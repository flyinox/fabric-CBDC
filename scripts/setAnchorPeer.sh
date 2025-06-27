#!/usr/bin/env bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# import utils
# test network home var targets to test network folder
TEST_NETWORK_HOME=${TEST_NETWORK_HOME:-${PWD}}
. ${TEST_NETWORK_HOME}/scripts/configUpdate.sh

# 读取网络配置
function readNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      errorln "Invalid JSON format in $config_file"
      return 1
    fi
    
    # 读取组织信息
    NETWORK_ORGS=($(jq -r '.network.organizations[].name' "$config_file"))
    NETWORK_ORG_MSPS=($(jq -r '.network.organizations[].msp_id' "$config_file"))
    NETWORK_ORG_DOMAINS=($(jq -r '.network.organizations[].domain' "$config_file"))
    NETWORK_ORG_PORTS=($(jq -r '.network.organizations[].peer.port' "$config_file"))
    
    if [[ ${#NETWORK_ORGS[@]} -eq 0 ]]; then
      errorln "No organizations found in $config_file"
      return 1
    fi
    
    return 0
  else
    # 使用默认配置
    NETWORK_ORGS=("org1" "org2")
    NETWORK_ORG_MSPS=("Org1MSP" "Org2MSP")
    NETWORK_ORG_DOMAINS=("org1.example.com" "org2.example.com")
    NETWORK_ORG_PORTS=("7051" "9051")
    return 1
  fi
}

# NOTE: This requires jq and configtxlator for execution.
createAnchorPeerUpdate() {
  infoln "Fetching channel config for channel $CHANNEL_NAME"
  fetchChannelConfig $ORG $CHANNEL_NAME ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}config.json

  infoln "Generating anchor peer update transaction for organization index $ORG on channel $CHANNEL_NAME"

  # 动态获取主机名和端口
  local HOST=""
  local PORT=""
  local org_index=$((ORG - 1))
  
  if [[ $org_index -ge 0 && $org_index -lt ${#NETWORK_ORGS[@]} ]]; then
    HOST="peer0.${NETWORK_ORG_DOMAINS[$org_index]}"
    PORT="${NETWORK_ORG_PORTS[$org_index]}"
    infoln "Setting anchor peer for ${NETWORK_ORGS[$org_index]} (${NETWORK_ORG_MSPS[$org_index]}) at ${HOST}:${PORT}"
  else
    # 向下兼容的默认值
    if [ $ORG -eq 1 ]; then
      HOST="peer0.org1.example.com"
      PORT=7051
    elif [ $ORG -eq 2 ]; then
      HOST="peer0.org2.example.com"
      PORT=9051
    else
      errorln "Unknown organization index: $ORG (available: ${#NETWORK_ORGS[@]} organizations)"
      return 1
    fi
    warnln "Using default configuration for org $ORG: ${HOST}:${PORT}"
  fi

  set -x
  # Modify the configuration to append the anchor peer 
  jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}config.json > ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}modified_config.json
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Channel configuration update for anchor peer failed, make sure you have jq installed"
  

  # Compute a config update, based on the differences between 
  # {orgmsp}config.json and {orgmsp}modified_config.json, write
  # it as a transaction to {orgmsp}anchors.tx
  createConfigUpdate ${CHANNEL_NAME} ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}config.json ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}modified_config.json ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx
}

updateAnchorPeer() {
  # 动态获取orderer地址
  local orderer_address="localhost:7050"
  local orderer_hostname="orderer.example.com"
  
  # 如果有网络配置，使用动态orderer设置
  if [[ -f "network-config.json" ]]; then
    local orderer_domain=$(jq -r '.network.orderer.domain // "example.com"' "network-config.json")
    orderer_hostname="orderer.${orderer_domain}"
    infoln "Using dynamic orderer hostname: ${orderer_hostname}"
  else
    warnln "Using default orderer hostname: ${orderer_hostname}"
  fi
  
  peer channel update -o $orderer_address --ordererTLSHostnameOverride $orderer_hostname -c $CHANNEL_NAME -f ${TEST_NETWORK_HOME}/channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile "$ORDERER_CA" >&log.txt
  res=$?
  cat log.txt
  verifyResult $res "Anchor peer update failed"
  successln "Anchor peer set for org '$CORE_PEER_LOCALMSPID' on channel '$CHANNEL_NAME'"
}

ORG=$1
CHANNEL_NAME=$2

# 读取网络配置
readNetworkConfig

setGlobals $ORG

createAnchorPeerUpdate 

updateAnchorPeer
