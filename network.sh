#!/usr/bin/env bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

# This script brings up a Hyperledger Fabric network for testing smart contracts
# and applications. The test network consists of two organizations with one
# peer each, and a single node Raft ordering service. Users can also use this
# script to create a channel deploy a chaincode on the channel
#
# prepending $PWD/../bin to PATH to ensure we are picking up the correct binaries
# this may be commented out to resolve installed version of tools if desired
#
# However using PWD in the path has the side effect that location that
# this script is run from is critical. To ease this, get the directory
# this script is actually in and infer location from there. (putting first)

ROOTDIR=$(cd "$(dirname "$0")" && pwd)
export PATH=${ROOTDIR}/bin:${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/configtx
export VERBOSE=false

# Load CBDC utility functions
. scripts/cbdcutil.sh

# Global variables for network configuration
NETWORK_CONFIG_LOADED=false
NETWORK_CHANNEL_NAME=""
NETWORK_ORDERER_NAME=""
NETWORK_ORDERER_MSP_ID=""
NETWORK_ORDERER_DOMAIN=""
NETWORK_ORDERER_PORT=""
NETWORK_ORDERER_OPERATIONS_PORT=""
NETWORK_ORGS_COUNT=0
NETWORK_ORG_NAMES=()
NETWORK_ORG_MSP_IDS=()
NETWORK_ORG_DOMAINS=()
NETWORK_ORG_PORTS=()
NETWORK_ORG_OPERATIONS_PORTS=()
NETWORK_ORG_COUCHDB_PORTS=()

# Function to read network configuration from JSON file
function readNetworkConfig() {
  local config_file="network-config.json"
  
  if [ ! -f "$config_file" ]; then
    warnln "Network configuration file $config_file not found. Using default configuration."
    return 1
  fi
  
  # Validate JSON format
  if ! jq --version > /dev/null 2>&1; then
    warnln "jq not found. Please install jq to use network-config.json. Using default configuration."
    return 1
  fi
  
  if ! jq empty "$config_file" 2>/dev/null; then
    fatalln "Invalid JSON format in $config_file"
  fi
  
  # Read configuration values
  NETWORK_CHANNEL_NAME=$(jq -r '.network.channel_name // "mychannel"' "$config_file")
  NETWORK_ORDERER_NAME=$(jq -r '.network.orderer.name // "OrdererOrg"' "$config_file")
  NETWORK_ORDERER_MSP_ID=$(jq -r '.network.orderer.msp_id // "OrdererMSP"' "$config_file")
  NETWORK_ORDERER_DOMAIN=$(jq -r '.network.orderer.domain // "example.com"' "$config_file")
  NETWORK_ORDERER_PORT=$(jq -r '.network.orderer.port // 7050' "$config_file")
  NETWORK_ORDERER_OPERATIONS_PORT=$(jq -r '.network.orderer.operations_port // 9443' "$config_file")
  
  # Read organizations
  NETWORK_ORGS_COUNT=$(jq -r '.network.organizations | length' "$config_file")
  
  # Clear arrays
  NETWORK_ORG_NAMES=()
  NETWORK_ORG_MSP_IDS=()
  NETWORK_ORG_DOMAINS=()
  NETWORK_ORG_PORTS=()
  NETWORK_ORG_OPERATIONS_PORTS=()
  NETWORK_ORG_COUCHDB_PORTS=()
  
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    NETWORK_ORG_NAMES+=("$(jq -r ".network.organizations[$i].name" "$config_file")")
    NETWORK_ORG_MSP_IDS+=("$(jq -r ".network.organizations[$i].msp_id" "$config_file")")
    NETWORK_ORG_DOMAINS+=("$(jq -r ".network.organizations[$i].domain" "$config_file")")
    NETWORK_ORG_PORTS+=("$(jq -r ".network.organizations[$i].peer.port" "$config_file")")
    NETWORK_ORG_OPERATIONS_PORTS+=("$(jq -r ".network.organizations[$i].peer.operations_port" "$config_file")")
    NETWORK_ORG_COUCHDB_PORTS+=("$(jq -r ".network.organizations[$i].peer.couchdb_port" "$config_file")")
  done
  
  # Override channel name if specified in config
  if [ ! -z "$NETWORK_CHANNEL_NAME" ] && [ "$NETWORK_CHANNEL_NAME" != "mychannel" ]; then
    CHANNEL_NAME="$NETWORK_CHANNEL_NAME"
  fi
  
  NETWORK_CONFIG_LOADED=true
  
  infoln "✅ Network configuration loaded from $config_file"
  infoln "   - Channel: $NETWORK_CHANNEL_NAME"
  infoln "   - Orderer: $NETWORK_ORDERER_NAME ($NETWORK_ORDERER_MSP_ID)"
  infoln "   - Organizations: $NETWORK_ORGS_COUNT"
  for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
    infoln "     * ${NETWORK_ORG_NAMES[$i]} (${NETWORK_ORG_MSP_IDS[$i]}) - Port: ${NETWORK_ORG_PORTS[$i]}"
  done
  
  return 0
}

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

# push to the required directory & set a trap to go back if needed
pushd ${ROOTDIR} > /dev/null
trap "popd > /dev/null" EXIT

. scripts/utils.sh

: ${CONTAINER_CLI:="docker"}
if command -v ${CONTAINER_CLI}-compose > /dev/null 2>&1; then
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI}-compose"}
else
    : ${CONTAINER_CLI_COMPOSE:="${CONTAINER_CLI} compose"}
