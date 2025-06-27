#!/usr/bin/env bash

# imports  
. scripts/envVar.sh

CHANNEL_NAME="$1"
DELAY="$2"
MAX_RETRY="$3"
VERBOSE="$4"
: ${CHANNEL_NAME:="mychannel"}
: ${DELAY:="3"}
: ${MAX_RETRY:="5"}
: ${VERBOSE:="false"}

: ${CONTAINER_CLI:="docker"}
if command -v ${CONTAINER_CLI}-compose > /dev/null 2>&1; then
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI}-compose"}
else
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI} compose"}
fi
infoln "Using ${CONTAINER_CLI} and ${CONTAINER_CLI_COMPOSE}"

if [ ! -d "channel-artifacts" ]; then
	mkdir channel-artifacts
fi

# 读取网络配置
function readNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    infoln "Reading network configuration from $config_file for channel operations"
    
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      errorln "Invalid JSON format in $config_file"
      exit 1
    fi
    
    # 读取组织信息
    NETWORK_ORGS=($(jq -r '.network.organizations[].name' "$config_file"))
    NETWORK_ORG_MSPS=($(jq -r '.network.organizations[].msp_id' "$config_file"))
    
    if [[ ${#NETWORK_ORGS[@]} -eq 0 ]]; then
      errorln "No organizations found in $config_file"
      exit 1
    fi
    
    infoln "Found ${#NETWORK_ORGS[@]} organizations for channel operations: ${NETWORK_ORGS[*]}"
    return 0
  else
    warnln "Network config file $config_file not found, using default org1/org2 configuration"
    NETWORK_ORGS=("org1" "org2")
    NETWORK_ORG_MSPS=("Org1MSP" "Org2MSP")
    return 1
  fi
}

createChannelGenesisBlock() {
  setGlobals 1
	which configtxgen
	if [ "$?" -ne 0 ]; then
		fatalln "configtxgen tool not found."
	fi
	set -x
	configtxgen -profile ChannelUsingRaft -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
	res=$?
	{ set +x; } 2>/dev/null
  verifyResult $res "Failed to generate channel configuration transaction..."
}

createChannel() {
	# Poll in case the raft leader is not set yet
	local rc=1
	local COUNTER=1
	infoln "Adding orderers"
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
		sleep $DELAY
		set -x
    . scripts/orderer.sh ${CHANNEL_NAME}> /dev/null 2>&1
		res=$?
		{ set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
	cat log.txt
	verifyResult $res "Channel creation failed"
}

# joinChannel ORG_INDEX
joinChannel() {
  local ORG_INDEX=$1
  FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg/
  setGlobals $ORG_INDEX
	local rc=1
	local COUNTER=1
	## Sometimes Join takes time, hence retry
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
    sleep $DELAY
    set -x
    peer channel join -b $BLOCKFILE >&log.txt
    res=$?
    { set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
	cat log.txt
	
	# 动态构建组织名称用于日志输出
	local org_name="unknown"
	if [[ $ORG_INDEX -le ${#NETWORK_ORGS[@]} ]]; then
	  org_name="${NETWORK_ORGS[$((ORG_INDEX-1))]}"
	fi
	
	verifyResult $res "After $MAX_RETRY attempts, peer0.${org_name} has failed to join channel '$CHANNEL_NAME' "
}

setAnchorPeer() {
  local ORG_INDEX=$1
  . scripts/setAnchorPeer.sh $ORG_INDEX $CHANNEL_NAME 
}

# 读取网络配置
readNetworkConfig

## Create channel genesis block
FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg/
BLOCKFILE="./channel-artifacts/${CHANNEL_NAME}.block"

infoln "Generating channel genesis block '${CHANNEL_NAME}.block'"
FABRIC_CFG_PATH=${PWD}/configtx
createChannelGenesisBlock

## Create channel
infoln "Creating channel ${CHANNEL_NAME}"
createChannel
successln "Channel '$CHANNEL_NAME' created"

## Join all the peer organizations to the channel
for i in "${!NETWORK_ORGS[@]}"; do
  org_name="${NETWORK_ORGS[$i]}"
  org_index=$((i+1))
  
  infoln "Joining ${org_name} peer to the channel..."
  joinChannel $org_index
done

## Set the anchor peers for each org in the channel
for i in "${!NETWORK_ORGS[@]}"; do
  org_name="${NETWORK_ORGS[$i]}"
  org_index=$((i+1))
  
  infoln "Setting anchor peer for ${org_name}..."
  setAnchorPeer $org_index
done

successln "Channel '$CHANNEL_NAME' joined by all organizations"
