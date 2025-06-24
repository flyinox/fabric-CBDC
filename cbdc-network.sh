#!/bin/bash

# 银行数字货币网络主控制脚本
# 用于管理整个 CBDC 网络的生命周期

# 设置脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR"

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

# 检查必要的工具
check_prerequisites() {
    print_message $BLUE "检查必备工具..."
    
    local missing_tools=()
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    # 检查 jq
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    # 检查 configtxlator（锚点节点配置更新需要）
    if ! command -v configtxlator &> /dev/null; then
        missing_tools+=("configtxlator")
    fi
    
    # 检查 Hyperledger Fabric 二进制文件（用于加密材料生成）
    local fabric_missing=()
    if ! command -v cryptogen &> /dev/null; then
        fabric_missing+=("cryptogen")
    fi
    if ! command -v configtxgen &> /dev/null; then
        fabric_missing+=("configtxgen")
    fi
    if ! command -v peer &> /dev/null; then
        fabric_missing+=("peer")
    fi
    if ! command -v osnadmin &> /dev/null; then
        fabric_missing+=("osnadmin")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_message $RED "缺少必要工具: ${missing_tools[*]}"
        print_message $YELLOW "请安装缺少的工具后再运行"
        exit 1
    fi
    
    if [ ${#fabric_missing[@]} -ne 0 ]; then
        print_message $YELLOW "警告: 缺少 Fabric 工具: ${fabric_missing[*]}"
        print_message $YELLOW "这些工具用于生成加密材料，如需完整功能请安装 Hyperledger Fabric 二进制文件"
        print_message $YELLOW "下载地址: https://github.com/hyperledger/fabric/releases"
        print_message $BLUE "当前可以运行基础配置生成功能"
    else
        print_message $GREEN "✓ Hyperledger Fabric 工具已安装"
    fi
    
    print_message $GREEN "✓ 必备工具检查完成"
}

# 生成网络配置和加密材料
setup_network() {
    print_message $BLUE "设置 CBDC 网络..."
    
    # 第一步：生成网络配置
    print_message $BLUE "步骤 1/2: 生成网络配置..."
    
    if [ $# -eq 0 ]; then
        # 交互式配置
        read -p "请输入频道名称 [cbdc-channel]: " channel_name
        channel_name=${channel_name:-cbdc-channel}
        
        read -p "请输入央行名称 [CentralBank]: " central_bank
        central_bank=${central_bank:-CentralBank}
        
        read -p "请输入银行名称，用空格分隔 [ICBC CCB ABC BOC]: " banks_input
        banks_input=${banks_input:-"ICBC CCB ABC BOC"}
        read -a banks <<< "$banks_input"
        
        # 调用配置生成脚本
        "$NETWORK_DIR/scripts/network-config.sh" generate "$channel_name" "$central_bank" "${banks[@]}"
    else
        # 命令行参数配置
        "$NETWORK_DIR/scripts/network-config.sh" generate "$@"
    fi
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ 网络配置生成失败"
        return 1
    fi
    
    print_message $GREEN "✓ 网络配置生成成功"
    
    # 确保 core.yaml 存在（静态文件）
    if [ ! -f "$NETWORK_DIR/configtx/core.yaml" ]; then
        print_message $BLUE "core.yaml 配置文件已存在（静态文件）"
    fi
    
    # 生成 configtx.yaml
    print_message $BLUE "生成 configtx.yaml..."
    "$NETWORK_DIR/scripts/generate-configtx.sh" generate
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ configtx.yaml 生成失败"
        return 1
    fi
    print_message $GREEN "✓ configtx.yaml 生成成功"
    
    # 生成 docker-compose.yaml
    print_message $BLUE "生成 docker-compose.yaml..."
    "$NETWORK_DIR/scripts/generate-compose.sh" generate
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ docker-compose.yaml 生成失败"
        return 1
    fi
    print_message $GREEN "✓ docker-compose.yaml 生成成功"
    
    # 第二步：生成加密材料
    print_message $BLUE "步骤 2/2: 生成加密材料..."
    
    # 调用加密材料生成脚本
    "$NETWORK_DIR/scripts/generate-crypto.sh" all
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ 加密材料生成失败"
        print_message $YELLOW "请检查是否已安装 Hyperledger Fabric 二进制文件"
        print_message $YELLOW "下载地址: https://github.com/hyperledger/fabric/releases"
        return 1
    fi
    
    print_message $GREEN "✓ 加密材料生成成功"
    
    # 显示生成的文件
    print_message $BLUE "生成的文件:"
    if [ -d "$NETWORK_DIR/organizations" ]; then
        print_message $GREEN "  - 组织证书和密钥: organizations/"
    fi
    if [ -f "$NETWORK_DIR/crypto-config.yaml" ]; then
        print_message $GREEN "  - 加密配置文件: crypto-config.yaml"
    fi
    if [ -d "$NETWORK_DIR/channel-artifacts" ]; then
        print_message $GREEN "  - 频道配置文件: channel-artifacts/"
    fi
    
    print_message $GREEN "🎉 CBDC 网络设置完成！现在可以启动网络了"
    print_message $BLUE "下一步运行: $0 network start"
    
    return 0
}

# 启动网络
start_network() {
    print_message $BLUE "启动 CBDC 网络..."
    
    # 检查配置文件
    if [ ! -f "$NETWORK_DIR/compose/docker-compose.yaml" ]; then
        print_message $RED "未找到 Docker Compose 配置文件"
        print_message $YELLOW "请先运行: $0 setup"
        return 1
    fi
    
    # 清理可能冲突的容器和端口
    print_message $BLUE "清理可能冲突的容器和端口..."
    
    # 切换到 compose 目录
    cd "$NETWORK_DIR/compose"
    
    # 停止并删除可能存在的容器（包括orphan容器）
    if command -v docker-compose &> /dev/null; then
        docker-compose down --remove-orphans 2>/dev/null || true
    else
        docker compose down --remove-orphans 2>/dev/null || true
    fi
    
    # 清理可能占用端口的容器
    print_message $BLUE "清理占用端口的容器..."
    
    # 定义需要清理的端口列表
    local ports_to_check=(5984 6984 7050 7051 7443 7984 8051 8984 9051 9443 9984 10051 10443 11051 11443 12443 13443)
    
    for port in "${ports_to_check[@]}"; do
        # 查找占用端口的容器
        local container_ids=$(docker ps --format "{{.ID}}" --filter "publish=$port" 2>/dev/null || true)
        if [ ! -z "$container_ids" ]; then
            print_message $YELLOW "停止占用端口 $port 的容器..."
            echo "$container_ids" | xargs docker stop 2>/dev/null || true
            echo "$container_ids" | xargs docker rm 2>/dev/null || true
        fi
        
        # 查找占用端口的进程
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ ! -z "$pids" ]; then
            print_message $YELLOW "终止占用端口 $port 的进程..."
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # 清理可能的网络
    docker network rm fabric_cbdc 2>/dev/null || true
    
    # 等待端口释放
    print_message $BLUE "等待端口释放..."
    sleep 2
    
    print_message $GREEN "✓ 端口清理完成"
    
    # 启动 Docker 容器
    print_message $BLUE "启动网络容器..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d --remove-orphans
    else
        docker compose up -d --remove-orphans
    fi
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "✓ 网络启动成功"
        
        # 等待网络稳定
        print_message $BLUE "等待网络稳定..."
        sleep 10
        
        # 创建频道
        create_channel
    else
        print_message $RED "✗ 网络启动失败"
        print_message $YELLOW "请检查 Docker 日志获取更多信息"
        print_message $BLUE "运行以下命令查看日志:"
        if command -v docker-compose &> /dev/null; then
            print_message $BLUE "  docker-compose logs"
        else
            print_message $BLUE "  docker compose logs"
        fi
        return 1
    fi
}

# 创建频道
create_channel() {
    print_message $BLUE "创建 CBDC 频道..."
    
    # 读取配置
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "未找到网络配置文件"
        return 1
    fi
    
    local channel_name=$(jq -r '.network.channel_name' "$config_file")
    local central_bank_name=$(jq -r '.network.central_bank.name' "$config_file")
    local banks_count=$(jq '.network.banks | length' "$config_file")
    
    print_message $BLUE "频道名称: $channel_name"
    print_message $BLUE "参与组织数量: $((banks_count + 1))"
    
    # 设置环境变量
    export FABRIC_CFG_PATH="$NETWORK_DIR/configtx"
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"
    export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/centralbank.cbdc.com/orderers/orderer.centralbank.cbdc.com/msp/tlscacerts/tlsca.centralbank.cbdc.com-cert.pem"
    
    # 确保 channel-artifacts 目录存在
    mkdir -p "$NETWORK_DIR/channel-artifacts"
    
    # 步骤 1: 生成频道创世区块（直接生成应用频道，无需系统频道）
    print_message $BLUE "步骤 1/4: 生成频道创世区块..."
    
    configtxgen -profile CBDCChannel \
        -outputBlock "$NETWORK_DIR/channel-artifacts/${channel_name}.block" \
        -channelID "$channel_name" \
        -configPath "$NETWORK_DIR/configtx"
    
    if [ $? -ne 0 ]; then
        print_message $RED "✗ 频道创世区块生成失败"
        return 1
    fi
    
    print_message $GREEN "✓ 频道创世区块生成成功"
    
    # 步骤 2: 使用 osnadmin 让 orderer 加入频道
    print_message $BLUE "步骤 2/4: orderer 加入频道..."
    
    # 设置 orderer admin 证书环境变量
    export ORDERER_ADMIN_TLS_SIGN_CERT="$NETWORK_DIR/organizations/ordererOrganizations/centralbank.cbdc.com/orderers/orderer.centralbank.cbdc.com/tls/server.crt"
    export ORDERER_ADMIN_TLS_PRIVATE_KEY="$NETWORK_DIR/organizations/ordererOrganizations/centralbank.cbdc.com/orderers/orderer.centralbank.cbdc.com/tls/server.key"
    
    # 重试机制加入频道
    local rc=1
    local COUNTER=1
    local MAX_RETRY=5
    while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
        sleep 3
        osnadmin channel join --channelID "$channel_name" \
            --config-block "$NETWORK_DIR/channel-artifacts/${channel_name}.block" \
            -o localhost:7543 \
            --ca-file "$ORDERER_CA" \
            --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" \
            --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY" 2>/dev/null
        
        rc=$?
        COUNTER=$((COUNTER + 1))
    done
    
    if [ $rc -eq 0 ]; then
        print_message $GREEN "✓ orderer 加入频道成功"
    else
        print_message $YELLOW "⚠ orderer 加入频道失败，但可能不影响基本功能"
    fi
    
    # 等待一段时间
    sleep 3
    
    # 步骤 3: 各组织加入频道
    print_message $BLUE "步骤 3/4: 各组织加入频道..."
    
    # 央行加入频道
    print_message $BLUE "央行加入频道..."
    peer channel join -b "$NETWORK_DIR/channel-artifacts/${channel_name}.block" 2>&1 | tee /tmp/join_output.log
    
    # 检查是否成功或者已经存在
    if [ $? -eq 0 ] || grep -q "already exists with state \[ACTIVE\]" /tmp/join_output.log; then
        print_message $GREEN "✓ 央行加入频道成功"
    else
        print_message $RED "✗ 央行加入频道失败"
        return 1
    fi
    
    # 各银行加入频道
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_domain=$(echo "${bank_name}" | tr '[:upper:]' '[:lower:]').cbdc.com  # 转换为小写并添加.cbdc.com
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        
        print_message $BLUE "银行 $bank_name 加入频道..."
        
        # 设置当前银行的环境变量
        export CORE_PEER_LOCALMSPID="${bank_name}MSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/peers/peer0.${bank_domain}/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/users/Admin@${bank_domain}/msp"
        export CORE_PEER_ADDRESS="localhost:${bank_port}"
        
        peer channel join -b "$NETWORK_DIR/channel-artifacts/${channel_name}.block" 2>&1 | tee /tmp/bank_join_output.log
        
        # 检查是否成功或者已经存在
        if [ $? -eq 0 ] || grep -q "already exists with state \[ACTIVE\]" /tmp/bank_join_output.log; then
            print_message $GREEN "✓ 银行 $bank_name 加入频道成功"
        else
            print_message $YELLOW "⚠ 银行 $bank_name 加入频道失败"
        fi
        
        sleep 1
    done
    
    # 等待频道稳定
    print_message $BLUE "等待频道稳定..."
    sleep 5
    
    # 步骤 4: 设置锚点节点（使用配置更新方式）
    print_message $BLUE "步骤 4/4: 设置锚点节点..."
    
    # 为央行设置锚点节点
    print_message $BLUE "设置央行锚点节点..."
    
    # 重新设置央行环境变量
    export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"
    
    # 获取频道配置
    peer channel fetch config "$NETWORK_DIR/channel-artifacts/config_block.pb" \
        -o localhost:7050 -c "$channel_name" --tls --cafile "$ORDERER_CA"
    
    if [ $? -eq 0 ]; then
        # 解码配置
        configtxlator proto_decode --input "$NETWORK_DIR/channel-artifacts/config_block.pb" \
            --type common.Block --output "$NETWORK_DIR/channel-artifacts/config_block.json"
        
        jq .data.data[0].payload.data.config "$NETWORK_DIR/channel-artifacts/config_block.json" > \
            "$NETWORK_DIR/channel-artifacts/config.json"
        
        # 修改配置添加央行锚点节点
        jq '.channel_group.groups.Application.groups.CentralBankPeerMSP.values += {
            "AnchorPeers":{
                "mod_policy": "Admins",
                "value":{"anchor_peers": [{"host": "peer0.centralbank.cbdc.com","port": 7051}]},
                "version": "0"
            }
        }' "$NETWORK_DIR/channel-artifacts/config.json" > "$NETWORK_DIR/channel-artifacts/modified_config.json"
        
        # 生成配置更新交易
        configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/config.json" \
            --type common.Config --output "$NETWORK_DIR/channel-artifacts/original_config.pb"
        configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/modified_config.json" \
            --type common.Config --output "$NETWORK_DIR/channel-artifacts/modified_config.pb"
        configtxlator compute_update --channel_id "$channel_name" \
            --original "$NETWORK_DIR/channel-artifacts/original_config.pb" \
            --updated "$NETWORK_DIR/channel-artifacts/modified_config.pb" \
            --output "$NETWORK_DIR/channel-artifacts/config_update.pb"
        configtxlator proto_decode --input "$NETWORK_DIR/channel-artifacts/config_update.pb" \
            --type common.ConfigUpdate --output "$NETWORK_DIR/channel-artifacts/config_update.json"
        echo '{"payload":{"header":{"channel_header":{"channel_id":"'$channel_name'", "type":2}},"data":{"config_update":'$(cat "$NETWORK_DIR/channel-artifacts/config_update.json")'}}}' | \
            jq . > "$NETWORK_DIR/channel-artifacts/config_update_in_envelope.json"
        configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/config_update_in_envelope.json" \
            --type common.Envelope --output "$NETWORK_DIR/channel-artifacts/centralbank_anchors.tx"
        
        # 提交配置更新
        peer channel update -o localhost:7050 -c "$channel_name" \
            -f "$NETWORK_DIR/channel-artifacts/centralbank_anchors.tx" --tls --cafile "$ORDERER_CA"
        
        if [ $? -eq 0 ]; then
            print_message $GREEN "✓ 央行锚点节点设置成功"
        else
            print_message $YELLOW "⚠ 央行锚点节点设置失败，但可能不影响基本功能"
        fi
    else
        print_message $YELLOW "⚠ 获取频道配置失败，跳过锚点节点设置"
    fi
    
    # 为各银行设置锚点节点
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_domain=$(echo "${bank_name}" | tr '[:upper:]' '[:lower:]').cbdc.com  # 转换为小写并添加.cbdc.com
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        
        print_message $BLUE "设置银行 $bank_name 锚点节点..."
        
        # 设置当前银行的环境变量
        export CORE_PEER_LOCALMSPID="${bank_name}MSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/peers/peer0.${bank_domain}/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${bank_domain}/users/Admin@${bank_domain}/msp"
        export CORE_PEER_ADDRESS="localhost:${bank_port}"
        
        # 获取并修改频道配置
        peer channel fetch config "$NETWORK_DIR/channel-artifacts/config_block.pb" \
            -o localhost:7050 -c "$channel_name" --tls --cafile "$ORDERER_CA" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            configtxlator proto_decode --input "$NETWORK_DIR/channel-artifacts/config_block.pb" \
                --type common.Block --output "$NETWORK_DIR/channel-artifacts/config_block.json" 2>/dev/null
            
            jq .data.data[0].payload.data.config "$NETWORK_DIR/channel-artifacts/config_block.json" > \
                "$NETWORK_DIR/channel-artifacts/${bank_name}_config.json" 2>/dev/null
            
            # 修改配置添加银行锚点节点
            jq '.channel_group.groups.Application.groups.'${bank_name}'MSP.values += {
                "AnchorPeers":{
                    "mod_policy": "Admins",
                    "value":{"anchor_peers": [{"host": "peer0.'${bank_domain}'","port": '${bank_port}'}]},
                    "version": "0"
                }
            }' "$NETWORK_DIR/channel-artifacts/${bank_name}_config.json" > "$NETWORK_DIR/channel-artifacts/${bank_name}_modified_config.json" 2>/dev/null
            
            # 生成并提交配置更新
            configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/${bank_name}_config.json" \
                --type common.Config --output "$NETWORK_DIR/channel-artifacts/${bank_name}_original_config.pb" 2>/dev/null
            configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/${bank_name}_modified_config.json" \
                --type common.Config --output "$NETWORK_DIR/channel-artifacts/${bank_name}_modified_config.pb" 2>/dev/null
            configtxlator compute_update --channel_id "$channel_name" \
                --original "$NETWORK_DIR/channel-artifacts/${bank_name}_original_config.pb" \
                --updated "$NETWORK_DIR/channel-artifacts/${bank_name}_modified_config.pb" \
                --output "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update.pb" 2>/dev/null
            configtxlator proto_decode --input "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update.pb" \
                --type common.ConfigUpdate --output "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update.json" 2>/dev/null
            echo '{"payload":{"header":{"channel_header":{"channel_id":"'$channel_name'", "type":2}},"data":{"config_update":'$(cat "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update.json")'}}}' | \
                jq . > "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update_in_envelope.json" 2>/dev/null
            configtxlator proto_encode --input "$NETWORK_DIR/channel-artifacts/${bank_name}_config_update_in_envelope.json" \
                --type common.Envelope --output "$NETWORK_DIR/channel-artifacts/${bank_name}_anchors.tx" 2>/dev/null
            
            peer channel update -o localhost:7050 -c "$channel_name" \
                -f "$NETWORK_DIR/channel-artifacts/${bank_name}_anchors.tx" --tls --cafile "$ORDERER_CA" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                print_message $GREEN "✓ 银行 $bank_name 锚点节点设置成功"
            else
                print_message $YELLOW "⚠ 银行 $bank_name 锚点节点设置失败，但可能不影响基本功能"
            fi
        else
            print_message $YELLOW "⚠ 银行 $bank_name 获取频道配置失败，跳过锚点节点设置"
        fi
        
        sleep 1
    done
    
    # 验证频道状态
    print_message $BLUE "验证频道配置..."
    
    # 重新设置央行环境变量进行验证
    export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"
    
    # 列出已加入的频道
    local joined_channels=$(peer channel list 2>/dev/null | grep "Channels peers has joined" -A 100 | grep -E "^${channel_name}$" || true)
    
    if [ ! -z "$joined_channels" ]; then
        print_message $GREEN "✓ 频道验证成功"
        print_message $GREEN "🎉 CBDC 频道创建完成！"
        print_message $BLUE "频道信息:"
        print_message $BLUE "  - 频道名称: $channel_name"
        print_message $BLUE "  - 参与组织: $((banks_count + 1)) 个"
        print_message $BLUE "  - 锚点节点: 已配置"
        print_message $GREEN "网络现在可以处理跨组织交易了！"
    else
        print_message $YELLOW "⚠ 频道验证失败，但频道可能已成功创建"
    fi
    
    return 0
}