fi
infoln "Using ${CONTAINER_CLI} and ${CONTAINER_CLI_COMPOSE}"

# Obtain CONTAINER_IDS and remove them
# This function is called when you bring a network down
function clearContainers() {
  infoln "Removing remaining containers"
  ${CONTAINER_CLI} rm -f $(${CONTAINER_CLI} ps -aq --filter label=service=hyperledger-fabric) 2>/dev/null || true
  ${CONTAINER_CLI} rm -f $(${CONTAINER_CLI} ps -aq --filter name='dev-peer*') 2>/dev/null || true
  ${CONTAINER_CLI} kill "$(${CONTAINER_CLI} ps -q --filter name=ccaas)" 2>/dev/null || true
}

# Delete any images that were generated as a part of this setup
# specifically the following images are often left behind:
# This function is called when you bring the network down
function removeUnwantedImages() {
  infoln "Removing generated chaincode docker images"
  ${CONTAINER_CLI} image rm -f $(${CONTAINER_CLI} images -aq --filter reference='dev-peer*') 2>/dev/null || true
}

# Versions of fabric known not to work with the test network
NONWORKING_VERSIONS="^1\.0\. ^1\.1\. ^1\.2\. ^1\.3\. ^1\.4\."

# Do some basic sanity checking to make sure that the appropriate versions of fabric
# binaries/images are available. In the future, additional checking for the presence
# of go or other items could be added.
function checkPrereqs() {
  ## Check if Fabric binaries are available.
  peer version > /dev/null 2>&1

  if [[ $? -ne 0 ]]; then
    errorln "Peer binary not found.."
    errorln
    errorln "Follow the instructions in the Fabric docs to install the Fabric Binaries:"
    errorln "https://hyperledger-fabric.readthedocs.io/en/latest/install.html"
    exit 1
  fi
  # use the fabric peer container to see if the samples and binaries match your
  # docker images
  LOCAL_VERSION=$(peer version | sed -ne 's/^ Version: //p')
  DOCKER_IMAGE_VERSION=$(${CONTAINER_CLI} run --rm hyperledger/fabric-peer:latest peer version | sed -ne 's/^ Version: //p')

  infoln "LOCAL_VERSION=$LOCAL_VERSION"
  infoln "DOCKER_IMAGE_VERSION=$DOCKER_IMAGE_VERSION"

  if [ "$LOCAL_VERSION" != "$DOCKER_IMAGE_VERSION" ]; then
    warnln "Local fabric binaries and docker images are out of sync. This may cause problems."
  fi

  for UNSUPPORTED_VERSION in $NONWORKING_VERSIONS; do
    infoln "$LOCAL_VERSION" | grep -q $UNSUPPORTED_VERSION
    if [ $? -eq 0 ]; then
      fatalln "Local Fabric binary version of $LOCAL_VERSION does not match the versions supported by the test network."
    fi

    infoln "$DOCKER_IMAGE_VERSION" | grep -q $UNSUPPORTED_VERSION
    if [ $? -eq 0 ]; then
      fatalln "Fabric Docker image version of $DOCKER_IMAGE_VERSION does not match the versions supported by the test network."
    fi
  done

  ## Check for fabric-ca
  if [ "$CRYPTO" == "Certificate Authorities" ]; then

    fabric-ca-client version > /dev/null 2>&1
    if [[ $? -ne 0 ]]; then
      errorln "fabric-ca-client binary not found.."
      errorln
      errorln "Follow the instructions in the Fabric docs to install the Fabric Binaries:"
      errorln "https://hyperledger-fabric.readthedocs.io/en/latest/install.html"
      exit 1
    fi
    CA_LOCAL_VERSION=$(fabric-ca-client version | sed -ne 's/ Version: //p')
    CA_DOCKER_IMAGE_VERSION=$(${CONTAINER_CLI} run --rm hyperledger/fabric-ca:latest fabric-ca-client version | sed -ne 's/ Version: //p' | head -1)
    infoln "CA_LOCAL_VERSION=$CA_LOCAL_VERSION"
    infoln "CA_DOCKER_IMAGE_VERSION=$CA_DOCKER_IMAGE_VERSION"

    if [ "$CA_LOCAL_VERSION" != "$CA_DOCKER_IMAGE_VERSION" ]; then
      warnln "Local fabric-ca binaries and docker images are out of sync. This may cause problems."
    fi
  fi
}

# Before you can bring up a network, each organization needs to generate the crypto
# material that will define that organization on the network. Because Hyperledger
# Fabric is a permissioned blockchain, each node and user on the network needs to
# use certificates and keys to sign and verify its actions. In addition, each user
# needs to belong to an organization that is recognized as a member of the network.
# You can use the Cryptogen tool or Fabric CAs to generate the organization crypto
# material.

# By default, the sample network uses cryptogen. Cryptogen is a tool that is
# meant for development and testing that can quickly create the certificates and keys
# that can be consumed by a Fabric network. The cryptogen tool consumes a series
# of configuration files for each organization in the "organizations/cryptogen"
# directory. Cryptogen uses the files to generate the crypto  material for each
# org in the "organizations" directory.

# You can also use Fabric CAs to generate the crypto material. CAs sign the certificates
# and keys that they generate to create a valid root of trust for each organization.
# The script uses Docker Compose to bring up three CAs, one for each peer organization
# and the ordering organization. The configuration file for creating the Fabric CA
# servers are in the "organizations/fabric-ca" directory. Within the same directory,
# the "registerEnroll.sh" script uses the Fabric CA client to create the identities,
# certificates, and MSP folders that are needed to create the test network in the
# "organizations/ordererOrganizations" directory.

# Create Organization crypto material using cryptogen or CAs
function createOrgs() {
  if [ -d "organizations/peerOrganizations" ]; then
    rm -Rf organizations/peerOrganizations && rm -Rf organizations/ordererOrganizations
  fi

  # Generate dynamic crypto configs first
  generateCryptoConfigs
  
  # Generate dynamic configtx.yaml
  generateConfigtx

  # Create crypto material using cryptogen
  if [ "$CRYPTO" == "cryptogen" ]; then
    which cryptogen
    if [ "$?" -ne 0 ]; then
      fatalln "cryptogen tool not found. exiting"
    fi
    infoln "Generating certificates using cryptogen tool"

    # Generate for dynamic or default organizations
    if [ "$NETWORK_CONFIG_LOADED" = true ]; then
      # Dynamic organization generation
      for i in $(seq 0 $((NETWORK_ORGS_COUNT - 1))); do
        local org_name="${NETWORK_ORG_NAMES[$i]}"
        local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
        
        infoln "Creating ${org_name} Identities"
        
        set -x
        cryptogen generate --config=./organizations/cryptogen/crypto-config-${org_lower}.yaml --output="organizations"
        res=$?
        { set +x; } 2>/dev/null
        if [ $res -ne 0 ]; then
          fatalln "Failed to generate certificates for ${org_name}..."
        fi
      done
      
      infoln "Creating ${NETWORK_ORDERER_NAME} Identities"
      
      set -x
      cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output="organizations"
      res=$?
      { set +x; } 2>/dev/null
      if [ $res -ne 0 ]; then
        fatalln "Failed to generate certificates for orderer..."
      fi
    else
      # Default organization generation (Org1, Org2, OrdererOrg)
      infoln "Creating Org1 Identities"

      set -x
      cryptogen generate --config=./organizations/cryptogen/crypto-config-org1.yaml --output="organizations"
      res=$?
      { set +x; } 2>/dev/null
      if [ $res -ne 0 ]; then
        fatalln "Failed to generate certificates..."
      fi

      infoln "Creating Org2 Identities"

      set -x
      cryptogen generate --config=./organizations/cryptogen/crypto-config-org2.yaml --output="organizations"
      res=$?
      { set +x; } 2>/dev/null
      if [ $res -ne 0 ]; then
        fatalln "Failed to generate certificates..."
      fi

      infoln "Creating Orderer Org Identities"

      set -x
      cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output="organizations"
      res=$?
      { set +x; } 2>/dev/null
      if [ $res -ne 0 ]; then
        fatalln "Failed to generate certificates..."
      fi
    fi

  fi

  # Create crypto material using Fabric CA
  if [ "$CRYPTO" == "Certificate Authorities" ]; then
    infoln "Generating certificates using Fabric CA"
    ${CONTAINER_CLI_COMPOSE} -f compose/$COMPOSE_FILE_CA -f compose/$CONTAINER_CLI/${CONTAINER_CLI}-$COMPOSE_FILE_CA up -d 2>&1

    . organizations/fabric-ca/registerEnroll.sh

    # Make sure CA files have been created
    while :
    do
      if [ ! -f "organizations/fabric-ca/org1/tls-cert.pem" ]; then
        sleep 1
      else
        break
      fi
    done

    # Make sure CA service is initialized and can accept requests before making register and enroll calls
    export FABRIC_CA_CLIENT_HOME=${PWD}/organizations/peerOrganizations/org1.example.com/
    COUNTER=0
    rc=1
    while [[ $rc -ne 0 && $COUNTER -lt $MAX_RETRY ]]; do
      sleep 1
      set -x
      fabric-ca-client getcainfo -u https://admin:adminpw@localhost:7054 --caname ca-org1 --tls.certfiles "${PWD}/organizations/fabric-ca/org1/ca-cert.pem"
      res=$?
    { set +x; } 2>/dev/null
    rc=$res  # Update rc
    COUNTER=$((COUNTER + 1))
    done

    infoln "Creating Org1 Identities"

    createOrg1

    infoln "Creating Org2 Identities"

    createOrg2

    infoln "Creating Orderer Org Identities"

    createOrderer

  fi

  infoln "Generating CCP (Connection Configuration Profile) files"
  # ./organizations/ccp-generate.sh  # Skip CCP generation for now
}

# Once you create the organization crypto material, you need to create the
# genesis block of the application channel.

