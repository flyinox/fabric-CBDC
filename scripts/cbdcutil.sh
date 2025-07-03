#!/bin/bash
#
# CBDC 智能合约管理工具
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# CBDC Utility Functions
# ======================

# Get available organizations for CBDC network
function getCBDCOrganizations() {
  if [ -f "network-config.json" ]; then
    jq -r '.network.organizations[].name' network-config.json
  else
    echo "PBOC ICBC ABC BOC"
  fi
}

# Get organization users (for now, we use admin and user1 as examples)
function getOrgUsers() {
  local org_name=$1
  local org_domain=""
  
  # Get organization domain from network config
  if [ -f "network-config.json" ]; then
    org_domain=$(jq -r ".network.organizations[] | select(.name == \"$org_name\") | .domain" network-config.json 2>/dev/null)
  fi
  
  # If not found in config, use default mapping
  if [ -z "$org_domain" ] || [ "$org_domain" = "null" ]; then
    case "$org_name" in
      "CentralBank") org_domain="centralbank.example.com" ;;
      "a1") org_domain="a1.example.com" ;;
      "b1") org_domain="b1.example.com" ;;
      "PBOC") org_domain="pboc.example.com" ;;
      "ICBC") org_domain="icbc.example.com" ;;
      "ABC") org_domain="abc.example.com" ;;
      "BOC") org_domain="boc.example.com" ;;
      *) org_domain="$org_name.example.com" ;;
    esac
  fi
  
  local users_dir="organizations/peerOrganizations/${org_domain}/users"
  
  if [ -d "$users_dir" ]; then
    # Extract user names from directory structure and convert to simple names
    local found_users=()
    for user_dir in "$users_dir"/*; do
      if [ -d "$user_dir" ]; then
        local user_name=$(basename "$user_dir")
        # Convert from User1@domain format to just user1, or admin for Admin@domain
        if [[ "$user_name" == Admin@* ]]; then
          found_users+=("admin")
        elif [[ "$user_name" == User*@* ]]; then
          # Convert User1@domain to user1, User2@domain to user2, etc.
          local user_num=$(echo "$user_name" | sed 's/User\([0-9]*\)@.*/\1/')
          found_users+=("user$user_num")
        fi
      fi
    done
    
    # Output all found users
    for user in "${found_users[@]}"; do
      echo "$user"
    done
  fi
}

