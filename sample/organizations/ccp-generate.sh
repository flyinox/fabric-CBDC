#!/usr/bin/env bash

function one_line_pem {
    echo "`awk 'NF {sub(/\\n/, ""); printf "%s\\\\\\\n",$0;}' $1`"
}

# Function to generate CCP using template files (alternative approach)
function json_ccp_from_template {
    local ORG_NAME=$1
    local ORG_MSP_ID=$2
    local ORG_DOMAIN=$3
    local P0PORT=$4
    local CAPORT=$5
    local PEERPEM=$6
    local CAPEM=$7
    
    local PP=$(one_line_pem $PEERPEM)
    local CP=$(one_line_pem $CAPEM)
    
    # Use the updated template with flexible variables
    sed -e "s/\${ORG_NAME}/$ORG_NAME/g" \
        -e "s/\${ORG_MSP_ID}/$ORG_MSP_ID/g" \
        -e "s/\${ORG_DOMAIN}/$ORG_DOMAIN/g" \
        -e "s/\${P0PORT}/$P0PORT/g" \
        -e "s/\${CAPORT}/$CAPORT/g" \
        -e "s#\${PEERPEM}#$PP#g" \
        -e "s#\${CAPEM}#$CP#g" \
        organizations/ccp-template.json
}

function yaml_ccp_from_template {
    local ORG_NAME=$1
    local ORG_MSP_ID=$2
    local ORG_DOMAIN=$3
    local P0PORT=$4
    local CAPORT=$5
    local PEERPEM=$6
    local CAPEM=$7
    
    local PP=$(one_line_pem $PEERPEM)
    local CP=$(one_line_pem $CAPEM)
    
    # Use the updated template with flexible variables
    sed -e "s/\${ORG_NAME}/$ORG_NAME/g" \
        -e "s/\${ORG_MSP_ID}/$ORG_MSP_ID/g" \
        -e "s/\${ORG_DOMAIN}/$ORG_DOMAIN/g" \
        -e "s/\${P0PORT}/$P0PORT/g" \
        -e "s/\${CAPORT}/$CAPORT/g" \
        -e "s#\${PEERPEM}#$PP#g" \
        -e "s#\${CAPEM}#$CP#g" \
        organizations/ccp-template.yaml | sed -e $'s/\\\\n/\\\n          /g'
}

function json_ccp {
    local ORG_NAME=$1
    local ORG_MSP_ID=$2
    local ORG_DOMAIN=$3
    local P0PORT=$4
    local CAPORT=$5
    local PEERPEM=$6
    local CAPEM=$7
    
    local PP=$(one_line_pem $PEERPEM)
    local CP=$(one_line_pem $CAPEM)
    
    # Generate dynamic JSON CCP
    cat << EOF
{
    "name": "test-network-${ORG_NAME}",
    "version": "1.0.0",
    "client": {
        "organization": "${ORG_MSP_ID}",
        "connection": {
            "timeout": {
                "peer": {
                    "endorser": "300"
                }
            }
        }
    },
    "organizations": {
        "${ORG_MSP_ID}": {
            "mspid": "${ORG_MSP_ID}",
            "peers": [
                "peer0.${ORG_DOMAIN}"
            ],
            "certificateAuthorities": [
                "ca.${ORG_DOMAIN}"
            ]
        }
    },
    "peers": {
        "peer0.${ORG_DOMAIN}": {
            "url": "grpcs://localhost:${P0PORT}",
            "tlsCACerts": {
                "pem": "${PP}"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.${ORG_DOMAIN}",
                "hostnameOverride": "peer0.${ORG_DOMAIN}"
            }
        }
    },
    "certificateAuthorities": {
        "ca.${ORG_DOMAIN}": {
            "url": "https://localhost:${CAPORT}",
            "caName": "ca-${ORG_NAME}",
            "tlsCACerts": {
                "pem": ["${CP}"]
            },
            "httpOptions": {
                "verify": false
            }
        }
    }
}
EOF
}