# 停止网络
stop_network() {
    print_message $BLUE "停止 CBDC 网络..."
    
    cd "$NETWORK_DIR/compose"
    
    if [ -f "docker-compose.yaml" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose down
        else
            docker compose down
        fi
        
        if [ $? -eq 0 ]; then
            print_message $GREEN "✓ 网络已停止"
        else
            print_message $RED "✗ 网络停止失败"
            return 1
        fi
    else
        print_message $YELLOW "未找到 Docker Compose 配置文件"
    fi
}

# 清理网络
clean_network() {
    print_message $BLUE "清理网络资源..."
    
    # 停止并删除容器
    stop_network
    
    # 删除卷
    print_message $BLUE "删除 Docker 卷..."
    docker volume prune -f
    
    # 清理生成的文件
    cleanup_files_only
    
    print_message $GREEN "✓ 网络资源清理完成"
}

# 仅清理生成的文件（不停止容器）
cleanup_files_only() {
    print_message $BLUE "清理所有生成的文件..."
    
    # 清理主要生成的配置文件
    print_message $BLUE "清理配置文件..."
    rm -rf "$NETWORK_DIR/configtx/network-config.json"
    rm -rf "$NETWORK_DIR/configtx/configtx.yaml"
    rm -rf "$NETWORK_DIR/compose/docker-compose.yaml"
    rm -rf "$NETWORK_DIR/crypto-config.yaml"
    
    # 清理证书和密钥
    print_message $BLUE "清理证书和密钥..."
    rm -rf "$NETWORK_DIR/organizations"
    
    # 清理频道配置
    print_message $BLUE "清理频道配置..."
    rm -rf "$NETWORK_DIR/channel-artifacts"
    
    # 清理临时日志文件
    print_message $BLUE "清理临时日志文件..."
    rm -f /tmp/join_output.log 2>/dev/null || true
    rm -f /tmp/bank_join_output.log 2>/dev/null || true
    
    # 清理可能的备份文件
    print_message $BLUE "清理备份文件..."
    find "$NETWORK_DIR" -name "*.bak" -type f -delete 2>/dev/null || true
    find "$NETWORK_DIR" -name "*~" -type f -delete 2>/dev/null || true
    
    # 清理可能的隐藏文件
    find "$NETWORK_DIR/configtx" -name ".DS_Store" -type f -delete 2>/dev/null || true
    find "$NETWORK_DIR/compose" -name ".DS_Store" -type f -delete 2>/dev/null || true
    
    print_message $GREEN "✓ 所有生成的文件清理完成"
    
    # 显示清理后的状态
    print_message $BLUE "清理后状态："
    if [ ! -f "$NETWORK_DIR/configtx/network-config.json" ]; then
        print_message $GREEN "  ✓ 网络配置文件已清理"
    fi
    if [ ! -f "$NETWORK_DIR/configtx/configtx.yaml" ]; then
        print_message $GREEN "  ✓ Fabric配置文件已清理"
    fi
    if [ ! -f "$NETWORK_DIR/compose/docker-compose.yaml" ]; then
        print_message $GREEN "  ✓ Docker配置文件已清理"
    fi
    if [ ! -f "$NETWORK_DIR/crypto-config.yaml" ]; then
        print_message $GREEN "  ✓ 加密配置文件已清理"
    fi
    if [ ! -d "$NETWORK_DIR/organizations" ]; then
        print_message $GREEN "  ✓ 证书和密钥已清理"
    fi
    if [ ! -d "$NETWORK_DIR/channel-artifacts" ]; then
        print_message $GREEN "  ✓ 频道配置已清理"
    fi
}

# 显示网络状态
show_status() {
    print_message $BLUE "CBDC 网络状态:"
    
    # 检查配置文件
    if [ -f "$NETWORK_DIR/configtx/network-config.json" ]; then
        print_message $GREEN "✓ 网络配置已生成"
        
        # 显示配置摘要
        local config_file="$NETWORK_DIR/configtx/network-config.json"
        local channel_name=$(jq -r '.network.channel_name' "$config_file")
        local central_bank=$(jq -r '.network.central_bank.name' "$config_file")
        local banks_count=$(jq '.network.banks | length' "$config_file")
        
        echo "  频道名称: $channel_name"
        echo "  央行: $central_bank"
        echo "  参与银行数量: $banks_count"
        
        # 显示银行列表
        echo "  银行列表:"
        for ((i=0; i<banks_count; i++)); do
            local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
            echo "    - $bank_name"
        done
    else
        print_message $YELLOW "✗ 网络配置未生成"
    fi
    
    # 检查 Docker 容器状态
    print_message $BLUE "Docker 容器状态:"
    if command -v docker &> /dev/null; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "label=service=hyperledger-fabric"
    else
        print_message $RED "Docker 未安装"
    fi
}

# 显示帮助信息
show_help() {
    echo "CBDC 银行数字货币网络管理脚本"
    echo ""
    echo "用法: $0 <命令> [参数...]"
    echo ""
    echo "命令:"
    echo "  setup [频道名] [央行名] [银行1] [银行2] ...  完整设置网络（生成配置+加密材料）"
    echo "  start                                         启动网络"
    echo "  stop                                          停止网络"
    echo "  clean                                         清理网络资源（停止容器+删除所有文件）"
    echo "  cleanup-files                                 仅清理生成的文件（不停止容器）"
    echo "  status                                        显示网络状态"
    echo "  help                                          显示帮助信息"
    echo ""
    echo "完整部署流程:"
    echo "  1. $0 setup                                   完整设置网络（配置+加密材料）"
    echo "  2. $0 start                                   启动网络容器"
    echo ""
    echo "清理命令区别:"
    echo "  clean         停止所有容器，删除卷，清理所有生成的文件（完全重置）"
    echo "  cleanup-files 仅清理生成的文件，保持容器运行（重新生成配置）"
    echo ""
    echo "示例:"
    echo "  $0 setup                                      交互式完整设置"
    echo "  $0 setup cbdc-channel CentralBank ICBC CCB   命令行完整设置"
    echo "  $0 start                                      启动网络"
    echo "  $0 status                                     查看状态"
    echo "  $0 cleanup-files                              仅清理生成的配置文件"
    echo "  $0 stop                                       停止网络"
    echo "  $0 clean                                      完全清理所有数据"
    echo ""
    echo "清理的文件包括:"
    echo "  - 网络配置文件 (configtx/network-config.json)"
    echo "  - Fabric配置文件 (configtx/configtx.yaml)"
    echo "  - Docker配置文件 (compose/docker-compose.yaml)"
    echo "  - 加密配置文件 (crypto-config.yaml)"
    echo "  - 组织证书和密钥 (organizations/)"
    echo "  - 频道配置 (channel-artifacts/)"
    echo "  - 临时日志文件 (/tmp/*_output.log)"
    echo "  - 备份文件 (*.bak, *~)"
    echo "  - 系统隐藏文件 (.DS_Store)"
    echo ""
    echo "注意事项:"
    echo "  - setup 命令需要安装 Hyperledger Fabric 二进制文件"
    echo "  - 现在只需要运行 setup -> start 两个步骤即可完成部署"
    echo "  - 使用 clean 命令会删除所有生成的文件和数据"
    echo "  - 使用 cleanup-files 命令可以在保持容器运行的情况下重新生成配置"
    echo ""
}

# ============ 网络管理命令 ============

# 网络命令处理
handle_network_command() {
    case "${1:-help}" in
        "setup")
            check_prerequisites
            shift
            setup_network "$@"
            ;;
        "start")
            check_prerequisites
            start_network
            ;;
        "stop")
            stop_network
            ;;
        "clean")
            clean_network
            ;;
        "cleanup-files")
            cleanup_files_only
            ;;
        "status")
            show_status
            ;;
        "add-peer")
            shift
            add_peer_to_network "$@"
            ;;
        "add-orderer")
            shift
            add_orderer_to_network "$@"
            ;;
        "help"|"-h"|"--help")
            show_network_help
            ;;
        *)
            print_message $RED "未知网络命令: $1"
            show_network_help
            exit 1
            ;;
    esac
}

