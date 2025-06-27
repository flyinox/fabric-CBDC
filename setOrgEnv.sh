#!/usr/bin/env bash
#
# SPDX-License-Identifier: Apache-2.0

# default to using first organization
ORG=${1:-""}

# Exit on first error, print all commands.
set -e
set -o pipefail

# Where am I?
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# 读取网络配置
function loadNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      echo "Warning: Invalid JSON format in $config_file, using default configuration" >&2
      return 1
    fi
    
    # 读取orderer配置
    ORDERER_DOMAIN=$(jq -r '.network.orderer.domain // "example.com"' "$config_file")
    
    # 读取组织信息
    NETWORK_ORGS=($(jq -r '.network.organizations[].name' "$config_file"))
    NETWORK_ORG_MSPS=($(jq -r '.network.organizations[].msp_id' "$config_file"))
    NETWORK_ORG_DOMAINS=($(jq -r '.network.organizations[].domain' "$config_file"))
    NETWORK_ORG_PORTS=($(jq -r '.network.organizations[].peer.port' "$config_file"))
    
    if [[ ${#NETWORK_ORGS[@]} -gt 0 ]]; then
      # 如果没有指定组织，默认使用第一个
      if [[ -z "$ORG" ]]; then
        ORG="${NETWORK_ORGS[0]}"
      fi
      return 0
    fi
  fi
  
  # 使用默认配置
  ORDERER_DOMAIN="example.com"
  NETWORK_ORGS=("org1" "org2")
  NETWORK_ORG_MSPS=("Org1MSP" "Org2MSP")
  NETWORK_ORG_DOMAINS=("org1.example.com" "org2.example.com")
  NETWORK_ORG_PORTS=("7051" "9051")
  
  # 如果没有指定组织，默认使用Org1
  if [[ -z "$ORG" ]]; then
    ORG="Org1"
  fi
  
  return 1
}

# 查找组织配置
function findOrgConfig() {
  local org_name="$1"
  local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
  
  # 首先尝试精确匹配组织名
  for i in "${!NETWORK_ORGS[@]}"; do
    local network_org_lower=$(echo "${NETWORK_ORGS[$i]}" | tr '[:upper:]' '[:lower:]')
    if [[ "$network_org_lower" == "$org_lower" ]]; then
      ORG_INDEX=$i
      return 0
    fi
  done
  
  # 尝试匹配MSP ID
  for i in "${!NETWORK_ORG_MSPS[@]}"; do
    local msp_lower=$(echo "${NETWORK_ORG_MSPS[$i]}" | tr '[:upper:]' '[:lower:]')
    if [[ "$msp_lower" == "$org_lower" ]]; then
      ORG_INDEX=$i
      return 0
    fi
  done
  
  # 向下兼容：处理传统名称
  case "$org_lower" in
    "org1"|"digibank")
      if [[ ${#NETWORK_ORGS[@]} -ge 1 ]]; then
        ORG_INDEX=0
        return 0
      fi
      ;;
    "org2"|"magnetocorp")
      if [[ ${#NETWORK_ORGS[@]} -ge 2 ]]; then
        ORG_INDEX=1
        return 0
      fi
      ;;
  esac
  
  return 1
}

# 显示帮助信息
function showHelp() {
  echo "Usage: $0 [ORG_NAME]"
  echo ""
  echo "Set environment variables for connecting to a specific organization's peer."
  echo ""
  echo "Arguments:"
  echo "  ORG_NAME    Organization name or MSP ID (optional, defaults to first org)"
  echo ""
  echo "Available organizations:"
  for i in "${!NETWORK_ORGS[@]}"; do
    echo "  - ${NETWORK_ORGS[$i]} (${NETWORK_ORG_MSPS[$i]})"
  done
  echo ""
  echo "Examples:"
  echo "  $0                     # Use first organization"
  echo "  $0 ${NETWORK_ORGS[0]}"
  if [[ ${#NETWORK_ORGS[@]} -ge 2 ]]; then
    echo "  $0 ${NETWORK_ORGS[1]}"
  fi
  echo ""
  echo "To set the environment variables in your shell:"
  echo "  export \$(./setOrgEnv.sh ${NETWORK_ORGS[0]} | xargs)"
}

# 加载网络配置
loadNetworkConfig

# 处理帮助请求
if [[ "$ORG" == "-h" || "$ORG" == "--help" ]]; then
  showHelp
  exit 0
fi

# 查找组织配置
if ! findOrgConfig "$ORG"; then
  echo "Unknown organization \"$ORG\"" >&2
  echo "" >&2
  showHelp >&2
  exit 1
fi

# 获取组织配置
ORG_NAME="${NETWORK_ORGS[$ORG_INDEX]}"
ORG_MSP="${NETWORK_ORG_MSPS[$ORG_INDEX]}"
ORG_DOMAIN="${NETWORK_ORG_DOMAINS[$ORG_INDEX]}"
ORG_PORT="${NETWORK_ORG_PORTS[$ORG_INDEX]}"

# 设置证书路径
ORDERER_CA="${DIR}/test-network/organizations/ordererOrganizations/${ORDERER_DOMAIN}/tlsca/tlsca.${ORDERER_DOMAIN}-cert.pem"

# 动态设置所有组织的CA路径（为了向下兼容）
PEER_CA_VARS=""
for i in "${!NETWORK_ORGS[@]}"; do
  org_name="${NETWORK_ORGS[$i]}"
  org_domain="${NETWORK_ORG_DOMAINS[$i]}"
  var_name="PEER0_$(echo "${org_name}" | tr '[:lower:]' '[:upper:]')_CA"
  ca_path="${DIR}/test-network/organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
  
  # 使用eval动态设置变量
  eval "${var_name}=\"${ca_path}\""
  
  # 记录变量名，用于后续输出
  if [[ -n "$PEER_CA_VARS" ]]; then
    PEER_CA_VARS="$PEER_CA_VARS $var_name"
  else
    PEER_CA_VARS="$var_name"
  fi
done

# 向下兼容：设置传统变量名
if [[ ${#NETWORK_ORGS[@]} -ge 1 ]]; then
  PEER0_ORG1_CA="${DIR}/test-network/organizations/peerOrganizations/${NETWORK_ORG_DOMAINS[0]}/tlsca/tlsca.${NETWORK_ORG_DOMAINS[0]}-cert.pem"
fi
if [[ ${#NETWORK_ORGS[@]} -ge 2 ]]; then
  PEER0_ORG2_CA="${DIR}/test-network/organizations/peerOrganizations/${NETWORK_ORG_DOMAINS[1]}/tlsca/tlsca.${NETWORK_ORG_DOMAINS[1]}-cert.pem"
fi

# 设置选中组织的环境变量
CORE_PEER_LOCALMSPID="$ORG_MSP"
CORE_PEER_MSPCONFIGPATH="${DIR}/test-network/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
CORE_PEER_ADDRESS="localhost:${ORG_PORT}"
CORE_PEER_TLS_ROOTCERT_FILE="${DIR}/test-network/organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pem"

# 输出环境变量（用于 export $(./setOrgEnv.sh ORG | xargs) 方式）
echo "CORE_PEER_TLS_ENABLED=true"
echo "ORDERER_CA=${ORDERER_CA}"

# 输出所有组织的CA变量（向下兼容）
if [[ -n "$PEER0_ORG1_CA" ]]; then
  echo "PEER0_ORG1_CA=${PEER0_ORG1_CA}"
fi
if [[ -n "$PEER0_ORG2_CA" ]]; then
  echo "PEER0_ORG2_CA=${PEER0_ORG2_CA}"
fi

# 输出动态组织的CA变量
for var_name in $PEER_CA_VARS; do
  eval "echo \"${var_name}=\${${var_name}}\""
done

echo "CORE_PEER_MSPCONFIGPATH=${CORE_PEER_MSPCONFIGPATH}"
echo "CORE_PEER_ADDRESS=${CORE_PEER_ADDRESS}"
echo "CORE_PEER_TLS_ROOTCERT_FILE=${CORE_PEER_TLS_ROOTCERT_FILE}"
echo "CORE_PEER_LOCALMSPID=${CORE_PEER_LOCALMSPID}"