# Interactive organization selection
function selectOrganization() {
  # Build organization array
  local orgs=()
  
  if [ -f "network-config.json" ]; then
    # Use temp file approach for compatibility
    local temp_org_file=$(mktemp)
    jq -r '.network.organizations[].name' network-config.json > "$temp_org_file"
    while IFS= read -r org_line; do
      if [ -n "$org_line" ]; then
        orgs+=("$org_line")
      fi
    done < "$temp_org_file"
    rm -f "$temp_org_file"
  else
    orgs=("PBOC" "ICBC" "ABC" "BOC")
  fi
  
  if [ ${#orgs[@]} -eq 1 ]; then
    echo "${orgs[0]}"
    return 0
  fi
  
  println "📋 可用组织："
  for i in "${!orgs[@]}"; do
    printf "  %d) %s\n" $((i+1)) "${orgs[$i]}"
  done
  
  while true; do
    printf "请选择组织 [1-${#orgs[@]}]: "
    read -r selection
    
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#orgs[@]} ]; then
      echo "${orgs[$((selection-1))]}"
      return 0
    else
      errorln "无效选择，请输入 1-${#orgs[@]} 之间的数字"
    fi
  done
}

# Interactive user selection
function selectUser() {
  local org_name=$1
  local users=($(getOrgUsers "$org_name"))
  
  if [ ${#users[@]} -eq 1 ]; then
    echo "${users[0]}"
    return 0
  fi
  
  println "👤 ${org_name} 组织可用用户："
  for i in "${!users[@]}"; do
    printf "  %d) %s\n" $((i+1)) "${users[$i]}"
  done
  
  while true; do
    printf "请选择用户 [1-${#users[@]}]: "
    read -r selection
    
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#users[@]} ]; then
      echo "${users[$((selection-1))]}"
      return 0
    else
      errorln "无效选择，请输入 1-${#users[@]} 之间的数字"
    fi
  done
}

# Get organization index for envVar.sh compatibility
function getOrgIndex() {
  local org_name=$1
  
  # Build organization array directly (no debug output to stdout)
  local orgs=()
  
  if [ -f "network-config.json" ]; then
    local temp_file=$(mktemp)
    jq -r '.network.organizations[].name' network-config.json > "$temp_file" 2>/dev/null
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        orgs+=("$line")
      fi
    done < "$temp_file"
    rm -f "$temp_file"
  else
    orgs=("PBOC" "ICBC" "ABC" "BOC")
  fi
  
  # 进行大小写不敏感的匹配
  for i in "${!orgs[@]}"; do
    local org_lower=$(echo "${orgs[$i]}" | tr '[:upper:]' '[:lower:]')
    local input_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
    if [[ "$org_lower" == "$input_lower" ]]; then
      echo $((i+1))
      return 0
    fi
  done
  
  # 如果没找到，尝试一些常见的别名映射
  local input_lower=$(echo "$org_name" | tr '[:upper:]' '[:lower:]')
  case "$input_lower" in
    "bank1"|"org1"|"a1") 
      # 查找 Bank1
      for i in "${!orgs[@]}"; do
        if [[ "${orgs[$i]}" == "Bank1" ]]; then
          echo $((i+1))
          return 0
        fi
      done
      ;;
    "bank2"|"org2"|"b1") 
      # 查找 Bank2
      for i in "${!orgs[@]}"; do
        if [[ "${orgs[$i]}" == "Bank2" ]]; then
          echo $((i+1))
          return 0
        fi
      done
      ;;
    "c1"|"central"|"centralbank"|"pboc") 
      # 查找 c1
      for i in "${!orgs[@]}"; do
        if [[ "${orgs[$i]}" == "c1" ]]; then
          echo $((i+1))
          return 0
        fi
      done
      ;;
  esac
  
  echo "1"  # Default to first organization
}

# Execute chaincode command with organization context
function executeChaincodeCommand() {
  local org_name=$1
  local user_name=$2
  local command_type=$3  # invoke or query
  local function_name=$4
  local args=$5
  
  local org_index=$(getOrgIndex "$org_name")
  
  infoln "🚀 执行智能合约命令..."
  println "  组织: $org_name (索引: $org_index)"
  println "  用户: $user_name"
  println "  类型: $command_type"
  println "  函数: $function_name"
  println "  参数: $args"
  println
  
  # Set proper environment (without debug output that might interfere)
  export FABRIC_CFG_PATH=${PWD}/compose/docker/peercfg
  export CHANNEL_NAME="cbdc-channel"
  export CC_NAME="cbdc"
  export CLI_DELAY=${CLI_DELAY:-3}
  export MAX_RETRY=${MAX_RETRY:-5}
  export DELAY=${CLI_DELAY}
  
  # Load scripts
  . scripts/envVar.sh
  . scripts/ccutils.sh
  
  # Set globals for the organization and user
  setGlobals $org_index "$user_name"
  
  # Execute chaincode operation
  if [ "$command_type" == "invoke" ]; then
    chaincodeInvoke $org_index "cbdc-channel" "cbdc" "${args}"
  else
    chaincodeQuery $org_index "cbdc-channel" "cbdc" "${args}" "$user_name"
  fi
}

# Inline organization and user selection logic (to avoid function call issues)
function selectOrgAndUser() {
  local org_name_var=$1
  local user_name_var=$2
  local current_org_name=${!org_name_var}
  local current_user_name=${!user_name_var}
  
  # Organization selection
  if [ -z "$current_org_name" ]; then
    local orgs=()
    
    if [ -f "network-config.json" ]; then
      local temp_org_file=$(mktemp)
      jq -r '.network.organizations[].name' network-config.json > "$temp_org_file"
      while IFS= read -r org_line; do
        if [ -n "$org_line" ]; then
          orgs+=("$org_line")
        fi
      done < "$temp_org_file"
      rm -f "$temp_org_file"
    else
      orgs=("PBOC" "ICBC" "ABC" "BOC")
    fi
    
    if [ ${#orgs[@]} -eq 1 ]; then
      current_org_name="${orgs[0]}"
    else
      println "📋 可用组织："
      for i in "${!orgs[@]}"; do
        printf "  %d) %s\n" $((i+1)) "${orgs[$i]}"
      done
      
      while true; do
        printf "请选择组织 [1-${#orgs[@]}]: "
        read -r selection
        
        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#orgs[@]} ]; then
          current_org_name="${orgs[$((selection-1))]}"
          break
        else
          errorln "无效选择，请输入 1-${#orgs[@]} 之间的数字"
        fi
      done
    fi
  fi
  
  # User selection
  if [ -z "$current_user_name" ]; then
    local users=($(getOrgUsers "$current_org_name"))
    
    if [ ${#users[@]} -eq 0 ]; then
      errorln "组织 $current_org_name 没有可用用户"
      return 1
    fi
    
    if [ ${#users[@]} -eq 1 ]; then
      current_user_name="${users[0]}"
    else
      println "👤 ${current_org_name} 组织可用用户："
      for i in "${!users[@]}"; do
        printf "  %d) %s\n" $((i+1)) "${users[$i]}"
      done
      
      while true; do
        printf "请选择用户 [1-${#users[@]}]: "
        read -r selection
        
        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#users[@]} ]; then
          current_user_name="${users[$((selection-1))]}"
          break
        else
          errorln "无效选择，请输入 1-${#users[@]} 之间的数字"
        fi
      done
    fi
  fi
  
  # Return values via global variables
  eval "$org_name_var='$current_org_name'"
  eval "$user_name_var='$current_user_name'"
}

# CBDC Command Implementations
# ============================

# CBDC Initialize command
function cbdcInitialize() {
  local name=""
  local symbol=""
  local decimals=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -name)
        name="$2"
        shift 2
        ;;
      -symbol)
        symbol="$2"
        shift 2
        ;;
      -decimals)
        decimals="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "🏛️ 初始化 CBDC 代币..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$name" ]; then
    printf "请输入代币名称 [默认: Digital Yuan]: "
    read -r name
    name=${name:-"Digital Yuan"}
  fi
  
  if [ -z "$symbol" ]; then
    printf "请输入代币符号 [默认: DCEP]: "
    read -r symbol
    symbol=${symbol:-"DCEP"}
  fi
  
  if [ -z "$decimals" ]; then
    printf "请输入小数位数 [默认: 2]: "
    read -r decimals
    decimals=${decimals:-"2"}
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  # Properly escape JSON arguments to handle spaces and special characters
  local escaped_name=$(printf '%s' "$name" | sed 's/"/\\"/g')
  local escaped_symbol=$(printf '%s' "$symbol" | sed 's/"/\\"/g')
  local escaped_decimals=$(printf '%s' "$decimals" | sed 's/"/\\"/g')
  
  local args="{\"Args\":[\"Initialize\",\"$escaped_name\",\"$escaped_symbol\",\"$escaped_decimals\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "invoke" "Initialize" "$args"
}

# CBDC Mint command
function cbdcMint() {
  local amount=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -amount)
        amount="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "💰 铸造 CBDC 代币..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$amount" ]; then
    printf "请输入铸造数量: "
    read -r amount
    if [[ ! "$amount" =~ ^[0-9]+$ ]] || [ "$amount" -le 0 ]; then
      errorln "数量必须是正整数"
      return 1
    fi
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"Mint\",\"$amount\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "invoke" "Mint" "$args"
}

# CBDC Burn command
function cbdcBurn() {
  local amount=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -amount)
        amount="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "🔥 销毁 CBDC 代币..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$amount" ]; then
    printf "请输入销毁数量: "
    read -r amount
    if [[ ! "$amount" =~ ^[0-9]+$ ]] || [ "$amount" -le 0 ]; then
      errorln "数量必须是正整数"
      return 1
    fi
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"Burn\",\"$amount\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "invoke" "Burn" "$args"
}

# CBDC Transfer command
function cbdcTransfer() {
  local recipient=""
  local amount=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -to)
        recipient="$2"
        shift 2
        ;;
      -amount)
        amount="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "💸 转账 CBDC 代币..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$recipient" ]; then
    printf "请输入接收者地址: "
    read -r recipient
    if [ -z "$recipient" ]; then
      errorln "接收者地址不能为空"
      return 1
    fi
  fi
  
  if [ -z "$amount" ]; then
    printf "请输入转账数量: "
    read -r amount
    if [[ ! "$amount" =~ ^[0-9]+$ ]] || [ "$amount" -le 0 ]; then
      errorln "数量必须是正整数"
      return 1
    fi
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  # Properly escape JSON arguments to handle spaces and special characters
  local escaped_recipient=$(printf '%s' "$recipient" | sed 's/"/\\"/g')
  
  local args="{\"Args\":[\"Transfer\",\"$escaped_recipient\",\"$amount\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "invoke" "Transfer" "$args"
}

