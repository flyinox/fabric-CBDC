#!/usr/bin/env bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

# This is a collection of bash functions used by different scripts

# imports
# test network home var targets to test-network folder
# the reason we use a var here is to accommodate scenarios
# where execution occurs from folders outside of default as $PWD.
# For setting environment variables, simple relative paths like ".." could lead to unintended references
# due to how they interact with FABRIC_CFG_PATH. It's advised to specify paths more explicitly,
# such as using "../${PWD}", to ensure that Fabric's environment variables are pointing to the correct paths.
TEST_NETWORK_HOME=${TEST_NETWORK_HOME:-$(pwd)}
. ${TEST_NETWORK_HOME}/scripts/utils.sh

export CORE_PEER_TLS_ENABLED=true

# 动态读取网络配置
function loadNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      errorln "Invalid JSON format in $config_file"
      return 1
    fi
    
    # 读取orderer配置
    ORDERER_DOMAIN=$(jq -r '.network.orderer.domain // "example.com"' "$config_file")
    
    # 读取组织信息
    NETWORK_ORGS=($(jq -r '.network.organizations[].name' "$config_file"))
    NETWORK_ORG_MSPS=($(jq -r '.network.organizations[].msp_id' "$config_file"))
    NETWORK_ORG_DOMAINS=($(jq -r '.network.organizations[].domain' "$config_file"))
    NETWORK_ORG_PORTS=($(jq -r '.network.organizations[].peer.port' "$config_file"))
    
    # 设置orderer CA
    export ORDERER_CA=${TEST_NETWORK_HOME}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/tlsca/tlsca.${ORDERER_DOMAIN}-cert.pem
    
    # 动态设置peer CA变量
    for i in "${!NETWORK_ORGS[@]}"; do
      local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
      local org_name_upper=$(echo "${NETWORK_ORGS[$i]}" | tr '[:lower:]' '[:upper:]')
      local var_name="PEER0_${org_name_upper}_CA"
      export "$var_name"="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
    done
    
    # 为向下兼容设置传统变量名
    if [[ ${#NETWORK_ORGS[@]} -ge 1 ]]; then
      export PEER0_ORG1_CA="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${NETWORK_ORG_DOMAINS[0]}/tlsca/tlsca.${NETWORK_ORG_DOMAINS[0]}-cert.pem"
    fi
    if [[ ${#NETWORK_ORGS[@]} -ge 2 ]]; then
      export PEER0_ORG2_CA="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${NETWORK_ORG_DOMAINS[1]}/tlsca/tlsca.${NETWORK_ORG_DOMAINS[1]}-cert.pem"
    fi
    
    return 0
  else
    # 使用默认配置
    export ORDERER_CA=${TEST_NETWORK_HOME}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
    export PEER0_ORG1_CA=${TEST_NETWORK_HOME}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
    export PEER0_ORG2_CA=${TEST_NETWORK_HOME}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem
    
    # 设置默认配置变量
    NETWORK_ORGS=("org1" "org2")
    NETWORK_ORG_MSPS=("Org1MSP" "Org2MSP")
    NETWORK_ORG_DOMAINS=("org1.example.com" "org2.example.com")
    NETWORK_ORG_PORTS=("7051" "9051")
    ORDERER_DOMAIN="example.com"
    
    return 1
  fi
}

# 初始化网络配置
loadNetworkConfig

# Set environment variables for the peer org
setGlobals() {
  local USING_ORG=""
  local USING_USER="admin"  # 默认使用admin用户
  
  if [ -z "$OVERRIDE_ORG" ]; then
    USING_ORG=$1
  else
    USING_ORG="${OVERRIDE_ORG}"
  fi
  
  # 如果提供了第二个参数，则使用指定的用户
  if [ -n "$2" ]; then
    USING_USER=$2
  fi
  
  infoln "Using organization ${USING_ORG} with user ${USING_USER}"
  
  # 查找组织索引
  local org_index=-1
  if [[ "$USING_ORG" =~ ^[0-9]+$ ]]; then
    # 如果是数字，直接使用索引
    org_index=$((USING_ORG - 1))
  else
    # 如果是组织名称，查找索引
    for i in "${!NETWORK_ORGS[@]}"; do
      if [[ "${NETWORK_ORGS[$i]}" == "$USING_ORG" ]]; then
        org_index=$i
        break
      fi
    done
  fi
  
  # 向下兼容：处理传统的数字索引
  if [[ $org_index -eq -1 ]]; then
    if [[ "$USING_ORG" =~ ^[0-9]+$ ]]; then
      org_index=$((USING_ORG - 1))
    else
      # 尝试默认映射
      local org_lower=$(echo "${USING_ORG}" | tr '[:upper:]' '[:lower:]')
      case "${org_lower}" in
        "org1"|"central") org_index=0 ;;
        "org2"|"a1") org_index=1 ;;
        "org3"|"b1") org_index=2 ;;
        *) org_index=0 ;;  # 默认使用第一个组织
      esac
    fi
  fi
  
  # 检查索引有效性
  if [[ $org_index -lt 0 || $org_index -ge ${#NETWORK_ORGS[@]} ]]; then
    errorln "ORG Unknown: $USING_ORG (index: $org_index, available orgs: ${NETWORK_ORGS[*]})"
    return 1
  fi
  
  # 设置环境变量
  local org_name="${NETWORK_ORGS[$org_index]}"
  local org_msp="${NETWORK_ORG_MSPS[$org_index]}"
  local org_domain="${NETWORK_ORG_DOMAINS[$org_index]}"
  local org_port="${NETWORK_ORG_PORTS[$org_index]}"
  
  # 根据用户选择动态设置证书路径
  local cert_user=""
  case "${USING_USER}" in
    "admin")
      cert_user="Admin"
      ;;
    user[0-9]*)
      # 动态处理用户，如 user1 -> User1, user2 -> User2
      local user_num="${USING_USER#user}"
      cert_user="User${user_num}"
      ;;
    *)
      cert_user="Admin"  # 默认使用Admin
      warnln "Unknown user: ${USING_USER}, using Admin as default"
      ;;
  esac
  
  export CORE_PEER_LOCALMSPID="$org_msp"
  export CORE_PEER_MSPCONFIGPATH="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${org_domain}/users/${cert_user}@${org_domain}/msp"
  export CORE_PEER_ADDRESS="localhost:${org_port}"
  
  # 设置TLS根证书文件
  local org_name_upper=$(echo "${org_name}" | tr '[:lower:]' '[:upper:]')
  local ca_var_name="PEER0_${org_name_upper}_CA"
  if [[ -n "${!ca_var_name}" ]]; then
    export CORE_PEER_TLS_ROOTCERT_FILE="${!ca_var_name}"
  else
    # 后备方案
    export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK_HOME}/organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
  fi

  if [ "$VERBOSE" = "true" ]; then
    env | grep CORE
  fi
}

