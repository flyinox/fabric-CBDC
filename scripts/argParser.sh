#!/bin/bash
#
# 通用参数解析模块
# 使用 getopts 标准化所有命令的参数处理
# 兼容 macOS 和 Linux
#

# 检查bash版本并设置兼容性
if [ -n "$BASH_VERSION" ]; then
    # Bash 4.0+ 支持关联数组
    if [[ ${BASH_VERSINFO[0]} -ge 4 ]]; then
        declare -A PARSED_ARGS 2>/dev/null || {
            # 如果关联数组不可用，使用环境变量模拟
            PARSED_ARGS_METHOD="env"
        }
    else
        PARSED_ARGS_METHOD="env"
    fi
else
    # 非bash shell，使用环境变量
    PARSED_ARGS_METHOD="env"
fi

OPTIND=1  # 重置 getopts

# 清空解析结果
function reset_parsed_args() {
    if [ "$PARSED_ARGS_METHOD" = "env" ]; then
        # 清理所有 PARSED_ARG_ 开头的环境变量
        unset $(env | grep '^PARSED_ARG_' | cut -d= -f1)
    else
        unset PARSED_ARGS
        declare -A PARSED_ARGS 2>/dev/null
    fi
    OPTIND=1
}

# 设置参数值
function set_parsed_arg() {
    local key="$1"
    local value="$2"
    
    if [ "$PARSED_ARGS_METHOD" = "env" ]; then
        eval "PARSED_ARG_${key}='$value'"
    else
        PARSED_ARGS["$key"]="$value"
    fi
}

# 获取参数值
function get_parsed_arg() {
    local key="$1"
    
    if [ "$PARSED_ARGS_METHOD" = "env" ]; then
        eval "echo \"\$PARSED_ARG_${key}\""
    else
        echo "${PARSED_ARGS[$key]}"
    fi
}

# 通用参数解析函数
function parse_common_args() {
    local OPTSTRING="$1"
    shift
    local args=("$@")
    
    reset_parsed_args
    
    while getopts "$OPTSTRING" opt "${args[@]}"; do
        case $opt in
            o)  # -o org (组织)
                set_parsed_arg "org" "$OPTARG"
                ;;
            u)  # -u user (用户)
                set_parsed_arg "user" "$OPTARG"
                ;;
            c)  # -c count (数量)
                set_parsed_arg "count" "$OPTARG"
                ;;
            C)  # -C channel (频道)
                set_parsed_arg "channel" "$OPTARG"
                ;;
            n)  # -n name (名称，如代币名称)
                set_parsed_arg "name" "$OPTARG"
                ;;
            s)  # -s symbol (符号，如代币符号)
                set_parsed_arg "symbol" "$OPTARG"
                ;;
            a)  # -a amount (数量，如代币数量)
                set_parsed_arg "amount" "$OPTARG"
                ;;
            t)  # -t to (接收地址)
                set_parsed_arg "to" "$OPTARG"
                ;;
            f)  # -f from (发送地址) 
                set_parsed_arg "from" "$OPTARG"
                ;;
            v)  # -v verbose (详细输出)
                set_parsed_arg "verbose" "true"
                ;;
            h)  # -h help (帮助)
                set_parsed_arg "help" "true"
                ;;
            \?) # 无效选项
                errorln "无效选项: -$OPTARG"
                return 1
                ;;
            :)  # 缺少参数
                errorln "选项 -$OPTARG 需要参数"
                return 1
                ;;
        esac
    done
    
    return 0
}

# 获取解析后的参数值
function get_arg() {
    local key="$1"
    local default="$2"
    local value=$(get_parsed_arg "$key")
    echo "${value:-$default}"
}

# 检查参数是否存在
function has_arg() {
    local key="$1"
    local value=$(get_parsed_arg "$key")
    [ -n "$value" ]
}

