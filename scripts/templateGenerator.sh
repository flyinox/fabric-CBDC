#!/usr/bin/env bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

# Template Generator Module for Hyperledger Fabric Network
# This script contains all template generation functions for creating
# dynamic network configurations, crypto configs, compose files, and chaincodes

# Load utility functions
. scripts/utils.sh

# Function to generate crypto-config files dynamically
function generateCryptoConfigs() {
  # Try to read network config
  if ! readNetworkConfig; then
    infoln "Using default crypto configuration"
    return 0
  fi
  
  infoln "🔑 Generating dynamic crypto-config files..."
  
  # Generate orderer crypto config
  cat > organizations/cryptogen/crypto-config-orderer.yaml << EOF
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# ---------------------------------------------------------------------------
# "OrdererOrgs" - Definition of organizations managing orderer nodes  
# ---------------------------------------------------------------------------
OrdererOrgs:
  - Name: ${NETWORK_ORDERER_NAME}
    Domain: ${NETWORK_ORDERER_DOMAIN}
    EnableNodeOUs: true
    # ---------------------------------------------------------------------------
    # "Specs"
    # ---------------------------------------------------------------------------
    Specs:
      - Hostname: orderer
        SANS:
          - localhost
    # ---------------------------------------------------------------------------
    # "Users"
    # ---------------------------------------------------------------------------
    Users:
      Count: 1
EOF

  # Generate peer org crypto configs
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    local org_name="${NETWORK_ORG_NAMES[$i]}"
    local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
    local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
    
    cat > "organizations/cryptogen/crypto-config-${org_lower}.yaml" << EOF
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# ---------------------------------------------------------------------------
# "PeerOrgs" - Definition of organizations managing peer nodes
# ---------------------------------------------------------------------------
PeerOrgs:
  - Name: ${org_name}
    Domain: ${org_domain}
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
    Users:
      Count: 1
EOF
  done
  
  infoln "✅ Crypto configuration files generated"
}

# Function to generate compose files dynamically
function generateComposeFiles() {
  # Try to read network config
  if ! readNetworkConfig; then
    infoln "Using default compose configuration"
    return 0
  fi
  
  infoln "🐳 Generating dynamic compose files..."
  
  # Generate main compose file
  local compose_file="compose/compose-test-net.yaml"
  
  cat > "$compose_file" << EOF
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

version: '3.7'

volumes:
EOF

  # Add volumes
  echo "  orderer.${NETWORK_ORDERER_DOMAIN}:" >> "$compose_file"
  
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
    echo "  peer0.${org_domain}:" >> "$compose_file"
  done
  
  cat >> "$compose_file" << EOF

networks:
  test:
    name: fabric_test

services:

  orderer.${NETWORK_ORDERER_DOMAIN}:
    container_name: orderer.${NETWORK_ORDERER_DOMAIN}
    image: hyperledger/fabric-orderer:latest
    labels:
      service: hyperledger-fabric
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=${NETWORK_ORDERER_PORT}
      - ORDERER_GENERAL_LOCALMSPID=${NETWORK_ORDERER_MSP_ID}
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
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:7053
      - ORDERER_OPERATIONS_LISTENADDRESS=orderer.${NETWORK_ORDERER_DOMAIN}:${NETWORK_ORDERER_OPERATIONS_PORT}
      - ORDERER_METRICS_PROVIDER=prometheus
    working_dir: /root
    command: orderer
    volumes:
        - ../organizations/ordererOrganizations/${NETWORK_ORDERER_DOMAIN}/orderers/orderer.${NETWORK_ORDERER_DOMAIN}/msp:/var/hyperledger/orderer/msp
        - ../organizations/ordererOrganizations/${NETWORK_ORDERER_DOMAIN}/orderers/orderer.${NETWORK_ORDERER_DOMAIN}/tls/:/var/hyperledger/orderer/tls
        - orderer.${NETWORK_ORDERER_DOMAIN}:/var/hyperledger/production/orderer
    ports:
      - ${NETWORK_ORDERER_PORT}:${NETWORK_ORDERER_PORT}
      - 7053:7053
      - ${NETWORK_ORDERER_OPERATIONS_PORT}:${NETWORK_ORDERER_OPERATIONS_PORT}
    networks:
      - test

EOF

  # Add peer services
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    local org_name="${NETWORK_ORG_NAMES[$i]}"
    local org_msp_id="${NETWORK_ORG_MSP_IDS[$i]}"
    local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
    local org_port="${NETWORK_ORG_PORTS[$i]}"
    local org_ops_port="${NETWORK_ORG_OPERATIONS_PORTS[$i]}"
    local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
    
    cat >> "$compose_file" << EOF
  peer0.${org_domain}:
    container_name: peer0.${org_domain}
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
      - CORE_PEER_ID=peer0.${org_domain}
      - CORE_PEER_ADDRESS=peer0.${org_domain}:${org_port}
      - CORE_PEER_LISTENADDRESS=0.0.0.0:${org_port}
      - CORE_PEER_CHAINCODEADDRESS=peer0.${org_domain}:$((org_port + 1))
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:$((org_port + 1))
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.${org_domain}:${org_port}
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.${org_domain}:${org_port}
      - CORE_PEER_LOCALMSPID=${org_msp_id}
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_OPERATIONS_LISTENADDRESS=peer0.${org_domain}:${org_ops_port}
      - CORE_METRICS_PROVIDER=prometheus
      - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG={"peername":"peer0${org_lower}"}
      - CORE_CHAINCODE_EXECUTETIMEOUT=300s
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric_test
    volumes:
      - ../organizations/peerOrganizations/${org_domain}/peers/peer0.${org_domain}:/etc/hyperledger/fabric
      - peer0.${org_domain}:/var/hyperledger/production
      - ../compose/docker/peercfg/core.yaml:/etc/hyperledger/peercfg/core.yaml
      - /var/run/docker.sock:/var/run/docker.sock
    working_dir: /root
    command: peer node start
    ports:
      - ${org_port}:${org_port}
      - ${org_ops_port}:${org_ops_port}
    networks:
      - test

EOF
  done
  
  infoln "✅ Compose file generated: $compose_file"
}