# parsePeerConnectionParameters $@
# Helper function that sets the peer connection parameters for a chaincode
# operation
parsePeerConnectionParameters() {
  PEER_CONN_PARMS=()
  PEERS=""
  while [ "$#" -gt 0 ]; do
    setGlobals $1
    
    # 动态构建peer名称
    local org_index=$1
    if [[ "$1" =~ ^[0-9]+$ ]]; then
      org_index=$((1 - 1))
    else
      # 根据组织名查找索引
      for i in "${!NETWORK_ORGS[@]}"; do
        if [[ "${NETWORK_ORGS[$i]}" == "$1" ]]; then
          org_index=$i
          break
        fi
      done
    fi
    
    local peer_name="peer0.${NETWORK_ORGS[$org_index]}"
    
    ## Set peer addresses
    if [ -z "$PEERS" ]
    then
	PEERS="$peer_name"
    else
	PEERS="$PEERS $peer_name"
    fi
    PEER_CONN_PARMS=("${PEER_CONN_PARMS[@]}" --peerAddresses $CORE_PEER_ADDRESS)
    
    ## Set path to TLS certificate
    PEER_CONN_PARMS=("${PEER_CONN_PARMS[@]}" --tlsRootCertFiles "$CORE_PEER_TLS_ROOTCERT_FILE")
    
    # shift by one to get to the next organization
    shift
  done
}

verifyResult() {
  if [ $1 -ne 0 ]; then
    fatalln "$2"
  fi
}