function yaml_ccp {
    local ORG_NAME=$1
    local ORG_MSP_ID=$2
    local ORG_DOMAIN=$3
    local P0PORT=$4
    local CAPORT=$5
    local PEERPEM=$6
    local CAPEM=$7
    
    local PP=$(one_line_pem $PEERPEM)
    local CP=$(one_line_pem $CAPEM)
    
    # Generate dynamic YAML CCP
    cat << EOF
---
name: test-network-${ORG_NAME}
version: 1.0.0
client:
  organization: ${ORG_MSP_ID}
  connection:
    timeout:
      peer:
        endorser: '300'
organizations:
  ${ORG_MSP_ID}:
    mspid: ${ORG_MSP_ID}
    peers:
    - peer0.${ORG_DOMAIN}
    certificateAuthorities:
    - ca.${ORG_DOMAIN}
peers:
  peer0.${ORG_DOMAIN}:
    url: grpcs://localhost:${P0PORT}
    tlsCACerts:
      pem: |
          ${PP}
    grpcOptions:
      ssl-target-name-override: peer0.${ORG_DOMAIN}
      hostnameOverride: peer0.${ORG_DOMAIN}
certificateAuthorities:
  ca.${ORG_DOMAIN}:
    url: https://localhost:${CAPORT}
    caName: ca-${ORG_NAME}
    tlsCACerts:
      pem: 
        - |
          ${CP}
    httpOptions:
      verify: false
EOF
}

# Function to read network configuration and generate CCP files
function generate_dynamic_ccp() {
    local config_file="network-config.json"
    
    if [ ! -f "$config_file" ]; then
        echo "Warning: Network configuration file $config_file not found. Using default CCP generation."
        generate_default_ccp
        return 0
    fi
    
    # Check if jq is available
    if ! command -v jq > /dev/null 2>&1; then
        echo "Warning: jq not found. Using default CCP generation."
        generate_default_ccp
        return 0
    fi
    
    # Validate JSON format
    if ! jq empty "$config_file" 2>/dev/null; then
        echo "Error: Invalid JSON format in $config_file"
        return 1
    fi
    
    # Read organizations count
    local orgs_count=$(jq -r '.network.organizations | length' "$config_file")
    
    echo "Generating CCP files for $orgs_count organizations..."
    
    # Generate CCP for each organization
    for i in $(seq 0 $((orgs_count - 1))); do
        local org_name=$(jq -r ".network.organizations[$i].name" "$config_file")
        local org_msp_id=$(jq -r ".network.organizations[$i].msp_id" "$config_file")
        local org_domain=$(jq -r ".network.organizations[$i].domain" "$config_file")
        local org_port=$(jq -r ".network.organizations[$i].peer.port" "$config_file")
        local org_ca_port=$((org_port + 1000))  # CA port convention
        
        local org_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
        
        # Define certificate paths
        local peerpem="organizations/peerOrganizations/${org_domain}/tlsca/tlsca.${org_domain}-cert.pem"
        local capem="organizations/peerOrganizations/${org_domain}/ca/ca.${org_domain}-cert.pem"
        
        # Check if certificate files exist
        if [ ! -f "$peerpem" ]; then
            echo "Warning: TLS CA certificate not found: $peerpem"
            echo "Skipping CCP generation for ${org_name}"
            continue
        fi
        
        if [ ! -f "$capem" ]; then
            echo "Warning: CA certificate not found: $capem"
            echo "Skipping CCP generation for ${org_name}"
            continue
        fi
        
        # Ensure output directory exists
        mkdir -p "organizations/peerOrganizations/${org_domain}"
        
        # Generate JSON CCP
        echo "Generating connection profile for ${org_name} (${org_msp_id})"
        echo "$(json_ccp "$org_name" "$org_msp_id" "$org_domain" "$org_port" "$org_ca_port" "$peerpem" "$capem")" > "organizations/peerOrganizations/${org_domain}/connection-${org_lower}.json"
        
        # Generate YAML CCP
        echo "$(yaml_ccp "$org_name" "$org_msp_id" "$org_domain" "$org_port" "$org_ca_port" "$peerpem" "$capem")" > "organizations/peerOrganizations/${org_domain}/connection-${org_lower}.yaml"
        
        echo "✅ Generated CCP files for ${org_name}:"
        echo "   - organizations/peerOrganizations/${org_domain}/connection-${org_lower}.json"
        echo "   - organizations/peerOrganizations/${org_domain}/connection-${org_lower}.yaml"
    done
    
    echo "🎉 Dynamic CCP generation completed for all organizations!"
}

