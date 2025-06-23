#!/bin/bash

#
# 银行数字货币网络加密材料生成脚本
# 基于 network-config.json 生成所有组织的证书和密钥
#

# 检查必要工具
check_prerequisites() {
    local missing_tools=()
    
    # 检查 cryptogen
    if ! command -v cryptogen &> /dev/null; then
        missing_tools+=("cryptogen")
    fi
    
    # 检查 configtxgen
    if ! command -v configtxgen &> /dev/null; then
        missing_tools+=("configtxgen")
    fi
    
    # 检查 jq
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo "错误: 缺少必要工具: ${missing_tools[*]}"
        echo "请安装 Hyperledger Fabric 二进制文件和 jq"
        exit 1
    fi
}

# 转换为小写
to_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

# 生成 crypto-config.yaml
generate_crypto_config() {
    local config_file="$1"
    local output_file="$2"
    
    echo "生成 crypto-config.yaml..."
    
    # 读取配置
    local central_bank_name=$(jq -r '.network.central_bank.name' "$config_file")
    local central_bank_lower=$(to_lower "$central_bank_name")
    local banks_count=$(jq '.network.banks | length' "$config_file")
    
    # 生成 crypto-config.yaml
    cat > "$output_file" << EOF
#
# 此文件由 generate-crypto.sh 脚本自动生成
# 基于 configtx/network-config.json 配置文件
# 请勿手动修改此文件！如需更改请修改 network-config.json 后重新生成
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
#

# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# 排序节点组织
OrdererOrgs:
  - Name: ${central_bank_name}
    Domain: ${central_bank_lower}.cbdc.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
        SANS:
          - localhost

# Peer 组织
PeerOrgs:
  # 央行 Peer 组织
  - Name: ${central_bank_name}Peer
    Domain: ${central_bank_lower}.cbdc.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
    Users:
      Count: 1

EOF

    # 添加银行组织
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_lower=$(to_lower "$bank_name")
        
        cat >> "$output_file" << EOF
  # ${bank_name} 银行组织
  - Name: ${bank_name}
    Domain: ${bank_lower}.cbdc.com
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
    Users:
      Count: 1

EOF
    done
    
    echo "crypto-config.yaml 已生成: $output_file"
}

# 生成加密材料
generate_crypto_materials() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local network_dir="$(dirname "$script_dir")"
    local config_file="$network_dir/configtx/network-config.json"
    local crypto_config_file="$network_dir/crypto-config.yaml"
    local organizations_dir="$network_dir/organizations"
    
    # 检查网络配置文件
    if [ ! -f "$config_file" ]; then
        echo "错误: 未找到网络配置文件 $config_file"
        echo "请先运行 network-config.sh 生成网络配置"
        exit 1
    fi
    
    echo "开始生成加密材料..."
    
    # 生成 crypto-config.yaml
    generate_crypto_config "$config_file" "$crypto_config_file"
    
    # 清理旧的加密材料
    if [ -d "$organizations_dir" ]; then
        echo "清理旧的加密材料..."
        rm -rf "$organizations_dir"
    fi
    
    # 生成加密材料
    echo "使用 cryptogen 生成证书和密钥..."
    cd "$network_dir"
    
    cryptogen generate --config=crypto-config.yaml --output="$organizations_dir"
    
    if [ $? -eq 0 ]; then
        echo "✓ 加密材料生成成功"
        
        # 设置正确的权限
        echo "设置文件权限..."
        find "$organizations_dir" -type f -name "*_sk" -exec chmod 600 {} \;
        find "$organizations_dir" -type f -name "*.key" -exec chmod 600 {} \;
        
        # 显示生成的组织结构
        echo ""
        echo "生成的组织结构:"
        tree "$organizations_dir" -L 3 2>/dev/null || ls -la "$organizations_dir"
        
        return 0
    else
        echo "✗ 加密材料生成失败"
        return 1
    fi
}

