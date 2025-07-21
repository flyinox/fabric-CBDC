#!/usr/bin/env bash

# Orderer日志查看脚本
# 专门用于查看orderer的日志，特别是Raft consensus相关的内容

# 加载工具函数
. scripts/utils.sh

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

# 显示帮助信息
function showHelp() {
  echo "Orderer日志查看工具"
  echo ""
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  -f, --follow          实时跟踪日志"
  echo "  -r, --raft            只显示Raft consensus相关日志"
  echo "  -c, --consensus       显示共识相关日志"
  echo "  -a, --all             显示所有日志"
  echo "  -t, --tail N          显示最后N行日志 (默认: 100)"
  echo "  -h, --help            显示此帮助信息"
  echo ""
  echo "示例:"
  echo "  $0 -r -f              # 实时跟踪Raft共识日志"
  echo "  $0 -c -t 50           # 显示最后50行共识相关日志"
  echo "  $0 -a -f              # 实时跟踪所有orderer日志"
  echo ""
}

# 过滤Raft共识相关日志
function filterRaftLogs() {
  local input="$1"
  echo "$input" | grep -i -E "(raft|consensus|leader|election|etcdraft|consenter|block|batch)" | grep -v "DEBUG"
}

# 过滤共识相关日志
function filterConsensusLogs() {
  local input="$1"
  echo "$input" | grep -i -E "(consensus|raft|leader|election|etcdraft|consenter|block|batch|orderer)" | grep -v "DEBUG"
}

# 主函数
function main() {
  local follow=false
  local raft_only=false
  local consensus_only=false
  local all_logs=false
  local tail_lines=100
  
  # 解析命令行参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      -f|--follow)
        follow=true
        shift
        ;;
      -r|--raft)
        raft_only=true
        shift
        ;;
      -c|--consensus)
        consensus_only=true
        shift
        ;;
      -a|--all)
        all_logs=true
        shift
        ;;
      -t|--tail)
        tail_lines="$2"
        shift 2
        ;;
      -h|--help)
        showHelp
        exit 0
        ;;
      *)
        echo "未知选项: $1"
        showHelp
        exit 1
        ;;
    esac
  done
  
  # 加载orderer配置
  loadOrdererConfig
  
  # 构建容器名称
  local container_name="orderer.${ORDERER_DOMAIN}"
  
  # 检查容器是否运行
  if ! docker ps | grep -q "$container_name"; then
    errorln "Orderer容器 '$container_name' 未运行"
    infoln "请先启动网络: ./network.sh up"
    exit 1
  fi
  
  infoln "查看orderer日志: $container_name"
  
  # 构建docker logs命令
  local docker_cmd="docker logs"
  
  if [ "$follow" = true ]; then
    docker_cmd="$docker_cmd -f"
  fi
  
  if [ "$tail_lines" != "0" ]; then
    docker_cmd="$docker_cmd --tail $tail_lines"
  fi
  
  docker_cmd="$docker_cmd $container_name"
  
  # 根据选项执行不同的日志查看策略
  if [ "$raft_only" = true ]; then
    infoln "🔍 过滤Raft共识相关日志..."
    if [ "$follow" = true ]; then
      # 实时跟踪Raft日志
      eval "$docker_cmd" | while IFS= read -r line; do
        if echo "$line" | grep -q -i -E "(raft|consensus|leader|election|etcdraft|consenter|block|batch)"; then
          if ! echo "$line" | grep -q "DEBUG"; then
            echo "$line"
          fi
        fi
      done
    else
      # 一次性显示Raft日志
      eval "$docker_cmd" | filterRaftLogs
    fi
  elif [ "$consensus_only" = true ]; then
    infoln "🔍 过滤共识相关日志..."
    if [ "$follow" = true ]; then
      # 实时跟踪共识日志
      eval "$docker_cmd" | while IFS= read -r line; do
        if echo "$line" | grep -q -i -E "(consensus|raft|leader|election|etcdraft|consenter|block|batch|orderer)"; then
          if ! echo "$line" | grep -q "DEBUG"; then
            echo "$line"
          fi
        fi
      done
    else
      # 一次性显示共识日志
      eval "$docker_cmd" | filterConsensusLogs
    fi
  elif [ "$all_logs" = true ]; then
    infoln "📋 显示所有orderer日志..."
    eval "$docker_cmd"
  else
    # 默认显示Raft相关日志
    infoln "🔍 显示Raft共识相关日志 (默认)..."
    eval "$docker_cmd" | filterRaftLogs
  fi
}

# 如果脚本被直接执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi