#!/usr/bin/env bash
#
# CBDC网络 - Chaincode as a Service 部署脚本
# 基于 Hyperledger Fabric 示例脚本修改
# 支持动态组织配置
#
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
#

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
println() { echo -e "$1"; }
infoln() { echo -e "${BLUE}$1${NC}"; }
successln() { echo -e "${GREEN}$1${NC}"; }
warnln() { echo -e "${YELLOW}$1${NC}"; }
errorln() { echo -e "${RED}$1${NC}"; }
fatalln() { errorln "$1"; exit 1; }

# 参数配置
CHANNEL_NAME=${1:-"cbdc-channel"}
CC_NAME=${2}
CC_SRC_PATH=${3}
CCAAS_DOCKER_RUN=${4:-"true"}
CC_VERSION=${5:-"1.0"}
CC_SEQUENCE=${6:-"1"}
CC_INIT_FCN=${7:-"NA"}
CC_END_POLICY=${8:-"NA"}
CC_COLL_CONFIG=${9:-"NA"}
DELAY=${10:-"3"}
MAX_RETRY=${11:-"5"}
VERBOSE=${12:-"false"}

CCAAS_SERVER_PORT=9999

: ${CONTAINER_CLI:="docker"}
if command -v ${CONTAINER_CLI}-compose > /dev/null 2>&1; then
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI}-compose"}
else
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI} compose"}
fi
infoln "Using ${CONTAINER_CLI} and ${CONTAINER_CLI_COMPOSE}"

println "executing with the following"
println "- CHANNEL_NAME: ${GREEN}${CHANNEL_NAME}${NC}"
println "- CC_NAME: ${GREEN}${CC_NAME}${NC}"
println "- CC_SRC_PATH: ${GREEN}${CC_SRC_PATH}${NC}"
println "- CC_VERSION: ${GREEN}${CC_VERSION}${NC}"
println "- CC_SEQUENCE: ${GREEN}${CC_SEQUENCE}${NC}"
println "- CC_END_POLICY: ${GREEN}${CC_END_POLICY}${NC}"
println "- CC_COLL_CONFIG: ${GREEN}${CC_COLL_CONFIG}${NC}"
println "- CC_INIT_FCN: ${GREEN}${CC_INIT_FCN}${NC}"
println "- CCAAS_DOCKER_RUN: ${GREEN}${CCAAS_DOCKER_RUN}${NC}"
println "- DELAY: ${GREEN}${DELAY}${NC}"
println "- MAX_RETRY: ${GREEN}${MAX_RETRY}${NC}"
println "- VERBOSE: ${GREEN}${VERBOSE}${NC}"

# 读取网络配置
CONFIG_FILE="$NETWORK_DIR/configtx/network-config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    fatalln "网络配置文件不存在: $CONFIG_FILE"
fi

# 参数验证
if [ -z "$CC_NAME" ] || [ "$CC_NAME" = "NA" ]; then
    fatalln "未提供链码名称。使用示例: $0 cbdc-channel cbdc-token ./chaincode"
elif [ -z "$CC_SRC_PATH" ] || [ "$CC_SRC_PATH" = "NA" ]; then
    fatalln "未提供链码路径。使用示例: $0 cbdc-channel cbdc-token ./chaincode"
elif [ ! -d "$CC_SRC_PATH" ]; then
    fatalln "链码路径不存在: $CC_SRC_PATH"
fi

# 背书策略和集合配置处理
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

# 设置环境变量
export FABRIC_CFG_PATH="$NETWORK_DIR/configtx"
export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/centralbank.cbdc.com/tlsca/tlsca.centralbank.cbdc.com-cert.pem"

# 导入工具函数
source "$NETWORK_DIR/scripts/cbdc-utils.sh"

# 读取组织信息
get_organizations() {
    local organizations=()
    
    # 添加央行
    organizations+=("CentralBank")
    
    # 添加所有银行
    local banks_count=$(jq '.network.banks | length' "$CONFIG_FILE")
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$CONFIG_FILE")
        organizations+=("$bank_name")
    done
    
    echo "${organizations[@]}"
}

# 设置组织环境变量
setup_org_env() {
    local org_name=$1
    
    if [ "$org_name" = "CentralBank" ]; then
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/tlsca/tlsca.centralbank.cbdc.com-cert.pem"
        export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
        export CORE_PEER_ADDRESS=localhost:7051
    else
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_LOCALMSPID="${org_name}MSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${org_name}.cbdc.com/tlsca/tlsca.${org_name}.cbdc.com-cert.pem"
        export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${org_name}.cbdc.com/users/Admin@${org_name}.cbdc.com/msp"
        
        # 根据组织名称设置端口
        local port=$(jq -r ".network.banks[] | select(.name==\"$org_name\") | .peer.port" "$CONFIG_FILE")
        export CORE_PEER_ADDRESS=localhost:$port
    fi
}

