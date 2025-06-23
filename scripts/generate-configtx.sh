#!/bin/bash

#
# 自动生成的 configtx.yaml 配置文件生成脚本
# 此文件由 cbdc-network.sh 脚本自动生成
# 请勿手动修改此文件，如需更改请修改 network-config.json 后重新生成
#

# 生成 configtx.yaml 配置文件脚本
# 基于 network-config.json 生成 Hyperledger Fabric 网络配置

# 检查 jq 工具
check_jq() {
    if ! command -v jq &> /dev/null; then
        echo "错误: 需要安装 jq 工具来解析 JSON 配置文件"
        echo "请运行: brew install jq (macOS) 或 apt-get install jq (Ubuntu)"
        exit 1
    fi
}

# 转换为小写
to_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

# 转换为首字母大写
to_title() {
    echo "$1" | sed 's/\b\w/\U&/g'
}

# 生成 configtx.yaml
generate_configtx() {
    local config_file="$(dirname "$0")/../configtx/network-config.json"
    local output_file="$(dirname "$0")/../configtx/configtx.yaml"
    
    if [ ! -f "$config_file" ]; then
        echo "错误: 未找到网络配置文件 $config_file"
        echo "请先运行 network-config.sh 生成网络配置"
        exit 1
    fi
    
    echo "正在生成 configtx.yaml..."
    
    # 读取配置
    local channel_name=$(jq -r '.network.channel_name' "$config_file")
    local central_bank_name=$(jq -r '.network.central_bank.name' "$config_file")
    local central_bank_msp=$(jq -r '.network.central_bank.msp_id' "$config_file")
    local central_bank_lower=$(to_lower "$central_bank_name")
    local channel_title=$(to_title "$channel_name")
    
    # 开始生成 configtx.yaml
    cat > "$output_file" << EOF
#
# 此文件由 generate-configtx.sh 脚本自动生成
# 基于 configtx/network-config.json 配置文件
# 请勿手动修改此文件！如需更改请修改 network-config.json 后重新生成
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
#

# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

---
################################################################################
#
#   银行数字货币网络配置文件
#   自动生成 - 请勿手动修改
#
################################################################################

################################################################################
#
#   组织定义
#
################################################################################
Organizations:

    # 央行组织定义
    - &${central_bank_name}
        Name: ${central_bank_msp}
        ID: ${central_bank_msp}
        MSPDir: ../organizations/ordererOrganizations/${central_bank_lower}.cbdc.com/msp
        
        Policies:
            Readers:
                Type: Signature
                Rule: "OR('${central_bank_msp}.member')"
            Writers:
                Type: Signature
                Rule: "OR('${central_bank_msp}.member')"
            Admins:
                Type: Signature
                Rule: "OR('${central_bank_msp}.admin')"
        
        OrdererEndpoints:
            - orderer.${central_bank_lower}.cbdc.com:7050

    # 央行作为Peer组织
    - &${central_bank_name}Peer
        Name: ${central_bank_name}PeerMSP
        ID: ${central_bank_name}PeerMSP
        MSPDir: ../organizations/peerOrganizations/${central_bank_lower}.cbdc.com/msp
        
        Policies:
            Readers:
                Type: Signature
                Rule: "OR('${central_bank_name}PeerMSP.admin', '${central_bank_name}PeerMSP.peer', '${central_bank_name}PeerMSP.client')"
            Writers:
                Type: Signature
                Rule: "OR('${central_bank_name}PeerMSP.admin', '${central_bank_name}PeerMSP.client')"
            Admins:
                Type: Signature
                Rule: "OR('${central_bank_name}PeerMSP.admin')"
            Endorsement:
                Type: Signature
                Rule: "OR('${central_bank_name}PeerMSP.peer')"

        AnchorPeers:
            - Host: peer0.${central_bank_lower}.cbdc.com
              Port: 7051

EOF

    # 添加银行组织
    local bank_count=$(jq '.network.banks | length' "$config_file")
    for ((i=0; i<bank_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_msp=$(jq -r ".network.banks[$i].msp_id" "$config_file")
        local bank_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        local bank_lower=$(to_lower "$bank_name")
        
        cat >> "$output_file" << EOF
    # ${bank_name} 银行组织
    - &${bank_name}
        Name: ${bank_msp}
        ID: ${bank_msp}
        MSPDir: ../organizations/peerOrganizations/${bank_lower}.cbdc.com/msp
        
        Policies:
            Readers:
                Type: Signature
                Rule: "OR('${bank_msp}.admin', '${bank_msp}.peer', '${bank_msp}.client')"
            Writers:
                Type: Signature
                Rule: "OR('${bank_msp}.admin', '${bank_msp}.client')"
            Admins:
                Type: Signature
                Rule: "OR('${bank_msp}.admin')"
            Endorsement:
                Type: Signature
                Rule: "OR('${bank_msp}.peer')"

        AnchorPeers:
            - Host: peer0.${bank_lower}.cbdc.com
              Port: ${bank_port}

EOF
    done

    # 添加功能定义和其他配置
    cat >> "$output_file" << EOF
################################################################################
#
#   功能定义
#
################################################################################
Capabilities:
    Channel: &ChannelCapabilities
        V2_0: true

    Orderer: &OrdererCapabilities
        V2_0: true

    Application: &ApplicationCapabilities
        V2_5: true

################################################################################
#
#   应用程序配置
#
################################################################################
Application: &ApplicationDefaults
    Organizations:
    
    Policies:
        Readers:
            Type: ImplicitMeta
            Rule: "ANY Readers"
        Writers:
            Type: ImplicitMeta
            Rule: "ANY Writers"
        Admins:
            Type: ImplicitMeta
            Rule: "MAJORITY Admins"
        LifecycleEndorsement:
            Type: ImplicitMeta
            Rule: "MAJORITY Endorsement"
        Endorsement:
            Type: ImplicitMeta
            Rule: "MAJORITY Endorsement"

    Capabilities:
        <<: *ApplicationCapabilities

################################################################################
#
#   排序节点配置
#
################################################################################
Orderer: &OrdererDefaults
    OrdererType: etcdraft
    
    Addresses:
        - orderer.${central_bank_lower}.cbdc.com:7050
    
    EtcdRaft:
        Consenters:
        - Host: orderer.${central_bank_lower}.cbdc.com
          Port: 7050
          ClientTLSCert: ../organizations/ordererOrganizations/${central_bank_lower}.cbdc.com/orderers/orderer.${central_bank_lower}.cbdc.com/tls/server.crt
          ServerTLSCert: ../organizations/ordererOrganizations/${central_bank_lower}.cbdc.com/orderers/orderer.${central_bank_lower}.cbdc.com/tls/server.crt
    
    BatchTimeout: 2s
    BatchSize:
        MaxMessageCount: 10
        AbsoluteMaxBytes: 99 MB
        PreferredMaxBytes: 512 KB
    
    Organizations:
    
    Policies:
        Readers:
            Type: ImplicitMeta
            Rule: "ANY Readers"
        Writers:
            Type: ImplicitMeta
            Rule: "ANY Writers"
        Admins:
            Type: ImplicitMeta
            Rule: "MAJORITY Admins"
        BlockValidation:
            Type: ImplicitMeta
            Rule: "ANY Writers"

    Capabilities:
        <<: *OrdererCapabilities

################################################################################
#
#   频道配置
#
################################################################################
Channel: &ChannelDefaults
    Policies:
        Readers:
            Type: ImplicitMeta
            Rule: "ANY Readers"
        Writers:
            Type: ImplicitMeta
            Rule: "ANY Writers"
        Admins:
            Type: ImplicitMeta
            Rule: "MAJORITY Admins"

    Capabilities:
        <<: *ChannelCapabilities

################################################################################
#
#   配置文件定义
#
################################################################################
Profiles:

    # 创世区块配置
    ${channel_title}OrdererGenesis:
        <<: *ChannelDefaults
        Orderer:
            <<: *OrdererDefaults
            Organizations:
                - *${central_bank_name}
        Consortiums:
            CBDCConsortium:
                Organizations:
                    - *${central_bank_name}Peer
EOF

    # 添加银行组织到联盟
    for ((i=0; i<bank_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        cat >> "$output_file" << EOF
                    - *${bank_name}
EOF
    done

    # 添加频道配置
    cat >> "$output_file" << EOF

    # 频道配置
    ${channel_title}Channel:
        Consortium: CBDCConsortium
        <<: *ChannelDefaults
        Application:
            <<: *ApplicationDefaults
            Organizations:
                - *${central_bank_name}Peer
EOF

    # 添加银行组织到频道
    for ((i=0; i<bank_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        cat >> "$output_file" << EOF
                - *${bank_name}
EOF
    done

    # 添加标准应用频道配置（Fabric v2.5+）
    cat >> "$output_file" << EOF

    # 应用频道配置（标准Fabric v2.5+做法）
    CBDCChannel:
        <<: *ChannelDefaults
        Orderer:
            <<: *OrdererDefaults
            Organizations:
                - *${central_bank_name}
            Capabilities: *OrdererCapabilities
        Application:
            <<: *ApplicationDefaults
            Organizations:
                - *${central_bank_name}Peer
EOF

    # 添加银行组织到标准应用频道
    for ((i=0; i<bank_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        cat >> "$output_file" << EOF
                - *${bank_name}
EOF
    done

    cat >> "$output_file" << EOF
            Capabilities: *ApplicationCapabilities
EOF

    echo "configtx.yaml 已生成: $output_file"
}

# 主函数
main() {
    check_jq
    generate_configtx
    echo "✓ configtx.yaml 生成成功"
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 