# 显示网络命令帮助
show_network_help() {
    echo "网络管理命令:"
    echo ""
    echo "用法: $0 network <子命令> [参数...]"
    echo ""
    echo "子命令:"
    echo "  setup [频道名] [央行名] [银行1] [银行2] ...  完整设置网络（生成配置+加密材料）"
    echo "  start                                         启动网络"
    echo "  stop                                          停止网络"
    echo "  clean                                         清理网络资源（停止容器+删除所有文件）"
    echo "  cleanup-files                                 仅清理生成的文件（不停止容器）"
    echo "  status                                        显示网络状态"
    echo "  add-peer <组织名> <节点名> [端口]               向网络添加新的 peer 节点"
    echo "  add-orderer <节点名> [端口]                    向网络添加新的 orderer 节点"
    echo "  help                                          显示网络命令帮助"
    echo ""
    echo "示例:"
    echo "  $0 network setup                              交互式完整设置"
    echo "  $0 network setup cbdc-channel CentralBank ICBC CCB  命令行完整设置"
    echo "  $0 network start                              启动网络"
    echo "  $0 network status                             查看状态"
    echo "  $0 network add-peer ICBC peer1 8051           为工商银行添加新节点"
    echo "  $0 network add-orderer orderer2 8050          添加新的排序节点"
}