# 打包链码
packageChaincode() {
    infoln "开始打包 CaaS 链码..."
    
    address="{{.peername}}_${CC_NAME}_ccaas:${CCAAS_SERVER_PORT}"
    prefix=$(basename "$0")
    tempdir=$(mktemp -d -t "$prefix.XXXXXXXX") || fatalln "创建临时目录失败"
    label=${CC_NAME}_${CC_VERSION}
    mkdir -p "$tempdir/src"

    cat > "$tempdir/src/connection.json" <<CONN_EOF
{
  "address": "${address}",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN_EOF

    mkdir -p "$tempdir/pkg"

    cat << METADATA-EOF > "$tempdir/pkg/metadata.json"
{
    "type": "ccaas",
    "label": "$label"
}
METADATA-EOF

    tar -C "$tempdir/src" -czf "$tempdir/pkg/code.tar.gz" .
    tar -C "$tempdir/pkg" -czf "$CC_NAME.tar.gz" metadata.json code.tar.gz
    rm -Rf "$tempdir"

    PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
    
    successln "链码包已创建: ${CC_NAME}.tar.gz"
    successln "Package ID: $PACKAGE_ID"
    successln "服务地址: ${address}"
}

# 构建Docker镜像
buildDockerImages() {
    if [ "$CCAAS_DOCKER_RUN" = "true" ]; then
        infoln "构建 Chaincode-as-a-Service Docker 镜像 '${CC_NAME}' '${CC_SRC_PATH}'"
        infoln "这可能需要几分钟时间..."
        
        set -x
        ${CONTAINER_CLI} build -f $CC_SRC_PATH/Dockerfile -t ${CC_NAME}_ccaas_image:latest --build-arg CC_SERVER_PORT=9999 $CC_SRC_PATH
        res=$?
        { set +x; } 2>/dev/null
        
        if [ $res -ne 0 ]; then
            fatalln "Docker 镜像构建失败"
        fi
        
        successln "Docker 镜像构建成功: '${CC_NAME}_ccaas_image:latest'"
    else
        infoln "跳过 Docker 镜像构建"
        infoln "构建命令: ${CONTAINER_CLI} build -f $CC_SRC_PATH/Dockerfile -t ${CC_NAME}_ccaas_image:latest --build-arg CC_SERVER_PORT=9999 $CC_SRC_PATH"
    fi
}

# 安装链码到指定组织
installChaincodeToOrg() {
    local org_name=$1
    
    infoln "安装链码到组织 $org_name..."
    setup_org_env "$org_name"
    
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
    res=$?
    
    if [ $res -ne 0 ]; then
        fatalln "链码安装到组织 $org_name 失败"
    fi
    
    successln "链码安装到组织 $org_name 成功"
}

# 批准链码定义
approveForOrg() {
    local org_name=$1
    
    infoln "组织 $org_name 批准链码定义..."
    setup_org_env "$org_name"
    
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID "$CHANNEL_NAME" \
        --name "$CC_NAME" \
        --version "$CC_VERSION" \
        --package-id "$PACKAGE_ID" \
        --sequence "$CC_SEQUENCE" \
        $CC_END_POLICY $CC_COLL_CONFIG
    
    res=$?
    if [ $res -ne 0 ]; then
        fatalln "组织 $org_name 批准链码定义失败"
    fi
    
    successln "组织 $org_name 批准链码定义成功"
}

# 检查提交准备状态
checkCommitReadiness() {
    local org_name=$1
    
    infoln "检查组织 $org_name 的提交准备状态..."
    setup_org_env "$org_name"
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID "$CHANNEL_NAME" \
        --name "$CC_NAME" \
        --version "$CC_VERSION" \
        --sequence "$CC_SEQUENCE" \
        --output json \
        $CC_END_POLICY $CC_COLL_CONFIG
}

# 提交链码定义
commitChaincodeDefinition() {
    infoln "提交链码定义到频道..."
    
    # 使用央行身份提交
    setup_org_env "CentralBank"
    
    # 构建所有组织的peer连接参数
    local organizations=($(get_organizations))
    local peer_conn_params=""
    
    for org in "${organizations[@]}"; do
        if [ "$org" = "CentralBank" ]; then
            peer_conn_params="$peer_conn_params --peerAddresses localhost:7051"
            peer_conn_params="$peer_conn_params --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/tlsca/tlsca.centralbank.cbdc.com-cert.pem"
        else
            local port=$(jq -r ".network.banks[] | select(.name==\"$org\") | .peer.port" "$CONFIG_FILE")
            peer_conn_params="$peer_conn_params --peerAddresses localhost:$port"
            peer_conn_params="$peer_conn_params --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/${org}.cbdc.com/tlsca/tlsca.${org}.cbdc.com-cert.pem"
        fi
    done
    
    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID "$CHANNEL_NAME" \
        --name "$CC_NAME" \
        --version "$CC_VERSION" \
        --sequence "$CC_SEQUENCE" \
        $peer_conn_params \
        $CC_END_POLICY $CC_COLL_CONFIG
    
    res=$?
    if [ $res -ne 0 ]; then
        fatalln "链码定义提交失败"
    fi
    
    successln "链码定义提交成功"
}

# 启动链码服务容器
startDockerContainer() {
    if [ "$CCAAS_DOCKER_RUN" = "true" ]; then
        infoln "启动 Chaincode-as-a-Service Docker 容器..."
        
        local organizations=($(get_organizations))
        local network_name="fabric_cbdc"
        
        for org in "${organizations[@]}"; do
            local container_name="${org}_${CC_NAME}_ccaas"
            
            infoln "启动容器: $container_name"
            
            ${CONTAINER_CLI} run --rm -d --name "$container_name" \
                --network "$network_name" \
                -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:${CCAAS_SERVER_PORT} \
                -e CHAINCODE_ID=$PACKAGE_ID \
                -e CORE_CHAINCODE_ID_NAME=$PACKAGE_ID \
                ${CC_NAME}_ccaas_image:latest
            
            res=$?
            if [ $res -ne 0 ]; then
                fatalln "启动容器 $container_name 失败"
            fi
            
            successln "容器 $container_name 启动成功"
        done
    else
        infoln "跳过启动 Docker 容器"
        local organizations=($(get_organizations))
        for org in "${organizations[@]}"; do
            local container_name="${org}_${CC_NAME}_ccaas"
            infoln "应该启动的容器: $container_name"
        done
    fi
}

# 查询已提交的链码
queryCommitted() {
    local org_name=$1
    
    infoln "查询组织 $org_name 的已提交链码..."
    setup_org_env "$org_name"
    
    peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME"
}

# 初始化链码
chaincodeInvokeInit() {
    infoln "初始化链码..."
    
    # 使用央行身份初始化
    setup_org_env "CentralBank"
    
    # 构建所有组织的peer连接参数
    local organizations=($(get_organizations))
    local peer_conn_params=""
    
    for org in "${organizations[@]}"; do
        if [ "$org" = "CentralBank" ]; then
            peer_conn_params="$peer_conn_params --peerAddresses localhost:7051"
            peer_conn_params="$peer_conn_params --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/tlsca/tlsca.centralbank.cbdc.com-cert.pem"
        else
            local port=$(jq -r ".network.banks[] | select(.name==\"$org\") | .peer.port" "$CONFIG_FILE")
            peer_conn_params="$peer_conn_params --peerAddresses localhost:$port"
            peer_conn_params="$peer_conn_params --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/${org}.cbdc.com/tlsca/tlsca.${org}.cbdc.com-cert.pem"
        fi
    done
    
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
        --tls --cafile "$ORDERER_CA" \
        -C "$CHANNEL_NAME" \
        -n "$CC_NAME" \
        $peer_conn_params \
        --isInit \
        -c "$CC_INIT_FCN"
    
    res=$?
    if [ $res -ne 0 ]; then
        fatalln "链码初始化失败"
    fi
    
    successln "链码初始化成功"
}

# 主要执行流程
main() {
    infoln "=== CBDC 网络 CaaS 链码部署开始 ==="
    
    # 1. 构建Docker镜像
    buildDockerImages
    
    # 2. 打包链码
    packageChaincode
    
    # 3. 获取组织列表并安装链码
    local organizations=($(get_organizations))
    infoln "检测到 ${#organizations[@]} 个组织: ${organizations[*]}"
    
    for org in "${organizations[@]}"; do
        installChaincodeToOrg "$org"
    done
    
    # 4. 各组织批准链码定义
    for org in "${organizations[@]}"; do
        approveForOrg "$org"
    done
    
    # 5. 检查提交准备状态
    infoln "检查所有组织的提交准备状态..."
    for org in "${organizations[@]}"; do
        checkCommitReadiness "$org"
    done
    
    # 6. 提交链码定义
    commitChaincodeDefinition
    
    # 7. 查询提交结果
    for org in "${organizations[@]}"; do
        queryCommitted "$org"
    done
    
    # 8. 启动链码服务容器
    startDockerContainer
    
    # 9. 初始化链码（如果需要）
    if [ "$CC_INIT_FCN" = "NA" ]; then
        infoln "链码不需要初始化"
    else
        chaincodeInvokeInit
    fi
    
    successln "=== CBDC 网络 CaaS 链码部署完成 ==="
}

# 执行主函数
main

exit 0
