#!/usr/bin/env bash

source scripts/utils.sh

CHANNEL_NAME=${1:-"mychannel"}
CC_NAME=${2}
CC_SRC_PATH=${3}
CC_SRC_LANGUAGE=${4}
CC_VERSION=${5:-"1.0"}
CC_SEQUENCE=${6:-"1"}
CC_INIT_FCN=${7:-"NA"}
CC_END_POLICY=${8:-"NA"}
CC_COLL_CONFIG=${9:-"NA"}
DELAY=${10:-"3"}
MAX_RETRY=${11:-"5"}
VERBOSE=${12:-"false"}

println "executing with the following"
println "- CHANNEL_NAME: ${C_GREEN}${CHANNEL_NAME}${C_RESET}"
println "- CC_NAME: ${C_GREEN}${CC_NAME}${C_RESET}"
println "- CC_SRC_PATH: ${C_GREEN}${CC_SRC_PATH}${C_RESET}"
println "- CC_SRC_LANGUAGE: ${C_GREEN}${CC_SRC_LANGUAGE}${C_RESET}"
println "- CC_VERSION: ${C_GREEN}${CC_VERSION}${C_RESET}"
println "- CC_SEQUENCE: ${C_GREEN}${CC_SEQUENCE}${C_RESET}"
println "- CC_END_POLICY: ${C_GREEN}${CC_END_POLICY}${C_RESET}"
println "- CC_COLL_CONFIG: ${C_GREEN}${CC_COLL_CONFIG}${C_RESET}"
println "- CC_INIT_FCN: ${C_GREEN}${CC_INIT_FCN}${C_RESET}"
println "- DELAY: ${C_GREEN}${DELAY}${C_RESET}"
println "- MAX_RETRY: ${C_GREEN}${MAX_RETRY}${C_RESET}"
println "- VERBOSE: ${C_GREEN}${VERBOSE}${C_RESET}"

INIT_REQUIRED="--init-required"
# check if the init fcn should be called
if [ "$CC_INIT_FCN" = "NA" ]; then
  INIT_REQUIRED=""
fi

if [ "$CC_END_POLICY" = "NA" ]; then
  CC_END_POLICY=""
else
  CC_END_POLICY="--signature-policy $CC_END_POLICY"
fi

if [ "$CC_COLL_CONFIG" = "NA" ]; then
  CC_COLL_CONFIG=""
else
  CC_COLL_CONFIG="--collections-config $CC_COLL_CONFIG"
fi

FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg/

# import utils
. scripts/envVar.sh
. scripts/ccutils.sh

function checkPrereqs() {
  jq --version > /dev/null 2>&1

  if [[ $? -ne 0 ]]; then
    errorln "jq command not found..."
    errorln
    errorln "Follow the instructions in the Fabric docs to install the prereqs"
    errorln "https://hyperledger-fabric.readthedocs.io/en/latest/prereqs.html"
    exit 1
  fi
}

# 读取网络配置
function readNetworkConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    infoln "Reading network configuration from $config_file"
    
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      errorln "Invalid JSON format in $config_file"
      exit 1
    fi
    
    # 读取组织信息 - 注意：不要覆盖envVar.sh中已经设置的变量
    # 这些变量已经在envVar.sh的loadNetworkConfig中正确设置了
    # NETWORK_ORGS, NETWORK_ORG_MSPS, NETWORK_ORG_PORTS, NETWORK_ORG_DOMAINS 等
    
    # 只检查组织数量以确保配置有效
    local temp_orgs=($(jq -r '.network.organizations[].name' "$config_file"))
    
    if [[ ${#temp_orgs[@]} -eq 0 ]]; then
      errorln "No organizations found in $config_file"
      exit 1
    fi
    
    infoln "Found ${#temp_orgs[@]} organizations: ${temp_orgs[*]}"
    return 0
  else
    warnln "Network config file $config_file not found, using default org1/org2 configuration"
    # 这里也不要覆盖，让envVar.sh处理默认配置
    return 1
  fi
}

# 生成MSP检查参数数组
function generateMspCheckArgs() {
  local approved_index=$1
  local msp_args=()
  
  for i in "${!NETWORK_ORG_MSPS[@]}"; do
    local status="false"
    if [[ $i -le $approved_index ]]; then
      status="true"
    fi
    msp_args+=("\"${NETWORK_ORG_MSPS[$i]}\": $status")
  done
  
  echo "${msp_args[@]}"
}

# 动态获取组织索引（用于向下兼容envVar.sh）
function getOrgIndex() {
  local org_name=$1
  
  # 如果使用动态配置，返回组织在数组中的索引+1
  for i in "${!NETWORK_ORGS[@]}"; do
    if [[ "${NETWORK_ORGS[$i]}" == "$org_name" ]]; then
      echo $((i+1))
      return
    fi
  done
  
  # 如果没找到，尝试默认映射
      local org_name_lower=$(echo "${org_name}" | tr '[:upper:]' '[:lower:]')
    case "${org_name_lower}" in
    "org1"|"central") echo 1 ;;
    "org2"|"a1") echo 2 ;;
    "org3"|"b1") echo 3 ;;
    *) echo 1 ;;  # 默认返回1
  esac
}

#check for prerequisites
checkPrereqs

# 读取网络配置
readNetworkConfig

## package the chaincode
./scripts/packageCC.sh $CC_NAME $CC_SRC_PATH $CC_SRC_LANGUAGE $CC_VERSION 

PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)

## Install chaincode on all peer organizations
for i in "${!NETWORK_ORGS[@]}"; do
  org_name="${NETWORK_ORGS[$i]}"
  org_index=$((i+1))
  
  infoln "Installing chaincode on peer0.${org_name}..."
  installChaincode $org_index
done

resolveSequence

## query whether the chaincode is installed (on first org)
queryInstalled 1

## approve the definition for each org sequentially
for i in "${!NETWORK_ORGS[@]}"; do
  org_name="${NETWORK_ORGS[$i]}"
  org_index=$((i+1))
  
  infoln "Approving chaincode definition for ${org_name}..."
  approveForMyOrg $org_index
done

## check commit readiness after all approvals
msp_args=($(generateMspCheckArgs $((${#NETWORK_ORGS[@]}-1))))
infoln "Checking commit readiness after all approvals..."

# 检查所有组织的commit readiness
for i in "${!NETWORK_ORGS[@]}"; do
  org_index=$((i+1))
  checkCommitReadiness $org_index "${msp_args[@]}"
done

## now that we know for sure all orgs have approved, commit the definition
infoln "Committing chaincode definition..."
org_indices=""
for i in "${!NETWORK_ORGS[@]}"; do
  org_indices="$org_indices $((i+1))"
done
commitChaincodeDefinition $org_indices

## query on all orgs to see that the definition committed successfully
for i in "${!NETWORK_ORGS[@]}"; do
  org_index=$((i+1))
  queryCommitted $org_index
done

## Invoke the chaincode - this does require that the chaincode have the 'initLedger'
## method defined
if [ "$CC_INIT_FCN" = "NA" ]; then
  infoln "Chaincode initialization is not required"
else
  infoln "Initializing chaincode..."
  chaincodeInvokeInit $org_indices
fi

exit 0
