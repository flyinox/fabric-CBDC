#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 基础配置
CENTRAL_BANK_NAME="central_bank"
CENTRAL_BANK_DOMAIN="centralbank.example.com"
CENTRAL_BANK_MSP="CentralBankMSP"
CENTRAL_BANK_CA_PORT=7054
CENTRAL_BANK_CA_OP_PORT=17054

# 银行配置数组
declare -a BANK_NAMES=()
declare -a BANK_DOMAINS=()
declare -a BANK_MSPS=()
declare -a BANK_CA_PORTS=()
declare -a BANK_CA_OP_PORTS=()

# 函数：显示欢迎信息
show_welcome() {
    clear
    echo -e "${GREEN}==================================================================${NC}"
    echo -e "${GREEN}                  Fabric 网络配置生成器                           ${NC}"
    echo -e "${GREEN}==================================================================${NC}"
    echo -e "${BLUE}此脚本将帮助您配置 Hyperledger Fabric 网络，包括：${NC}"
    echo -e "${BLUE}- 动态生成 docker-compose-ca.yaml 文件${NC}"
    echo -e "${BLUE}- 动态生成 generate-crypto.sh 脚本${NC}"
    echo -e "${BLUE}- 配置央行和多个商业银行${NC}"
    echo -e "${GREEN}==================================================================${NC}"
    echo ""
}

# 函数：首字母大写（兼容所有shell版本）
capitalize_first() {
    local str="$1"
    local first_char=$(echo "${str:0:1}" | tr '[:lower:]' '[:upper:]')
    local rest="${str:1}"
    echo "${first_char}${rest}"
}

# 函数：收集银行信息
collect_bank_info() {
    local bank_index=$1
    local default_name="bank$bank_index"
    local default_domain="${default_name}.example.com"
    local default_msp="$(capitalize_first $default_name)MSP"  # 首字母大写，使用兼容函数
    local default_ca_port=$((8054 + (bank_index-1) * 1000))
    local default_ca_op_port=$((18054 + (bank_index-1) * 1000))
    
    echo -e "${YELLOW}配置银行 #$bank_index${NC}"
    
    read -p "银行名称 [默认: $default_name]: " bank_name
    bank_name=${bank_name:-$default_name}
    BANK_NAMES+=("$bank_name")
    
    read -p "银行域名 [默认: $default_domain]: " bank_domain
    bank_domain=${bank_domain:-$default_domain}
    BANK_DOMAINS+=("$bank_domain")
    
    read -p "银行 MSP ID [默认: $default_msp]: " bank_msp
    bank_msp=${bank_msp:-$default_msp}
    BANK_MSPS+=("$bank_msp")
    
    read -p "CA 服务端口 [默认: $default_ca_port]: " bank_ca_port
    bank_ca_port=${bank_ca_port:-$default_ca_port}
    BANK_CA_PORTS+=("$bank_ca_port")
    
    read -p "CA 操作端口 [默认: $default_ca_op_port]: " bank_ca_op_port
    bank_ca_op_port=${bank_ca_op_port:-$default_ca_op_port}
    BANK_CA_OP_PORTS+=("$bank_ca_op_port")
    
    echo -e "${GREEN}银行 #$bank_index 配置完成${NC}"
    echo ""
}

