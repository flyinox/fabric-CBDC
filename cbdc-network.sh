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
    print_message $BLUE "下一步运行: $0 start"
    
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
    print_message $BLUE "清理生成的配置文件..."
    rm -rf "$NETWORK_DIR/configtx/network-config.json"
    rm -rf "$NETWORK_DIR/configtx/configtx.yaml"
    rm -rf "$NETWORK_DIR/compose/docker-compose.yaml"
    rm -rf "$NETWORK_DIR/channel-artifacts"
    rm -rf "$NETWORK_DIR/organizations"
    
    print_message $GREEN "✓ 网络资源清理完成"
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
    echo "  clean                                         清理网络资源"
    echo "  status                                        显示网络状态"
    echo "  help                                          显示帮助信息"
    echo ""
    echo "完整部署流程:"
    echo "  1. $0 setup                                   完整设置网络（配置+加密材料）"
    echo "  2. $0 start                                   启动网络容器"
    echo ""
    echo "示例:"
    echo "  $0 setup                                      交互式完整设置"
    echo "  $0 setup cbdc-channel CentralBank ICBC CCB   命令行完整设置"
    echo "  $0 start                                      启动网络"
    echo "  $0 status                                     查看状态"
    echo "  $0 stop                                       停止网络"
    echo "  $0 clean                                      清理所有数据"
    echo ""
    echo "注意事项:"
    echo "  - setup 命令需要安装 Hyperledger Fabric 二进制文件"
    echo "  - 现在只需要运行 setup -> start 两个步骤即可完成部署"
    echo "  - 使用 clean 命令会删除所有生成的文件和数据"
    echo ""
}

# 主函数
main() {
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
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_message $RED "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 