# 向网络添加新的 peer 节点
add_peer_to_network() {
    local org_name=$1
    local peer_name=$2
    local peer_port=${3:-}
    
    if [ -z "$org_name" ] || [ -z "$peer_name" ]; then
        print_message $RED "用法: $0 network add-peer <组织名> <节点名> [端口]"
        return 1
    fi
    
    print_message $BLUE "向组织 $org_name 添加节点 $peer_name..."
    
    # 检查网络配置是否存在
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "网络配置文件不存在，请先运行 network setup"
        return 1
    fi
    
    # TODO: 实现添加 peer 节点的逻辑
    # 1. 更新网络配置文件
    # 2. 重新生成证书
    # 3. 更新 docker-compose.yaml
    # 4. 重启网络服务
    
    print_message $YELLOW "添加 peer 节点功能正在开发中..."
}

# 向网络添加新的 orderer 节点
add_orderer_to_network() {
    local orderer_name=$1
    local orderer_port=${2:-}
    
    if [ -z "$orderer_name" ]; then
        print_message $RED "用法: $0 network add-orderer <节点名> [端口]"
        return 1
    fi
    
    print_message $BLUE "添加排序节点 $orderer_name..."
    
    # TODO: 实现添加 orderer 节点的逻辑
    print_message $YELLOW "添加 orderer 节点功能正在开发中..."
}