# CBDC Balance query
function cbdcBalance() {
  local account=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -account)
        account="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "🔍 查询账户余额..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  if [ -z "$account" ]; then
    printf "是否查询当前客户端余额？[Y/n]: "
    read -r response
    case "$response" in
      [nN][oO]|[nN])
        printf "请输入要查询的账户地址: "
        read -r account
        # Properly escape JSON arguments to handle spaces and special characters
        local escaped_account=$(printf '%s' "$account" | sed 's/"/\\"/g')
        local args="{\"Args\":[\"BalanceOf\",\"$escaped_account\"]}"
        executeChaincodeCommand "$org_name" "$user_name" "query" "BalanceOf" "$args"
        ;;
      *)
        local args="{\"Args\":[\"ClientAccountBalance\"]}"
        executeChaincodeCommand "$org_name" "$user_name" "query" "ClientAccountBalance" "$args"
        ;;
    esac
  else
    # Properly escape JSON arguments to handle spaces and special characters
    local escaped_account=$(printf '%s' "$account" | sed 's/"/\\"/g')
    local args="{\"Args\":[\"BalanceOf\",\"$escaped_account\"]}"
    executeChaincodeCommand "$org_name" "$user_name" "query" "BalanceOf" "$args"
  fi
}

# CBDC Total Supply query
function cbdcTotalSupply() {
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "📊 查询代币总供应量..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"TotalSupply\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "query" "TotalSupply" "$args"
}