# Function to generate default CCP files (backward compatibility)
function generate_default_ccp() {
    echo "Generating default CCP files for Org1 and Org2..."
    
    # Org1 configuration
    ORG=1
    P0PORT=7051
    CAPORT=7054
    PEERPEM=organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
    CAPEM=organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem
    
    if [ -f "$PEERPEM" ] && [ -f "$CAPEM" ]; then
        echo "$(json_ccp "Org1" "Org1MSP" "org1.example.com" "$P0PORT" "$CAPORT" "$PEERPEM" "$CAPEM")" > organizations/peerOrganizations/org1.example.com/connection-org1.json
        echo "$(yaml_ccp "Org1" "Org1MSP" "org1.example.com" "$P0PORT" "$CAPORT" "$PEERPEM" "$CAPEM")" > organizations/peerOrganizations/org1.example.com/connection-org1.yaml
        echo "✅ Generated CCP files for Org1"
    else
        echo "Warning: Certificate files not found for Org1, skipping CCP generation"
    fi
    
    # Org2 configuration
    ORG=2
    P0PORT=9051
    CAPORT=8054
    PEERPEM=organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem
    CAPEM=organizations/peerOrganizations/org2.example.com/ca/ca.org2.example.com-cert.pem
    
    if [ -f "$PEERPEM" ] && [ -f "$CAPEM" ]; then
        echo "$(json_ccp "Org2" "Org2MSP" "org2.example.com" "$P0PORT" "$CAPORT" "$PEERPEM" "$CAPEM")" > organizations/peerOrganizations/org2.example.com/connection-org2.json
        echo "$(yaml_ccp "Org2" "Org2MSP" "org2.example.com" "$P0PORT" "$CAPORT" "$PEERPEM" "$CAPEM")" > organizations/peerOrganizations/org2.example.com/connection-org2.yaml
        echo "✅ Generated CCP files for Org2"
    else
        echo "Warning: Certificate files not found for Org2, skipping CCP generation"
    fi
}

# Main execution
case "$1" in
    "--dynamic")
        generate_dynamic_ccp
        ;;
    "--template")
        echo "Using template-based CCP generation with flexible variables"
        echo "Note: This mode uses the updated ccp-template.json and ccp-template.yaml files"
        echo "Template variables: \${ORG_NAME}, \${ORG_MSP_ID}, \${ORG_DOMAIN}, \${P0PORT}, \${CAPORT}, \${PEERPEM}, \${CAPEM}"
        ;;
    "--help"|"-h")
        echo "Usage: $0 [--dynamic|--template|--help]"
        echo ""
        echo "Options:"
        echo "  --dynamic     Use dynamic CCP generation (reads network-config.json)"
        echo "  --template    Show template usage information"
        echo "  --help, -h    Show this help message"
        echo ""
        echo "Default behavior:"
        echo "  - If network-config.json exists and jq is available: use dynamic generation"
        echo "  - Otherwise: use default Org1/Org2 generation"
        echo ""
        echo "Template Variables (for --template mode):"
        echo "  \${ORG_NAME}    - Organization name (e.g., 'Central', 'Bank1')"
        echo "  \${ORG_MSP_ID}  - MSP identifier (e.g., 'CentralMSP', 'Bank1MSP')"
        echo "  \${ORG_DOMAIN}  - Organization domain (e.g., 'central.example.com')"
        echo "  \${P0PORT}      - Peer port (e.g., 7051)"
        echo "  \${CAPORT}      - CA port (e.g., 8051)"
        echo "  \${PEERPEM}     - Peer TLS certificate content"
        echo "  \${CAPEM}       - CA certificate content"
        ;;
    *)
        # Default behavior - auto-detect mode
        if [ -f "network-config.json" ] && command -v jq > /dev/null 2>&1; then
            generate_dynamic_ccp
        else
            generate_default_ccp
        fi
        ;;
esac
