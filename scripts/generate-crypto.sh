#!/bin/bash

# 脚本用于生成银行组织的 MSP 材料
# 确保 fabric-ca-client 已经安装并且在 PATH 中，或者使用 Docker 容器运行

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 docker-compose-ca.yaml 是否存在
if [ ! -f "docker-compose-ca.yaml" ]; then
    echo -e "${RED}错误: docker-compose-ca.yaml 文件未找到!${NC}"
    echo -e "${RED}请确保您在正确的目录下运行此脚本，并且该文件存在。${NC}"
    exit 1
fi

# 检查是否使用 Docker 容器运行 fabric-ca-client
USE_DOCKER=false
if ! command -v fabric-ca-client &> /dev/null; then
    echo -e "${YELLOW}未找到 fabric-ca-client 工具，将使用 Docker 容器运行。${NC}"
    
    # 检查是否有 hyperledger/fabric-ca 镜像
    if ! docker images | grep -q "hyperledger/fabric-ca"; then
        echo -e "${YELLOW}正在拉取 hyperledger/fabric-ca 镜像...${NC}"
        docker pull hyperledger/fabric-ca:latest
    fi
    
    USE_DOCKER=true
    
    # 定义 fabric-ca-client 函数，使用 Docker 容器运行
    fabric-ca-client() {
        # 获取当前目录的绝对路径
        local current_dir=$(pwd)
        
        # 构建 Docker 命令
        docker run --rm \
            --network=host \
            -v "$current_dir:/opt/workspace" \
            -w /opt/workspace \
            hyperledger/fabric-ca:latest \
            fabric-ca-client "$@"
    }
    
    echo -e "${GREEN}已配置使用 Docker 容器运行 fabric-ca-client${NC}"
fi

echo -e "${GREEN}正在启动 CA 服务 (如果尚未运行)...${NC}"
docker-compose -f docker-compose-ca.yaml up -d ca_bank1 ca_bank2
# 等待 CA 服务启动
echo -e "${GREEN}等待 CA 服务启动 (10 秒)...${NC}"
sleep 10

