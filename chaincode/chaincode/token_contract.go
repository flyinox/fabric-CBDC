/*
央行数字货币智能合约 (CBDC Smart Contract)

-  ERC-20 标准接口: 已完整实现标准代币功能
-  EOA (外部拥有账户) 管理接口: 尚未实现
-  隐私功能

SPDX-License-Identifier: Apache-2.0
*/

package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// 定义选项的键名
const nameKey = "name"
const symbolKey = "symbol"
const decimalsKey = "decimals"
const totalSupplyKey = "totalSupply"

// 定义前缀的对象类型名称
const allowancePrefix = "allowance"

// 定义选项的键名

// SmartContract 提供在账户间转移代币的功能
type SmartContract struct {
	contractapi.Contract
}

// event 提供一个用于发出事件的有组织结构
type event struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Value int    `json:"value"`
}

// Mint 创建新代币并将其添加到铸币者的账户余额中
// 此函数触发 Transfer 事件
func (s *SmartContract) Mint(ctx contractapi.TransactionContextInterface, amount int) error {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return errors.New("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 检查铸币者授权 - 仅有CentralBankMSP可以铸造新代币
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSPID: %v", err)
	}
	if clientMSPID != "CentralBankMSP" {
		return errors.New("client is not authorized to mint new tokens")
	}

	// 获取提交客户端身份的ID
	minter, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client id: %v", err)
	}

	if amount <= 0 {
		return errors.New("mint amount must be a positive integer")
	}

	currentBalanceBytes, err := ctx.GetStub().GetState(minter)
	if err != nil {
		return fmt.Errorf("failed to read minter account %s from world state: %v", minter, err)
	}

	var currentBalance int

	// 如果铸币者当前余额尚不存在，我们将创建一个当前余额为0的账户
	if currentBalanceBytes == nil {
		currentBalance = 0
	} else {
		currentBalance, _ = strconv.Atoi(string(currentBalanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数
	}

	updatedBalance, err := add(currentBalance, amount)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(minter, []byte(strconv.Itoa(updatedBalance)))
	if err != nil {
		return err
	}

	// 更新总供应量
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve total token supply: %v", err)
	}

	var totalSupply int

	// 如果没有代币被铸造，初始化总供应量
	if totalSupplyBytes == nil {
		totalSupply = 0
	} else {
		totalSupply, _ = strconv.Atoi(string(totalSupplyBytes)) // 不需要错误处理，因为设置总供应量时使用了Itoa()，保证了它是整数
	}

	// 将铸造数量添加到总供应量并更新状态
	totalSupply, err = add(totalSupply, amount)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(totalSupplyKey, []byte(strconv.Itoa(totalSupply)))
	if err != nil {
		return err
	}

	// 发出 Transfer 事件
	transferEvent := event{"0x0", minter, amount}
	transferEventJSON, err := json.Marshal(transferEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Transfer", transferEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	log.Printf("minter account %s balance updated from %d to %d", minter, currentBalance, updatedBalance)

	return nil
}

// Burn 销毁铸币者账户余额中的代币
// 此函数触发 Transfer 事件
func (s *SmartContract) Burn(ctx contractapi.TransactionContextInterface, amount int) error {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return errors.New("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}
	// 检查铸币者授权 - 仅有CentralBankMSP可以销毁代币
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSPID: %v", err)
	}
	if clientMSPID != "CentralBankMSP" {
		return errors.New("client is not authorized to burn tokens")
	}

	// 获取提交客户端身份的ID
	minter, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client id: %v", err)
	}

	if amount <= 0 {
		return errors.New("burn amount must be a positive integer")
	}

	currentBalanceBytes, err := ctx.GetStub().GetState(minter)
	if err != nil {
		return fmt.Errorf("failed to read minter account %s from world state: %v", minter, err)
	}

	var currentBalance int

	// 检查铸币者当前余额是否存在
	if currentBalanceBytes == nil {
		return errors.New("The balance does not exist")
	}

	currentBalance, _ = strconv.Atoi(string(currentBalanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数

	updatedBalance, err := sub(currentBalance, amount)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(minter, []byte(strconv.Itoa(updatedBalance)))
	if err != nil {
		return err
	}

	// 更新总供应量
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve total token supply: %v", err)
	}

	// 如果没有代币被铸造，抛出错误
	if totalSupplyBytes == nil {
		return errors.New("totalSupply does not exist")
	}

	totalSupply, _ := strconv.Atoi(string(totalSupplyBytes)) // 不需要错误处理，因为设置总供应量时使用了Itoa()，保证了它是整数

	// 从总供应量中减去销毁数量并更新状态
	totalSupply, err = sub(totalSupply, amount)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(totalSupplyKey, []byte(strconv.Itoa(totalSupply)))
	if err != nil {
		return err
	}

	// 发出 Transfer 事件
	transferEvent := event{minter, "0x0", amount}
	transferEventJSON, err := json.Marshal(transferEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Transfer", transferEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	log.Printf("minter account %s balance updated from %d to %d", minter, currentBalance, updatedBalance)

	return nil
}

// Transfer 将代币从客户端账户转移到接收者账户
// 接收者账户必须是 ClientID() 函数返回的有效 clientID
// 此函数触发 Transfer 事件
func (s *SmartContract) Transfer(ctx contractapi.TransactionContextInterface, recipient string, amount int) error {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client id: %v", err)
	}

	err = transferHelper(ctx, clientID, recipient, amount)
	if err != nil {
		return fmt.Errorf("failed to transfer: %v", err)
	}

	// 发出 Transfer 事件
	transferEvent := event{clientID, recipient, amount}
	transferEventJSON, err := json.Marshal(transferEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Transfer", transferEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// BalanceOf 返回给定账户的余额
func (s *SmartContract) BalanceOf(ctx contractapi.TransactionContextInterface, account string) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	balanceBytes, err := ctx.GetStub().GetState(account)
	if err != nil {
		return 0, fmt.Errorf("failed to read from world state: %v", err)
	}
	if balanceBytes == nil {
		return 0, fmt.Errorf("the account %s does not exist", account)
	}

	balance, _ := strconv.Atoi(string(balanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数

	return balance, nil
}

// ClientAccountBalance 返回请求客户端账户的余额
func (s *SmartContract) ClientAccountBalance(ctx contractapi.TransactionContextInterface) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return 0, fmt.Errorf("failed to get client id: %v", err)
	}

	balanceBytes, err := ctx.GetStub().GetState(clientID)
	if err != nil {
		return 0, fmt.Errorf("failed to read from world state: %v", err)
	}
	if balanceBytes == nil {
		return 0, fmt.Errorf("the account %s does not exist", clientID)
	}

	balance, _ := strconv.Atoi(string(balanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数

	return balance, nil
}

// ClientAccountID 返回提交客户端的账户ID
// 在此实现中，客户端账户 ID 等同于客户端身份证书的 ID
// 用户通常会将其存储在钱包中，并在调用函数时作为参数提供
func (s *SmartContract) ClientAccountID(ctx contractapi.TransactionContextInterface) (string, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	clientAccountID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get client id: %v", err)
	}

	return clientAccountID, nil
}

// GetUserInfo 返回调用客户端的基本身份信息
// 包含客户端ID、MSPID等信息，用于获取用户基本信息
func (s *SmartContract) GetUserInfo(ctx contractapi.TransactionContextInterface) (string, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取客户端身份信息
	clientIdentity := ctx.GetClientIdentity()

	// 获取客户端ID
	clientID, err := clientIdentity.GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get client id: %v", err)
	}

	// 获取客户端MSPID
	mspID, err := clientIdentity.GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get client MSPID: %v", err)
	}

	// 解析 clientID 获取明文信息
	var userName, orgName, orgUnit, decodedClientID string
	
	// 尝试解码 base64 编码的 clientID
	if decodedBytes, err := base64.StdEncoding.DecodeString(clientID); err == nil {
		decodedClientID = string(decodedBytes)
		
		// 解析 X.509 格式：x509::CN=User1@domain.com,OU=client,...::...
		if strings.HasPrefix(decodedClientID, "x509::") {
			parts := strings.Split(decodedClientID, "::")
			if len(parts) >= 2 {
				subjectPart := parts[1]
				
				// 解析 CN (Common Name)
				if cnMatch := strings.Split(subjectPart, "CN="); len(cnMatch) > 1 {
					cnPart := strings.Split(cnMatch[1], ",")[0]
					if strings.Contains(cnPart, "@") {
						userName = strings.Split(cnPart, "@")[0]
						orgName = strings.Split(cnPart, "@")[1]
					} else {
						userName = cnPart
					}
				}
				
				// 解析 OU (Organizational Unit)
				if ouMatch := strings.Split(subjectPart, "OU="); len(ouMatch) > 1 {
					orgUnit = strings.Split(ouMatch[1], ",")[0]
				}
			}
		}
	} else {
		decodedClientID = "Failed to decode: " + err.Error()
	}
	
	// 构建用户信息结构
	userInfo := struct {
		ClientID         string `json:"clientId"`
		DecodedClientID  string `json:"decodedClientId"`
		UserName         string `json:"userName"`
		OrgName          string `json:"orgName"`
		OrgUnit          string `json:"orgUnit"`
		MSPID            string `json:"mspId"`
		TxID             string `json:"txId"`
		ChannelID        string `json:"channelId"`
	}{
		ClientID:         clientID,
		DecodedClientID:  decodedClientID,
		UserName:         userName,
		OrgName:          orgName,
		OrgUnit:          orgUnit,
		MSPID:            mspID,
		TxID:             ctx.GetStub().GetTxID(),
		ChannelID:        ctx.GetStub().GetChannelID(),
	}

	// 将用户信息转换为JSON格式
	userInfoJSON, err := json.Marshal(userInfo)
	if err != nil {
		return "", fmt.Errorf("failed to marshal user info: %v", err)
	}

	log.Printf("User info: %s", string(userInfoJSON))

	return string(userInfoJSON), nil
}

// TotalSupply 返回代币的总供应量
func (s *SmartContract) TotalSupply(ctx contractapi.TransactionContextInterface) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 从状态中检索总供应量
	totalSupplyBytes, err := ctx.GetStub().GetState(totalSupplyKey)
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve total token supply: %v", err)
	}

	var totalSupply int

	// 如果没有代币被铸造，总供应量为0
	if totalSupplyBytes == nil {
		totalSupply = 0
	} else {
		totalSupply, _ = strconv.Atoi(string(totalSupplyBytes)) // 不需要错误处理，因为设置总供应量时使用了Itoa()，保证了它是整数
	}

	log.Printf("TotalSupply: %d tokens", totalSupply)

	return totalSupply, nil
}