# CBDC Client Account ID query
function cbdcClientAccountID() {
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "🆔 查询客户端账户ID..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"ClientAccountID\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "query" "ClientAccountID" "$args"
}

# CBDC Approve command
function cbdcApprove() {
  local spender=""
  local amount=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -spender)
        spender="$2"
        shift 2
        ;;
      -amount)
        amount="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "✅ 批准代币授权..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$spender" ]; then
    printf "请输入被授权者地址: "
    read -r spender
    if [ -z "$spender" ]; then
      errorln "被授权者地址不能为空"
      return 1
    fi
  fi
  
  if [ -z "$amount" ]; then
    printf "请输入授权金额: "
    read -r amount
    if [[ ! "$amount" =~ ^[0-9]+$ ]] || [ "$amount" -lt 0 ]; then
      errorln "数量必须是非负整数"
      return 1
    fi
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  # Properly escape JSON arguments to handle spaces and special characters
  local escaped_spender=$(printf '%s' "$spender" | sed 's/"/\\"/g')
  
  local args="{\"Args\":[\"Approve\",\"$escaped_spender\",\"$amount\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "invoke" "Approve" "$args"
}

# CBDC Allowance query
function cbdcAllowance() {
  local owner=""
  local spender=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -owner)
        owner="$2"
        shift 2
        ;;
      -spender)
        spender="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "🔍 查询代币授权额度..."
  println
  
  # Interactive mode if parameters not provided
  if [ -z "$owner" ]; then
    printf "请输入授权者地址: "
    read -r owner
    if [ -z "$owner" ]; then
      errorln "授权者地址不能为空"
      return 1
    fi
  fi
  
  if [ -z "$spender" ]; then
    printf "请输入被授权者地址: "
    read -r spender
    if [ -z "$spender" ]; then
      errorln "被授权者地址不能为空"
      return 1
    fi
  fi
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  # Properly escape JSON arguments to handle spaces and special characters
  local escaped_owner=$(printf '%s' "$owner" | sed 's/"/\\"/g')
  local escaped_spender=$(printf '%s' "$spender" | sed 's/"/\\"/g')
  
  local args="{\"Args\":[\"Allowance\",\"$escaped_owner\",\"$escaped_spender\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "query" "Allowance" "$args"
}

# CBDC Get user info query
function cbdcGetUserInfo() {
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "👤 获取用户基本信息..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"GetUserInfo\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "query" "GetUserInfo" "$args"
}

# CBDC Get user account info query
function cbdcGetUserAccountInfo() {
  local user_id=""
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -userid)
        user_id="$2"
        shift 2
        ;;
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "👤 获取用户账户信息..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  if [ -z "$user_id" ]; then
    printf "是否查询当前客户端账户信息？[Y/n]: "
    read -r response
    case "$response" in
      [nN][oO]|[nN])
        printf "请输入要查询的用户ID: "
        read -r user_id
        if [ -z "$user_id" ]; then
          errorln "用户ID不能为空"
          return 1
        fi
        # Properly escape JSON arguments to handle spaces and special characters
        local escaped_user_id=$(printf '%s' "$user_id" | sed 's/"/\\"/g')
        local args="{\"Args\":[\"GetUserAccountInfo\",\"$escaped_user_id\"]}"
        executeChaincodeCommand "$org_name" "$user_name" "query" "GetUserAccountInfo" "$args"
        ;;
      *)
        local args="{\"Args\":[\"GetClientAccountInfo\"]}"
        executeChaincodeCommand "$org_name" "$user_name" "query" "GetClientAccountInfo" "$args"
        ;;
    esac
  else
    # Properly escape JSON arguments to handle spaces and special characters
    local escaped_user_id=$(printf '%s' "$user_id" | sed 's/"/\\"/g')
    local args="{\"Args\":[\"GetUserAccountInfo\",\"$escaped_user_id\"]}"
    executeChaincodeCommand "$org_name" "$user_name" "query" "GetUserAccountInfo" "$args"
  fi
}

