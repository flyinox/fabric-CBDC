#!/bin/bash

# 输出彩色日志
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

log_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# 检查Docker是否安装
check_docker() {
    log_info "检查Docker是否已安装..."
    if ! command -v docker &> /dev/null; then
        log_error "未检测到Docker，需要安装Docker才能继续"
        
        # 检测操作系统类型
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "检测到macOS系统，请通过以下方式安装Docker:"
            log_info "1. 访问 https://www.docker.com/products/docker-desktop 下载Docker Desktop"
            log_info "2. 或使用Homebrew: brew install --cask docker"
            read -p "是否要通过Homebrew安装Docker? (y/n): " install_docker
            if [[ "$install_docker" == "y" ]]; then
                log_info "通过Homebrew安装Docker..."
                brew install --cask docker
                log_info "安装完成后，请启动Docker Desktop并再次运行此脚本"
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "检测到Linux系统，是否要安装Docker? (y/n): "
            read install_docker
            if [[ "$install_docker" == "y" ]]; then
                log_info "安装Docker..."
                curl -fsSL https://get.docker.com -o get-docker.sh
                sudo sh get-docker.sh
                sudo usermod -aG docker $USER
                log_info "Docker安装完成，可能需要重新登录以使权限生效"
                log_info "请确保Docker服务已启动: sudo systemctl start docker"
            fi
        else
            log_error "不支持的操作系统类型: $OSTYPE"
            exit 1
        fi
        
        return 1
    else
        log_info "Docker已安装 ✓"
        return 0
    fi
}

# 检查Docker Compose是否安装
check_docker_compose() {
    log_info "检查Docker Compose是否已安装..."
    if ! command -v docker compose &> /dev/null; then
        log_warn "未检测到Docker Compose V2插件，检查独立版本..."
        if ! command -v docker-compose &> /dev/null; then
            log_error "未检测到Docker Compose，请确保Docker Desktop已更新或手动安装Docker Compose"
            return 1
        else
            log_info "检测到独立版Docker Compose ✓"
            return 0
        fi
    else
        log_info "Docker Compose已安装 ✓"
        return 0
    fi
}

# 检查Go语言是否安装
check_golang() {
    log_info "检查Go语言环境是否已安装..."
    if ! command -v go &> /dev/null; then
        log_warn "未检测到Go语言环境，Hyperledger Fabric开发可能需要Go"
        log_info "推荐安装Go 1.17或更高版本"
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "在macOS上，可以使用: brew install go"
            read -p "是否要通过Homebrew安装Go? (y/n): " install_go
            if [[ "$install_go" == "y" ]]; then
                brew install go
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "在Linux上，可以访问 https://golang.org/dl/ 下载并安装"
            log_info "或使用包管理器安装"
        fi
    else
        GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
        log_info "Go语言已安装: 版本 $GO_VERSION ✓"
    fi
}

# 检查Node.js是否安装
check_nodejs() {
    log_info "检查Node.js环境是否已安装..."
    if ! command -v node &> /dev/null; then
        log_warn "未检测到Node.js环境，Fabric应用开发可能需要Node.js"
        log_info "推荐安装Node.js 14.x或更高LTS版本"
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "在macOS上，可以使用: brew install node"
            read -p "是否要通过Homebrew安装Node.js? (y/n): " install_node
            if [[ "$install_node" == "y" ]]; then
                brew install node
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            log_info "在Linux上，可以使用NVM或包管理器安装Node.js"
        fi
    else
        NODE_VERSION=$(node -v)
        log_info "Node.js已安装: 版本 $NODE_VERSION ✓"
    fi
}

# 拉取install-fabric.sh脚本
download_fabric_script() {
    log_info "开始下载Hyperledger Fabric安装脚本..."
    
    # 尝试从主地址下载
    if curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh --connect-timeout 10; then
        log_info "成功从GitHub下载install-fabric.sh"
        chmod +x install-fabric.sh
        return 0
    else
        log_warn "从GitHub下载失败，尝试使用镜像站..."
        
        # 尝试从镜像地址下载
        if curl -sSLO https://ghfast.top/https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh --connect-timeout 10; then
            log_info "成功从镜像站下载install-fabric.sh"
            chmod +x install-fabric.sh
            return 0
        else
            log_error "无法下载install-fabric.sh，请检查网络连接或手动下载脚本"
            return 1
        fi
    fi
}

# 运行install-fabric.sh脚本
run_fabric_script() {
    log_info "开始运行Hyperledger Fabric安装脚本..."
    
    # 确认是否需要安装示例和二进制文件
    read -p "是否安装 Fabric 镜像? (y/n): " install_samples
    
    if [[ "$install_samples" == "y" ]]; then
        ./install-fabric.sh docker
    else
        ./install-fabric.sh binary samples
    fi
    
    if [ $? -eq 0 ]; then
        log_info "Hyperledger Fabric环境安装成功!"
    else
        log_error "Hyperledger Fabric环境安装失败，请查看错误信息"
        return 1
    fi
}

# 主函数
main() {
    log_info "========== Hyperledger Fabric 央行数字货币项目环境配置 =========="
    
    # 检查必要依赖
    check_docker && check_docker_compose
    if [ $? -ne 0 ]; then
        log_error "必要组件Docker/Docker Compose未安装，请先安装后再运行此脚本"
        exit 1
    fi
    
    # 检查推荐依赖
    check_golang
    # check_nodejs 暂不需要检查nodejs
    
    # 下载并运行Fabric安装脚本
    if download_fabric_script; then
        run_fabric_script
    else
        exit 1
    fi
    
    log_info "基础环境构建成功"
}

# 执行主函数
main 