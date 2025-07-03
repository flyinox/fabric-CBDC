#!/usr/bin/env bash

source scripts/utils.sh

# 读取网络配置
function loadNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      warnln "Invalid JSON format in $config_file, using defaults"
      return 1
    fi
    
    # 读取orderer配置
    ORDERER_DOMAIN=$(jq -r '.network.orderer.domain // "example.com"' "$config_file")
    
    # 读取组织信息
    NETWORK_ORGS=($(jq -r '.network.organizations[].name' "$config_file"))
    NETWORK_ORG_MSPS=($(jq -r '.network.organizations[].msp_id' "$config_file"))
    NETWORK_ORG_DOMAINS=($(jq -r '.network.organizations[].domain' "$config_file"))
    NETWORK_ORG_PORTS=($(jq -r '.network.organizations[].peer.port' "$config_file"))
    
    return 0
  else
    # 使用默认配置
    ORDERER_DOMAIN="example.com"
    NETWORK_ORGS=("org1" "org2")
    NETWORK_ORG_MSPS=("Org1MSP" "Org2MSP")
    NETWORK_ORG_DOMAINS=("org1.example.com" "org2.example.com")
    NETWORK_ORG_PORTS=("7051" "9051")
    return 1
  fi
}

# 获取组织名称
function getOrgName() {
  local org_index=$1
  
  # 如果传入的是数字索引（从0开始）
  if [[ "$org_index" =~ ^[0-9]+$ ]]; then
    if [[ $org_index -ge 0 && $org_index -lt ${#NETWORK_ORGS[@]} ]]; then
      echo "${NETWORK_ORGS[$org_index]}"
    else
      echo "org${org_index}"  # 默认后备名称
    fi
  else
    # 如果传入的是组织名称，直接返回
    echo "$org_index"
  fi
}

# 初始化网络配置
loadNetworkConfig

# installChaincode PEER ORG
function installChaincode() {
  ORG=$1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  
  set -x
  peer lifecycle chaincode queryinstalled --output json | jq -r 'try (.installed_chaincodes[].package_id)' | grep ^${PACKAGE_ID}$ >&log.txt
  if test $? -ne 0; then
    peer lifecycle chaincode install ${CC_NAME}.tar.gz >&log.txt
    res=$?
  fi
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode installation on peer0.${org_name} has failed"
  successln "Chaincode is installed on peer0.${org_name}"
}

# queryInstalled PEER ORG
function queryInstalled() {
  ORG=$1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  
  set -x
  peer lifecycle chaincode queryinstalled --output json | jq -r 'try (.installed_chaincodes[].package_id)' | grep ^${PACKAGE_ID}$ >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Query installed on peer0.${org_name} has failed"
  successln "Query installed successful on peer0.${org_name} on channel"
}

# approveForMyOrg VERSION PEER ORG
function approveForMyOrg() {
  ORG=$1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  local orderer_hostname="orderer.${ORDERER_DOMAIN}"
  
  set -x
  peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride $orderer_hostname --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode definition approved on peer0.${org_name} on channel '$CHANNEL_NAME' failed"
  successln "Chaincode definition approved on peer0.${org_name} on channel '$CHANNEL_NAME'"
}

# checkCommitReadiness VERSION PEER ORG
function checkCommitReadiness() {
  ORG=$1
  shift 1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  
  infoln "Checking the commit readiness of the chaincode definition on peer0.${org_name} on channel '$CHANNEL_NAME'..."
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -le $MAX_RETRY ]; do
    # 第一次不需要等待
    if [ $COUNTER -gt 1 ]; then
      sleep $DELAY
      infoln "Attempting to check the commit readiness of the chaincode definition on peer0.${org_name}, Retry after $DELAY seconds."
    fi
    set -x
    peer lifecycle chaincode checkcommitreadiness --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} --output json >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    let rc=0
    for var in "$@"; do
      grep "$var" log.txt &>/dev/null || let rc=1
    done
    # 如果成功，立即退出循环
    if [ $rc -eq 0 ]; then
      break
    fi
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -eq 0; then
    infoln "Checking the commit readiness of the chaincode definition successful on peer0.${org_name} on channel '$CHANNEL_NAME'"
  else
    fatalln "After $MAX_RETRY attempts, Check commit readiness result on peer0.${org_name} is INVALID!"
  fi
}

# commitChaincodeDefinition VERSION PEER ORG (PEER ORG)...
function commitChaincodeDefinition() {
  parsePeerConnectionParameters $@
  res=$?
  verifyResult $res "Invoke transaction failed on channel '$CHANNEL_NAME' due to uneven number of peer and org parameters "

  local orderer_hostname="orderer.${ORDERER_DOMAIN}"
  
  # while 'peer chaincode' command can get the orderer endpoint from the
  # peer (if join was successful), let's supply it directly as we know
  # it using the "-o" option
  set -x
  peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride $orderer_hostname --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} "${PEER_CONN_PARMS[@]}" --version ${CC_VERSION} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode definition commit failed on channel '$CHANNEL_NAME'"
  successln "Chaincode definition committed on channel '$CHANNEL_NAME'"
}