# 生成创世区块
generate_genesis_block() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local network_dir="$(dirname "$script_dir")"
    local config_file="$network_dir/configtx/network-config.json"
    local configtx_file="$network_dir/configtx/configtx.yaml"
    local channel_artifacts_dir="$network_dir/channel-artifacts"
    
    # 检查必要文件
    if [ ! -f "$configtx_file" ]; then
        echo "错误: 未找到 configtx.yaml 文件"
        echo "请先运行配置生成"
        return 1
    fi
    
    # 创建 channel-artifacts 目录
    mkdir -p "$channel_artifacts_dir"
    
    # 读取配置
    local channel_name=$(jq -r '.network.channel_name' "$config_file")
    local channel_title=$(echo "$channel_name" | sed 's/\b\w/\U&/g')
    
    echo "生成创世区块..."
    
    cd "$network_dir"
    export FABRIC_CFG_PATH="$network_dir/configtx"
    
    # 生成排序节点创世区块
    configtxgen -profile "${channel_title}OrdererGenesis" -channelID system-channel -outputBlock "$channel_artifacts_dir/genesis.block"
    
    if [ $? -eq 0 ]; then
        echo "✓ 创世区块生成成功: $channel_artifacts_dir/genesis.block"
        return 0
    else
        echo "✗ 创世区块生成失败"
        return 1
    fi
}

# 生成频道交易文件
generate_channel_tx() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local network_dir="$(dirname "$script_dir")"
    local config_file="$network_dir/configtx/network-config.json"
    local configtx_file="$network_dir/configtx/configtx.yaml"
    local channel_artifacts_dir="$network_dir/channel-artifacts"
    
    # 读取配置
    local channel_name=$(jq -r '.network.channel_name' "$config_file")
    local channel_title=$(echo "$channel_name" | sed 's/\b\w/\U&/g')
    
    echo "生成频道交易文件..."
    
    cd "$network_dir"
    export FABRIC_CFG_PATH="$network_dir/configtx"
    
    # 生成频道交易文件
    configtxgen -profile "${channel_title}Channel" -outputCreateChannelTx "$channel_artifacts_dir/${channel_name}.tx" -channelID "$channel_name"
    
    if [ $? -eq 0 ]; then
        echo "✓ 频道交易文件生成成功: $channel_artifacts_dir/${channel_name}.tx"
        
        # 生成锚点节点更新交易
        generate_anchor_peer_updates "$config_file" "$channel_artifacts_dir" "$channel_name" "$channel_title"
        
        return 0
    else
        echo "✗ 频道交易文件生成失败"
        return 1
    fi
}

# 生成锚点节点更新交易
generate_anchor_peer_updates() {
    local config_file="$1"
    local channel_artifacts_dir="$2"
    local channel_name="$3"
    local channel_title="$4"
    
    echo "生成锚点节点更新交易..."
    
    # 央行锚点节点
    local central_bank_name=$(jq -r '.network.central_bank.name' "$config_file")
    configtxgen -profile "${channel_title}Channel" -outputAnchorPeersUpdate "$channel_artifacts_dir/${central_bank_name}PeerMSPanchors.tx" -channelID "$channel_name" -asOrg "${central_bank_name}PeerMSP"
    
    # 银行锚点节点
    local banks_count=$(jq '.network.banks | length' "$config_file")
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        configtxgen -profile "${channel_title}Channel" -outputAnchorPeersUpdate "$channel_artifacts_dir/${bank_name}MSPanchors.tx" -channelID "$channel_name" -asOrg "${bank_name}MSP"
    done
    
    echo "✓ 锚点节点更新交易生成完成"
}

# 主函数
main() {
    case "${1:-all}" in
        "all")
            check_prerequisites
            generate_crypto_materials
            if [ $? -eq 0 ]; then
                generate_genesis_block
                generate_channel_tx
            fi
            ;;
        "crypto")
            check_prerequisites
            generate_crypto_materials
            ;;
        "genesis")
            check_prerequisites
            generate_genesis_block
            ;;
        "channel")
            check_prerequisites
            generate_channel_tx
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [命令]"
            echo ""
            echo "命令:"
            echo "  all       生成所有加密材料和配置文件（默认）"
            echo "  crypto    仅生成证书和密钥"
            echo "  genesis   仅生成创世区块"
            echo "  channel   仅生成频道交易文件"
            echo "  help      显示帮助信息"
            echo ""
            echo "注意: 需要先运行 network-config.sh 生成网络配置"
            ;;
        *)
            echo "未知命令: $1"
            echo "使用 '$0 help' 查看帮助信息"
            exit 1
            ;;
    esac
}

# 如果直接运行脚本，执行主函数
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi 