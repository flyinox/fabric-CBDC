#!/bin/bash

# 银行数字货币网络配置生成脚本
# 用于生成网络配置文件 network-config.json

# 默认配置
DEFAULT_CHANNEL_NAME="cbdc-channel"
DEFAULT_CENTRAL_BANK="CentralBank"
DEFAULT_BANKS=("ICBC" "CCB" "ABC" "BOC")

# 基础端口配置
BASE_ORDERER_PORT=7050
BASE_PEER_PORT=7051
BASE_PEER_CHAINCODE_PORT=7052
BASE_PEER_OPERATIONS_PORT=9443
BASE_PEER_CouchDB_PORT=5984

# 生成网络配置
generate_network_config() {
    local channel_name=$1
    local central_bank=$2
    shift 2
    local banks=("$@")
    
    echo "生成网络配置..."
    echo "频道名称: $channel_name"
    echo "央行名称: $central_bank"
    echo "参与银行: ${banks[*]}"
    
    # 创建配置目录
    mkdir -p "$(dirname "$0")/../configtx"
    
    local config_file="$(dirname "$0")/../configtx/network-config.json"
    
    # 生成 JSON 配置文件
    printf '{\n' > "$config_file"
    printf '  "_comment": "此文件由 network-config.sh 脚本自动生成，请勿手动修改！",\n' >> "$config_file"
    printf '  "_generated_time": "%s",\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$config_file"
    printf '  "_warning": "如需更改配置，请修改 network-config.sh 脚本后重新生成",\n' >> "$config_file"
    printf '  "network": {\n' >> "$config_file"
    printf '    "channel_name": "%s",\n' "$channel_name" >> "$config_file"
    printf '    "central_bank": {\n' >> "$config_file"
    printf '      "name": "%s",\n' "$central_bank" >> "$config_file"
    printf '      "msp_id": "%sMSP",\n' "$central_bank" >> "$config_file"
    printf '      "orderer": {\n' >> "$config_file"
    printf '        "port": %d,\n' "$BASE_ORDERER_PORT" >> "$config_file"
    printf '        "operations_port": %d\n' "$((BASE_ORDERER_PORT + 393))" >> "$config_file"
    printf '      },\n' >> "$config_file"
    printf '      "peer": {\n' >> "$config_file"
    printf '        "port": %d,\n' "$BASE_PEER_PORT" >> "$config_file"
    printf '        "chaincode_port": %d,\n' "$BASE_PEER_CHAINCODE_PORT" >> "$config_file"
    printf '        "operations_port": %d,\n' "$BASE_PEER_OPERATIONS_PORT" >> "$config_file"
    printf '        "couchdb_port": %d\n' "$BASE_PEER_CouchDB_PORT" >> "$config_file"
    printf '      }\n' >> "$config_file"
    printf '    },\n' >> "$config_file"
    printf '    "banks": [\n' >> "$config_file"

    # 添加银行配置
    local bank_count=${#banks[@]}
    for i in "${!banks[@]}"; do
        local bank=${banks[$i]}
        local peer_port=$((BASE_PEER_PORT + (i + 1) * 1000))
        local chaincode_port=$((BASE_PEER_CHAINCODE_PORT + (i + 1) * 1000))
        local operations_port=$((BASE_PEER_OPERATIONS_PORT + (i + 1) * 1000))
        local couchdb_port=$((BASE_PEER_CouchDB_PORT + (i + 1) * 1000))
        
        printf '      {\n' >> "$config_file"
        printf '        "name": "%s",\n' "$bank" >> "$config_file"
        printf '        "msp_id": "%sMSP",\n' "$bank" >> "$config_file"
        printf '        "peer": {\n' >> "$config_file"
        printf '          "port": %d,\n' "$peer_port" >> "$config_file"
        printf '          "chaincode_port": %d,\n' "$chaincode_port" >> "$config_file"
        printf '          "operations_port": %d,\n' "$operations_port" >> "$config_file"
        printf '          "couchdb_port": %d\n' "$couchdb_port" >> "$config_file"
        printf '        }\n' >> "$config_file"
        
        if [ $i -lt $((bank_count - 1)) ]; then
            printf '      },\n' >> "$config_file"
        else
            printf '      }\n' >> "$config_file"
        fi
    done
    
    printf '    ]\n' >> "$config_file"
    printf '  }\n' >> "$config_file"
    printf '}\n' >> "$config_file"

    echo "网络配置已生成: $config_file"
}

# 读取现有配置
read_network_config() {
    local config_file="$(dirname "$0")/../configtx/network-config.json"
    if [ -f "$config_file" ]; then
        echo "当前网络配置:"
        cat "$config_file"
    else
        echo "未找到网络配置文件"
        return 1
    fi
}

# 主函数
main() {
    case "${1:-generate}" in
        "generate")
            local channel_name="${2:-$DEFAULT_CHANNEL_NAME}"
            local central_bank="${3:-$DEFAULT_CENTRAL_BANK}"
            
            if [ $# -gt 3 ]; then
                # 使用命令行提供的银行列表
                shift 3
                local banks=("$@")
            else
                # 使用默认银行列表
                local banks=("${DEFAULT_BANKS[@]}")
            fi
            
            generate_network_config "$channel_name" "$central_bank" "${banks[@]}"
            ;;
        "read"|"show")
            read_network_config
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [命令] [参数...]"
            echo ""
            echo "命令:"
            echo "  generate [频道名] [央行名] [银行1] [银行2] ...  生成网络配置"
            echo "  read|show                                     显示当前配置"
            echo "  help                                          显示帮助信息"
            echo ""
            echo "示例:"
            echo "  $0 generate                                   使用默认配置"
            echo "  $0 generate cbdc-channel CentralBank ICBC CCB 自定义配置"
            echo "  $0 read                                       查看当前配置"
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