# 函数：生成 docker-compose-ca.yaml
generate_docker_compose_ca() {
    echo -e "${BLUE}正在生成 docker-compose-ca.yaml...${NC}"
    
    # 创建 docker-compose-ca.yaml 文件
    cat > docker-compose-ca.yaml << EOF
version: '3.7'

networks:
  fabric_network:
    name: fabric_network
    external: true

services:
  ca_central_bank:
    image: hyperledger/fabric-ca:latest
    container_name: ca_central_bank
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-central-bank
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=${CENTRAL_BANK_CA_PORT}
      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:${CENTRAL_BANK_CA_OP_PORT}
      # 管理员用户的用户名和密码
      - FABRIC_CA_SERVER_ADMIN_USER=admin
      - FABRIC_CA_SERVER_ADMIN_PASSWORD=adminpw
    ports:
      - "${CENTRAL_BANK_CA_PORT}:${CENTRAL_BANK_CA_PORT}" # CA服务端口
      - "${CENTRAL_BANK_CA_OP_PORT}:${CENTRAL_BANK_CA_OP_PORT}" # 操作服务端口
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ./fabric-ca/${CENTRAL_BANK_NAME}:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric_network
EOF

    # 添加银行 CA 服务
    for i in "${!BANK_NAMES[@]}"; do
        cat >> docker-compose-ca.yaml << EOF

  ca_${BANK_NAMES[$i]}:
    image: hyperledger/fabric-ca:latest
    container_name: ca_${BANK_NAMES[$i]}
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-${BANK_NAMES[$i]}
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=${BANK_CA_PORTS[$i]}
      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:${BANK_CA_OP_PORTS[$i]}
      - FABRIC_CA_SERVER_ADMIN_USER=admin
      - FABRIC_CA_SERVER_ADMIN_PASSWORD=adminpw
    ports:
      - "${BANK_CA_PORTS[$i]}:${BANK_CA_PORTS[$i]}"
      - "${BANK_CA_OP_PORTS[$i]}:${BANK_CA_OP_PORTS[$i]}"
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ./fabric-ca/${BANK_NAMES[$i]}:/etc/hyperledger/fabric-ca-server
    networks:
      - fabric_network
EOF
    done
    
    echo -e "${GREEN}docker-compose-ca.yaml 已生成${NC}"
}

# 函数：生成 generate-crypto.sh
generate_crypto_script() {
    echo -e "${BLUE}正在生成 generate-crypto.sh...${NC}"
    
    # 创建 generate-crypto.sh 文件
    cat > generate-crypto.sh << 'EOF'
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
EOF

    # 添加启动 CA 服务的命令
    echo -n "docker-compose -f docker-compose-ca.yaml up -d" >> generate-crypto.sh
    for bank_name in "${BANK_NAMES[@]}"; do
        echo -n " ca_${bank_name}" >> generate-crypto.sh
    done
    echo >> generate-crypto.sh
    
    # 继续添加脚本内容
    cat >> generate-crypto.sh << 'EOF'
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

EOF

    # 添加银行特定的生成命令
    for i in "${!BANK_NAMES[@]}"; do
        cat >> generate-crypto.sh << EOF
# 为 ${BANK_NAMES[$i]} 生成 MSP
generate_msp_for_org "${BANK_NAMES[$i]}" "${BANK_DOMAINS[$i]}" "${BANK_CA_PORTS[$i]}" "ca-${BANK_NAMES[$i]}"
EOF
    done
    
    # 添加结束信息
    cat >> generate-crypto.sh << 'EOF'

echo ""
echo -e "${GREEN}所有银行的 MSP 材料已生成在 crypto-config 目录下。${NC}"
echo -e "${YELLOW}您可以关闭 CA 服务: docker-compose -f docker-compose-ca.yaml down${NC}"

exit 0
EOF

    # 设置执行权限
    chmod +x generate-crypto.sh
    
    echo -e "${GREEN}generate-crypto.sh 已生成并设置了执行权限${NC}"
}

# 函数：确保网络存在
ensure_network_exists() {
    echo -e "${BLUE}确保 fabric_network 网络存在...${NC}"
    
    # 检查网络是否存在
    if ! docker network ls | grep -q fabric_network; then
        echo -e "${YELLOW}创建 fabric_network 网络...${NC}"
        docker network create fabric_network
    else
        echo -e "${GREEN}fabric_network 网络已存在${NC}"
    fi
}

# 函数：检查并释放被占用的端口
check_and_free_ports() {
    echo -e "${BLUE}检查并释放 Docker 中占用的端口...${NC}"
    
    # 收集所有需要使用的端口
    local all_ports=("${CENTRAL_BANK_CA_PORT}" "${CENTRAL_BANK_CA_OP_PORT}")
    for port in "${BANK_CA_PORTS[@]}"; do
        all_ports+=("$port")
    done
    for port in "${BANK_CA_OP_PORTS[@]}"; do
        all_ports+=("$port")
    done
    
    # 查找并停止占用这些端口的 Docker 容器
    for port in "${all_ports[@]}"; do
        # 查找使用该端口的容器
        local containers=$(docker ps -q --filter "publish=$port")
        if [ ! -z "$containers" ]; then
            echo -e "${YELLOW}发现占用端口 $port 的 Docker 容器，停止并移除...${NC}"
            for container in $containers; do
                # 获取容器名称，用于日志显示
                local container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\///')
                echo -e "${YELLOW}停止并移除容器 $container_name (ID: $container)...${NC}"
                docker stop "$container" >/dev/null 2>&1
                docker rm "$container" >/dev/null 2>&1
            done
        fi
    done
    
    # 检查是否还有端口被占用（可能是非 Docker 进程）
    local still_occupied=false
    for port in "${all_ports[@]}"; do
        if lsof -i:$port >/dev/null 2>&1; then
            echo -e "${RED}警告: 端口 $port 仍然被占用，但不是由 Docker 容器占用。${NC}"
            echo -e "${RED}可能需要手动释放该端口，或者选择其他端口。${NC}"
            still_occupied=true
        fi
    done
    
    if [ "$still_occupied" = true ]; then
        echo -e "${YELLOW}是否继续尝试启动 CA 服务? (y/N) ${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}已取消启动 CA 服务。${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}所有需要的端口都已释放${NC}"
    fi
}

# 函数：停止并删除现有的 CA 容器
stop_and_remove_ca_containers() {
    echo -e "${BLUE}停止并删除现有的 CA 容器...${NC}"
    
    # 检查 docker-compose-ca.yaml 文件是否存在
    if [ -f "docker-compose-ca.yaml" ]; then
        echo -e "${YELLOW}使用 docker-compose down 停止并删除现有的 CA 服务...${NC}"
        docker-compose -f docker-compose-ca.yaml down --volumes >/dev/null 2>&1 || true
    else
        echo -e "${YELLOW}docker-compose-ca.yaml 文件不存在，使用 docker 命令停止并删除 CA 容器...${NC}"
        
        # 停止并删除 ca_central_bank 容器
        if docker ps -a | grep -q ca_central_bank; then
            echo -e "${YELLOW}停止并删除 ca_central_bank 容器...${NC}"
            docker stop ca_central_bank >/dev/null 2>&1 || true
            docker rm ca_central_bank >/dev/null 2>&1 || true
        fi
        
        # 停止并删除所有 ca_bank 容器
        for container in $(docker ps -a --format '{{.Names}}' | grep '^ca_bank'); do
            echo -e "${YELLOW}停止并删除 ${container} 容器...${NC}"
            docker stop ${container} >/dev/null 2>&1 || true
            docker rm ${container} >/dev/null 2>&1 || true
        done
    fi
    
    # 额外检查：确保所有相关容器都已被移除
    local remaining_containers=$(docker ps -a --format '{{.Names}}' | grep -E '^ca_(central_bank|bank)')
    if [ ! -z "$remaining_containers" ]; then
        echo -e "${YELLOW}发现仍有 CA 相关容器存在，强制移除...${NC}"
        echo "$remaining_containers" | xargs docker rm -f >/dev/null 2>&1 || true
    fi
    
    echo -e "${GREEN}所有 CA 容器已停止并删除${NC}"
    
    # 检查并释放端口
    check_and_free_ports
}