# The configtxgen tool is used to create the genesis block. Configtxgen consumes a
# "configtx.yaml" file that contains the definitions for the sample network. The
# genesis block is defined using the "ChannelUsingRaft" profile at the bottom
# of the file. This profile defines an application channel consisting of our two Peer Orgs.
# The peer and ordering organizations are defined in the "Profiles" section at the
# top of the file. As part of each organization profile, the file points to the
# location of the MSP directory for each member. This MSP is used to create the channel
# MSP that defines the root of trust for each organization. In essence, the channel
# MSP allows the nodes and users to be recognized as network members.
#
# If you receive the following warning, it can be safely ignored:
#
# [bccsp] GetDefault -> WARN 001 Before using BCCSP, please call InitFactories(). Falling back to bootBCCSP.
#
# You can ignore the logs regarding intermediate certs, we are not using them in
# this crypto implementation.

# After we create the org crypto material and the application channel genesis block,
# we can now bring up the peers and ordering service. By default, the base
# file for creating the network is "docker-compose-test-net.yaml" in the ``docker``
# folder. This file defines the environment variables and file mounts that
# point the crypto material and genesis block that were created in earlier.

# Bring up the peer and orderer nodes using docker compose.
function networkUp() {

  checkPrereqs

  # generate artifacts if they don't exist
  if [ ! -d "organizations/peerOrganizations" ]; then
    createOrgs
  fi

  # Generate dynamic compose files
  generateComposeFiles

  # Check if we have dynamic network configuration
  if [[ "$NETWORK_CONFIG_LOADED" == "true" ]]; then
    # Use only dynamic compose files when network config is loaded
    COMPOSE_FILES="-f compose/${COMPOSE_FILE_BASE}"
    
    if [ "${DATABASE}" == "couchdb" ]; then
      COMPOSE_FILES="${COMPOSE_FILES} -f compose/${COMPOSE_FILE_COUCH}"
    fi
    
    infoln "🔄 Using dynamic compose configuration (network-config.json loaded)"
  else
    # Use traditional compose files for backward compatibility
    COMPOSE_FILES="-f compose/${COMPOSE_FILE_BASE} -f compose/${CONTAINER_CLI}/${CONTAINER_CLI}-${COMPOSE_FILE_BASE}"
    
    if [ "${DATABASE}" == "couchdb" ]; then
      COMPOSE_FILES="${COMPOSE_FILES} -f compose/${COMPOSE_FILE_COUCH} -f compose/${CONTAINER_CLI}/${CONTAINER_CLI}-${COMPOSE_FILE_COUCH}"
    fi
    
    infoln "📁 Using traditional compose configuration (org1/org2)"
  fi

  DOCKER_SOCK="${DOCKER_SOCK}" ${CONTAINER_CLI_COMPOSE} ${COMPOSE_FILES} up -d 2>&1

  $CONTAINER_CLI ps -a
  if [ $? -ne 0 ]; then
    fatalln "Unable to start network"
  fi
}