// Approve 允许 spender 从调用客户端账户中提取代币，最多到 value 金额
// 此函数触发 Approval 事件
func (s *SmartContract) Approve(ctx contractapi.TransactionContextInterface, spender string, value int) error {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	owner, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client id: %v", err)
	}

	// 创建 allowanceKey
	allowanceKey, err := ctx.GetStub().CreateCompositeKey(allowancePrefix, []string{owner, spender})
	if err != nil {
		return fmt.Errorf("failed to create the composite key for prefix %s: %v", allowancePrefix, err)
	}

	// 将 approval 金额更新到状态
	err = ctx.GetStub().PutState(allowanceKey, []byte(strconv.Itoa(value)))
	if err != nil {
		return fmt.Errorf("failed to update state of smart contract for key %s: %v", allowanceKey, err)
	}

	// 发出 Approval 事件
	approvalEvent := struct {
		Owner   string `json:"owner"`
		Spender string `json:"spender"`
		Value   int    `json:"value"`
	}{
		Owner:   owner,
		Spender: spender,
		Value:   value,
	}

	approvalEventJSON, err := json.Marshal(approvalEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Approval", approvalEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	log.Printf("client %s approved a withdrawal of %d tokens for spender %s", owner, value, spender)

	return nil
}

// Allowance 返回 owner 仍允许 spender 提取的代币数量
func (s *SmartContract) Allowance(ctx contractapi.TransactionContextInterface, owner string, spender string) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 创建 allowanceKey
	allowanceKey, err := ctx.GetStub().CreateCompositeKey(allowancePrefix, []string{owner, spender})
	if err != nil {
		return 0, fmt.Errorf("failed to create the composite key for prefix %s: %v", allowancePrefix, err)
	}

	// 从状态中读取 allowance 金额
	allowanceBytes, err := ctx.GetStub().GetState(allowanceKey)
	if err != nil {
		return 0, fmt.Errorf("failed to read allowance for %s from world state: %v", allowanceKey, err)
	}

	var allowance int

	// 如果没有当前的 allowance，将其设置为0
	if allowanceBytes == nil {
		allowance = 0
	} else {
		allowance, _ = strconv.Atoi(string(allowanceBytes)) // 不需要错误处理，因为设置 allowance 时使用了Itoa()，保证了它是整数
	}

	log.Printf("The allowance left for spender %s to withdraw from owner %s: %d", spender, owner, allowance)

	return allowance, nil
}