# 函数：启动 CA 服务
start_ca_services() {
    echo -e "${BLUE}启动 CA 服务...${NC}"
    
    # 检查并释放被占用的端口
    check_and_free_ports
    
    # 构建启动命令
    local cmd="docker-compose -f docker-compose-ca.yaml up -d"
    
    # 添加央行 CA
    cmd="${cmd} ca_central_bank"
    
    # 添加银行 CA
    for bank_name in "${BANK_NAMES[@]}"; do
        cmd="${cmd} ca_${bank_name}"
    done
    
    # 执行命令
    echo -e "${YELLOW}执行: ${cmd}${NC}"
    eval ${cmd}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}CA 服务已启动${NC}"
    else
        echo -e "${RED}启动 CA 服务失败${NC}"
        exit 1
    fi
    
    # 等待 CA 服务启动
    echo -e "${YELLOW}等待 CA 服务启动 (10 秒)...${NC}"
    sleep 10
}

# 函数：生成证书
generate_certificates() {
    echo -e "${BLUE}生成证书...${NC}"
    
    # 检查 fabric-ca-client 是否安装
    if ! command -v fabric-ca-client &> /dev/null; then
        echo -e "${RED}错误: fabric-ca-client 工具未安装或不在 PATH 中${NC}"
        echo -e "${YELLOW}请安装 fabric-ca-client 工具后再尝试生成证书${NC}"
        echo -e "${YELLOW}可以参考 Hyperledger Fabric 官方文档: https://hyperledger-fabric.readthedocs.io/en/latest/install.html${NC}"
        
        # 询问用户是否要继续
        echo -e "${YELLOW}是否跳过证书生成步骤? (y/N) ${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}已取消操作。${NC}"
            exit 1
        else
            echo -e "${YELLOW}跳过证书生成步骤。${NC}"
            return 0
        fi
    fi
    
    # 确保在项目根目录下执行脚本
    local current_dir=$(pwd)
    if [[ "$current_dir" == */scripts ]]; then
        echo -e "${YELLOW}当前在 scripts 目录下，切换到项目根目录...${NC}"
        cd ..
    fi
    
    # 执行 generate-crypto.sh 脚本
    ./generate-crypto.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}证书生成完成${NC}"
    else
        echo -e "${RED}生成证书失败${NC}"
        exit 1
    fi
    
    # 如果之前切换了目录，切换回来
    if [[ "$current_dir" == */scripts ]]; then
        cd "$current_dir"
    fi
}

# 主函数
main() {
    show_welcome
    
    # 询问银行数量
    read -p "请输入您想要配置的银行数量: " num_banks
    
    # 验证输入是否为数字
    if ! [[ "$num_banks" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}错误: 请输入一个有效的数字${NC}"
        exit 1
    fi
    
    # 收集每个银行的信息
    for ((i=1; i<=num_banks; i++)); do
        collect_bank_info $i
    done
    
    # 生成文件
    generate_docker_compose_ca
    generate_crypto_script
    
    echo -e "${GREEN}==================================================================${NC}"
    echo -e "${GREEN}配置完成！${NC}"
    echo -e "${GREEN}已生成以下文件:${NC}"
    echo -e "${BLUE}- docker-compose-ca.yaml${NC}"
    echo -e "${BLUE}- generate-crypto.sh${NC}"
    echo -e "${GREEN}==================================================================${NC}"
    echo ""
    
    # 询问是否自动启动 CA 服务并生成证书
    read -p "是否自动启动 CA 服务并生成证书? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 确保网络存在
        ensure_network_exists
        
        # 停止并删除现有的 CA 容器
        stop_and_remove_ca_containers
        
        # 启动 CA 服务
        start_ca_services
        
        # 生成证书
        generate_certificates
        
        echo -e "${GREEN}==================================================================${NC}"
        echo -e "${GREEN}所有操作已完成！${NC}"
        echo -e "${GREEN}==================================================================${NC}"
    else
        echo -e "您可以使用以下命令启动 CA 服务并生成证书:"
        echo -e "${YELLOW}docker-compose -f docker-compose-ca.yaml up -d${NC}"
        echo -e "${YELLOW}./generate-crypto.sh${NC}"
    fi
}

# 执行主函数
main 