# 定义通用函数来生成MSP
# 参数:
# 1. 组织名称 (例如: bank1)
# 2. 组织域名 (例如: bank1.example.com)
# 3. CA 服务端口 (例如: 8054)
# 4. CA 名称 (例如: ca-bank1)
generate_msp_for_org() {
    ORG_NAME=$1
    ORG_DOMAIN=$2
    CA_PORT=$3
    CA_NAME=$4
    CA_ADMIN_USER=admin
    CA_ADMIN_PASS=adminpw
    ORG_ADMIN_USER="Admin@${ORG_DOMAIN}"
    ORG_ADMIN_PASS="${ORG_NAME}adminpw" # 为每个银行的Admin设置不同的密码

    echo ""
    echo -e "${GREEN}#################################################################${NC}"
    echo -e "${GREEN}#### 生成 ${ORG_NAME} 的 MSP 材料 ####${NC}"
    echo -e "${GREEN}#################################################################${NC}"

    # 设置 Fabric CA 客户端的 Home 目录，用于隔离不同组织的证书
    export FABRIC_CA_CLIENT_HOME=${PWD}/crypto-config/fabric-ca-client/${ORG_NAME}
    mkdir -p ${FABRIC_CA_CLIENT_HOME}

    CA_URL="http://${CA_ADMIN_USER}:${CA_ADMIN_PASS}@localhost:${CA_PORT}"

    echo "FABRIC_CA_CLIENT_HOME: ${FABRIC_CA_CLIENT_HOME}"
    echo "CA_URL: ${CA_URL}"
    echo "CA_NAME: ${CA_NAME}"

    # 1. Enroll CA Admin (获取 CA 根证书)
    echo ""
    echo -e "${GREEN}正在为 ${ORG_NAME} enroll CA 管理员 (${CA_ADMIN_USER})...${NC}"
    fabric-ca-client enroll -u ${CA_URL} --caname ${CA_NAME} --mspdir ${FABRIC_CA_CLIENT_HOME}/ca-admin-msp

    # CA 根证书路径可能会变化，我们查找它
    CA_CERT_PATH=$(find ${FABRIC_CA_CLIENT_HOME}/ca-admin-msp/cacerts -type f)
    if [ -z "${CA_CERT_PATH}" ]; then
        echo -e "${RED}错误: 未能找到 CA 根证书 for ${CA_NAME}${NC}"
        exit 1
    fi
    echo "CA 根证书路径: ${CA_CERT_PATH}"


    # MSP 目录结构
    ORG_MSP_DIR=${PWD}/crypto-config/peerOrganizations/${ORG_DOMAIN}/msp
    ORG_ADMIN_MSP_DIR=${PWD}/crypto-config/peerOrganizations/${ORG_DOMAIN}/users/${ORG_ADMIN_USER}/msp

    mkdir -p ${ORG_MSP_DIR}/{admincerts,cacerts,tlscacerts}
    mkdir -p ${ORG_ADMIN_MSP_DIR}/{signcerts,keystore,cacerts,tlscacerts,admincerts} # admincerts for admin user msp

    # 复制 CA 根证书到组织的 MSP 目录
    cp "${CA_CERT_PATH}" "${ORG_MSP_DIR}/cacerts/ca.${ORG_DOMAIN}-cert.pem"
    cp "${CA_CERT_PATH}" "${ORG_MSP_DIR}/tlscacerts/tlsca.${ORG_DOMAIN}-cert.pem"
    # 也复制到组织管理员用户的 MSP 目录
    cp "${CA_CERT_PATH}" "${ORG_ADMIN_MSP_DIR}/cacerts/ca.${ORG_DOMAIN}-cert.pem"
    cp "${CA_CERT_PATH}" "${ORG_ADMIN_MSP_DIR}/tlscacerts/tlsca.${ORG_DOMAIN}-cert.pem"


    # 2. Register Organization Admin User
    echo ""
    echo -e "${GREEN}正在为 ${ORG_NAME} 注册组织管理员用户 ${ORG_ADMIN_USER}...${NC}"
    # affiliations 默认为空，可以根据需要设置，例如 --id.affiliation org1.department1
    fabric-ca-client register --caname ${CA_NAME} --id.name ${ORG_ADMIN_USER} --id.secret ${ORG_ADMIN_PASS} --id.type admin -u ${CA_URL}

    # 3. Enroll Organization Admin User
    echo ""
    echo -e "${GREEN}正在为 ${ORG_NAME} enroll 组织管理员用户 ${ORG_ADMIN_USER}...${NC}"
    # --enrollment.profile tls 可以用于生成 TLS 证书，但这里我们主要关注签名证书
    fabric-ca-client enroll -u http://${ORG_ADMIN_USER}:${ORG_ADMIN_PASS}@localhost:${CA_PORT} --caname ${CA_NAME} --mspdir ${ORG_ADMIN_MSP_DIR}

    # 将组织管理员的签名证书复制到组织 MSP 的 admincerts 目录下
    ADMIN_CERT_PATH=${ORG_ADMIN_MSP_DIR}/signcerts/*
    if [ ! -f "$ADMIN_CERT_PATH" ] && [ -z "$(ls -A ${ORG_ADMIN_MSP_DIR}/signcerts)" ]; then # check if file or if dir empty
        # Handle cases where ADMIN_CERT_PATH might be a pattern that doesn't match if no certs exist
        # Re-check with find
        ADMIN_CERT_PATH=$(find ${ORG_ADMIN_MSP_DIR}/signcerts -type f 2>/dev/null | head -n 1)
         if [ -z "${ADMIN_CERT_PATH}" ]; then
            echo -e "${RED}错误: 未找到组织管理员 ${ORG_ADMIN_USER} 的签名证书。${NC}"
            exit 1
        fi
    elif [ -f "$ADMIN_CERT_PATH" ]; then
         # if it is a file, use it directly
         : # do nothing, ADMIN_CERT_PATH is correct
    else # if it is a directory (should not happen with *) or pattern that matched multiple
        ADMIN_CERT_PATH=$(find ${ORG_ADMIN_MSP_DIR}/signcerts -type f 2>/dev/null | head -n 1)
         if [ -z "${ADMIN_CERT_PATH}" ]; then
            echo -e "${RED}错误: 未找到组织管理员 ${ORG_ADMIN_USER} 的签名证书 (检查路径)。${NC}"
            exit 1
        fi
    fi

    echo "组织管理员 ${ORG_ADMIN_USER} 的签名证书路径: ${ADMIN_CERT_PATH}"
    cp "${ADMIN_CERT_PATH}" "${ORG_MSP_DIR}/admincerts/Admin@${ORG_DOMAIN}-cert.pem"
    # 也复制到Admin用户的msp/admincerts，虽然典型结构中用户的admincerts通常为空，但有些工具或场景可能需要
    cp "${ADMIN_CERT_PATH}" "${ORG_ADMIN_MSP_DIR}/admincerts/Admin@${ORG_DOMAIN}-cert.pem"

    echo -e "${GREEN}#### ${ORG_NAME} 的 MSP 材料生成完毕 ####${NC}"
    echo "MSP 目录: ${ORG_MSP_DIR}"
    echo "管理员用户 (${ORG_ADMIN_USER}) MSP 目录: ${ORG_ADMIN_MSP_DIR}"
}

# 清理旧的 crypto-config (如果存在)
if [ -d "crypto-config" ]; then
    echo -e "${YELLOW}发现旧的 crypto-config 目录，是否删除并重新生成? (y/N) ${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}正在删除旧的 crypto-config...${NC}"
        rm -rf crypto-config
    else
        echo -e "${YELLOW}保留现有的 crypto-config 目录。脚本将尝试在此基础上操作，可能导致冲突。${NC}"
    fi
fi
mkdir -p crypto-config/fabric-ca-client # 创建 fabric-ca-client 的根目录

# 为 bank1 生成 MSP
generate_msp_for_org "bank1" "bank1.example.com" "8054" "ca-bank1"
# 为 bank2 生成 MSP
generate_msp_for_org "bank2" "bank2.example.com" "9054" "ca-bank2"

echo ""
echo -e "${GREEN}所有银行的 MSP 材料已生成在 crypto-config 目录下。${NC}"
echo -e "${YELLOW}您可以关闭 CA 服务: docker-compose -f docker-compose-ca.yaml down${NC}"

exit 0