# 验证必需参数
function require_args() {
    local missing_args=()
    
    for arg in "$@"; do
        if ! has_arg "$arg"; then
            missing_args+=("$arg")
        fi
    done
    
    if [ ${#missing_args[@]} -gt 0 ]; then
        errorln "缺少必需参数: ${missing_args[*]}"
        return 1
    fi
    
    return 0
}

# 验证数字参数
function validate_numeric_arg() {
    local key="$1"
    local min_val="${2:-1}"
    local value=$(get_arg "$key")
    
    if [[ -n "$value" ]]; then
        if ! [[ "$value" =~ ^[0-9]+$ ]] || [ "$value" -lt "$min_val" ]; then
            errorln "参数 $key 必须是大于等于 $min_val 的整数"
            return 1
        fi
    fi
    
    return 0
}

# 验证组织参数 (动态版本，从 network-config.json 读取)
function validate_org_arg() {
    local org=$(get_arg "org")
    if [[ -n "$org" ]]; then
        # 从 network-config.json 获取组织列表
        local valid_orgs=""
        if [ -f "network-config.json" ]; then
            local temp_org_file=$(mktemp)
            jq -r '.network.organizations[].name' network-config.json > "$temp_org_file" 2>/dev/null
            while IFS= read -r org_line; do
                if [ -n "$org_line" ]; then
                    valid_orgs="$valid_orgs $org_line"
                fi
            done < "$temp_org_file"
            rm -f "$temp_org_file"
        fi
        
        local is_valid=false
        for valid_org in $valid_orgs; do
            if [ "$org" = "$valid_org" ]; then
                is_valid=true
                break
            fi
        done
        
        if [ "$is_valid" = false ]; then
            errorln "无效的组织名称: $org"
            if [ -n "$valid_orgs" ]; then
                errorln "有效的组织: $valid_orgs"
            else
                errorln "未找到任何配置的组织，请检查 network-config.json 文件"
            fi
            return 1
        fi
    fi
    
    return 0
}

# 交互式获取缺失参数
function prompt_missing_args() {
    # 交互式获取组织
    if ! has_arg "org"; then
        local org_name
        selectOrganization org_name
        set_parsed_arg "org" "$org_name"
    fi
    
    # 交互式获取用户
    if ! has_arg "user" && [ "$1" = "need_user" ]; then
        printf "请输入用户名 [admin/user1/user2/...]: "
        read -r user_input
        if [ -n "$user_input" ]; then
            set_parsed_arg "user" "$user_input"
        else
            set_parsed_arg "user" "admin"
        fi
    fi
    
    # 交互式获取数量
    if ! has_arg "count" && [ "$1" = "need_count" ]; then
        printf "请输入数量 [默认: 1]: "
        read -r count_input
        if [ -n "$count_input" ] && [[ "$count_input" =~ ^[0-9]+$ ]] && [ "$count_input" -gt 0 ]; then
            set_parsed_arg "count" "$count_input"
        else
            set_parsed_arg "count" "1"
        fi
    fi
}

# CBDC 相关参数解析
function parse_cbdc_args() {
    parse_common_args "o:u:C:n:s:a:t:f:vh" "$@"
}

# 用户管理参数解析  
function parse_user_args() {
    parse_common_args "o:c:vh" "$@"
}

# 智能合约参数解析
function parse_chaincode_args() {
    parse_common_args "o:u:C:vh" "$@"
}

# 打印解析结果（调试用）
function print_parsed_args() {
    if [ "$VERBOSE" = "true" ] || has_arg "verbose"; then
        infoln "🔍 解析的参数:"
        
        if [ "$PARSED_ARGS_METHOD" = "env" ]; then
            # 遍历环境变量
            env | grep '^PARSED_ARG_' | while IFS='=' read -r key value; do
                local clean_key=${key#PARSED_ARG_}
                infoln "  $clean_key = $value"
            done
        else
            # 使用关联数组
            for key in "${!PARSED_ARGS[@]}"; do
                infoln "  $key = ${PARSED_ARGS[$key]}"
            done
        fi
    fi
}

# 简化版选择组织函数
function selectOrganization() {
    local org_name_var=$1
    local orgs=()
    
    # 从 network-config.json 获取组织列表
    if [ -f "network-config.json" ]; then
        local temp_org_file=$(mktemp)
        jq -r '.network.organizations[].name' network-config.json > "$temp_org_file" 2>/dev/null
        while IFS= read -r org_line; do
            if [ -n "$org_line" ]; then
                orgs+=("$org_line")
            fi
        done < "$temp_org_file"
        rm -f "$temp_org_file"
    fi
    
    if [ ${#orgs[@]} -eq 0 ]; then
        errorln "未找到任何配置的组织，请检查 network-config.json 文件"
        return 1
    fi
    
    if [ ${#orgs[@]} -eq 1 ]; then
        eval "$org_name_var='${orgs[0]}'"
    else
        println "📋 可用组织："
        for i in "${!orgs[@]}"; do
            printf "  %d) %s\n" $((i+1)) "${orgs[$i]}"
        done
        
        while true; do
            printf "请选择组织 [1-${#orgs[@]}]: "
            read -r selection
            
            if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#orgs[@]} ]; then
                eval "$org_name_var='${orgs[$((selection-1))]}'"
                break
            else
                errorln "无效选择，请输入 1-${#orgs[@]} 之间的数字"
            fi
        done
    fi
}

# 使用示例函数
function show_usage_examples() {
    println "📖 参数解析使用示例:"
    println
    println "1. 解析 CBDC 参数:"
    println "   parse_cbdc_args \"\$@\""
    println "   org=\$(get_arg \"org\")"
    println "   amount=\$(get_arg \"amount\" \"100\")"
    println
    println "2. 验证参数:"
    println "   validate_numeric_arg \"amount\" 1"
    println "   validate_org_arg"
    println
    println "3. 处理缺失参数:"
    println "   prompt_missing_args \"need_user\""
    println
    println "4. 检查参数:"
    println "   if has_arg \"verbose\"; then"
    println "       echo \"详细模式已启用\""
    println "   fi"
}

# 导出主要函数
export -f parse_common_args
export -f parse_cbdc_args
export -f parse_user_args
export -f parse_chaincode_args
export -f get_arg
export -f has_arg
export -f require_args
export -f validate_numeric_arg
export -f validate_org_arg
export -f prompt_missing_args
export -f print_parsed_args
export -f reset_parsed_args 