// TransferFrom 使用 allowance 机制将代币从一个账户转移到另一个账户
// 调用者必须事先获得 from 账户的 allowance
func (s *SmartContract) TransferFrom(ctx contractapi.TransactionContextInterface, from string, to string, value int) error {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	spender, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get client id: %v", err)
	}

	// 检索 allowance key
	allowanceKey, err := ctx.GetStub().CreateCompositeKey(allowancePrefix, []string{from, spender})
	if err != nil {
		return fmt.Errorf("failed to create the composite key for prefix %s: %v", allowancePrefix, err)
	}

	// 从状态中检索 allowance
	currentAllowanceBytes, err := ctx.GetStub().GetState(allowanceKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve the allowance for %s from world state: %v", allowanceKey, err)
	}

	var currentAllowance int
	currentAllowance, _ = strconv.Atoi(string(currentAllowanceBytes)) // 不需要错误处理，因为设置 allowance 时使用了Itoa()，保证了它是整数

	// 检查转账金额是否小于等于 allowance
	if currentAllowance < value {
		return fmt.Errorf("spender does not have enough allowance for transfer")
	}

	// 启动转账
	err = transferHelper(ctx, from, to, value)
	if err != nil {
		return fmt.Errorf("failed to transfer: %v", err)
	}

	// 减少 allowance
	updatedAllowance, err := sub(currentAllowance, value)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(allowanceKey, []byte(strconv.Itoa(updatedAllowance)))
	if err != nil {
		return err
	}

	// 发出 Transfer 事件
	transferEvent := event{from, to, value}
	transferEventJSON, err := json.Marshal(transferEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Transfer", transferEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	log.Printf("spender %s allowance updated from %d to %d", spender, currentAllowance, updatedAllowance)

	return nil
}