# queryCommitted ORG
function queryCommitted() {
  ORG=$1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  
  EXPECTED_RESULT="Version: ${CC_VERSION}, Sequence: ${CC_SEQUENCE}, Endorsement Plugin: escc, Validation Plugin: vscc"
  infoln "Querying chaincode definition on peer0.${org_name} on channel '$CHANNEL_NAME'..."
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -le $MAX_RETRY ]; do
    # 第一次不需要等待
    if [ $COUNTER -gt 1 ]; then
      sleep $DELAY
      infoln "Attempting to Query committed status on peer0.${org_name}, Retry after $DELAY seconds."
    fi
    set -x
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name ${CC_NAME} >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    test $res -eq 0 && VALUE=$(cat log.txt | grep -o '^Version: '$CC_VERSION', Sequence: [0-9]*, Endorsement Plugin: escc, Validation Plugin: vscc')
    test "$VALUE" = "$EXPECTED_RESULT" && let rc=0
    # 如果成功，立即退出循环
    if [ $rc -eq 0 ]; then
      break
    fi
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -eq 0; then
    successln "Query chaincode definition successful on peer0.${org_name} on channel '$CHANNEL_NAME'"
  else
    fatalln "After $MAX_RETRY attempts, Query chaincode definition result on peer0.${org_name} is INVALID!"
  fi
}

function chaincodeInvokeInit() {
  parsePeerConnectionParameters $@
  res=$?
  verifyResult $res "Invoke transaction failed on channel '$CHANNEL_NAME' due to uneven number of peer and org parameters "

  local orderer_hostname="orderer.${ORDERER_DOMAIN}"
  local rc=1
  local COUNTER=1
  local fcn_call='{"function":"'${CC_INIT_FCN}'","Args":[]}'
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    # while 'peer chaincode' command can get the orderer endpoint from the
    # peer (if join was successful), let's supply it directly as we know
    # it using the "-o" option
    set -x
    infoln "invoke fcn call:${fcn_call}"
    peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride $orderer_hostname --tls --cafile "$ORDERER_CA" -C $CHANNEL_NAME -n ${CC_NAME} "${PEER_CONN_PARMS[@]}" --isInit -c "${fcn_call}" >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  verifyResult $res "Invoke execution on $PEERS failed "
  successln "Invoke transaction successful on $PEERS on channel '$CHANNEL_NAME'"
}

function chaincodeQuery() {
  ORG=$1
  setGlobals $ORG
  local org_name=$(getOrgName $ORG)
  
  infoln "Querying on peer0.${org_name} on channel '$CHANNEL_NAME'..."
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    infoln "Attempting to Query peer0.${org_name}, Retry after $DELAY seconds."
    set -x
    peer chaincode query -C $CHANNEL_NAME -n ${CC_NAME} -c '{"Args":["org.hyperledger.fabric:GetMetadata"]}' >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -eq 0; then
    successln "Query successful on peer0.${org_name} on channel '$CHANNEL_NAME'"
  else
    fatalln "After $MAX_RETRY attempts, Query result on peer0.${org_name} is INVALID!"
  fi
}

