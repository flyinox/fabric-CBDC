#!/bin/bash

# CBDC 网络实用工具函数
# 包含链码管理、交易处理等具体实现

# 设置脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# ============ 链码管理实现 ============

# 实际打包链码
package_chaincode_impl() {
    local chaincode_name=$1
    local chaincode_path=$2
    local version=$3
    local chaincode_lang=${4:-golang}
    
    print_message $BLUE "开始打包链码 $chaincode_name..."
    
    # 检查链码目录
    if [ ! -d "$chaincode_path" ]; then
        print_message $RED "链码目录不存在: $chaincode_path"
        return 1
    fi
    
    # 创建链码包目录
    local package_dir="$NETWORK_DIR/chaincode-packages"
    mkdir -p "$package_dir"
    
    # 设置环境变量
    export FABRIC_CFG_PATH="$NETWORK_DIR/configtx"
    
    # 打包链码
    local package_file="$package_dir/${chaincode_name}_${version}.tar.gz"
    
    print_message $BLUE "打包文件将保存为: $package_file"
    
    peer lifecycle chaincode package "$package_file" \
        --path "$chaincode_path" \
        --lang "$chaincode_lang" \
        --label "${chaincode_name}_${version}"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 链码打包成功: $package_file"
        return 0
    else
        print_message $RED "✗ 链码打包失败"
        return 1
    fi
}

# 实际安装链码
install_chaincode_impl() {
    local chaincode_name=$1
    local org_name=$2
    local version=$3
    
    print_message $BLUE "开始安装链码 $chaincode_name 到组织 $org_name..."
    
    # 检查链码包是否存在
    local package_dir="$NETWORK_DIR/chaincode-packages"
    local package_file="$package_dir/${chaincode_name}_${version}.tar.gz"
    
    if [ ! -f "$package_file" ]; then
        print_message $RED "链码包不存在: $package_file"
        print_message $YELLOW "请先运行: chaincode package"
        return 1
    fi
    
    # 读取网络配置
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "网络配置文件不存在"
        return 1
    fi
    
    # 设置组织环境变量
    setup_org_env "$org_name" || return 1
    
    # 安装链码
    print_message $BLUE "安装链码包..."
    peer lifecycle chaincode install "$package_file"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 链码安装成功"
        
        # 查询安装结果
        print_message $BLUE "查询已安装的链码..."
        peer lifecycle chaincode queryinstalled
        
        return 0
    else
        print_message $RED "✗ 链码安装失败"
        return 1
    fi
}

