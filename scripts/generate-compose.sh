#!/bin/bash

# 生成 Docker Compose 文件脚本
# 基于 network-config.json 生成 docker-compose.yaml

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

# 生成 Docker Compose 文件
generate_compose() {
    local config_file="$(dirname "$0")/../configtx/network-config.json"
    local output_file="$(dirname "$0")/../compose/docker-compose.yaml"
    
    if [ ! -f "$config_file" ]; then
        echo "错误: 未找到网络配置文件 $config_file"
        echo "请先运行 network-config.sh 生成网络配置"
        exit 1
    fi
    
    echo "正在生成 docker-compose.yaml..."
    
    # 创建输出目录
    mkdir -p "$(dirname "$output_file")"
    
    # 读取配置
    local channel_name=$(jq -r '.network.channel_name' "$config_file")
    local central_bank_name=$(jq -r '.network.central_bank.name' "$config_file")
    local central_bank_lower=$(to_lower "$central_bank_name")
    local orderer_port=$(jq -r '.network.central_bank.orderer.port' "$config_file")
    local orderer_ops_port=$(jq -r '.network.central_bank.orderer.operations_port' "$config_file")
    local cb_peer_port=$(jq -r '.network.central_bank.peer.port' "$config_file")
    local cb_chaincode_port=$(jq -r '.network.central_bank.peer.chaincode_port' "$config_file")
    local cb_ops_port=$(jq -r '.network.central_bank.peer.operations_port' "$config_file")
    local cb_couchdb_port=$(jq -r '.network.central_bank.peer.couchdb_port' "$config_file")
    
    # 计算Orderer管理端口（避免冲突）
    local orderer_admin_port=$((orderer_ops_port + 100))
    
    # 开始生成 docker-compose.yaml
    cat > "$output_file" << EOF
#
# 此文件由 generate-compose.sh 脚本自动生成
# 基于 configtx/network-config.json 配置文件
# 请勿手动修改此文件！如需更改请修改 network-config.json 后重新生成
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
#

# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

version: '3.7'

volumes:
  orderer.${central_bank_lower}.cbdc.com:
  peer0.${central_bank_lower}.cbdc.com:
  couchdb.${central_bank_lower}.cbdc.com:
EOF

    # 添加银行卷
    local banks_count=$(jq '.network.banks | length' "$config_file")
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_lower=$(to_lower "$bank_name")
        cat >> "$output_file" << EOF
  peer0.${bank_lower}.cbdc.com:
  couchdb.${bank_lower}.cbdc.com:
EOF
    done

    # 添加网络定义
    cat >> "$output_file" << EOF

networks:
  cbdc:
    name: fabric_cbdc

services:

  # 央行排序节点
  orderer.${central_bank_lower}.cbdc.com:
    container_name: orderer.${central_bank_lower}.cbdc.com
    image: hyperledger/fabric-orderer:latest
    labels:
      service: hyperledger-fabric
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=${orderer_port}
      - ORDERER_GENERAL_LOCALMSPID=${central_bank_name}MSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_CLUSTER_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:${orderer_admin_port}
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer.${central_bank_lower}.cbdc.com:${orderer_ops_port}
      - ORDERER_METRICS_PROVIDER=prometheus
    working_dir: /root
    command: orderer
    volumes:
        - ../organizations/ordererOrganizations/${central_bank_lower}.cbdc.com/orderers/orderer.${central_bank_lower}.cbdc.com/msp:/var/hyperledger/orderer/msp
        - ../organizations/ordererOrganizations/${central_bank_lower}.cbdc.com/orderers/orderer.${central_bank_lower}.cbdc.com/tls/:/var/hyperledger/orderer/tls
        - orderer.${central_bank_lower}.cbdc.com:/var/hyperledger/production/orderer
    ports:
      - ${orderer_port}:${orderer_port}
      - ${orderer_ops_port}:${orderer_ops_port}
      - ${orderer_admin_port}:${orderer_admin_port}
    networks:
      - cbdc

  # 央行CouchDB
  couchdb.${central_bank_lower}.cbdc.com:
    container_name: couchdb.${central_bank_lower}.cbdc.com
    image: couchdb:3.3.0
    labels:
      service: hyperledger-fabric
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "${cb_couchdb_port}:5984"
    volumes:
      - couchdb.${central_bank_lower}.cbdc.com:/opt/couchdb/data
    networks:
      - cbdc

  # 央行Peer节点
  peer0.${central_bank_lower}.cbdc.com:
    container_name: peer0.${central_bank_lower}.cbdc.com
    image: hyperledger/fabric-peer:latest
    labels:
      service: hyperledger-fabric
    environment:
      - FABRIC_CFG_PATH=/etc/hyperledger/peercfg
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_PROFILE_ENABLED=false
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_PEER_ID=peer0.${central_bank_lower}.cbdc.com
      - CORE_PEER_ADDRESS=peer0.${central_bank_lower}.cbdc.com:${cb_peer_port}
      - CORE_PEER_LISTENADDRESS=0.0.0.0:${cb_peer_port}
      - CORE_PEER_CHAINCODEADDRESS=peer0.${central_bank_lower}.cbdc.com:${cb_chaincode_port}
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:${cb_chaincode_port}
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.${central_bank_lower}.cbdc.com:${cb_peer_port}
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.${central_bank_lower}.cbdc.com:${cb_peer_port}
      - CORE_PEER_LOCALMSPID=${central_bank_name}PeerMSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_OPERATIONS_LISTENADDRESS=peer0.${central_bank_lower}.cbdc.com:${cb_ops_port}
      - CORE_METRICS_PROVIDER=prometheus
      - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG={"peername":"peer0${central_bank_lower}"}
      - CORE_CHAINCODE_EXECUTETIMEOUT=300s
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.${central_bank_lower}.cbdc.com:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
    volumes:
      - /var/run/:/host/var/run/
      - ../organizations/peerOrganizations/${central_bank_lower}.cbdc.com/peers/peer0.${central_bank_lower}.cbdc.com/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/${central_bank_lower}.cbdc.com/peers/peer0.${central_bank_lower}.cbdc.com/tls:/etc/hyperledger/fabric/tls
      - ../organizations/peerOrganizations/${central_bank_lower}.cbdc.com/peers/peer0.${central_bank_lower}.cbdc.com:/var/hyperledger/production
      - ../configtx/core.yaml:/etc/hyperledger/peercfg/core.yaml
    working_dir: /root
    command: peer node start
    ports:
      - ${cb_peer_port}:${cb_peer_port}
      - ${cb_ops_port}:${cb_ops_port}
    depends_on:
      - couchdb.${central_bank_lower}.cbdc.com
    networks:
      - cbdc

EOF

    # 添加银行节点
    for ((i=0; i<banks_count; i++)); do
        local bank_name=$(jq -r ".network.banks[$i].name" "$config_file")
        local bank_lower=$(to_lower "$bank_name")
        local bank_peer_port=$(jq -r ".network.banks[$i].peer.port" "$config_file")
        local bank_chaincode_port=$(jq -r ".network.banks[$i].peer.chaincode_port" "$config_file")
        local bank_ops_port=$(jq -r ".network.banks[$i].peer.operations_port" "$config_file")
        local bank_couchdb_port=$(jq -r ".network.banks[$i].peer.couchdb_port" "$config_file")
        
        cat >> "$output_file" << EOF
  # ${bank_name} CouchDB
  couchdb.${bank_lower}.cbdc.com:
    container_name: couchdb.${bank_lower}.cbdc.com
    image: couchdb:3.3.0
    labels:
      service: hyperledger-fabric
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "${bank_couchdb_port}:5984"
    volumes:
      - couchdb.${bank_lower}.cbdc.com:/opt/couchdb/data
    networks:
      - cbdc

  # ${bank_name} Peer节点
  peer0.${bank_lower}.cbdc.com:
    container_name: peer0.${bank_lower}.cbdc.com
    image: hyperledger/fabric-peer:latest
    labels:
      service: hyperledger-fabric
    environment:
      - FABRIC_CFG_PATH=/etc/hyperledger/peercfg
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_PROFILE_ENABLED=false
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_PEER_ID=peer0.${bank_lower}.cbdc.com
      - CORE_PEER_ADDRESS=peer0.${bank_lower}.cbdc.com:${bank_peer_port}
      - CORE_PEER_LISTENADDRESS=0.0.0.0:${bank_peer_port}
      - CORE_PEER_CHAINCODEADDRESS=peer0.${bank_lower}.cbdc.com:${bank_chaincode_port}
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:${bank_chaincode_port}
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.${bank_lower}.cbdc.com:${bank_peer_port}
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.${central_bank_lower}.cbdc.com:${cb_peer_port}
      - CORE_PEER_LOCALMSPID=${bank_name}MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_OPERATIONS_LISTENADDRESS=peer0.${bank_lower}.cbdc.com:${bank_ops_port}
      - CORE_METRICS_PROVIDER=prometheus
      - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG={"peername":"peer0${bank_lower}"}
      - CORE_CHAINCODE_EXECUTETIMEOUT=300s
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.${bank_lower}.cbdc.com:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
    volumes:
      - /var/run/:/host/var/run/
      - ../organizations/peerOrganizations/${bank_lower}.cbdc.com/peers/peer0.${bank_lower}.cbdc.com/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/${bank_lower}.cbdc.com/peers/peer0.${bank_lower}.cbdc.com/tls:/etc/hyperledger/fabric/tls
      - ../organizations/peerOrganizations/${bank_lower}.cbdc.com/peers/peer0.${bank_lower}.cbdc.com:/var/hyperledger/production
      - ../configtx/core.yaml:/etc/hyperledger/peercfg/core.yaml
    working_dir: /root
    command: peer node start
    ports:
      - ${bank_peer_port}:${bank_peer_port}
      - ${bank_ops_port}:${bank_ops_port}
    depends_on:
      - couchdb.${bank_lower}.cbdc.com
    networks:
      - cbdc

EOF
    done

    echo "docker-compose.yaml 已生成: $output_file"
}

# 主函数
main() {
    case "${1:-generate}" in
        "generate")
            check_jq
            generate_compose
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [命令]"
            echo ""
            echo "命令:"
            echo "  generate    生成 docker-compose.yaml 文件"
            echo "  help        显示帮助信息"
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