function resolveSequence() {

  #if the sequence is not "auto", then use the provided sequence
  if [[ "${CC_SEQUENCE}" != "auto" ]]; then
    return 0
  fi

  local rc=1
  local COUNTER=1
  # first, find the sequence number of the committed chaincode
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    set -x
    COMMITTED_CC_SEQUENCE=$(peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name ${CC_NAME} | sed -n "/Version:/{s/.*Sequence: //; s/, Endorsement Plugin:.*$//; p;}")
    res=$?
    { set +x; } 2>/dev/null
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done

  # if there are no committed versions, then set the sequence to 1
  if [ -z $COMMITTED_CC_SEQUENCE ]; then
    CC_SEQUENCE=1
    return 0
  fi

  rc=1
  COUNTER=1
  # next, find the sequence number of the approved chaincode
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    set -x
    APPROVED_CC_SEQUENCE=$(peer lifecycle chaincode queryapproved --channelID $CHANNEL_NAME --name ${CC_NAME} | sed -n "/sequence:/{s/^sequence: //; s/, version:.*$//; p;}")
    res=$?
    { set +x; } 2>/dev/null
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done

  # if the committed sequence and the approved sequence match, then increment the sequence
  # otherwise, use the approved sequence
  if [ $COMMITTED_CC_SEQUENCE == $APPROVED_CC_SEQUENCE ]; then
    CC_SEQUENCE=$((COMMITTED_CC_SEQUENCE+1))
  else
    CC_SEQUENCE=$APPROVED_CC_SEQUENCE
  fi

}

#. scripts/envVar.sh

queryInstalledOnPeer() {

  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    #sleep $DELAY
    #infoln "Attempting to list on peer0.org${ORG}, Retry after $DELAY seconds."
    peer lifecycle chaincode queryinstalled >&log.txt
    res=$?
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
}

queryCommittedOnChannel() {
  CHANNEL=$1
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    #sleep $DELAY
    #infoln "Attempting to list on peer0.org${ORG}, Retry after $DELAY seconds."
    peer lifecycle chaincode querycommitted -C $CHANNEL >&log.txt
    res=$?
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -ne 0; then
    fatalln "After $MAX_RETRY attempts, Failed to retrieve committed chaincode!"
  fi

}

## Function to list chaincodes installed on the peer and committed chaincode visible to the org
listAllCommitted() {

  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    CHANNEL_LIST=$(peer channel list | sed '1,1d')
    res=$?
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  if test $rc -eq 0; then
    for channel in $CHANNEL_LIST
    do
      queryCommittedOnChannel "$channel"
    done
  else
    fatalln "After $MAX_RETRY attempts, Failed to retrieve committed chaincode!"
  fi

}

chaincodeInvoke() {
  ORG=$1
  CHANNEL=$2
  CC_NAME_LOCAL=$3
  CC_INVOKE_CONSTRUCTOR=$4
  local org_name=$(getOrgName $ORG)
  
  infoln "Invoking on peer0.${org_name} on channel '$CHANNEL'..."
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    infoln "Attempting to Invoke on peer0.${org_name}, Retry after $DELAY seconds."
    
    # 动态构建peer连接参数
    local peer_conn_params=""
    
    # 检查是否是CBDC链码，如果是则只使用央行peer
    if [[ "${CC_NAME_LOCAL}" == "cbdc" ]]; then
      # 只使用央行peer进行背书
      local central_org_index=0  # CentralBank通常是第一个组织
      local org_port="${NETWORK_ORG_PORTS[$central_org_index]}"
      local org_domain="${NETWORK_ORG_DOMAINS[$central_org_index]}"
      local ca_path="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
      
      peer_conn_params="--peerAddresses localhost:${org_port} --tlsRootCertFiles $ca_path"
    else
      # 其他链码使用所有peer
      for i in "${!NETWORK_ORGS[@]}"; do
        local org_port="${NETWORK_ORG_PORTS[$i]}"
        local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
        local ca_path="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
        
        peer_conn_params="$peer_conn_params --peerAddresses localhost:${org_port} --tlsRootCertFiles $ca_path"
      done
    fi
    
    set -x
    peer chaincode invoke -o localhost:7050 -C $CHANNEL -n ${CC_NAME_LOCAL} -c "${CC_INVOKE_CONSTRUCTOR}" --tls --cafile $ORDERER_CA $peer_conn_params >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(($COUNTER + 1))
  done
  cat log.txt
  if test $rc -eq 0; then
    successln "Invoke successful on peer0.${org_name} on channel '$CHANNEL'"
  else
    fatalln "After $MAX_RETRY attempts, Invoke result on peer0.${org_name} is INVALID!"
  fi
}