# 实际部署链码
deploy_chaincode_impl() {
    local chaincode_name=$1
    local channel_name=$2
    local version=$3
    local init_required=${4:-false}
    local init_args=${5:-"{}"}
    
    print_message $BLUE "开始部署链码 $chaincode_name 到频道 $channel_name..."
    
    # 读取网络配置
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "网络配置文件不存在"
        return 1
    fi
    
    local sequence=${6:-1}
    
    # 获取链码包ID
    local package_id=$(get_chaincode_package_id "$chaincode_name" "$version")
    if [ -z "$package_id" ]; then
        print_message $RED "无法获取链码包ID，请确保链码已安装"
        return 1
    fi
    
    print_message $BLUE "链码包ID: $package_id"
    
    # 设置央行环境变量（作为部署者）
    setup_org_env "CentralBank" || return 1
    
    # 步骤1: 批准链码定义
    print_message $BLUE "步骤 1/3: 批准链码定义..."
    
    if [ "$init_required" = "true" ]; then
        peer lifecycle chaincode approveformyorg \
            -o localhost:7050 \
            --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
            --tls --cafile "$ORDERER_CA" \
            --channelID "$channel_name" \
            --name "$chaincode_name" \
            --version "$version" \
            --package-id "$package_id" \
            --sequence "$sequence" \
            --init-required
    else
        peer lifecycle chaincode approveformyorg \
            -o localhost:7050 \
            --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
            --tls --cafile "$ORDERER_CA" \
            --channelID "$channel_name" \
            --name "$chaincode_name" \
            --version "$version" \
            --package-id "$package_id" \
            --sequence "$sequence"
    fi
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ 央行批准链码定义失败"
        return 1
    fi
    
    print_message $GREEN "✓ 央行批准链码定义成功"
    
    # 为所有银行批准链码定义
    local banks_count=$(jq '.network.banks | length' "$config_file")
    
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        
        print_message $BLUE "为银行 $bank_name 批准链码定义..."
        
        setup_org_env "$bank_name" || continue
        
        if [ "$init_required" = "true" ]; then
            peer lifecycle chaincode approveformyorg \
                -o localhost:7050 \
                --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
                --tls --cafile "$ORDERER_CA" \
                --channelID "$channel_name" \
                --name "$chaincode_name" \
                --version "$version" \
                --package-id "$package_id" \
                --sequence "$sequence" \
                --init-required
        else
            peer lifecycle chaincode approveformyorg \
                -o localhost:7050 \
                --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
                --tls --cafile "$ORDERER_CA" \
                --channelID "$channel_name" \
                --name "$chaincode_name" \
                --version "$version" \
                --package-id "$package_id" \
                --sequence "$sequence"
        fi
        
        if [ $? -eq 0 ]; then
            print_message $GREEN "✓ 银行 $bank_name 批准链码定义成功"
        else
            print_message $YELLOW "⚠ 银行 $bank_name 批准链码定义失败"
        fi
    done
    
    # 步骤2: 检查提交准备状态
    print_message $BLUE "步骤 2/3: 检查提交准备状态..."
    
    setup_org_env "CentralBank" || return 1
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID "$channel_name" \
        --name "$chaincode_name" \
        --version "$version" \
        --sequence "$sequence" \
        --output json \
        $([ "$init_required" = "true" ] && echo "--init-required")
    
    # 步骤3: 提交链码定义
    print_message $BLUE "步骤 3/3: 提交链码定义..."
    
    # 构建所有组织的TLS证书参数
    local peer_conn_parms=""
    local tlsrootcert_files=""
    
    # 添加央行
    peer_conn_parms="--peerAddresses localhost:7051 --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    
    # 添加银行
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_domain=$(echo "${bank_name}" | tr '[:upper:]' '[:lower:]').cbdc.com
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        
        peer_conn_parms="$peer_conn_parms --peerAddresses localhost:${bank_port} --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/peers/peer0.${bank_domain}/tls/ca.crt"
    done
    
    if [ "$init_required" = "true" ]; then
        peer lifecycle chaincode commit \
            -o localhost:7050 \
            --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
            --tls --cafile "$ORDERER_CA" \
            --channelID "$channel_name" \
            --name "$chaincode_name" \
            --version "$version" \
            --sequence "$sequence" \
            --init-required \
            $peer_conn_parms
    else
        peer lifecycle chaincode commit \
            -o localhost:7050 \
            --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
            --tls --cafile "$ORDERER_CA" \
            --channelID "$channel_name" \
            --name "$chaincode_name" \
            --version "$version" \
            --sequence "$sequence" \
            $peer_conn_parms
    fi
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 链码部署成功"
        
        # 如果需要初始化，执行初始化
        if [ "$init_required" = "true" ]; then
            print_message $BLUE "执行链码初始化..."
            
            peer chaincode invoke \
                -o localhost:7050 \
                --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
                --tls --cafile "$ORDERER_CA" \
                -C "$channel_name" \
                -n "$chaincode_name" \
                --isInit \
                -c "$init_args" \
                $peer_conn_parms
            
            if [ $? -eq 0 ]; then
                print_message $GREEN "✓ 链码初始化成功"
            else
                print_message $YELLOW "⚠ 链码初始化失败，但部署已完成"
            fi
        fi
        
        # 查询已提交的链码
        print_message $BLUE "查询已提交的链码..."
        peer lifecycle chaincode querycommitted --channelID "$channel_name"
        
        return 0
    else
        print_message $RED "✗ 链码部署失败"
        return 1
    fi
}

# ============ 交易管理实现 ============

# 实际调用交易
invoke_transaction_impl() {
    local chaincode_name=$1
    local channel_name=$2
    local function_name=$3
    shift 3
    local args=("$@")
    
    print_message $BLUE "调用链码交易..."
    print_message $BLUE "链码: $chaincode_name, 频道: $channel_name, 函数: $function_name"
    print_message $BLUE "参数: ${args[*]}"
    
    # 构建参数字符串
    local args_str='{"Args":["'$function_name'"'
    for arg in "${args[@]}"; do
        args_str="$args_str,\"$arg\""
    done
    args_str="$args_str]}"
    
    print_message $BLUE "调用参数: $args_str"
    
    # 设置央行环境变量
    setup_org_env "CentralBank" || return 1
    
    # 构建peer连接参数
    local peer_conn_parms=$(build_peer_connection_params)
    
    # 调用交易
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.centralbank.cbdc.com \
        --tls --cafile "$ORDERER_CA" \
        -C "$channel_name" \
        -n "$chaincode_name" \
        -c "$args_str" \
        $peer_conn_parms
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 交易调用成功"
        return 0
    else
        print_message $RED "✗ 交易调用失败"
        return 1
    fi
}