# call the script to create the channel, join the peers of org1 and org2,
# and then update the anchor peers for each organization
function createChannel() {
  # Bring up the network if it is not already up.
  bringUpNetwork="false"

  if ! $CONTAINER_CLI info > /dev/null 2>&1 ; then
    fatalln "$CONTAINER_CLI network is required to be running to create a channel"
  fi

  # check if all containers are present
  CONTAINERS=($($CONTAINER_CLI ps | grep hyperledger/ | awk '{print $2}'))
  len=$(echo ${#CONTAINERS[@]})

  if [[ $len -ge 4 ]] && [[ ! -d "organizations/peerOrganizations" ]]; then
    echo "Bringing network down to sync certs with containers"
    networkDown
  fi

  [[ $len -lt 4 ]] || [[ ! -d "organizations/peerOrganizations" ]] && bringUpNetwork="true" || echo "Network Running Already"

  if [ $bringUpNetwork == "true"  ]; then
    infoln "Bringing up network"
    networkUp
  fi

  # now run the script that creates a channel. This script uses configtxgen once
  # to create the channel creation transaction and the anchor peer updates.
  scripts/createChannel.sh $CHANNEL_NAME $CLI_DELAY $MAX_RETRY $VERBOSE
}


## Call the script to deploy a chaincode to the channel
function deployCC() {
  scripts/deployCC.sh $CHANNEL_NAME $CC_NAME $CC_SRC_PATH $CC_SRC_LANGUAGE $CC_VERSION $CC_SEQUENCE $CC_INIT_FCN $CC_END_POLICY $CC_COLL_CONFIG $CLI_DELAY $MAX_RETRY $VERBOSE

  if [ $? -ne 0 ]; then
    fatalln "Deploying chaincode failed"
  fi
}

## Call the script to deploy a chaincode to the channel
function deployCCAAS() {
  scripts/deployCCAAS.sh $CHANNEL_NAME $CC_NAME $CC_SRC_PATH $CCAAS_DOCKER_RUN $CC_VERSION $CC_SEQUENCE $CC_INIT_FCN $CC_END_POLICY $CC_COLL_CONFIG $CLI_DELAY $MAX_RETRY $VERBOSE $CCAAS_DOCKER_RUN

  if [ $? -ne 0 ]; then
    fatalln "Deploying chaincode-as-a-service failed"
  fi
}

## Call the script to package the chaincode
function packageChaincode() {

  infoln "Packaging chaincode"

  scripts/packageCC.sh $CC_NAME $CC_SRC_PATH $CC_SRC_LANGUAGE $CC_VERSION true

  if [ $? -ne 0 ]; then
    fatalln "Packaging the chaincode failed"
  fi

}

## Call the script to list installed and committed chaincode on a peer
function listChaincode() {

  export FABRIC_CFG_PATH=${PWD}/../config

  . scripts/envVar.sh
  . scripts/ccutils.sh

  setGlobals $ORG

  println
  queryInstalledOnPeer
  println

  listAllCommitted

}

## Call the script to invoke 
function invokeChaincode() {

  export FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg
  export CLI_DELAY=${CLI_DELAY:-3}
  export MAX_RETRY=${MAX_RETRY:-5}
  export DELAY=${CLI_DELAY}

  . scripts/envVar.sh
  . scripts/ccutils.sh

  setGlobals $ORG

  chaincodeInvoke $ORG $CHANNEL_NAME $CC_NAME $CC_INVOKE_CONSTRUCTOR

}

## Call the script to query chaincode 
function queryChaincode() {

  export FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg
  export CLI_DELAY=${CLI_DELAY:-3}
  export MAX_RETRY=${MAX_RETRY:-5}
  export DELAY=${CLI_DELAY}
  
  . scripts/envVar.sh
  . scripts/ccutils.sh

  setGlobals $ORG

  chaincodeQuery $ORG $CHANNEL_NAME $CC_NAME $CC_QUERY_CONSTRUCTOR

}


# Bring down running network
function networkDown() {
  # Try to read network config for proper cleanup
  readNetworkConfig
  
  local temp_compose=${COMPOSE_FILE_BASE}
  if [ "${DATABASE}" == "couchdb" ]; then
    COMPOSE_FILE_BASE=${COMPOSE_FILE_BASE}-couch.yaml
  fi

  if [ "${CRYPTO}" == "Certificate Authorities" ]; then
    ${CONTAINER_CLI_COMPOSE} -f compose/${COMPOSE_FILE_BASE} -f compose/${CONTAINER_CLI}/${CONTAINER_CLI}-${COMPOSE_FILE_CA} down --volumes --remove-orphans
  else
    ${CONTAINER_CLI_COMPOSE} -f compose/${COMPOSE_FILE_BASE} -f compose/${CONTAINER_CLI}/${CONTAINER_CLI}-${COMPOSE_FILE_BASE} down --volumes --remove-orphans
  fi

  COMPOSE_FILE_BASE=${temp_compose}

  # Don't remove the generated artifacts -- note, the ledgers are always removed
  if [ "$MODE" != "restart" ]; then
    # Enhanced volume cleanup - remove all fabric-related volumes
    infoln "🧹 Cleaning up Fabric data volumes..."
    
    # Get all fabric-related volumes and remove them
    local fabric_volumes=$(${CONTAINER_CLI} volume ls -q | grep -E "(orderer|peer)" || true)
    if [ ! -z "$fabric_volumes" ]; then
      echo "$fabric_volumes" | xargs ${CONTAINER_CLI} volume rm 2>/dev/null || true
      successln "✅ Fabric data volumes cleaned"
    else
      infoln "No Fabric volumes found to clean"
    fi
    
    #Cleanup the chaincode containers
    clearContainers
    #Cleanup images
    removeUnwantedImages
    # remove orderer block and other channel configuration transactions and certs
    ${CONTAINER_CLI} run --rm -v "$(pwd):/data" busybox sh -c 'cd /data && rm -rf system-genesis-block/*.block organizations/peerOrganizations organizations/ordererOrganizations'
    ## remove fabric ca artifacts
    ${CONTAINER_CLI} run --rm -v "$(pwd):/data" busybox sh -c 'cd /data && rm -rf organizations/fabric-ca/org1/msp organizations/fabric-ca/org1/tls-cert.pem organizations/fabric-ca/org1/ca-cert.pem organizations/fabric-ca/org1/IssuerPublicKey organizations/fabric-ca/org1/IssuerRevocationPublicKey organizations/fabric-ca/org1/fabric-ca-server.db'
    ${CONTAINER_CLI} run --rm -v "$(pwd):/data" busybox sh -c 'cd /data && rm -rf organizations/fabric-ca/org2/msp organizations/fabric-ca/org2/tls-cert.pem organizations/fabric-ca/org2/ca-cert.pem organizations/fabric-ca/org2/IssuerPublicKey organizations/fabric-ca/org2/IssuerRevocationPublicKey organizations/fabric-ca/org2/fabric-ca-server.db'
    ${CONTAINER_CLI} run --rm -v "$(pwd):/data" busybox sh -c 'cd /data && rm -rf organizations/fabric-ca/ordererOrg/msp organizations/fabric-ca/ordererOrg/tls-cert.pem organizations/fabric-ca/ordererOrg/ca-cert.pem organizations/fabric-ca/ordererOrg/IssuerPublicKey organizations/fabric-ca/ordererOrg/IssuerRevocationPublicKey organizations/fabric-ca/ordererOrg/fabric-ca-server.db'
    # remove channel and script artifacts
    ${CONTAINER_CLI} run --rm -v "$(pwd):/data" busybox sh -c 'cd /data && rm -rf channel-artifacts log.txt *.tar.gz'
  fi
}

# Completely clean network (down + volume cleanup + artifacts cleanup)
function networkClean() {
  warnln "🚨 This will completely remove all network data, volumes, and artifacts!"
  printf "Are you sure you want to continue? [y/N]: "
  read -r response
  case "$response" in
    [yY][eE][sS]|[yY]) 
      infoln "🧹 Starting complete network cleanup..."
      ;;
    *)
      infoln "Cleanup cancelled."
      return 0
      ;;
  esac
  
  # First, bring down the network
  networkDown
  
  # Additional cleanup: remove ALL fabric-related volumes (even if not caught by networkDown)
  infoln "🧹 Performing deep volume cleanup..."
  local all_fabric_volumes=$(${CONTAINER_CLI} volume ls -q | grep -E "(compose_|docker_)?(orderer|peer)" || true)
  if [ ! -z "$all_fabric_volumes" ]; then
    echo "$all_fabric_volumes" | xargs ${CONTAINER_CLI} volume rm -f 2>/dev/null || true
    successln "✅ All Fabric volumes removed"
  fi
  
  # Remove any remaining fabric containers (including stopped ones)
  infoln "🧹 Removing any remaining Fabric containers..."
  local fabric_containers=$(${CONTAINER_CLI} ps -aq --filter "ancestor=hyperledger/fabric-peer" --filter "ancestor=hyperledger/fabric-orderer" --filter "ancestor=hyperledger/fabric-ccenv" || true)
  if [ ! -z "$fabric_containers" ]; then
    echo "$fabric_containers" | xargs ${CONTAINER_CLI} rm -f 2>/dev/null || true
    successln "✅ Remaining Fabric containers removed"
  fi
  
  successln "🎉 Complete network cleanup finished!"
  infoln "You can now run './network.sh up' for a fresh start."
}