chaincodeQuery() {
  ORG=$1
  CHANNEL=$2
  CC_NAME_LOCAL=$3
  CC_QUERY_CONSTRUCTOR=$4
  USER_NAME=${5:-"admin"}  # 可选的用户参数，默认为admin
  local org_name=$(getOrgName $ORG)

  # 保存当前环境变量
  local current_org=$ORG
  local current_org_name=$org_name
  local original_user=$USER_NAME
  
  # 强制使用央行peer（通常是第一个组织）
  # 由于setGlobals函数期望从1开始的索引，我们需要传入1
  local central_org_index=1
  local central_org_name=$(getOrgName 0)  # 从0开始的索引获取名称
  
  # 获取正确的原始组织名称（ORG是从1开始的索引，需要转换为从0开始的索引）
  local actual_org_index=$((ORG - 1))
  local actual_org_name=$(getOrgName $actual_org_index)
  
  infoln "查询操作：使用央行peer (${central_org_name}) 进行查询..."
  infoln "原始请求组织: ${actual_org_name}"
  
  # 先设置原始组织环境（获取用户身份）
  setGlobals $current_org $original_user
  
  # 保存用户身份相关的环境变量
  local original_mspid=$CORE_PEER_LOCALMSPID
  local original_mspconfigpath=$CORE_PEER_MSPCONFIGPATH
  
  # 设置央行peer连接信息，但保持原始用户身份
  local central_org_domain="${NETWORK_ORG_DOMAINS[0]}"
  local central_org_port="${NETWORK_ORG_PORTS[0]}"
  local central_org_name_upper=$(echo "${central_org_name}" | tr '[:lower:]' '[:upper:]')
  local central_ca_var_name="PEER0_${central_org_name_upper}_CA"
  
  # 更新peer连接信息为央行peer，但保持原始用户身份
  export CORE_PEER_ADDRESS="localhost:${central_org_port}"
  if [[ -n "${!central_ca_var_name}" ]]; then
    export CORE_PEER_TLS_ROOTCERT_FILE="${!central_ca_var_name}"
  else
    export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${central_org_domain}/tlsca/tlsca.${central_org_domain}-cert.pem"
  fi
  
  infoln "Querying on peer0.${central_org_name} on channel '$CHANNEL' with user identity from ${actual_org_name}..."
  local rc=1
  local COUNTER=1
  # continue to poll
  # we either get a successful response, or reach MAX RETRY
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    infoln "Attempting to Query peer0.${central_org_name}, Retry after $DELAY seconds."
    set -x
    peer chaincode query -C $CHANNEL -n ${CC_NAME_LOCAL} -c "${CC_QUERY_CONSTRUCTOR}" >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(($COUNTER + 1))
  done
  cat log.txt
  if test $rc -eq 0; then
    successln "Query successful on peer0.${central_org_name} on channel '$CHANNEL'"
  else
    fatalln "After $MAX_RETRY attempts, Query result on peer0.${central_org_name} is INVALID!"
  fi
  
  # 恢复原始环境变量
  setGlobals $current_org $original_user
}