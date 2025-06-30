#!/bin/bash
#
# 用户管理脚本模块
# 支持通过 cryptogen 为组织添加新用户
#

# 导入通用函数
if [ -f "scripts/utils.sh" ]; then
    . scripts/utils.sh
elif [ -f "./utils.sh" ]; then
    . ./utils.sh
fi

# 导入网络配置函数
if [ -f "scripts/envVar.sh" ]; then
    . scripts/envVar.sh
elif [ -f "./envVar.sh" ]; then
    . ./envVar.sh
fi

# 导入参数解析模块
if [ -f "scripts/argParser.sh" ]; then
    . scripts/argParser.sh
elif [ -f "./argParser.sh" ]; then
    . ./argParser.sh
fi

# 获取组织的 cryptogen 配置文件路径
function getOrgCryptoConfig() {
    local org_name=$1
    local config_file=""
    
    case "$org_name" in
        "CentralBank")
            config_file="organizations/cryptogen/crypto-config-centralbank.yaml"
            ;;
        "PBOC")
            config_file="organizations/cryptogen/crypto-config-pboc.yaml"
            ;;
        "ICBC")
            config_file="organizations/cryptogen/crypto-config-icbc.yaml"
            ;;
        "ABC")
            config_file="organizations/cryptogen/crypto-config-abc.yaml"
            ;;
        "BOC")
            config_file="organizations/cryptogen/crypto-config-boc.yaml"
            ;;
        "a1")
            config_file="organizations/cryptogen/crypto-config-a1.yaml"
            ;;
        "b1")
            config_file="organizations/cryptogen/crypto-config-b1.yaml"
            ;;
        *)
            # 对于动态组织，尝试从 network-config.json 中查找
            if [ -f "network-config.json" ]; then
                local org_domain=$(jq -r ".network.organizations[] | select(.name == \"$org_name\") | .domain" network-config.json 2>/dev/null)
                if [ "$org_domain" != "null" ] && [ -n "$org_domain" ]; then
                    local org_name_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
                    config_file="organizations/cryptogen/crypto-config-${org_name_lower}.yaml"
                fi
            fi
            ;;
    esac
    
    echo "$config_file"
}

# 获取组织的域名
function getOrgDomain() {
    local org_name=$1
    local org_domain=""
    
    case "$org_name" in
        "CentralBank")
            org_domain="centralbank.example.com"
            ;;
        "PBOC")
            org_domain="pboc.example.com"
            ;;
        "ICBC")
            org_domain="icbc.example.com"
            ;;
        "ABC")
            org_domain="abc.example.com"
            ;;
        "BOC")
            org_domain="boc.example.com"
            ;;
        "a1")
            org_domain="a1.example.com"
            ;;
        "b1")
            org_domain="b1.example.com"
            ;;
        *)
            # 对于动态组织，尝试从 network-config.json 中查找
            if [ -f "network-config.json" ]; then
                org_domain=$(jq -r ".network.organizations[] | select(.name == \"$org_name\") | .domain" network-config.json 2>/dev/null)
                if [ "$org_domain" == "null" ]; then
                    org_domain=""
                fi
            fi
            ;;
    esac
    
    echo "$org_domain"
}

# 获取组织当前的用户数量
function getCurrentUserCount() {
    local config_file=$1
    
    if [ ! -f "$config_file" ]; then
        echo "0"
        return
    fi
    
    # 使用 grep 和 awk 提取用户数量
    local count=$(grep -A 1 "Users:" "$config_file" | grep "Count:" | awk '{print $2}')
    if [ -z "$count" ]; then
        count="0"
    fi
    
    echo "$count"
}