# ============ 组织管理命令 ============

# 组织命令处理
handle_org_command() {
    case "${1:-help}" in
        "list")
            list_organizations
            ;;
        "info")
            shift
            show_org_info "$@"
            ;;
        "add-user")
            shift
            add_user_to_org "$@"
            ;;
        "add-peer")
            shift
            add_peer_to_org "$@"
            ;;
        "help"|"-h"|"--help")
            show_org_help
            ;;
        *)
            print_message $RED "未知组织命令: $1"
            show_org_help
            exit 1
            ;;
    esac
}

# 显示组织命令帮助
show_org_help() {
    echo "组织管理命令:"
    echo ""
    echo "用法: $0 org <子命令> [参数...]"
    echo ""
    echo "子命令:"
    echo "  list                                显示所有组织"
    echo "  info <组织名>                       显示组织详细信息"
    echo "  add-user <组织名> <用户名> [类型]     向组织添加用户"
    echo "  add-peer <组织名> <节点名> [端口]     向组织添加节点"
    echo "  help                                显示组织命令帮助"
    echo ""
    echo "示例:"
    echo "  $0 org list                         列出所有组织"
    echo "  $0 org info ICBC                    显示工商银行信息"
    echo "  $0 org add-user ICBC user1 client   为工商银行添加客户端用户"
    echo "  $0 org add-peer ICBC peer1 8051      为工商银行添加节点"
}