# Setup network configuration for CBDC
function setupNetwork() {
  local config_file="network-config.json"
  local use_auto="${SETUP_AUTO:-false}"
  local load_from_file="${SETUP_CONFIG_FILE:-}"
  local central_bank_name="${CENTRAL_BANK_NAME:-}"
  local bank_names=("${BANK_NAMES[@]}")
  
  infoln "🏦 设置央行数字货币（CBDC）网络配置"
  println
  
  # Check if using auto configuration
  if [ "$use_auto" == "true" ]; then
    infoln "使用默认配置..."
    generate_cbdc_default_config
    return 0
  fi
  
  # Check if loading from file
  if [ ! -z "$load_from_file" ] && [ -f "$load_from_file" ]; then
    infoln "从文件加载配置: $load_from_file"
    cp "$load_from_file" "$config_file"
    validate_config "$config_file"
    return 0
  fi
  
  # Check if central bank name and banks are provided via command line
  if [ ! -z "$central_bank_name" ] && [ ${#bank_names[@]} -gt 0 ]; then
    infoln "使用命令行参数配置网络..."
    infoln "央行: $central_bank_name"
    infoln "银行: ${bank_names[*]}"
    
    # Generate CBDC configuration with provided names
    generate_cbdc_network_config "cbdc-channel" "$central_bank_name" "${bank_names[@]}"
    
    # Generate chaincode from template
    generate_chaincode_from_template "$central_bank_name"
    
    successln "✅ CBDC 网络配置已生成完成"
    return 0
  fi
  
  # Interactive setup for CBDC
  println "这将配置您的央行数字货币 (CBDC) 网络。"
  println "配置将保存到 'network-config.json'"
  println
  
  # Get central bank name
  printf "请输入央行名称 [CentralBank]: "
  read central_bank_input
  central_bank_name=${central_bank_input:-CentralBank}
  
  # Validate central bank name
  if ! [[ "$central_bank_name" =~ ^[a-zA-Z][a-zA-Z0-9]*$ ]]; then
    errorln "无效的央行名称: $central_bank_name"
    errorln "组织名称必须以字母开头，只能包含字母和数字。"
    exit 1
  fi
  
  # Get commercial banks
  printf "请输入商业银行数量 [2]: "
  read bank_count
  bank_count=${bank_count:-2}
  
  # Validate bank count
  if ! [[ "$bank_count" =~ ^[0-9]+$ ]] || [ "$bank_count" -lt 1 ] || [ "$bank_count" -gt 20 ]; then
    errorln "无效的银行数量。必须在 1 到 20 之间。"
    exit 1
  fi
  
  println
  infoln "配置 $bank_count 个商业银行..."
  println
  
  # Get bank names
  local banks=()
  for ((i=1; i<=bank_count; i++)); do
    local default_name="Bank$i"
    printf "请输入第 $i 个银行名称 [$default_name]: "
    read bank_name
    bank_name=${bank_name:-$default_name}
    
    # Validate bank name
    if ! [[ "$bank_name" =~ ^[a-zA-Z][a-zA-Z0-9]*$ ]]; then
      errorln "无效的银行名称: $bank_name"
      errorln "银行名称必须以字母开头，只能包含字母和数字。"
      exit 1
    fi
    
    banks+=("$bank_name")
  done
  
  # Generate CBDC configuration
  println
  infoln "生成 CBDC 网络配置..."
  
  generate_cbdc_network_config "cbdc-channel" "$central_bank_name" "${banks[@]}"
  
  # Generate chaincode from template
  generate_chaincode_from_template "$central_bank_name"
  
  successln "✅ CBDC 网络配置已保存到: $config_file"
  println
  infoln "配置摘要:"
  println "  频道: cbdc-channel"
  println "  央行: $central_bank_name"
  println "  商业银行: ${banks[*]}"
  println
  infoln "下一步:"
  println "  1. 运行 './network.sh start' 启动完整的 CBDC 网络"
  println "  2. 或者分别运行 './network.sh up'、'./network.sh createChannel'、'./network.sh deployCC'"
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

# Start complete CBDC network (up + createChannel + deployCC)
function startCBDCNetwork() {
  local channel_name="cbdc-channel"
  
  infoln "🚀 启动完整的 CBDC 网络..."
  println
  
  # Check if network configuration exists
  if [ ! -f "network-config.json" ]; then
    errorln "未找到网络配置文件。请先运行 './network.sh setup' 来配置网络。"
    exit 1
  fi
  
  # Override channel name with cbdc-channel
  export CHANNEL_NAME="cbdc-channel"
  
  # Step 1: Bring up the network
  infoln "📦 步骤 1/3: 启动网络节点..."
  networkUp
  if [ $? -ne 0 ]; then
    fatalln "网络启动失败"
  fi
  successln "✅ 网络节点启动成功"
  println
  
  # Step 2: Create channel
  infoln "🌐 步骤 2/3: 创建和加入频道 ($channel_name)..."
  scripts/createChannel.sh $channel_name $CLI_DELAY $MAX_RETRY $VERBOSE
  if [ $? -ne 0 ]; then
    fatalln "频道创建失败"
  fi
  successln "✅ 频道创建和加入成功"
  println
  
  # Step 3: Deploy chaincode
  infoln "⚡ 步骤 3/3: 部署 CBDC 智能合约..."
  
  # Set chaincode defaults for CBDC (explicitly override config defaults)
  local cbdc_cc_name="cbdc"
  local cbdc_cc_path="./chaincode/chaincode"
  local cbdc_cc_language="go"
  local cbdc_cc_version="1.0"
  local cbdc_cc_sequence="1"
  local cbdc_cc_init_fcn="NA"
  
  scripts/deployCC.sh $channel_name $cbdc_cc_name $cbdc_cc_path $cbdc_cc_language $cbdc_cc_version $cbdc_cc_sequence $cbdc_cc_init_fcn "$CC_END_POLICY" "$CC_COLL_CONFIG" $CLI_DELAY $MAX_RETRY $VERBOSE
  if [ $? -ne 0 ]; then
    fatalln "智能合约部署失败"
  fi
  successln "✅ CBDC 智能合约部署成功"
  println
  
  successln "🎉 CBDC 网络启动完成！"
  println
  infoln "网络信息:"
  println "  频道名称: $channel_name"
  println "  智能合约: $CC_NAME"
  println "  智能合约版本: $CC_VERSION"
  println
  infoln "下一步你可以:"
  println "  - 使用 './network.sh cc invoke' 调用智能合约"
  println "  - 使用 './network.sh cc query' 查询智能合约"
  println "  - 使用 './network.sh down' 停止网络"
}

# CBDC Chaincode Management Functions
# ===================================

# Get available organizations for CBDC network






















. ./network.config

# use this as the default docker-compose yaml definition
COMPOSE_FILE_BASE=compose-test-net.yaml
# docker-compose.yaml file if you are using couchdb
COMPOSE_FILE_COUCH=compose-couch.yaml
# certificate authorities compose file
COMPOSE_FILE_CA=compose-ca.yaml

# Get docker sock path from environment variable
SOCK="${DOCKER_HOST:-/var/run/docker.sock}"
DOCKER_SOCK="${SOCK##unix://}"

# Parse commandline args

## Parse mode
if [[ $# -lt 1 ]] ; then
  printHelp
  exit 0
else
  MODE=$1
  shift
fi

## if no parameters are passed, show the help for cc or ccc
if [ "$MODE" == "cc" ] && [[ $# -lt 1 ]]; then
  printHelp $MODE
  exit 0
elif [ "$MODE" == "ccc" ] && [[ $# -lt 1 ]]; then
  printCBDCHelp
  exit 0
fi

# parse subcommands if used
if [[ $# -ge 1 ]] ; then
  key="$1"
  # check for the createChannel subcommand
  if [[ "$key" == "createChannel" ]]; then
      export MODE="createChannel"
      shift
  # check for the cc command
  elif [[ "$MODE" == "cc" ]]; then
    if [ "$1" != "-h" ]; then
      export SUBCOMMAND=$key
      shift
    fi
  # check for the ccc command
  elif [[ "$MODE" == "ccc" ]]; then
    if [ "$1" != "-h" ]; then
      export CCC_SUBCOMMAND=$key
      shift
    fi
  fi
fi


# parse flags

while [[ $# -ge 1 ]] ; do
  key="$1"
  case $key in
  -h )
    printHelp $MODE
    exit 0
    ;;
  -c )
    CHANNEL_NAME="$2"
    shift
    ;;
  -ca )
    CRYPTO="Certificate Authorities"
    ;;
  -r )
    MAX_RETRY="$2"
    shift
    ;;
  -d )
    CLI_DELAY="$2"
    shift
    ;;
  -s )
    DATABASE="$2"
    shift
    ;;
  -ccl )
    CC_SRC_LANGUAGE="$2"
    shift
    ;;
  -ccn )
    CC_NAME="$2"
    shift
    ;;
  -ccv )
    CC_VERSION="$2"
    shift
    ;;
  -ccs )
    CC_SEQUENCE="$2"
    shift
    ;;
  -ccp )
    CC_SRC_PATH="$2"
    shift
    ;;
  -ccep )
    CC_END_POLICY="$2"
    shift
    ;;
  -cccg )
    CC_COLL_CONFIG="$2"
    shift
    ;;
  -cci )
    CC_INIT_FCN="$2"
    shift
    ;;
  -ccaasdocker )
    CCAAS_DOCKER_RUN="$2"
    shift
    ;;
  -verbose )
    VERBOSE=true
    ;;
  -org )
    ORG="$2"
    shift
    ;;
  -i )
    IMAGETAG="$2"
    shift
    ;;
  -cai )
    CA_IMAGETAG="$2"
    shift
    ;;
  -ccic )
    CC_INVOKE_CONSTRUCTOR="$2"
    shift
    ;;
  -ccqc )
    CC_QUERY_CONSTRUCTOR="$2"
    shift
    ;;
  -auto )
    SETUP_AUTO=true
    ;;
  -f )
    SETUP_CONFIG_FILE="$2"
    shift
    ;;
  -central )
    CENTRAL_BANK_NAME="$2"
    shift
    ;;
  -banks )
    # Read all remaining arguments as bank names
    shift
    BANK_NAMES=()
    while [[ $# -gt 0 ]] && [[ "$1" != -* ]]; do
      BANK_NAMES+=("$1")
      shift
    done
    # We need to step back one since the main loop will shift again
    if [[ $# -gt 0 ]]; then
      set -- "$1" "${@:2}"
    fi
    continue
    ;;    
  * )
    # Skip unknown flags for ccc command, they will be handled by cbdcChaincode function
    if [ "$MODE" == "ccc" ]; then
      break
    fi
    errorln "Unknown flag: $key"
    printHelp
    exit 1
    ;;
  esac
  shift
done

# Are we generating crypto material with this command?
if [ ! -d "organizations/peerOrganizations" ]; then
  CRYPTO_MODE="with crypto from '${CRYPTO}'"
else
  CRYPTO_MODE=""
fi

# Determine mode of operation and printing out what we asked for
if [ "$MODE" == "prereq" ]; then
  infoln "Installing binaries and fabric images. Fabric Version: ${IMAGETAG}  Fabric CA Version: ${CA_IMAGETAG}"
  installPrereqs
elif [ "$MODE" == "up" ]; then
  infoln "Starting nodes with CLI timeout of '${MAX_RETRY}' tries and CLI delay of '${CLI_DELAY}' seconds and using database '${DATABASE}' ${CRYPTO_MODE}"
  networkUp
elif [ "$MODE" == "createChannel" ]; then
  infoln "Creating channel '${CHANNEL_NAME}'."
  infoln "If network is not up, starting nodes with CLI timeout of '${MAX_RETRY}' tries and CLI delay of '${CLI_DELAY}' seconds and using database '${DATABASE} ${CRYPTO_MODE}"
  createChannel
elif [ "$MODE" == "down" ]; then
  infoln "Stopping network"
  networkDown
elif [ "$MODE" == "clean" ]; then
  infoln "Completely cleaning network (containers + volumes + artifacts)"
  networkClean
elif [ "$MODE" == "restart" ]; then
  infoln "Restarting network"
  networkDown
  networkUp
elif [ "$MODE" == "deployCC" ]; then
  infoln "deploying chaincode on channel '${CHANNEL_NAME}'"
  deployCC
elif [ "$MODE" == "deployCCAAS" ]; then
  infoln "deploying chaincode-as-a-service on channel '${CHANNEL_NAME}'"
  deployCCAAS
elif [ "$MODE" == "cc" ] && [ "$SUBCOMMAND" == "package" ]; then
  packageChaincode
elif [ "$MODE" == "cc" ] && [ "$SUBCOMMAND" == "list" ]; then
  listChaincode
elif [ "$MODE" == "cc" ] && [ "$SUBCOMMAND" == "invoke" ]; then
  invokeChaincode
elif [ "$MODE" == "cc" ] && [ "$SUBCOMMAND" == "query" ]; then
  queryChaincode
elif [ "$MODE" == "setup" ]; then
  setupNetwork
elif [ "$MODE" == "start" ]; then
  infoln "启动完整的 CBDC 网络（包含网络启动、频道创建和智能合约部署）"
  startCBDCNetwork
elif [ "$MODE" == "ccc" ]; then
  # Rebuild the argument list for ccc command
  set -- "$CCC_SUBCOMMAND" "$@"
  cbdcChaincode "$@"
else
  printHelp
  exit 1
fi