# 列出组织的所有用户
function listOrgUsers() {
    local org_name=$1
    local show_ids=${2:-false}  # 新增参数：是否显示 base64 ID
    local org_domain=$(getOrgDomain "$org_name")
    
    if [ -z "$org_domain" ]; then
        errorln "未找到组织 $org_name 的域名配置"
        return 1
    fi
    
    local users_dir="organizations/peerOrganizations/${org_domain}/users"
    
    if [ ! -d "$users_dir" ]; then
        errorln "组织 $org_name 的用户目录不存在: $users_dir"
        return 1
    fi
    
    infoln "👥 组织 $org_name 的用户列表："
    println
    
    local count=0
    for user_dir in "$users_dir"/*; do
        if [ -d "$user_dir" ]; then
            local user_name=$(basename "$user_dir")
            local user_type=""
            
            if [[ "$user_name" == Admin@* ]]; then
                user_type="管理员"
            else
                user_type="普通用户"
            fi
            
            printf "  %-30s %s\n" "$user_name" "$user_type"
            
            # 如果需要显示 ID，则调用 getUserId 函数
            if [ "$show_ids" = true ]; then
                local simple_user_name=$(echo "$user_name" | cut -d'@' -f1)
                printf "    💡 获取此用户的 base64 ID: ./network.sh adduser getid -o %s -u %s\n" "$org_name" "$user_name"
            fi
            
            count=$((count + 1))
        fi
    done
    
    println
    infoln "总共 $count 个用户"
    
    if [ "$show_ids" != true ]; then
        println
        infoln "💡 提示: 使用 './network.sh adduser getid -o $org_name -u <用户名>' 获取用户的 base64 编码 ID"
    fi
}

# 添加新用户到组织
function addUserToOrg() {
    local org_name=$1
    local user_count=${2:-1}  # 默认添加1个用户
    
    if [ -z "$org_name" ]; then
        errorln "组织名称不能为空"
        return 1
    fi
    
    if ! [[ "$user_count" =~ ^[0-9]+$ ]] || [ "$user_count" -le 0 ]; then
        errorln "用户数量必须是正整数"
        return 1
    fi
    
    local config_file=$(getOrgCryptoConfig "$org_name")
    local org_domain=$(getOrgDomain "$org_name")
    
    if [ -z "$config_file" ] || [ -z "$org_domain" ]; then
        errorln "未找到组织 $org_name 的配置"
        return 1
    fi
    
    if [ ! -f "$config_file" ]; then
        errorln "组织 $org_name 的 cryptogen 配置文件不存在: $config_file"
        return 1
    fi
    
    # 获取当前用户数量
    local current_count=$(getCurrentUserCount "$config_file")
    local new_count=$((current_count + user_count))
    
    infoln "🔧 为组织 $org_name 添加用户..."
    infoln "当前用户数量: $current_count"
    infoln "新增用户数量: $user_count"
    infoln "更新后总数量: $new_count"
    println
    
    # 备份原配置文件
    local backup_file="${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$config_file" "$backup_file"
    infoln "已备份原配置文件到: $backup_file"
    
    # 更新配置文件中的用户数量
    if command -v sed >/dev/null 2>&1; then
        # 使用 sed 替换用户数量
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS 的 sed 需要 -i '' 参数
            sed -i '' "s/Count: $current_count/Count: $new_count/" "$config_file"
        else
            # Linux 的 sed
            sed -i "s/Count: $current_count/Count: $new_count/" "$config_file"
        fi
    else
        errorln "sed 命令不可用，无法更新配置文件"
        return 1
    fi
    
    # 验证配置文件是否更新成功
    local updated_count=$(getCurrentUserCount "$config_file")
    if [ "$updated_count" != "$new_count" ]; then
        errorln "配置文件更新失败，恢复原配置"
        cp "$backup_file" "$config_file"
        return 1
    fi
    
    infoln "✅ 配置文件更新成功"
    
    # 运行 cryptogen 生成新用户证书
    infoln "🔐 生成新用户证书..."
    
    if ! command -v cryptogen >/dev/null 2>&1; then
        errorln "cryptogen 命令不可用，请确保 Fabric 工具已安装"
        # 恢复原配置文件
        cp "$backup_file" "$config_file"
        return 1
    fi
    
    # 使用 cryptogen extend 来增量添加新用户，保留现有证书
    infoln "🔐 使用增量方式生成新用户证书（保留现有证书）..."
    
    # 使用 cryptogen extend 命令来扩展现有网络
    if cryptogen extend --config="$config_file" --input="organizations" 2>/dev/null; then
        infoln "✅ 新用户证书生成成功"
    else
        errorln "新用户证书生成失败"
        # 恢复原配置文件
        cp "$backup_file" "$config_file"
        return 1
    fi
    
    # 列出新生成的用户
    infoln "🎉 成功为组织 $org_name 添加了 $user_count 个用户！"
    println
    listOrgUsers "$org_name"
    
    return 0
}

# 删除用户（通过减少用户数量）
function removeUserFromOrg() {
    local org_name=$1
    local user_count=${2:-1}  # 默认删除1个用户
    
    if [ -z "$org_name" ]; then
        errorln "组织名称不能为空"
        return 1
    fi
    
    if ! [[ "$user_count" =~ ^[0-9]+$ ]] || [ "$user_count" -le 0 ]; then
        errorln "用户数量必须是正整数"
        return 1
    fi
    
    local config_file=$(getOrgCryptoConfig "$org_name")
    
    if [ -z "$config_file" ] || [ ! -f "$config_file" ]; then
        errorln "未找到组织 $org_name 的配置文件"
        return 1
    fi
    
    # 获取当前用户数量
    local current_count=$(getCurrentUserCount "$config_file")
    local new_count=$((current_count - user_count))
    
    if [ "$new_count" -lt 0 ]; then
        errorln "无法删除 $user_count 个用户，当前只有 $current_count 个普通用户"
        return 1
    fi
    
    infoln "🗑️ 从组织 $org_name 删除用户..."
    infoln "当前用户数量: $current_count"
    infoln "删除用户数量: $user_count"
    infoln "更新后总数量: $new_count"
    println
    
    # 备份原配置文件
    local backup_file="${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$config_file" "$backup_file"
    
    # 更新配置文件
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/Count: $current_count/Count: $new_count/" "$config_file"
    else
        sed -i "s/Count: $current_count/Count: $new_count/" "$config_file"
    fi
    
    # 手动删除多余的用户目录（保留现有Admin和剩余User证书）
    local org_domain=$(getOrgDomain "$org_name")
    local users_dir="organizations/peerOrganizations/${org_domain}/users"
    
    # 计算需要保留的用户数量，只删除多余的用户目录
    if [ -d "$users_dir" ]; then
        local existing_users=($(ls "$users_dir"/User* 2>/dev/null | sort -V))
        local users_to_delete=${#existing_users[@]}
        local users_to_keep=$new_count
        
        # 删除最后的几个用户目录
        for ((i=users_to_keep; i<users_to_delete; i++)); do
            if [ -d "${existing_users[$i]}" ]; then
                rm -rf "${existing_users[$i]}"
                infoln "删除用户目录: $(basename "${existing_users[$i]}")"
            fi
        done
    fi
    
    infoln "✅ 用户删除成功（现有证书未受影响）"
    listOrgUsers "$org_name"
    
    return 0
}

# 用户管理主函数
function userManagement() {
    local subcommand="$1"
    shift
    
    case "$subcommand" in
        "add")
            addUserCommand "$@"
            ;;
        "remove")
            removeUserCommand "$@"
            ;;
        "list")
            listUserCommand "$@"
            ;;
        "getid")
            getUserIdCommand "$@"
            ;;
        "help")
            printUserManagementHelp
            ;;
        *)
            errorln "未知的用户管理子命令: $subcommand"
            printUserManagementHelp
            exit 1
            ;;
    esac
}

# 添加用户命令处理 (重构版本)
function addUserCommand() {
    # 使用新的参数解析 - 支持 -o (org) 和 -c (count)
    if ! parse_user_args "$@"; then
        return 1
    fi
    
    # 检查帮助
    if has_arg "help"; then
        printUserManagementHelp
        return 0
    fi
    
    # 显示解析结果（详细模式）
    print_parsed_args
    
    # 验证参数
    if ! validate_org_arg; then
        return 1
    fi
    
    if ! validate_numeric_arg "count" 1; then
        return 1
    fi
    
    # 获取参数值
    local org_name=$(get_arg "org")
    local user_count=$(get_arg "count")
    
    # 交互式获取缺失参数
    if [ -z "$org_name" ]; then
        prompt_missing_args
        org_name=$(get_arg "org")
    fi
    
    if [ -z "$user_count" ]; then
        prompt_missing_args "need_count"
        user_count=$(get_arg "count")
    fi
    
    # 最终验证
    if [ -z "$org_name" ]; then
        errorln "组织名称不能为空"
        return 1
    fi
    
    if [ -z "$user_count" ]; then
        errorln "用户数量不能为空"
        return 1
    fi
    
    addUserToOrg "$org_name" "$user_count"
}

# 删除用户命令处理 (重构版本)
function removeUserCommand() {
    # 使用新的参数解析 - 支持 -o (org) 和 -c (count)
    if ! parse_user_args "$@"; then
        return 1
    fi
    
    # 检查帮助
    if has_arg "help"; then
        printUserManagementHelp
        return 0
    fi
    
    # 显示解析结果（详细模式）
    print_parsed_args
    
    # 验证参数
    if ! validate_org_arg; then
        return 1
    fi
    
    if ! validate_numeric_arg "count" 1; then
        return 1
    fi
    
    # 获取参数值
    local org_name=$(get_arg "org")
    local user_count=$(get_arg "count")
    
    # 交互式获取缺失参数
    if [ -z "$org_name" ]; then
        prompt_missing_args
        org_name=$(get_arg "org")
    fi
    
    if [ -z "$user_count" ]; then
        prompt_missing_args "need_count"
        user_count=$(get_arg "count")
    fi
    
    # 最终验证
    if [ -z "$org_name" ]; then
        errorln "组织名称不能为空"
        return 1
    fi
    
    if [ -z "$user_count" ]; then
        errorln "用户数量不能为空"
        return 1
    fi
    
    removeUserFromOrg "$org_name" "$user_count"
}

# 列出用户命令处理 (重构版本)
function listUserCommand() {
    # 使用新的参数解析 - 支持 -o (org)
    if ! parse_user_args "$@"; then
        return 1
    fi
    
    # 检查帮助
    if has_arg "help"; then
        printUserManagementHelp
        return 0
    fi
    
    # 显示解析结果（详细模式）
    print_parsed_args
    
    # 验证参数
    if ! validate_org_arg; then
        return 1
    fi
    
    # 获取参数值
    local org_name=$(get_arg "org")
    
    # 如果未指定组织，列出所有组织的用户
    if [ -z "$org_name" ]; then
        infoln "📋 列出所有组织的用户："
        println
        
        # 从 network-config.json 获取组织列表
        if [ -f "network-config.json" ]; then
            local temp_org_file=$(mktemp)
            jq -r '.network.organizations[].name' network-config.json > "$temp_org_file" 2>/dev/null
            while IFS= read -r org_line; do
                if [ -n "$org_line" ]; then
                    listOrgUsers "$org_line"
                    println
                fi
            done < "$temp_org_file"
            rm -f "$temp_org_file"
        else
            # 使用默认组织列表
            local default_orgs=("CentralBank" "a1" "b1")
            for org in "${default_orgs[@]}"; do
                listOrgUsers "$org"
                println
            done
        fi
    else
        listOrgUsers "$org_name"
    fi
}

# 获取用户 ID 命令处理
function getUserIdCommand() {
    local org_name=""
    local user_name=""
    local verbose=false
    local show_help=false
    
    # 简单的参数解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -o|--org)
                org_name="$2"
                shift 2
                ;;
            -u|--user)
                user_name="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_help=true
                shift
                ;;
            *)
                errorln "未知参数: $1"
                printUserManagementHelp
                return 1
                ;;
        esac
    done
    
    # 检查帮助
    if [ "$show_help" = true ]; then
        printUserManagementHelp
        return 0
    fi
    
    # 显示解析结果（详细模式）
    if [ "$verbose" = true ]; then
        infoln "🔍 解析的参数："
        printf "  组织名: %s\n" "${org_name:-未指定}"
        printf "  用户名: %s\n" "${user_name:-未指定}"
        println
    fi
    
    # 交互式获取缺失参数
    if [ -z "$org_name" ]; then
        selectOrganization org_name
    fi
    
    if [ -z "$user_name" ]; then
        infoln "请选择用户："
        selectUser "$org_name" user_name
    fi
    
    # 最终验证
    if [ -z "$org_name" ]; then
        errorln "组织名称不能为空"
        return 1
    fi
    
    if [ -z "$user_name" ]; then
        errorln "用户名不能为空"
        return 1
    fi
    
    getUserId "$org_name" "$user_name"
}

# 获取用户的 base64 编码 ID
function getUserId() {
    local org_name=$1
    local user_name=$2
    
    if [ -z "$org_name" ] || [ -z "$user_name" ]; then
        errorln "组织名称和用户名不能为空"
        return 1
    fi
    
    local org_domain=$(getOrgDomain "$org_name")
    if [ -z "$org_domain" ]; then
        errorln "未找到组织 $org_name 的域名配置"
        return 1
    fi
    
    # 构建用户证书路径 - 如果用户名已包含域名，直接使用；否则添加域名
    local full_user_name
    if [[ "$user_name" == *@* ]]; then
        full_user_name="$user_name"
    else
        full_user_name="${user_name}@${org_domain}"
    fi
    
    # 证书文件名格式为 ${full_user_name}-cert.pem
    local user_cert_path="organizations/peerOrganizations/${org_domain}/users/${full_user_name}/msp/signcerts/${full_user_name}-cert.pem"
    
    if [ ! -f "$user_cert_path" ]; then
        errorln "用户证书文件不存在: $user_cert_path"
        errorln "请确保用户 $full_user_name 已在组织 $org_name 中正确创建"
        return 1
    fi
    
    infoln "🔍 正在为用户 $full_user_name 生成 base64 编码 ID..."
    println
    
    # 从证书中提取主体信息
    local cert_subject=$(openssl x509 -in "$user_cert_path" -noout -subject -nameopt RFC2253)
    if [ $? -ne 0 ]; then
        errorln "无法从证书中提取主体信息"
        return 1
    fi
    
    # 从证书中提取 issuer 信息（CA证书主体）
    local cert_issuer=$(openssl x509 -in "$user_cert_path" -noout -issuer -nameopt RFC2253)
    if [ $? -ne 0 ]; then
        errorln "无法从证书中提取 issuer 信息"
        return 1
    fi
    
    # 移除 "subject=" 和 "issuer=" 前缀
    cert_subject=${cert_subject#subject=}
    cert_issuer=${cert_issuer#issuer=}
    
    # 构建 x509 格式的客户端 ID 字符串（正确格式）
    local client_id_raw="x509::${cert_subject}::${cert_issuer}"
    
    # 进行 base64 编码
    local client_id_base64=$(echo -n "$client_id_raw" | base64 -w 0)
    
    infoln "📄 用户信息："
    printf "  %-20s %s\n" "用户名:" "$full_user_name"
    printf "  %-20s %s\n" "组织:" "$org_name"
    printf "  %-20s %s\n" "域名:" "$org_domain"
    printf "  %-20s %s\n" "证书路径:" "$user_cert_path"
    println
    
    infoln "🔑 证书主体信息 (Subject)："
    printf "  %s\n" "$cert_subject"
    println
    
    infoln "🏢 证书颁发者信息 (Issuer/CA)："
    printf "  %s\n" "$cert_issuer"
    println
    
    infoln "🆔 Raw Client ID："
    printf "  %s\n" "$client_id_raw"
    println
    
    infoln "🔐 Base64 编码的 Client ID (用于转账)："
    printf "  %s\n" "$client_id_base64"
    println
    
    infoln "💡 使用示例："
    println "  # 转账到此用户："
    println "  ./network.sh ccc transfer -org $org_name -user admin -to \"$client_id_base64\" -amount 100"
    println
    println "  # 查询此用户余额："
    println "  ./network.sh ccc balance -account \"$client_id_base64\""
    
    return 0
}

# 选择用户函数
function selectUser() {
    local org_name=$1
    local user_var_name=$2
    local org_domain=$(getOrgDomain "$org_name")
    
    if [ -z "$org_domain" ]; then
        errorln "未找到组织 $org_name 的域名配置"
        return 1
    fi
    
    local users_dir="organizations/peerOrganizations/${org_domain}/users"
    
    if [ ! -d "$users_dir" ]; then
        errorln "组织 $org_name 的用户目录不存在: $users_dir"
        return 1
    fi
    
    local users=()
    for user_dir in "$users_dir"/*; do
        if [ -d "$user_dir" ]; then
            local user_name=$(basename "$user_dir")
            users+=("$user_name")
        fi
    done
    
    if [ ${#users[@]} -eq 0 ]; then
        errorln "组织 $org_name 没有任何用户"
        return 1
    fi
    
    if [ ${#users[@]} -eq 1 ]; then
        eval "$user_var_name='${users[0]}'"
    else
        println "📋 组织 $org_name 的可用用户："
        for i in "${!users[@]}"; do
            printf "  %d) %s\n" $((i+1)) "${users[$i]}"
        done
        
        while true; do
            printf "请选择用户 [1-${#users[@]}]: "
            read -r selection
            
            if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#users[@]} ]; then
                eval "$user_var_name='${users[$((selection-1))]}'"
                break
            else
                errorln "无效选择，请输入 1-${#users[@]} 之间的数字"
            fi
        done
    fi
}

# 选择组织函数
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
    else
        orgs=("CentralBank" "a1" "b1")
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

# 打印用户管理帮助信息 (重构版本)
function printUserManagementHelp() {
    println "👥 用户管理工具 (重构版本)"
    println
    println "用法: $0 adduser <子命令> [选项]"
    println
    println "子命令:"
    println "  add        - 为组织添加新用户"
    println "  remove     - 从组织删除用户"
    println "  list       - 列出组织的用户"
    println "  getid      - 获取用户 base64 编码 ID"
    println "  help       - 显示此帮助信息"
    println
    println "选项:"
    println "  -o <组织名>     - 指定组织名称"
    println "  -c <数量>       - 指定用户数量（仅适用于 add/remove）"
    println "  -u <用户名>     - 指定用户名（仅适用于 getid）"
    println "  -v             - 详细输出模式"
    println "  -h             - 显示帮助信息"
    println
    println "示例:"
    println "  $0 adduser add -o CentralBank -c 2"
    println "  $0 adduser remove -o a1 -c 1"
    println "  $0 adduser list -o b1"
    println "  $0 adduser list  # 列出所有组织的用户"
    println "  $0 adduser getid -o CentralBank -u Admin@centralbank.example.com"
    println "  $0 adduser getid -o a1 -u User1@a1.example.com"
    println "  $0 adduser add -v -o CentralBank -c 2  # 详细模式"
    println
    println "用户 ID 相关:"
    println "  - getid 子命令生成的 base64 编码 ID 可用于转账命令"
    println "  - 示例: ./network.sh ccc transfer -to \"<base64_id>\" -amount 100"
    println "  - 可以通过智能合约的 GetUserInfo 函数验证用户身份"
    println
    println "注意:"
    println "  - 添加用户使用增量方式，保留现有用户证书不变"
    println "  - Admin 用户不会被删除"
    println "  - 操作前会自动备份配置文件"
    println "  - 新用户可立即使用，无需重启网络"
    println "  - 旧格式 (-org, -count) 仍然兼容新格式 (-o, -c)"
} 