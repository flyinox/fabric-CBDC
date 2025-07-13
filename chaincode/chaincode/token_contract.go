/*
央行数字货币智能合约 (CBDC Smart Contract)

-  ERC-20 标准接口: 已完整实现标准代币功能，具备隐私保护
-  隐私功能: 所有数据都存储在央行私有集合中
-  央行监管: 央行可以查看所有数据，其他用户只能查看相关数据

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
const balancePrefix = "balance_"

// 隐私功能相关常量
const centralBankCollection = "central_bank_full_data"
const transactionPrefix = "tx_"

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

// PrivateTransactionData 完整的私有交易数据结构
type PrivateTransactionData struct {
	TxID            string `json:"txId"`
	From            string `json:"from"`
	To              string `json:"to"`
	FromMSP         string `json:"fromMsp"`
	ToMSP           string `json:"toMsp"`
	Amount          int    `json:"amount"`
	TransactionType string `json:"transactionType"` // 新增：交易类型 (transfer, approve, transferFrom, mint, burn)
	Spender         string `json:"spender"`         // 新增：授权转账中的spender
	BlockNumber     uint64 `json:"blockNumber"`
	TxIndex         uint32 `json:"txIndex"`
}

// UserBalance 用户余额记录
type UserBalance struct {
	UserID  string `json:"userId"`
	Balance int    `json:"balance"`
	OrgMSP  string `json:"orgMsp"` // 新增：用户所属的组织MSP
}

// AllowanceRecord 授权记录
type AllowanceRecord struct {
	Owner   string `json:"owner"`
	Spender string `json:"spender"`
	Value   int    `json:"value"`
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
		return errors.New("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 检查铸币者授权 - 仅有CentralBankMSP可以铸造新代币
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSPID: %v", err)
	}
	if clientMSPID != CENTRAL_MSP_ID {
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

	// 从私有集合获取当前余额
	currentBalance, err := s.getBalanceFromPrivateCollection(ctx, minter)
	if err != nil {
		return fmt.Errorf("failed to read minter account %s from private collection: %v", minter, err)
	}

	updatedBalance, err := add(currentBalance, amount)
	if err != nil {
		return err
	}

	// 更新私有集合中的余额
	err = s.updateBalanceInPrivateCollection(ctx, minter, updatedBalance)
	if err != nil {
		return fmt.Errorf("failed to update balance in private collection: %v", err)
	}

	// 更新总供应量
	totalSupply, err := s.getTotalSupplyFromPrivateCollection(ctx)
	if err != nil {
		return fmt.Errorf("failed to retrieve total token supply: %v", err)
	}

	// 将铸造数量添加到总供应量并更新状态
	totalSupply, err = add(totalSupply, amount)
	if err != nil {
		return err
	}

	err = s.updateTotalSupplyInPrivateCollection(ctx, totalSupply)
	if err != nil {
		return fmt.Errorf("failed to update total supply in private collection: %v", err)
	}

	// 创建完整的私有交易数据
	txID := ctx.GetStub().GetTxID()
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	privateData := PrivateTransactionData{
		TxID:            txID,
		From:            "0x0", // 铸币从零地址
		To:              minter,
		FromMSP:         "", // 简化实现
		ToMSP:           "", // 简化实现
		Amount:          amount,
		TransactionType: "mint",
		Spender:         "",
		BlockNumber:     0, // 简化实现
		TxIndex:         0, // 简化实现
	}

	// 创建用于查询的扩展交易数据
	queryData := map[string]interface{}{
		"docType":         "transaction",
		"txId":            txID,
		"from":            "0x0",
		"to":              minter,
		"fromMsp":         "",
		"amount":          amount,
		"transactionType": "mint",
		"spender":         "",
		"timestamp":       timestamp.Seconds,
		"blockNumber":     0, // 简化实现
		"txIndex":         0, // 简化实现
	}

	// 序列化私有数据
	privateDataBytes, err := json.Marshal(privateData)
	if err != nil {
		return fmt.Errorf("failed to marshal private data: %v", err)
	}

	// 序列化查询数据
	queryDataBytes, err := json.Marshal(queryData)
	if err != nil {
		return fmt.Errorf("failed to marshal query data: %v", err)
	}

	// 央行存储完整数据
	privateDataKey := transactionPrefix + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, privateDataKey, privateDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store private data: %v", err)
	}

	// 存储用于查询的数据
	queryDataKey := "query_" + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, queryDataKey, queryDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store query data: %v", err)
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
		return errors.New("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}
	// 检查铸币者授权 - 仅有CentralBankMSP可以销毁代币
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSPID: %v", err)
	}
	if clientMSPID != CENTRAL_MSP_ID {
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

	// 从私有集合获取当前余额
	currentBalance, err := s.getBalanceFromPrivateCollection(ctx, minter)
	if err != nil {
		return fmt.Errorf("failed to read minter account %s from private collection: %v", minter, err)
	}

	if currentBalance < amount {
		return fmt.Errorf("insufficient balance to burn %d tokens", amount)
	}

	updatedBalance, err := sub(currentBalance, amount)
	if err != nil {
		return err
	}

	// 更新私有集合中的余额
	err = s.updateBalanceInPrivateCollection(ctx, minter, updatedBalance)
	if err != nil {
		return fmt.Errorf("failed to update balance in private collection: %v", err)
	}

	// 更新总供应量
	totalSupply, err := s.getTotalSupplyFromPrivateCollection(ctx)
	if err != nil {
		return fmt.Errorf("failed to retrieve total token supply: %v", err)
	}

	// 从总供应量中减去销毁数量并更新状态
	totalSupply, err = sub(totalSupply, amount)
	if err != nil {
		return err
	}

	err = s.updateTotalSupplyInPrivateCollection(ctx, totalSupply)
	if err != nil {
		return fmt.Errorf("failed to update total supply in private collection: %v", err)
	}

	// 创建完整的私有交易数据
	txID := ctx.GetStub().GetTxID()
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	privateData := PrivateTransactionData{
		TxID:            txID,
		From:            minter,
		To:              "0x0", // 销毁到零地址
		FromMSP:         "",    // 简化实现
		ToMSP:           "",    // 简化实现
		Amount:          amount,
		TransactionType: "burn",
		Spender:         "",
		BlockNumber:     0, // 简化实现
		TxIndex:         0, // 简化实现
	}

	// 创建用于查询的扩展交易数据
	queryData := map[string]interface{}{
		"docType":         "transaction",
		"txId":            txID,
		"from":            minter,
		"to":              "0x0",
		"fromMsp":         "",
		"amount":          amount,
		"transactionType": "burn",
		"spender":         "",
		"timestamp":       timestamp.Seconds,
		"blockNumber":     0, // 简化实现
		"txIndex":         0, // 简化实现
	}

	// 序列化私有数据
	privateDataBytes, err := json.Marshal(privateData)
	if err != nil {
		return fmt.Errorf("failed to marshal private data: %v", err)
	}

	// 序列化查询数据
	queryDataBytes, err := json.Marshal(queryData)
	if err != nil {
		return fmt.Errorf("failed to marshal query data: %v", err)
	}

	// 央行存储完整数据
	privateDataKey := transactionPrefix + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, privateDataKey, privateDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store private data: %v", err)
	}

	// 存储用于查询的数据
	queryDataKey := "query_" + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, queryDataKey, queryDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store query data: %v", err)
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

// Transfer 将代币从客户端账户转移到接收者账户（隐私版本）
// 此函数触发 Transfer 事件，但所有数据都通过隐私机制处理
func (s *SmartContract) Transfer(ctx contractapi.TransactionContextInterface, recipient string, amount int) error {
	// 🔍 添加链码地址跟踪日志
	log.Printf("🔍 CHAINCODE TRANSFER 地址跟踪开始:")
	log.Printf("  📥 链码接收到的 recipient: %s", recipient)
	log.Printf("  📥 recipient 类型: %T", recipient)
	log.Printf("  📥 recipient 长度: %d", len(recipient))
	log.Printf("  📥 recipient 是否为空: %t", recipient == "")
	log.Printf("  📥 recipient 是否只包含空格: %t", strings.TrimSpace(recipient) == "")
	log.Printf("  📥 recipient 前10个字符: %s", func() string {
		if len(recipient) > 10 {
			return recipient[:10]
		}
		return recipient
	}())
	log.Printf("  📥 recipient 后10个字符: %s", func() string {
		if len(recipient) > 10 {
			return recipient[len(recipient)-10:]
		}
		return recipient
	}())

	// 检查合约初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取发送方信息
	sender, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get sender ID: %v", err)
	}

	senderMSP, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get sender MSP: %v", err)
	}

	// 验证转账金额
	if amount <= 0 {
		return fmt.Errorf("transfer amount must be positive")
	}

	log.Printf("🔍 准备执行转账:")
	log.Printf("  📤 发送方: %s", sender)
	log.Printf("  📤 接收方: %s", recipient)
	log.Printf("  📤 金额: %d", amount)

	// 执行隐私余额转账
	err = s.transferHelperPrivate(ctx, sender, recipient, amount)
	if err != nil {
		return fmt.Errorf("failed to execute transfer: %v", err)
	}

	// 创建完整的私有交易数据
	txID := ctx.GetStub().GetTxID()
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	privateData := PrivateTransactionData{
		TxID:            txID,
		From:            sender,
		To:              recipient,
		FromMSP:         senderMSP,
		Amount:          amount,
		TransactionType: "transfer",
		Spender:         "",
		BlockNumber:     0, // 简化实现
		TxIndex:         0, // 简化实现
	}

	// 创建用于查询的扩展交易数据
	queryData := map[string]interface{}{
		"docType":         "transaction",
		"txId":            txID,
		"from":            sender,
		"to":              recipient,
		"fromMsp":         senderMSP,
		"amount":          amount,
		"transactionType": "transfer",
		"timestamp":       timestamp.Seconds,
		"blockNumber":     0, // 简化实现
		"txIndex":         0, // 简化实现
	}

	// 序列化私有数据
	privateDataBytes, err := json.Marshal(privateData)
	if err != nil {
		return fmt.Errorf("failed to marshal private data: %v", err)
	}

	// 序列化查询数据
	queryDataBytes, err := json.Marshal(queryData)
	if err != nil {
		return fmt.Errorf("failed to marshal query data: %v", err)
	}

	// 央行存储完整数据
	privateDataKey := transactionPrefix + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, privateDataKey, privateDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store private data: %v", err)
	}

	// 存储用于查询的数据
	queryDataKey := "query_" + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, queryDataKey, queryDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store query data: %v", err)
	}

	// 发出Transfer事件（保持ERC20兼容性）
	transferEvent := event{sender, recipient, amount}
	transferEventJSON, err := json.Marshal(transferEvent)
	if err != nil {
		return fmt.Errorf("failed to obtain JSON encoding: %v", err)
	}
	err = ctx.GetStub().SetEvent("Transfer", transferEventJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	log.Printf("Private transfer completed: %s -> %s, amount: %d, txID: %s", sender, recipient, amount, txID)
	return nil
}

// BalanceOf 返回给定账户的余额（带权限控制）
func (s *SmartContract) BalanceOf(ctx contractapi.TransactionContextInterface, account string) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取当前调用者的信息
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return 0, fmt.Errorf("failed to get caller id: %v", err)
	}

	// 检查权限
	hasPermission, err := s.checkBalancePermission(ctx, callerID, account)
	if err != nil {
		return 0, fmt.Errorf("failed to check permission: %v", err)
	}
	if !hasPermission {
		return 0, fmt.Errorf("caller does not have permission to view balance of account %s", account)
	}

	// 从私有集合获取余额
	balance, err := s.getBalanceFromPrivateCollection(ctx, account)
	if err != nil {
		return 0, fmt.Errorf("failed to read client account %s from private collection: %v", account, err)
	}

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
		return 0, fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取提交客户端身份的ID
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return 0, fmt.Errorf("failed to get client id: %v", err)
	}

	// 从私有集合获取余额
	balance, err := s.getBalanceFromPrivateCollection(ctx, clientID)
	if err != nil {
		return 0, fmt.Errorf("failed to read from private collection: %v", err)
	}

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
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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
		ClientID        string `json:"clientId"`
		DecodedClientID string `json:"decodedClientId"`
		UserName        string `json:"userName"`
		OrgName         string `json:"orgName"`
		OrgUnit         string `json:"orgUnit"`
		MSPID           string `json:"mspId"`
		TxID            string `json:"txId"`
		ChannelID       string `json:"channelId"`
	}{
		ClientID:        clientID,
		DecodedClientID: decodedClientID,
		UserName:        userName,
		OrgName:         orgName,
		OrgUnit:         orgUnit,
		MSPID:           mspID,
		TxID:            ctx.GetStub().GetTxID(),
		ChannelID:       ctx.GetStub().GetChannelID(),
	}

	// 将用户信息转换为JSON格式
	userInfoJSON, err := json.Marshal(userInfo)
	if err != nil {
		return "", fmt.Errorf("failed to marshal user info: %v", err)
	}

	log.Printf("User info: %s", string(userInfoJSON))

	return string(userInfoJSON), nil
}

// GetUserAccountInfo 返回指定用户的完整账户信息
func (s *SmartContract) GetUserAccountInfo(ctx contractapi.TransactionContextInterface, userID string) (string, error) {
	// 获取当前调用者的信息
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller id: %v", err)
	}

	// 检查权限
	hasPermission, err := s.checkAccountInfoPermission(ctx, callerID, userID)
	if err != nil {
		return "", fmt.Errorf("failed to check permission: %v", err)
	}
	if !hasPermission {
		return "", fmt.Errorf("caller does not have permission to view account info of user %s", userID)
	}

	return s.getAccountInfoAsJSON(ctx, userID, "user")
}

// GetClientAccountInfo 返回当前调用客户端的完整账户信息
func (s *SmartContract) GetClientAccountInfo(ctx contractapi.TransactionContextInterface) (string, error) {
	// 获取提交客户端身份的ID
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get client id: %v", err)
	}

	return s.getAccountInfoAsJSON(ctx, clientID, "client")
}

// TotalSupply 返回代币的总供应量
func (s *SmartContract) TotalSupply(ctx contractapi.TransactionContextInterface) (int, error) {

	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return 0, fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 从私有集合获取总供应量
	totalSupply, err := s.getTotalSupplyFromPrivateCollection(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve total token supply: %v", err)
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
		return fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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

	// 创建授权记录
	allowanceRecord := AllowanceRecord{
		Owner:   owner,
		Spender: spender,
		Value:   value,
	}

	// 序列化授权记录
	allowanceRecordBytes, err := json.Marshal(allowanceRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal allowance record: %v", err)
	}

	// 将 approval 金额更新到私有集合
	err = ctx.GetStub().PutPrivateData(centralBankCollection, allowanceKey, allowanceRecordBytes)
	if err != nil {
		return fmt.Errorf("failed to update state of smart contract for key %s: %v", allowanceKey, err)
	}

	// 创建完整的私有交易数据
	txID := ctx.GetStub().GetTxID()
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	privateData := PrivateTransactionData{
		TxID:            txID,
		From:            owner,
		To:              spender,
		FromMSP:         "", // 简化实现
		ToMSP:           "", // 简化实现
		Amount:          value,
		TransactionType: "approve",
		Spender:         spender,
		BlockNumber:     0, // 简化实现
		TxIndex:         0, // 简化实现
	}

	// 创建用于查询的扩展交易数据
	queryData := map[string]interface{}{
		"docType":         "transaction",
		"txId":            txID,
		"from":            owner,
		"to":              spender,
		"fromMsp":         "",
		"amount":          value,
		"transactionType": "approve",
		"spender":         spender,
		"timestamp":       timestamp.Seconds,
		"blockNumber":     0, // 简化实现
		"txIndex":         0, // 简化实现
	}

	// 序列化私有数据
	privateDataBytes, err := json.Marshal(privateData)
	if err != nil {
		return fmt.Errorf("failed to marshal private data: %v", err)
	}

	// 序列化查询数据
	queryDataBytes, err := json.Marshal(queryData)
	if err != nil {
		return fmt.Errorf("failed to marshal query data: %v", err)
	}

	// 央行存储完整数据
	privateDataKey := transactionPrefix + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, privateDataKey, privateDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store private data: %v", err)
	}

	// 存储用于查询的数据
	queryDataKey := "query_" + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, queryDataKey, queryDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store query data: %v", err)
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
		return 0, fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 创建 allowanceKey
	allowanceKey, err := ctx.GetStub().CreateCompositeKey(allowancePrefix, []string{owner, spender})
	if err != nil {
		return 0, fmt.Errorf("failed to create the composite key for prefix %s: %v", allowancePrefix, err)
	}

	// 从私有集合中读取 allowance 金额
	allowanceBytes, err := ctx.GetStub().GetPrivateData(centralBankCollection, allowanceKey)
	if err != nil {
		return 0, fmt.Errorf("failed to read allowance for %s from private collection: %v", allowanceKey, err)
	}

	var allowance int

	// 如果没有当前的 allowance，将其设置为0
	if allowanceBytes == nil {
		allowance = 0
	} else {
		// 尝试解析为新的格式
		var allowanceRecord AllowanceRecord
		if err := json.Unmarshal(allowanceBytes, &allowanceRecord); err == nil {
			allowance = allowanceRecord.Value
		} else {
			// 兼容旧格式
			allowance, _ = strconv.Atoi(string(allowanceBytes))
		}
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
		return fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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

	// 从私有集合中检索 allowance
	currentAllowanceBytes, err := ctx.GetStub().GetPrivateData(centralBankCollection, allowanceKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve the allowance for %s from private collection: %v", allowanceKey, err)
	}

	var currentAllowance int
	if currentAllowanceBytes == nil {
		currentAllowance = 0
	} else {
		// 尝试解析为新的格式
		var allowanceRecord AllowanceRecord
		if err := json.Unmarshal(currentAllowanceBytes, &allowanceRecord); err == nil {
			currentAllowance = allowanceRecord.Value
		} else {
			// 兼容旧格式
			currentAllowance, _ = strconv.Atoi(string(currentAllowanceBytes))
		}
	}

	// 检查转账金额是否小于等于 allowance
	if currentAllowance < value {
		return fmt.Errorf("spender does not have enough allowance for transfer")
	}

	// 启动隐私转账
	err = s.transferHelperPrivate(ctx, from, to, value)
	if err != nil {
		return fmt.Errorf("failed to transfer: %v", err)
	}

	// 减少 allowance
	updatedAllowance, err := sub(currentAllowance, value)
	if err != nil {
		return err
	}

	// 更新授权记录
	allowanceRecord := AllowanceRecord{
		Owner:   from,
		Spender: spender,
		Value:   updatedAllowance,
	}

	allowanceRecordBytes, err := json.Marshal(allowanceRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal allowance record: %v", err)
	}

	err = ctx.GetStub().PutPrivateData(centralBankCollection, allowanceKey, allowanceRecordBytes)
	if err != nil {
		return err
	}

	// 创建完整的私有交易数据
	txID := ctx.GetStub().GetTxID()
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to get transaction timestamp: %v", err)
	}

	privateData := PrivateTransactionData{
		TxID:            txID,
		From:            from,
		To:              to,
		FromMSP:         "", // 简化实现
		ToMSP:           "", // 简化实现
		Amount:          value,
		TransactionType: "transferFrom",
		Spender:         spender,
		BlockNumber:     0, // 简化实现
		TxIndex:         0, // 简化实现
	}

	// 创建用于查询的扩展交易数据
	queryData := map[string]interface{}{
		"docType":         "transaction",
		"txId":            txID,
		"from":            from,
		"to":              to,
		"fromMsp":         "",
		"amount":          value,
		"transactionType": "transferFrom",
		"spender":         spender,
		"timestamp":       timestamp.Seconds,
		"blockNumber":     0, // 简化实现
		"txIndex":         0, // 简化实现
	}

	// 序列化私有数据
	privateDataBytes, err := json.Marshal(privateData)
	if err != nil {
		return fmt.Errorf("failed to marshal private data: %v", err)
	}

	// 序列化查询数据
	queryDataBytes, err := json.Marshal(queryData)
	if err != nil {
		return fmt.Errorf("failed to marshal query data: %v", err)
	}

	// 央行存储完整数据
	privateDataKey := transactionPrefix + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, privateDataKey, privateDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store private data: %v", err)
	}

	// 存储用于查询的数据
	queryDataKey := "query_" + txID
	err = ctx.GetStub().PutPrivateData(centralBankCollection, queryDataKey, queryDataBytes)
	if err != nil {
		return fmt.Errorf("failed to store query data: %v", err)
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
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
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

// add 两个数字检查溢出
func add(b int, q int) (int, error) {

	// Check overflow
	sum := q + b

	if (sum < q || sum < b) == (b >= 0 && q >= 0) {
		return 0, fmt.Errorf("math: addition overflow occurred %d + %d", b, q)
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
	diff := b - q

	if (diff > b) == (b >= 0 && q >= 0) {
		return 0, fmt.Errorf("math: Subtraction overflow occurred %d - %d", b, q)
	}

	return diff, nil
}

// ========== 内部辅助方法 ==========

// getAccountInfoAsJSON 通用的账户信息获取和JSON序列化函数
func (s *SmartContract) getAccountInfoAsJSON(ctx contractapi.TransactionContextInterface, userID string, logPrefix string) (string, error) {
	// 首先检查合约是否已初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取用户账户信息
	userBalance, err := s.getUserAccountInfo(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get %s account info: %v", logPrefix, err)
	}

	// 将用户账户信息转换为JSON格式
	userAccountJSON, err := json.Marshal(userBalance)
	if err != nil {
		return "", fmt.Errorf("failed to marshal %s account info: %v", logPrefix, err)
	}

	log.Printf("%s account info: %s", logPrefix, string(userAccountJSON))

	return string(userAccountJSON), nil
}

// extractOrgMSPFromClientID 从clientID中提取组织MSP信息
// 这个方法解析X.509证书格式的clientID，提取组织信息
func (s *SmartContract) extractOrgMSPFromClientID(clientID string) (string, error) {
	// 尝试解码 base64 编码的 clientID
	decodedBytes, err := base64.StdEncoding.DecodeString(clientID)
	if err != nil {
		return "", fmt.Errorf("failed to decode clientID: %v", err)
	}

	decodedClientID := string(decodedBytes)

	// 解析 X.509 格式：x509::CN=User1@domain.com,OU=client,O=Org1,ST=State,C=Country::CN=ca.domain.com,O=domain.com,...
	if strings.HasPrefix(decodedClientID, "x509::") {
		parts := strings.Split(decodedClientID, "::")
		if len(parts) >= 2 {
			// 首先尝试从用户证书部分提取组织信息
			subjectPart := parts[1]

			// 解析 O (Organization) - 用户证书部分
			if orgMatch := strings.Split(subjectPart, "O="); len(orgMatch) > 1 {
				orgPart := strings.Split(orgMatch[1], ",")[0]
				return orgPart, nil
			}

			// 如果没有O字段，尝试从CN中提取组织信息
			if cnMatch := strings.Split(subjectPart, "CN="); len(cnMatch) > 1 {
				cnPart := strings.Split(cnMatch[1], ",")[0]
				if strings.Contains(cnPart, "@") {
					parts := strings.Split(cnPart, "@")
					if len(parts) > 1 {
						return parts[1], nil
					}
				}
			}

			// 如果用户证书部分没有找到，尝试从CA证书部分提取
			if len(parts) >= 3 {
				caPart := parts[2]

				// 解析 CA 证书的 O (Organization)
				if orgMatch := strings.Split(caPart, "O="); len(orgMatch) > 1 {
					orgPart := strings.Split(orgMatch[1], ",")[0]
					return orgPart, nil
				}
			}
		}
	}

	return "", fmt.Errorf("unable to extract organization from clientID: %s", clientID)
}

// getUserAccountInfo 获取用户账户信息，包括余额和组织MSP
func (s *SmartContract) getUserAccountInfo(ctx contractapi.TransactionContextInterface, userID string) (*UserBalance, error) {
	balanceKey := balancePrefix + userID
	balanceBytes, err := ctx.GetStub().GetPrivateData(centralBankCollection, balanceKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read balance from private collection: %v", err)
	}

	userBalance := &UserBalance{
		UserID:  userID,
		Balance: 0,
		OrgMSP:  "",
	}

	if balanceBytes != nil {
		// 尝试解析为新的格式
		if err := json.Unmarshal(balanceBytes, userBalance); err == nil {
			// 如果成功解析，检查是否需要更新orgMSP
			if userBalance.OrgMSP == "" {
				// 提取并更新orgMSP
				orgMSP, err := s.extractOrgMSPFromClientID(userID)
				if err == nil {
					userBalance.OrgMSP = orgMSP
					// 更新存储的账户信息
					err = s.updateUserAccountInPrivateCollection(ctx, userBalance)
					if err != nil {
						log.Printf("Warning: failed to update user account with orgMSP: %v", err)
					}
				}
			}
			return userBalance, nil
		}

		// 兼容旧格式 - 只有余额信息
		balance, err := strconv.Atoi(string(balanceBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to parse balance: %v", err)
		}
		userBalance.Balance = balance

		// 为旧格式数据提取orgMSP
		orgMSP, err := s.extractOrgMSPFromClientID(userID)
		if err == nil {
			userBalance.OrgMSP = orgMSP
			// 更新存储的账户信息
			err = s.updateUserAccountInPrivateCollection(ctx, userBalance)
			if err != nil {
				log.Printf("Warning: failed to update user account with orgMSP: %v", err)
			}
		}
	} else {
		// 账户不存在，尝试提取orgMSP用于新账户创建
		orgMSP, err := s.extractOrgMSPFromClientID(userID)
		if err == nil {
			userBalance.OrgMSP = orgMSP
		}
	}

	return userBalance, nil
}

// updateUserAccountInPrivateCollection 更新私有集合中的用户账户信息
func (s *SmartContract) updateUserAccountInPrivateCollection(ctx contractapi.TransactionContextInterface, userBalance *UserBalance) error {
	balanceKey := balancePrefix + userBalance.UserID

	// 序列化用户账户信息
	balanceBytes, err := json.Marshal(userBalance)
	if err != nil {
		return fmt.Errorf("failed to marshal user balance: %v", err)
	}

	// 存储到私有集合
	err = ctx.GetStub().PutPrivateData(centralBankCollection, balanceKey, balanceBytes)
	if err != nil {
		return fmt.Errorf("failed to store balance in private collection: %v", err)
	}

	return nil
}

// ========== 隐私功能辅助函数 ==========

// getBalanceFromPrivateCollection 从私有集合获取用户余额
func (s *SmartContract) getBalanceFromPrivateCollection(ctx contractapi.TransactionContextInterface, userID string) (int, error) {
	userBalance, err := s.getUserAccountInfo(ctx, userID)
	if err != nil {
		return 0, err
	}
	return userBalance.Balance, nil
}

// updateBalanceInPrivateCollection 更新私有集合中的用户余额
func (s *SmartContract) updateBalanceInPrivateCollection(ctx contractapi.TransactionContextInterface, userID string, balance int) error {
	// 获取现有账户信息
	userBalance, err := s.getUserAccountInfo(ctx, userID)
	if err != nil {
		// 如果获取失败，创建新的账户信息
		userBalance = &UserBalance{
			UserID:  userID,
			Balance: 0,
			OrgMSP:  "",
		}
		// 尝试提取orgMSP
		orgMSP, extractErr := s.extractOrgMSPFromClientID(userID)
		if extractErr == nil {
			userBalance.OrgMSP = orgMSP
		}
	}

	// 更新余额
	userBalance.Balance = balance

	// 更新账户信息
	return s.updateUserAccountInPrivateCollection(ctx, userBalance)
}

// getTotalSupplyFromPrivateCollection 从私有集合获取总供应量
func (s *SmartContract) getTotalSupplyFromPrivateCollection(ctx contractapi.TransactionContextInterface) (int, error) {
	totalSupplyBytes, err := ctx.GetStub().GetPrivateData(centralBankCollection, totalSupplyKey)
	if err != nil {
		return 0, fmt.Errorf("failed to read total supply from private collection: %v", err)
	}

	if totalSupplyBytes == nil {
		return 0, nil // 总供应量不存在，返回0
	}

	totalSupply, err := strconv.Atoi(string(totalSupplyBytes))
	if err != nil {
		return 0, fmt.Errorf("failed to parse total supply: %v", err)
	}

	return totalSupply, nil
}

// updateTotalSupplyInPrivateCollection 更新私有集合中的总供应量
func (s *SmartContract) updateTotalSupplyInPrivateCollection(ctx contractapi.TransactionContextInterface, totalSupply int) error {
	totalSupplyBytes := []byte(strconv.Itoa(totalSupply))
	err := ctx.GetStub().PutPrivateData(centralBankCollection, totalSupplyKey, totalSupplyBytes)
	if err != nil {
		return fmt.Errorf("failed to store total supply in private collection: %v", err)
	}

	return nil
}

// transferHelperPrivate 隐私版本的转账辅助函数
func (s *SmartContract) transferHelperPrivate(ctx contractapi.TransactionContextInterface, from string, to string, value int) error {
	if value < 0 {
		return fmt.Errorf("transfer amount cannot be negative")
	}

	// 从私有集合获取发送方余额
	fromCurrentBalance, err := s.getBalanceFromPrivateCollection(ctx, from)
	if err != nil {
		return fmt.Errorf("failed to read sender account %s from private collection: %v", from, err)
	}

	if fromCurrentBalance < value {
		return fmt.Errorf("sender account %s has insufficient funds", from)
	}

	// 从私有集合获取接收方余额
	toCurrentBalance, err := s.getBalanceFromPrivateCollection(ctx, to)
	if err != nil {
		return fmt.Errorf("failed to read recipient account %s from private collection: %v", to, err)
	}

	// 计算新余额
	fromUpdatedBalance, err := sub(fromCurrentBalance, value)
	if err != nil {
		return err
	}

	toUpdatedBalance, err := add(toCurrentBalance, value)
	if err != nil {
		return err
	}

	// 更新私有集合中的余额
	err = s.updateBalanceInPrivateCollection(ctx, from, fromUpdatedBalance)
	if err != nil {
		return err
	}

	err = s.updateBalanceInPrivateCollection(ctx, to, toUpdatedBalance)
	if err != nil {
		return err
	}

	log.Printf("sender %s balance updated from %d to %d", from, fromCurrentBalance, fromUpdatedBalance)
	log.Printf("recipient %s balance updated from %d to %d", to, toCurrentBalance, toUpdatedBalance)

	return nil
}

// ========== 权限控制辅助函数 ==========

// checkAccountInfoPermission 检查调用者是否有权限查看指定用户的账户信息
func (s *SmartContract) checkAccountInfoPermission(ctx contractapi.TransactionContextInterface, callerID, targetUserID string) (bool, error) {
	// 如果调用者查询自己的账户信息，直接允许
	if callerID == targetUserID {
		return true, nil
	}

	// 获取调用者的信息（用于验证调用者账户存在）
	_, err := s.getUserAccountInfo(ctx, callerID)
	if err != nil {
		return false, fmt.Errorf("failed to get caller account info: %v", err)
	}

	// 获取目标用户的信息
	targetInfo, err := s.getUserAccountInfo(ctx, targetUserID)
	if err != nil {
		return false, fmt.Errorf("failed to get target user account info: %v", err)
	}

	// 解析调用者的clientID获取用户类型
	callerDomain, err := s.extractDomainFromClientID(callerID)
	if err != nil {
		return false, fmt.Errorf("failed to extract caller domain: %v", err)
	}

	// 检查是否是央行用户（可以查看所有账户信息）
	if callerDomain == CENTRAL_BANK_DOMAIN {
		return true, nil
	}

	// 检查是否是银行admin用户
	if s.isAdminUserByDomain(callerID) {
		// admin用户可以查看同一银行的所有账户信息
		if callerDomain == targetInfo.OrgMSP {
			return true, nil
		}
	}

	// 其他情况不允许查看
	return false, nil
}

// checkBalancePermission 检查调用者是否有权限查看指定账户的余额
func (s *SmartContract) checkBalancePermission(ctx contractapi.TransactionContextInterface, callerID, targetAccount string) (bool, error) {
	// 如果调用者查询自己的账户，直接允许
	if callerID == targetAccount {
		return true, nil
	}

	// 获取调用者的信息（用于验证调用者账户存在）
	_, err := s.getUserAccountInfo(ctx, callerID)
	if err != nil {
		return false, fmt.Errorf("failed to get caller account info: %v", err)
	}

	// 获取目标账户的信息
	targetInfo, err := s.getUserAccountInfo(ctx, targetAccount)
	if err != nil {
		return false, fmt.Errorf("failed to get target account info: %v", err)
	}

	// 解析调用者的clientID获取用户类型
	callerDomain, err := s.extractDomainFromClientID(callerID)
	if err != nil {
		return false, fmt.Errorf("failed to extract caller domain: %v", err)
	}

	// 检查是否是央行用户（可以查看所有账户）
	if callerDomain == CENTRAL_BANK_DOMAIN {
		return true, nil
	}

	// 检查是否是银行admin用户
	if s.isAdminUserByDomain(callerID) {
		// admin用户可以查看同一银行的所有账户
		if callerDomain == targetInfo.OrgMSP {
			return true, nil
		}
	}

	// 其他情况不允许查看
	return false, nil
}

// isAdminUser 检查用户是否是admin用户
func (s *SmartContract) isAdminUser(clientID string) bool {
	// 尝试解码 base64 编码的 clientID
	decodedBytes, err := base64.StdEncoding.DecodeString(clientID)
	if err != nil {
		return false
	}

	decodedClientID := string(decodedBytes)

	// 解析 X.509 格式，检查CN是否包含Admin
	if strings.HasPrefix(decodedClientID, "x509::") {
		parts := strings.Split(decodedClientID, "::")
		if len(parts) >= 2 {
			subjectPart := parts[1]

			// 解析 CN (Common Name)
			if cnMatch := strings.Split(subjectPart, "CN="); len(cnMatch) > 1 {
				cnPart := strings.Split(cnMatch[1], ",")[0]
				// 检查是否包含Admin（不区分大小写）
				if strings.Contains(strings.ToLower(cnPart), "admin") {
					return true
				}
			}
		}
	}

	return false
}

// isAdminUserByDomain 通过domain检查用户是否是admin用户（更准确的方法）
func (s *SmartContract) isAdminUserByDomain(clientID string) bool {
	// 提取domain
	domain, err := s.extractDomainFromClientID(clientID)
	if err != nil {
		return false
	}

	// 检查domain是否包含admin（不区分大小写）
	return strings.Contains(strings.ToLower(domain), "admin")
}

// extractDomainFromClientID 从clientID中提取组织域名信息
// 这个方法解析X.509证书格式的clientID，提取组织域名
func (s *SmartContract) extractDomainFromClientID(clientID string) (string, error) {
	// 尝试解码 base64 编码的 clientID
	decodedBytes, err := base64.StdEncoding.DecodeString(clientID)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 clientID: %v", err)
	}

	decodedClientID := string(decodedBytes)

	// 解析 X.509 格式：x509::CN=User1@domain.com,OU=client,O=Org1,ST=State,C=Country::CN=ca.domain.com,O=domain.com,...
	if strings.HasPrefix(decodedClientID, "x509::") {
		parts := strings.Split(decodedClientID, "::")
		if len(parts) >= 2 {
			// 首先尝试从用户证书部分提取组织信息
			subjectPart := parts[1]

			// 解析 O (Organization) - 用户证书部分
			if orgMatch := strings.Split(subjectPart, "O="); len(orgMatch) > 1 {
				orgPart := strings.Split(orgMatch[1], ",")[0]
				return orgPart, nil
			}

			// 如果没有O字段，尝试从CN中提取组织信息
			if cnMatch := strings.Split(subjectPart, "CN="); len(cnMatch) > 1 {
				cnPart := strings.Split(cnMatch[1], ",")[0]
				if strings.Contains(cnPart, "@") {
					parts := strings.Split(cnPart, "@")
					if len(parts) > 1 {
						return parts[1], nil
					}
				}
			}

			// 如果用户证书部分没有找到，尝试从CA证书部分提取
			if len(parts) >= 3 {
				caPart := parts[2]

				// 解析 CA 证书的 O (Organization)
				if orgMatch := strings.Split(caPart, "O="); len(orgMatch) > 1 {
					orgPart := strings.Split(orgMatch[1], ",")[0]
					return orgPart, nil
				}
			}
		}
	}

	return "", fmt.Errorf("unable to extract domain from clientID: %s", clientID)
}

// checkTransactionQueryPermission 检查调用者是否有权限查询指定用户的交易记录
func (s *SmartContract) checkTransactionQueryPermission(ctx contractapi.TransactionContextInterface, callerID, targetUserID string) (bool, error) {
	// 如果调用者查询自己的交易记录，直接允许
	if callerID == targetUserID {
		return true, nil
	}

	// 获取调用者的信息（用于验证调用者账户存在）
	_, err := s.getUserAccountInfo(ctx, callerID)
	if err != nil {
		return false, fmt.Errorf("failed to get caller account info: %v", err)
	}

	// 解析调用者的clientID获取用户类型
	callerDomain, err := s.extractDomainFromClientID(callerID)
	if err != nil {
		return false, fmt.Errorf("failed to extract caller domain: %v", err)
	}

	// 检查是否是央行用户（可以查看所有交易记录）
	if callerDomain == CENTRAL_BANK_DOMAIN {
		return true, nil
	}

	// 检查是否是银行admin用户
	if s.isAdminUserByDomain(callerID) {
		// admin用户可以查看同一银行的所有交易记录
		targetInfo, err := s.getUserAccountInfo(ctx, targetUserID)
		if err != nil {
			return false, fmt.Errorf("failed to get target user account info: %v", err)
		}
		if callerDomain == targetInfo.OrgMSP {
			return true, nil
		}
	}

	// 其他情况不允许查看
	return false, nil
}

// ========== 统一的交易查询方法 ==========

// QueryUserTransactions 统一的交易查询方法，支持多种筛选条件和分页
func (s *SmartContract) QueryUserTransactions(ctx contractapi.TransactionContextInterface, userID string, minAmount int, maxAmount int, transactionType string, counterparty string, pageSize int, offset int) (string, error) {
	// 检查合约初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取当前调用者的信息
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller id: %v", err)
	}

	// 检查权限 - 用户只能查询自己的交易，央行可以查询所有交易
	hasPermission, err := s.checkTransactionQueryPermission(ctx, callerID, userID)
	if err != nil {
		return "", fmt.Errorf("failed to check permission: %v", err)
	}
	if !hasPermission {
		return "", fmt.Errorf("caller does not have permission to query transactions for user %s", userID)
	}

	// 验证和设置页面大小
	if pageSize <= 0 {
		pageSize = 20 // 默认页面大小
	}
	if pageSize > 100 {
		pageSize = 100 // 最大页面大小限制
	}

	// 验证偏移量
	if offset < 0 {
		offset = 0
	}

	// 构建查询条件
	querySelector := map[string]interface{}{
		"selector": map[string]interface{}{
			"docType": "transaction",
		},
		"limit": pageSize + offset, // 获取更多数据以支持偏移量
	}

	// 添加用户筛选条件
	if userID != "" {
		querySelector["selector"].(map[string]interface{})["$or"] = []map[string]interface{}{
			{"from": userID},
			{"to": userID},
		}
	}

	// 添加金额范围筛选
	if minAmount > 0 || maxAmount > 0 {
		amountCondition := map[string]interface{}{}
		if minAmount > 0 {
			amountCondition["$gte"] = minAmount
		}
		if maxAmount > 0 {
			amountCondition["$lte"] = maxAmount
		}
		querySelector["selector"].(map[string]interface{})["amount"] = amountCondition
	}

	// 添加交易类型筛选
	if transactionType != "" {
		querySelector["selector"].(map[string]interface{})["transactionType"] = transactionType
	}

	// 添加参与方筛选
	if counterparty != "" {
		querySelector["selector"].(map[string]interface{})["$or"] = []map[string]interface{}{
			{"from": counterparty},
			{"to": counterparty},
		}
	}

	// 序列化查询条件
	queryJSON, err := json.Marshal(querySelector)
	if err != nil {
		return "", fmt.Errorf("failed to marshal query selector: %v", err)
	}

	// 执行查询
	queryResults, err := ctx.GetStub().GetPrivateDataQueryResult(centralBankCollection, string(queryJSON))
	if err != nil {
		return "", fmt.Errorf("failed to query private data: %v", err)
	}
	defer queryResults.Close()

	// 处理查询结果
	var allTransactions []map[string]interface{}
	for queryResults.HasNext() {
		queryResult, err := queryResults.Next()
		if err != nil {
			return "", fmt.Errorf("failed to get next query result: %v", err)
		}

		var transaction map[string]interface{}
		err = json.Unmarshal(queryResult.Value, &transaction)
		if err != nil {
			return "", fmt.Errorf("failed to unmarshal transaction: %v", err)
		}

		// 添加查询结果信息
		transaction["key"] = queryResult.Key
		allTransactions = append(allTransactions, transaction)
	}

	// 应用偏移量和页面大小
	var transactions []map[string]interface{}
	totalCount := len(allTransactions)

	if offset < totalCount {
		endIndex := offset + pageSize
		if endIndex > totalCount {
			endIndex = totalCount
		}
		transactions = allTransactions[offset:endIndex]
	}

	// 计算分页信息
	hasMore := (offset + pageSize) < totalCount
	nextOffset := offset + pageSize
	if nextOffset >= totalCount {
		nextOffset = -1 // 表示没有下一页
	}

	// 构建响应
	response := map[string]interface{}{
		"userID": userID,
		"queryConditions": map[string]interface{}{
			"minAmount":       minAmount,
			"maxAmount":       maxAmount,
			"transactionType": transactionType,
			"counterparty":    counterparty,
		},
		"pagination": map[string]interface{}{
			"pageSize":      pageSize,
			"currentOffset": offset,
			"nextOffset":    nextOffset,
			"hasMore":       hasMore,
			"totalCount":    totalCount,
		},
		"currentPageCount": len(transactions),
		"transactions":     transactions,
	}

	// 序列化响应
	responseJSON, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal response: %v", err)
	}

	return string(responseJSON), nil
}

// 为了向后兼容，保留一些简化的查询方法
// QueryUserTransactionsSimple 简化版查询，用于基本查询需求
func (s *SmartContract) QueryUserTransactionsSimple(ctx contractapi.TransactionContextInterface, userID string) (string, error) {
	return s.QueryUserTransactions(ctx, userID, 0, 0, "", "", 100, 0)
}

// GetUserTransactionHistory 获取用户交易历史（向后兼容）
func (s *SmartContract) GetUserTransactionHistory(ctx contractapi.TransactionContextInterface, userID string) (string, error) {
	return s.QueryUserTransactions(ctx, userID, 0, 0, "", "", 50, 0)
}

// QueryAllTransactions 查询所有交易记录，根据用户角色实现权限控制
func (s *SmartContract) QueryAllTransactions(ctx contractapi.TransactionContextInterface, minAmount int, maxAmount int, transactionType string, counterparty string, pageSize int, offset int) (string, error) {
	// 检查合约初始化
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to check if contract is already initialized: %v", err)
	}
	if !initialized {
		return "", fmt.Errorf("contract options need to be set before calling any function, call Initialize() to initialize contract")
	}

	// 获取当前调用者的信息
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller id: %v", err)
	}

	// 解析调用者的clientID获取用户类型
	callerDomain, err := s.extractDomainFromClientID(callerID)
	if err != nil {
		return "", fmt.Errorf("failed to extract caller domain: %v", err)
	}

	// 验证和设置页面大小
	if pageSize <= 0 {
		pageSize = 20 // 默认页面大小
	}
	if pageSize > 100 {
		pageSize = 100 // 最大页面大小限制
	}

	// 验证偏移量
	if offset < 0 {
		offset = 0
	}

	// 构建查询条件
	querySelector := map[string]interface{}{
		"selector": map[string]interface{}{
			"docType": "transaction",
		},
		"limit": pageSize + offset, // 获取更多数据以支持偏移量
	}

	// 根据用户角色添加不同的筛选条件
	if callerDomain == CENTRAL_BANK_DOMAIN {
		// 央行用户（admin和user）：可以查询所有交易，不需要额外筛选
		log.Printf("央行用户查询所有交易记录")
	} else if s.isAdminUserByDomain(callerID) {
		// 银行admin用户：只能查询同一银行的所有交易
		log.Printf("银行admin用户查询本行所有交易记录，银行MSP: %s", callerDomain)
		// 这里需要通过MSP字段筛选，但由于当前交易数据结构中没有存储toMsp字段
		// 我们需要通过其他方式来实现银行级别的筛选
		// 暂时先查询所有交易，后续可以通过增强交易数据结构来完善
	} else {
		// 普通用户：只能查询自己的交易
		log.Printf("普通用户查询自己的交易记录，用户ID: %s", callerID)
		querySelector["selector"].(map[string]interface{})["$or"] = []map[string]interface{}{
			{"from": callerID},
			{"to": callerID},
		}
	}

	// 添加金额范围筛选
	if minAmount > 0 || maxAmount > 0 {
		amountCondition := map[string]interface{}{}
		if minAmount > 0 {
			amountCondition["$gte"] = minAmount
		}
		if maxAmount > 0 {
			amountCondition["$lte"] = maxAmount
		}
		querySelector["selector"].(map[string]interface{})["amount"] = amountCondition
	}

	// 添加交易类型筛选
	if transactionType != "" {
		querySelector["selector"].(map[string]interface{})["transactionType"] = transactionType
	}

	// 添加参与方筛选
	if counterparty != "" {
		// 如果已经有$or条件，需要合并
		if _, exists := querySelector["selector"].(map[string]interface{})["$or"]; exists {
			// 合并现有的$or条件和新的参与方条件
			// 这里需要更复杂的逻辑来合并条件，暂时简化处理
			log.Printf("Warning: 参与方筛选与现有条件冲突，暂时忽略参与方筛选")
		} else {
			querySelector["selector"].(map[string]interface{})["$or"] = []map[string]interface{}{
				{"from": counterparty},
				{"to": counterparty},
			}
		}
	}

	// 序列化查询条件
	queryJSON, err := json.Marshal(querySelector)
	if err != nil {
		return "", fmt.Errorf("failed to marshal query selector: %v", err)
	}

	// 执行查询
	queryResults, err := ctx.GetStub().GetPrivateDataQueryResult(centralBankCollection, string(queryJSON))
	if err != nil {
		return "", fmt.Errorf("failed to query private data: %v", err)
	}
	defer queryResults.Close()

	// 处理查询结果
	var allTransactions []map[string]interface{}
	for queryResults.HasNext() {
		queryResult, err := queryResults.Next()
		if err != nil {
			return "", fmt.Errorf("failed to get next query result: %v", err)
		}

		var transaction map[string]interface{}
		err = json.Unmarshal(queryResult.Value, &transaction)
		if err != nil {
			return "", fmt.Errorf("failed to unmarshal transaction: %v", err)
		}

		// 添加查询结果信息
		transaction["key"] = queryResult.Key
		allTransactions = append(allTransactions, transaction)
	}

	// 对于银行admin用户，需要在应用层进行MSP筛选
	if callerDomain != CENTRAL_BANK_DOMAIN && s.isAdminUserByDomain(callerID) && !s.isCentralBankUser(callerID) {
		// 银行admin用户：筛选同一银行的交易
		var filteredTransactions []map[string]interface{}
		for _, tx := range allTransactions {
			// 检查交易的from和to是否属于同一银行
			fromUser := tx["from"].(string)
			toUser := tx["to"].(string)

			// 获取from和to用户的MSP信息
			fromMSP, _ := s.extractDomainFromClientID(fromUser)
			toMSP, _ := s.extractDomainFromClientID(toUser)

			// 如果from或to属于同一银行，则包含此交易
			if fromMSP == callerDomain || toMSP == callerDomain {
				filteredTransactions = append(filteredTransactions, tx)
			}
		}
		allTransactions = filteredTransactions
	}

	// 应用偏移量和页面大小
	var transactions []map[string]interface{}
	totalCount := len(allTransactions)

	if offset < totalCount {
		endIndex := offset + pageSize
		if endIndex > totalCount {
			endIndex = totalCount
		}
		transactions = allTransactions[offset:endIndex]
	}

	// 计算分页信息
	hasMore := (offset + pageSize) < totalCount
	nextOffset := offset + pageSize
	if nextOffset >= totalCount {
		nextOffset = -1 // 表示没有下一页
	}

	// 构建响应
	response := map[string]interface{}{
		"queryConditions": map[string]interface{}{
			"minAmount":       minAmount,
			"maxAmount":       maxAmount,
			"transactionType": transactionType,
			"counterparty":    counterparty,
		},
		"pagination": map[string]interface{}{
			"pageSize":      pageSize,
			"currentOffset": offset,
			"nextOffset":    nextOffset,
			"hasMore":       hasMore,
			"totalCount":    totalCount,
		},
		"currentPageCount": len(transactions),
		"transactions":     transactions,
		"userRole": map[string]interface{}{
			"callerID":      callerID,
			"callerDomain":  callerDomain,
			"isAdmin":       s.isAdminUserByDomain(callerID),
			"isCentralBank": callerDomain == CENTRAL_BANK_DOMAIN,
		},
	}

	// 序列化响应
	responseJSON, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal response: %v", err)
	}

	return string(responseJSON), nil
}

// isCentralBankUser 检查用户是否是央行用户
func (s *SmartContract) isCentralBankUser(clientID string) bool {
	domain, err := s.extractDomainFromClientID(clientID)
	if err != nil {
		return false
	}
	return domain == CENTRAL_BANK_DOMAIN
}