# Function to generate configtx.yaml dynamically
function generateConfigtx() {
  # Try to read network config
  if ! readNetworkConfig; then
    infoln "Using default configtx configuration"
    return 0
  fi
  
  infoln "⚙️ Generating dynamic configtx.yaml..."
  
  local configtx_file="configtx/configtx.yaml"
  
  cat > "$configtx_file" << EOF
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

---
################################################################################
#
#   Section: Organizations
#
#   - This section defines the different organizational identities which will
#   be referenced later in the configuration.
#
################################################################################
Organizations:
  - &${NETWORK_ORDERER_NAME}
    Name: ${NETWORK_ORDERER_NAME}
    ID: ${NETWORK_ORDERER_MSP_ID}
    MSPDir: ../organizations/ordererOrganizations/${NETWORK_ORDERER_DOMAIN}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${NETWORK_ORDERER_MSP_ID}.member')"
      Writers:
        Type: Signature
        Rule: "OR('${NETWORK_ORDERER_MSP_ID}.member')"
      Admins:
        Type: Signature
        Rule: "OR('${NETWORK_ORDERER_MSP_ID}.admin')"
    OrdererEndpoints:
      - orderer.${NETWORK_ORDERER_DOMAIN}:${NETWORK_ORDERER_PORT}
EOF

  # Add peer organizations
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    local org_name="${NETWORK_ORG_NAMES[$i]}"
    local org_msp_id="${NETWORK_ORG_MSP_IDS[$i]}"
    local org_domain="${NETWORK_ORG_DOMAINS[$i]}"
    
    cat >> "$configtx_file" << EOF
  - &${org_name}
    Name: ${org_msp_id}
    ID: ${org_msp_id}
    MSPDir: ../organizations/peerOrganizations/${org_domain}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${org_msp_id}.admin', '${org_msp_id}.peer', '${org_msp_id}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${org_msp_id}.admin', '${org_msp_id}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${org_msp_id}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${org_msp_id}.peer')"
EOF
  done

  # Add the rest of the configtx.yaml
  cat >> "$configtx_file" << EOF
################################################################################
#
#   SECTION: Capabilities
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
#   SECTION: Application
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
#   SECTION: Orderer
#
################################################################################
Orderer: &OrdererDefaults
  OrdererType: etcdraft
  Addresses:
    - orderer.${NETWORK_ORDERER_DOMAIN}:${NETWORK_ORDERER_PORT}
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
  EtcdRaft:
    Consenters:
    - Host: orderer.${NETWORK_ORDERER_DOMAIN}
      Port: ${NETWORK_ORDERER_PORT}
      ClientTLSCert: ../organizations/ordererOrganizations/${NETWORK_ORDERER_DOMAIN}/orderers/orderer.${NETWORK_ORDERER_DOMAIN}/tls/server.crt
      ServerTLSCert: ../organizations/ordererOrganizations/${NETWORK_ORDERER_DOMAIN}/orderers/orderer.${NETWORK_ORDERER_DOMAIN}/tls/server.crt
  Capabilities:
    <<: *OrdererCapabilities

################################################################################
#
#   CHANNEL
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
#   Profile
#
################################################################################
Profiles:
  ChannelUsingRaft:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *${NETWORK_ORDERER_NAME}
      Capabilities: *OrdererCapabilities
    Application:
      <<: *ApplicationDefaults
      Organizations:
EOF

  # Add organizations to the profile
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    local org_name="${NETWORK_ORG_NAMES[$i]}"
    echo "        - *${org_name}" >> "$configtx_file"
  done
  
  cat >> "$configtx_file" << EOF
      Capabilities: *ApplicationCapabilities
EOF
  
  infoln "✅ Configtx file generated: $configtx_file"
}