# 实际查询交易
query_transaction_impl() {
    local chaincode_name=$1
    local channel_name=$2
    local function_name=$3
    shift 3
    local args=("$@")
    
    print_message $BLUE "查询链码..."
    print_message $BLUE "链码: $chaincode_name, 频道: $channel_name, 函数: $function_name"
    print_message $BLUE "参数: ${args[*]}"
    
    # 构建参数字符串
    local args_str='{"Args":["'$function_name'"'
    for arg in "${args[@]}"; do
        args_str="$args_str,\"$arg\""
    done
    args_str="$args_str]}"
    
    print_message $BLUE "查询参数: $args_str"
    
    # 设置央行环境变量
    setup_org_env "CentralBank" || return 1
    
    # 查询
    peer chaincode query \
        -C "$channel_name" \
        -n "$chaincode_name" \
        -c "$args_str"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 查询成功"
        return 0
    else
        print_message $RED "✗ 查询失败"
        return 1
    fi
}

# ============ 辅助函数 ============

# 设置组织环境变量
setup_org_env() {
    local org_name=$1
    
    # 读取网络配置
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "网络配置文件不存在"
        return 1
    fi
    
    export FABRIC_CFG_PATH="$NETWORK_DIR/configtx"
    export CORE_PEER_TLS_ENABLED=true
    export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/centralbank.cbdc.com/orderers/orderer.centralbank.cbdc.com/msp/tlscacerts/tlsca.centralbank.cbdc.com-cert.pem"
    
    if [ "$org_name" = "CentralBank" ]; then
        export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
        export CORE_PEER_ADDRESS="localhost:7051"
    else
        # 查找银行信息
        local banks_count=$(jq '.network.banks | length' "$config_file")
        local found=false
        
        for ((i=0; i<banks_count; i++)); do
            local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
            if [ "$bank_name" = "$org_name" ]; then
                local bank_domain=$(echo "${bank_name}" | tr '[:upper:]' '[:lower:]').cbdc.com
                local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
                
                export CORE_PEER_LOCALMSPID="${bank_name}MSP"
                export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/peers/peer0.${bank_domain}/tls/ca.crt"
                export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/users/Admin@${bank_domain}/msp"
                export CORE_PEER_ADDRESS="localhost:${bank_port}"
                
                found=true
                break
            fi
        done
        
        if [ "$found" = false ]; then
            print_message $RED "未找到组织: $org_name"
            return 1
        fi
    fi
    
    return 0
}

# 获取链码包ID
get_chaincode_package_id() {
    local chaincode_name=$1
    local version=$2
    
    # 设置央行环境变量
    setup_org_env "CentralBank" || return 1
    
    # 查询已安装的链码并提取包ID
    local package_id=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[] | select(.label=="'${chaincode_name}_${version}'") | .package_id')
    
    echo "$package_id"
}

# 构建peer连接参数
build_peer_connection_params() {
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    local peer_conn_parms=""
    
    # 添加央行
    peer_conn_parms="--peerAddresses localhost:7051 --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    
    # 添加银行
    local banks_count=$(jq '.network.banks | length' "$config_file")
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_domain=$(echo "${bank_name}" | tr '[:upper:]' '[:lower:]').cbdc.com
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        
        peer_conn_parms="$peer_conn_parms --peerAddresses localhost:${bank_port} --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/peers/peer0.${bank_domain}/tls/ca.crt"
    done
    
    echo "$peer_conn_parms"
}

# 列出已安装的链码实现
list_chaincodes_impl() {
    print_message $BLUE "查询已安装的链码..."
    
    # 设置央行环境变量
    setup_org_env "CentralBank" || return 1
    
    print_message $BLUE "已安装的链码包:"
    peer lifecycle chaincode queryinstalled
    
    print_message $BLUE "已提交的链码定义:"
    # 需要知道频道名
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ -f "$config_file" ]; then
        local channel_name=$(jq -r '.network.channel_name' "$config_file")
        peer lifecycle chaincode querycommitted --channelID "$channel_name"
    else
        print_message $YELLOW "无法获取频道名称，请提供频道名称"
    fi
}

# 获取链码当前序列号
get_current_chaincode_sequence() {
    local chaincode_name=$1
    local channel_name=$2
    
    # 设置央行环境变量
    setup_org_env "CentralBank" || return 1
    
    # 查询已提交的链码并提取序列号
    local sequence=$(peer lifecycle chaincode querycommitted --channelID "$channel_name" --output json 2>/dev/null | jq -r '.chaincode_definitions[] | select(.name=="'$chaincode_name'") | .sequence // 0')
    
    # 如果没有找到，返回0
    if [ -z "$sequence" ] || [ "$sequence" = "null" ]; then
        sequence=0
    fi
    
    echo "$sequence"
} 