# CBDC Get client account info query
function cbdcGetClientAccountInfo() {
  local org_name=""
  local user_name=""
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      -org)
        org_name="$2"
        shift 2
        ;;
      -user)
        user_name="$2"
        shift 2
        ;;
      *)
        errorln "未知参数: $1"
        return 1
        ;;
    esac
  done
  
  infoln "👤 获取当前客户端账户信息..."
  println
  
  # Use inline selection to avoid function call issues
  selectOrgAndUser org_name user_name
  
  local args="{\"Args\":[\"GetClientAccountInfo\"]}"
  
  executeChaincodeCommand "$org_name" "$user_name" "query" "GetClientAccountInfo" "$args"
}

# CBDC main command handler
function cbdcChaincode() {
  local subcommand="$1"
  shift
  
  case "$subcommand" in
    init)
      cbdcInitialize "$@"
      ;;
    mint)
      cbdcMint "$@"
      ;;
    burn)
      cbdcBurn "$@"
      ;;
    transfer)
      cbdcTransfer "$@"
      ;;
    balance)
      cbdcBalance "$@"
      ;;
    supply)
      cbdcTotalSupply "$@"
      ;;
    clientAccountID)
      cbdcClientAccountID "$@"
      ;;
    clientid)
      cbdcClientAccountID "$@"
      ;;
    approve)
      cbdcApprove "$@"
      ;;
    allowance)
      cbdcAllowance "$@"
      ;;
    userinfo)
      cbdcGetUserInfo "$@"
      ;;
    user)
      cbdcGetUserInfo "$@"
      ;;
    accountinfo)
      cbdcGetUserAccountInfo "$@"
      ;;
    account)
      cbdcGetUserAccountInfo "$@"
      ;;
    clientaccount)
      cbdcGetClientAccountInfo "$@"
      ;;
    help)
      printCBDCHelp
      ;;
    *)
      errorln "未知的 CBDC 子命令: $subcommand"
      printCBDCHelp
      exit 1
      ;;
  esac
}

# Print CBDC help information
function printCBDCHelp() {
  println "🏛️ CBDC 智能合约管理工具"
  println
  println "用法: $0 ccc <子命令> [选项]"
  println
  println "子命令:"
  println "  init       - 初始化 CBDC 代币"
  println "  mint       - 铸造新代币 (仅央行)"
  println "  burn       - 销毁代币 (仅央行)"
  println "  transfer   - 转账代币"
  println "  balance    - 查询账户余额"
  println "  supply     - 查询代币总供应量"
  println "  clientAccountID - 查询客户端账户ID"
  println "  clientid   - 查询客户端账户ID (clientAccountID的简写)"
  println "  approve    - 批准代币授权"
  println "  allowance  - 查询授权额度"
  println "  userinfo   - 获取用户基本信息"
  println "  user       - 获取用户基本信息 (userinfo的简写)"
  println "  accountinfo - 获取用户账户信息 (包含余额和组织MSP)"
  println "  account    - 获取用户账户信息 (accountinfo的简写)"
  println "  clientaccount - 获取当前客户端账户信息"
  println "  help       - 显示此帮助信息"
  println
  println "通用选项:"
  println "  -org <组织名>   - 指定执行操作的组织"
  println "  -user <用户名>  - 指定执行操作的用户"
  println
  println "示例:"
  println "  $0 ccc init -name \"Digital Yuan\" -symbol \"DCEP\" -decimals \"2\""
  println "  $0 ccc mint -amount 10000 -org PBOC -user admin"
  println "  $0 ccc transfer -to <地址> -amount 100"
  println "  $0 ccc balance -account <地址>"
  println "  $0 ccc supply"
  println "  $0 ccc userinfo -org CentralBank -user admin"
  println "  $0 ccc accountinfo -userid <用户ID>"
  println "  $0 ccc accountinfo"
  println "  $0 ccc clientaccount -org PBOC -user admin"
  println
  println "注意:"
  println "  - 如果不提供选项，系统将进入交互模式"
  println "  - mint 和 burn 操作仅限央行 (PBOCMSP) 执行"
  println "  - 其他操作可由任何组织执行"
} 