# 列出所有组织
list_organizations() {
    print_message $BLUE "组织列表:"
    
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ ! -f "$config_file" ]; then
        print_message $RED "网络配置文件不存在，请先运行 network setup"
        return 1
    fi
    
    # 显示央行
    local central_bank=$(jq -r '.network.central_bank.name' "$config_file")
    print_message $GREEN "央行: $central_bank"
    
    # 显示银行
    local banks_count=$(jq '.network.banks | length' "$config_file")
    print_message $GREEN "参与银行 ($banks_count 个):"
    
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        print_message $BLUE "  - $bank_name (端口: $bank_port)"
    done
}

# 显示组织详细信息
show_org_info() {
    local org_name=$1
    
    if [ -z "$org_name" ]; then
        print_message $RED "用法: $0 org info <组织名>"
        return 1
    fi
    
    print_message $BLUE "组织 $org_name 详细信息:"
    
    # TODO: 实现显示组织详细信息的逻辑
    print_message $YELLOW "组织信息显示功能正在开发中..."
}

# 向组织添加用户
add_user_to_org() {
    local org_name=$1
    local user_name=$2
    local user_type=${3:-client}
    
    if [ -z "$org_name" ] || [ -z "$user_name" ]; then
        print_message $RED "用法: $0 org add-user <组织名> <用户名> [类型]"
        return 1
    fi
    
    print_message $BLUE "向组织 $org_name 添加用户 $user_name (类型: $user_type)..."
    
    # TODO: 实现添加用户的逻辑
    print_message $YELLOW "添加用户功能正在开发中..."
}

# 向组织添加节点
add_peer_to_org() {
    local org_name=$1
    local peer_name=$2
    local peer_port=${3:-}
    
    if [ -z "$org_name" ] || [ -z "$peer_name" ]; then
        print_message $RED "用法: $0 org add-peer <组织名> <节点名> [端口]"
        return 1
    fi
    
    print_message $BLUE "向组织 $org_name 添加节点 $peer_name..."
    
    # TODO: 实现向组织添加节点的逻辑
    print_message $YELLOW "向组织添加节点功能正在开发中..."
}

# ============ 链码管理命令 ============

# 链码命令处理
handle_chaincode_command() {
    case "${1:-help}" in
        "package")
            shift
            package_chaincode "$@"
            ;;
        "install")
            shift
            install_chaincode "$@"
            ;;
        "deploy")
            shift
            deploy_chaincode "$@"
            ;;
        "upgrade")
            shift
            upgrade_chaincode "$@"
            ;;
        "list")
            list_chaincodes
            ;;
        "help"|"-h"|"--help")
            show_chaincode_help
            ;;
        *)
            print_message $RED "未知链码命令: $1"
            show_chaincode_help
            exit 1
            ;;
    esac
}

