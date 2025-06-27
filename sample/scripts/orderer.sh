#!/usr/bin/env bash

channel_name=$1

# 读取网络配置
function loadOrdererConfig() {
  local config_file="network-config.json"
  
  if [[ -f "$config_file" ]]; then
    # 验证JSON格式
    if ! jq empty "$config_file" >/dev/null 2>&1; then
      echo "Warning: Invalid JSON format in $config_file, using default configuration" >&2
      ORDERER_DOMAIN="example.com"
      ORDERER_NAME="orderer"
      return 1
    fi
    
    # 读取orderer配置
    ORDERER_DOMAIN=$(jq -r '.network.orderer.domain // "example.com"' "$config_file")
    ORDERER_NAME=$(jq -r '.network.orderer.name // "orderer"' "$config_file")
    return 0
  else
    # 使用默认配置
    ORDERER_DOMAIN="example.com"
    ORDERER_NAME="orderer"
    return 1
  fi
}

# 加载配置
loadOrdererConfig

export PATH=${ROOTDIR}/../bin:${PWD}/../bin:$PATH
export ORDERER_ADMIN_TLS_SIGN_CERT=${PWD}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.crt
export ORDERER_ADMIN_TLS_PRIVATE_KEY=${PWD}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.key

osnadmin channel join --channelID ${channel_name} --config-block ./channel-artifacts/${channel_name}.block -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY" >> log.txt 2>&1