# Generate CBDC network configuration JSON
function generate_cbdc_network_config() {
  local channel_name="$1"
  local central_bank_name="$2"
  shift 2
  local banks=("$@")
  
  local config_file="network-config.json"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # All organizations (central bank + commercial banks)
  local all_orgs=("$central_bank_name" "${banks[@]}")
  
  # Start JSON
  cat > "$config_file" << EOF
{
  "_comment": "Generated by network.sh CBDC setup command",
  "_generated_time": "$timestamp",
  "_network_type": "CBDC",
  "_central_bank": "$central_bank_name",
  "_warning": "Do not edit this file manually. Use 'network.sh setup' to regenerate.",
  "network": {
    "channel_name": "$channel_name",
    "orderer": {
      "name": "OrdererOrg",
      "msp_id": "OrdererMSP",
      "domain": "example.com",
      "port": 7050,
      "operations_port": 9443
    },
    "organizations": [
EOF

  # Add organizations (central bank first, then commercial banks)
  local org_count=${#all_orgs[@]}
  for ((i=0; i<org_count; i++)); do
    local org_name="${all_orgs[$i]}"
    local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
    local peer_port=$((7051 + i * 1000))
    local operations_port=$((9444 + i))
    local couchdb_port=$((5984 + i * 1000))
    
    # Mark central bank
    local org_type="commercial_bank"
    if [ "$org_name" == "$central_bank_name" ]; then
      org_type="central_bank"
    fi
    
    cat >> "$config_file" << EOF
      {
        "name": "$org_name",
        "msp_id": "${org_name}MSP",
        "domain": "${org_lower}.example.com",
        "type": "$org_type",
        "peer": {
          "port": $peer_port,
          "operations_port": $operations_port,
          "couchdb_port": $couchdb_port
        }
      }
EOF
    
    if [ $i -lt $((org_count - 1)) ]; then
      echo "," >> "$config_file"
    fi
  done
  
  # Close JSON
  cat >> "$config_file" << EOF

    ]
  }
}
EOF
}

# Generate network configuration JSON
function generate_network_config() {
  local channel_name="$1"
  local orderer_name="$2"
  shift 2
  local orgs=("$@")
  
  local config_file="network-config.json"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Start JSON
  cat > "$config_file" << EOF
{
  "_comment": "Generated by network.sh setup command",
  "_generated_time": "$timestamp",
  "_warning": "Do not edit this file manually. Use 'network.sh setup' to regenerate.",
  "network": {
    "channel_name": "$channel_name",
    "orderer": {
      "name": "$orderer_name",
      "msp_id": "${orderer_name}MSP",
      "domain": "$(echo "$orderer_name" | tr '[:upper:]' '[:lower:]').example.com",
      "port": 7050,
      "operations_port": 9443
    },
    "organizations": [
EOF

  # Add organizations
  local org_count=${#orgs[@]}
  for ((i=0; i<org_count; i++)); do
    local org_name="${orgs[$i]}"
    local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
    local peer_port=$((7051 + i * 1000))
    local operations_port=$((9444 + i))
    local couchdb_port=$((5984 + i * 1000))
    
    cat >> "$config_file" << EOF
      {
        "name": "$org_name",
        "msp_id": "${org_name}MSP",
        "domain": "${org_lower}.example.com",
        "peer": {
          "port": $peer_port,
          "operations_port": $operations_port,
          "couchdb_port": $couchdb_port
        }
      }
EOF
    
    if [ $i -lt $((org_count - 1)) ]; then
      echo "," >> "$config_file"
    fi
  done
  
  # Close JSON
  cat >> "$config_file" << EOF

    ]
  }
}
EOF
}

# Generate chaincode from template with central bank MSP ID
function generate_chaincode_from_template() {
  local central_bank_name="$1"
  local central_msp_id="${central_bank_name}MSP"
  local template_file="chaincode/chaincode/token_contract.go.template"
  local output_file="chaincode/chaincode/token_contract.go"
  
  if [ ! -f "$template_file" ]; then
    errorln "Chaincode template not found: $template_file"
    return 1
  fi
  
  infoln "📝 从模板生成智能合约..."
  infoln "   央行 MSP ID: $central_msp_id"
  
  # Replace template placeholder with actual central bank MSP ID
  sed "s/{{CENTRAL_MSP_ID}}/$central_msp_id/g" "$template_file" > "$output_file"
  
  if [ $? -eq 0 ]; then
    successln "✅ 智能合约已生成: $output_file"
    infoln "   Mint 和 Burn 权限已设置为: $central_msp_id"
  else
    errorln "生成智能合约失败"
    return 1
  fi
}

# Validate network configuration
function validate_config() {
  local config_file="$1"
  
  if [ ! -f "$config_file" ]; then
    errorln "Configuration file not found: $config_file"
    exit 1
  fi
  
  # Check if jq is available for validation
  if command -v jq &> /dev/null; then
    if ! jq empty "$config_file" 2>/dev/null; then
      errorln "Invalid JSON format in configuration file: $config_file"
      exit 1
    fi
    
    # Validate required fields
    local channel_name=$(jq -r '.network.channel_name' "$config_file" 2>/dev/null)
    local orderer_name=$(jq -r '.network.orderer.name' "$config_file" 2>/dev/null)
    local org_count=$(jq '.network.organizations | length' "$config_file" 2>/dev/null)
    
    if [ "$channel_name" == "null" ] || [ -z "$channel_name" ]; then
      errorln "Missing or invalid channel name in configuration"
      exit 1
    fi
    
    if [ "$orderer_name" == "null" ] || [ -z "$orderer_name" ]; then
      errorln "Missing or invalid orderer name in configuration"
      exit 1
    fi
    
    if [ "$org_count" == "null" ] || [ "$org_count" -lt 1 ]; then
      errorln "No organizations defined in configuration"
      exit 1
    fi
    
    successln "Configuration validation passed"
  else
    warnln "jq not found, skipping JSON validation"
  fi
}

# Generate default CBDC configuration
function generate_cbdc_default_config() {
  local config_file="network-config.json"
  local channel_name="cbdc-channel"
  
  generate_cbdc_network_config "$channel_name" "CentralBank" "Bank1" "Bank2"
  
  # Generate chaincode from template
  generate_chaincode_from_template "CentralBank"
  
  successln "✅ 默认 CBDC 网络配置已保存到: $config_file"
  infoln "使用默认配置: 央行 (CentralBank) + 2个银行 (Bank1, Bank2)，频道 '$channel_name'"
}

# Generate default network configuration
function generate_default_config() {
  local config_file="network-config.json"
  local channel_name="${CHANNEL_NAME:-mychannel}"
  
  generate_network_config "$channel_name" "OrdererOrg" "Org1" "Org2"
  
  successln "✅ Default network configuration saved to: $config_file"
  infoln "Using default configuration: 2 organizations (Org1, Org2) with channel '$channel_name'"
} 