// Name 返回代币的名称
func (s *SmartContract) Name(ctx contractapi.TransactionContextInterface) (string, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	bytes, err := ctx.GetStub().GetState(nameKey)
	if err != nil {
		return "", fmt.Errorf("failed to get Name bytes: %s", err)
	}

	return string(bytes), nil
}

// Symbol 返回代币的符号
func (s *SmartContract) Symbol(ctx contractapi.TransactionContextInterface) (string, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("Contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	bytes, err := ctx.GetStub().GetState(symbolKey)
	if err != nil {
		return "", fmt.Errorf("failed to get Symbol: %v", err)
	}

	return string(bytes), nil
}

// Set information for a token and intialize contract.
// ===================================================
// This function has only one input, a JSON string with four properties: name, symbol, decimals, and totalSupply
func (s *SmartContract) Initialize(ctx contractapi.TransactionContextInterface, name string, symbol string, decimals string) (bool, error) {

	// 检查合约是否已经初始化 - 在第一次使用时调用Initialize()
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if initialized {
		return false, fmt.Errorf("contract is already initialized")
	}

	// 在初始化函数中设置合约选项
	err = ctx.GetStub().PutState(nameKey, []byte(name))
	if err != nil {
		return false, fmt.Errorf("failed to set token name: %v", err)
	}

	err = ctx.GetStub().PutState(symbolKey, []byte(symbol))
	if err != nil {
		return false, fmt.Errorf("failed to set token symbol: %v", err)
	}

	err = ctx.GetStub().PutState(decimalsKey, []byte(decimals))
	if err != nil {
		return false, fmt.Errorf("failed to set token decimals: %v", err)
	}

	return true, nil
}

// transferHelper 是一个辅助函数，用于代币转移
// transfer amount from one account to another account
func transferHelper(ctx contractapi.TransactionContextInterface, from string, to string, value int) error {

	if value < 0 { // transfer of 0 is allowed in ERC-20, so just validate against negative amounts
		return fmt.Errorf("transfer amount cannot be negative")
	}

	fromCurrentBalanceBytes, err := ctx.GetStub().GetState(from)
	if err != nil {
		return fmt.Errorf("failed to read client account %s from world state: %v", from, err)
	}

	if fromCurrentBalanceBytes == nil {
		return fmt.Errorf("client account %s has no balance", from)
	}

	fromCurrentBalance, _ := strconv.Atoi(string(fromCurrentBalanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数

	if fromCurrentBalance < value {
		return fmt.Errorf("client account %s has insufficient funds", from)
	}

	toCurrentBalanceBytes, err := ctx.GetStub().GetState(to)
	if err != nil {
		return fmt.Errorf("failed to read recipient account %s from world state: %v", to, err)
	}

	var toCurrentBalance int
	// 如果账户尚不存在，我们将创建一个当前余额为0的账户
	if toCurrentBalanceBytes == nil {
		toCurrentBalance = 0
	} else {
		toCurrentBalance, _ = strconv.Atoi(string(toCurrentBalanceBytes)) // 不需要错误处理，因为设置账户余额时使用了Itoa()，保证了它是整数
	}

	fromUpdatedBalance, err := sub(fromCurrentBalance, value)
	if err != nil {
		return err
	}

	toUpdatedBalance, err := add(toCurrentBalance, value)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(from, []byte(strconv.Itoa(fromUpdatedBalance)))
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(to, []byte(strconv.Itoa(toUpdatedBalance)))
	if err != nil {
		return err
	}

	log.Printf("client %s balance updated from %d to %d", from, fromCurrentBalance, fromUpdatedBalance)
	log.Printf("recipient %s balance updated from %d to %d", to, toCurrentBalance, toUpdatedBalance)

	return nil
}

// add 两个数字检查溢出
func add(b int, q int) (int, error) {

	// Check overflow
	var sum int
	sum = q + b

	if (sum < q || sum < b) == (b >= 0 && q >= 0) {
		return 0, fmt.Errorf("Math: addition overflow occurred %d + %d", b, q)
	}

	return sum, nil
}

// checkInitialized 返回布尔值以反映合约是否已初始化
func checkInitialized(ctx contractapi.TransactionContextInterface) (bool, error) {
	tokenName, err := ctx.GetStub().GetState(nameKey)
	if err != nil {
		return false, fmt.Errorf("failed to get token name: %v", err)
	} else if tokenName == nil {
		return false, nil
	}

	return true, nil
}

// Checks that contract options have been already initialized
func sub(b int, q int) (int, error) {

	// Check overflow
	var diff int
	diff = b - q

	if (diff > b) == (b >= 0 && q >= 0) {
		return 0, fmt.Errorf("Math: Subtraction overflow occurred %d - %d", b, q)
	}

	return diff, nil
} 