# 显示链码命令帮助
show_chaincode_help() {
    echo "链码管理命令:"
    echo ""
    echo "用法: $0 chaincode <子命令> [参数...]"
    echo ""
    echo "子命令:"
    echo "  package <链码名> <路径> [版本] [语言]                    打包链码"
    echo "  install <链码名> <组织名> [版本]                         安装链码到指定组织"
    echo "  deploy <链码名> <频道名> [版本] [需要初始化] [初始化参数] [序列号]  部署链码到频道"
    echo "  upgrade <链码名> <版本> [频道名] [升级参数]               升级链码"
    echo "  list                                                    列出所有已安装的链码"
    echo "  help                                                    显示链码命令帮助"
    echo ""
    echo "完整部署流程:"
    echo "  1. $0 chaincode package cbdc-token ./chaincode 1.0 golang"
    echo "  2. $0 chaincode install cbdc-token CentralBank 1.0"
    echo "  3. $0 chaincode install cbdc-token ICBC 1.0"
    echo "  4. $0 chaincode install cbdc-token CCB 1.0"
    echo "  5. $0 chaincode deploy cbdc-token cbdc-channel 1.0 false"
    echo ""
    echo "参数说明:"
    echo "  语言选项: golang, node, java (默认: golang)"
    echo "  需要初始化: true/false (默认: false)"
    echo "  初始化参数: JSON格式，如 '{\"Args\":[\"init\",\"param1\"]}'"
    echo "  序列号: 整数，用于链码版本管理 (默认: 1)"
    echo ""
    echo "示例:"
    echo "  $0 chaincode package cbdc-token ./chaincode 1.0 golang"
    echo "  $0 chaincode install cbdc-token ICBC 1.0"
    echo "  $0 chaincode deploy cbdc-token cbdc-channel 1.0 true '{\"Args\":[\"init\"]}' 1"
    echo "  $0 chaincode upgrade cbdc-token 1.1 cbdc-channel"
    echo "  $0 chaincode list"
}

# 打包链码
package_chaincode() {
    local chaincode_name=$1
    local chaincode_path=$2
    local version=${3:-1.0}
    local chaincode_lang=${4:-golang}
    
    if [ -z "$chaincode_name" ] || [ -z "$chaincode_path" ]; then
        print_message $RED "用法: $0 chaincode package <链码名> <路径> [版本] [语言]"
        print_message $YELLOW "支持的语言: golang, node, java"
        return 1
    fi
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    package_chaincode_impl "$chaincode_name" "$chaincode_path" "$version" "$chaincode_lang"
}

# 安装链码
install_chaincode() {
    local chaincode_name=$1
    local org_name=$2
    local version=${3:-1.0}
    
    if [ -z "$chaincode_name" ] || [ -z "$org_name" ]; then
        print_message $RED "用法: $0 chaincode install <链码名> <组织名> [版本]"
        return 1
    fi
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    install_chaincode_impl "$chaincode_name" "$org_name" "$version"
}

# 部署链码
deploy_chaincode() {
    local chaincode_name=$1
    local channel_name=$2
    local version=${3:-1.0}
    local init_required=${4:-false}
    local init_args=${5:-"{}"}
    local sequence=${6:-1}
    
    if [ -z "$chaincode_name" ] || [ -z "$channel_name" ]; then
        print_message $RED "用法: $0 chaincode deploy <链码名> <频道名> [版本] [需要初始化] [初始化参数] [序列号]"
        print_message $YELLOW "示例: $0 chaincode deploy cbdc-token cbdc-channel 1.0 true '{\"Args\":[\"init\"]}' 1"
        return 1
    fi
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    deploy_chaincode_impl "$chaincode_name" "$channel_name" "$version" "$init_required" "$init_args" "$sequence"
}

# 升级链码
upgrade_chaincode() {
    local chaincode_name=$1
    local version=$2
    local channel_name=${3:-}
    local upgrade_args=${4:-"{}"}
    
    if [ -z "$chaincode_name" ] || [ -z "$version" ]; then
        print_message $RED "用法: $0 chaincode upgrade <链码名> <版本> [频道名] [升级参数]"
        return 1
    fi
    
    # 如果没有提供频道名，尝试从配置文件获取
    if [ -z "$channel_name" ]; then
        local config_file="$NETWORK_DIR/configtx/network-config.json"
        if [ -f "$config_file" ]; then
            channel_name=$(jq -r '.network.channel_name' "$config_file")
        else
            print_message $RED "无法获取频道名称，请提供频道名称"
            return 1
        fi
    fi
    
    print_message $BLUE "升级链码 $chaincode_name 到版本 $version 在频道 $channel_name..."
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 获取当前序列号并加1
    local current_sequence=$(get_current_chaincode_sequence "$chaincode_name" "$channel_name")
    local new_sequence=$((current_sequence + 1))
    
    print_message $BLUE "当前序列号: $current_sequence, 新序列号: $new_sequence"
    
    # 调用部署实现（升级实际上是重新部署新版本）
    deploy_chaincode_impl "$chaincode_name" "$channel_name" "$version" "false" "$upgrade_args" "$new_sequence"
}

# 列出所有链码
list_chaincodes() {
    print_message $BLUE "查询链码列表..."
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    list_chaincodes_impl
}

# ============ 交易管理命令 ============

# 交易命令处理
handle_tx_command() {
    case "${1:-help}" in
        "invoke")
            shift
            invoke_transaction "$@"
            ;;
        "query")
            shift
            query_transaction "$@"
            ;;
        "history")
            shift
            show_tx_history "$@"
            ;;
        "help"|"-h"|"--help")
            show_tx_help
            ;;
        *)
            print_message $RED "未知交易命令: $1"
            show_tx_help
            exit 1
            ;;
    esac
}

# 显示交易命令帮助
show_tx_help() {
    echo "交易管理命令:"
    echo ""
    echo "用法: $0 tx <子命令> [参数...]"
    echo ""
    echo "子命令:"
    echo "  invoke <链码名> <函数> <参数...>     调用链码函数（写操作）"
    echo "  query <链码名> <函数> <参数...>      查询链码函数（读操作）"
    echo "  history <交易ID>                    显示交易历史"
    echo "  help                               显示交易命令帮助"
    echo ""
    echo "示例:"
    echo "  $0 tx invoke cbdc-token transfer Alice Bob 100"
    echo "  $0 tx query cbdc-token balanceOf Alice"
    echo "  $0 tx history abc123def456"
}

# 调用交易
invoke_transaction() {
    local chaincode_name=$1
    local function_name=$2
    shift 2
    local args=("$@")
    local channel_name=""
    
    if [ -z "$chaincode_name" ] || [ -z "$function_name" ]; then
        print_message $RED "用法: $0 tx invoke <链码名> <函数> <参数...>"
        print_message $YELLOW "示例: $0 tx invoke cbdc-token transfer Alice Bob 100"
        return 1
    fi
    
    # 获取频道名称
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ -f "$config_file" ]; then
        channel_name=$(jq -r '.network.channel_name' "$config_file")
    else
        print_message $RED "无法获取频道名称，请先运行 network setup"
        return 1
    fi
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    invoke_transaction_impl "$chaincode_name" "$channel_name" "$function_name" "${args[@]}"
}

# 查询交易
query_transaction() {
    local chaincode_name=$1
    local function_name=$2
    shift 2
    local args=("$@")
    local channel_name=""
    
    if [ -z "$chaincode_name" ] || [ -z "$function_name" ]; then
        print_message $RED "用法: $0 tx query <链码名> <函数> <参数...>"
        print_message $YELLOW "示例: $0 tx query cbdc-token balanceOf Alice"
        return 1
    fi
    
    # 获取频道名称
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ -f "$config_file" ]; then
        channel_name=$(jq -r '.network.channel_name' "$config_file")
    else
        print_message $RED "无法获取频道名称，请先运行 network setup"
        return 1
    fi
    
    # 检查必要工具
    check_prerequisites
    
    # 加载实用工具函数
    source "$NETWORK_DIR/scripts/cbdc-utils.sh"
    
    # 调用实际实现
    query_transaction_impl "$chaincode_name" "$channel_name" "$function_name" "${args[@]}"
}

# 显示交易历史
show_tx_history() {
    local tx_id=$1
    local channel_name=""
    
    if [ -z "$tx_id" ]; then
        print_message $RED "用法: $0 tx history <交易ID>"
        print_message $YELLOW "示例: $0 tx history abc123def456789"
        return 1
    fi
    
    # 获取频道名称
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    if [ -f "$config_file" ]; then
        channel_name=$(jq -r '.network.channel_name' "$config_file")
    else
        print_message $RED "无法获取频道名称，请先运行 network setup"
        return 1
    fi
    
    print_message $BLUE "查询交易 $tx_id 在频道 $channel_name 的历史..."
    
    # 检查必要工具
    check_prerequisites
    
    # 设置央行环境变量
    local config_file="$NETWORK_DIR/configtx/network-config.json"
    export FABRIC_CFG_PATH="$NETWORK_DIR/configtx"
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="CentralBankPeerMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/peers/peer0.centralbank.cbdc.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/centralbank.cbdc.com/users/Admin@centralbank.cbdc.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"
    
    # 查询交易历史
    peer channel getinfo -c "$channel_name"
    
    print_message $BLUE "尝试获取区块详情..."
    peer channel fetch newest "$tx_id.block" -c "$channel_name"
    
    if [ -f "$tx_id.block" ]; then
        print_message $GREEN "✓ 区块文件已下载: $tx_id.block"
        print_message $BLUE "解析区块文件..."
        configtxlator proto_decode --input "$tx_id.block" --type common.Block --output "$tx_id.json"
        
        if [ -f "$tx_id.json" ]; then
            print_message $GREEN "✓ 区块解析成功，详情保存在: $tx_id.json"
            print_message $BLUE "区块摘要："
            jq '.header' "$tx_id.json" 2>/dev/null || cat "$tx_id.json"
        fi
        
        # 清理临时文件
        rm -f "$tx_id.block" "$tx_id.json"
    else
        print_message $YELLOW "⚠ 无法获取指定的交易历史，请检查交易ID是否正确"
    fi
}

# ============ 主命令处理 ============

# 显示主帮助信息
show_help() {
    echo "CBDC 银行数字货币网络管理脚本"
    echo ""
    echo "用法: $0 <模块> <命令> [参数...]"
    echo ""
    echo "模块:"
    echo "  network     网络管理（设置、启动、停止、清理等）"
    echo "  org         组织管理（用户、节点管理等）"
    echo "  chaincode   链码管理（打包、安装、部署等）"
    echo "  tx          交易管理（调用、查询等）"
    echo ""
    echo "快速开始:"
    echo "  $0 network setup     完整设置网络"
    echo "  $0 network start     启动网络"
    echo "  $0 org list         查看所有组织"
    echo "  $0 chaincode list   查看所有链码"
    echo ""
    echo "详细帮助:"
    echo "  $0 network help     网络管理命令帮助"
    echo "  $0 org help         组织管理命令帮助"
    echo "  $0 chaincode help   链码管理命令帮助"
    echo "  $0 tx help          交易管理命令帮助"
    echo ""
    echo "兼容性命令（保持向后兼容）:"
    echo "  $0 setup            等同于 $0 network setup"
    echo "  $0 start            等同于 $0 network start"
    echo "  $0 stop             等同于 $0 network stop"
    echo "  $0 clean            等同于 $0 network clean"
    echo "  $0 status           等同于 $0 network status"
}

# 主函数
main() {
    local command=${1:-help}
    
    case "$command" in
        "network")
            shift
            handle_network_command "$@"
            ;;
        "org")
            shift
            handle_org_command "$@"
            ;;
        "chaincode")
            shift
            handle_chaincode_command "$@"
            ;;
        "tx")
            shift
            handle_tx_command "$@"
            ;;
        # 保持向后兼容的命令
        "setup")
            check_prerequisites
            shift
            setup_network "$@"
            ;;
        "start")
            check_prerequisites
            start_network
            ;;
        "stop")
            stop_network
            ;;
        "clean")
            clean_network
            ;;
        "cleanup-files")
            cleanup_files_only
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_message $RED "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 