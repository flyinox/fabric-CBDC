import React, { useEffect, useMemo, useState } from 'react'
import { Layout, Typography, Select, Tag, message, Button, Table, Space, InputNumber, Input, Divider, Statistic, Flex, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UserSwitchOutlined, SendOutlined, DollarOutlined, ProfileOutlined } from '@ant-design/icons'

type OrgType = 'central_bank' | 'commercial_bank'

interface WalletItem { file: string; orgName: string; orgType: OrgType; userName: string; fullName: string; mspId: string; type: string; version: number }
interface UserRow { key: string; identityName: string; name: string; org: string; role: string; orgType: OrgType; balance?: number }
interface TxItem { id: string; type: string; amount: string; from: string; to: string; timestamp: number; status: string; hash?: string; spender?: string }

const { Header, Content } = Layout
const { Title, Text } = Typography

async function apiGet<T>(url: string): Promise<T> { const res = await fetch(url); if (!res.ok) throw new Error(await res.text()); return res.json() }
async function apiPost<T>(url: string, body: any): Promise<T> { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) throw new Error(await res.text()); return res.json() }

export default function App() {
  const [wallets, setWallets] = useState<WalletItem[]>([])
  const [adminCandidates, setAdminCandidates] = useState<string[]>([])
  const [currentIdentity, setCurrentIdentity] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [txs, setTxs] = useState<TxItem[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)
  const [adminBalance, setAdminBalance] = useState<number>(0)
  const [bankTotalBalance, setBankTotalBalance] = useState<number>(0)
  const [batchRows, setBatchRows] = useState<Array<{ recipient: string; amount: number }>>([{ recipient: '', amount: 0 }])
  const [submittingBatch, setSubmittingBatch] = useState(false)

  // 加载钱包与当前身份
  useEffect(() => {
    (async () => {
      try {
        const w = await apiGet<{ wallets: WalletItem[] }>('/api/wallets')
        setWallets(w.wallets || [])
        const admins = (w.wallets || [])
          .filter(x => x.orgType === 'commercial_bank' && x.userName === 'Admin')
          .map(x => x.file.replace('.id', ''))
        setAdminCandidates(admins)

        const cur = await apiGet<{ success: boolean; data: { identityName: string | null } }>('/api/current-user')
        setCurrentIdentity(cur?.data?.identityName || null)
      } catch (e: any) {
        message.error('加载钱包失败: ' + e.message)
      }
    })()
  }, [])

  // 选择管理员（限制仅 Admin）
  const handleSelectAdmin = async (identityName: string) => {
    try {
      const resp = await apiPost<{ success: boolean; message?: string }>('/api/select-user', { identityName })
      if (resp.success) {
        setCurrentIdentity(identityName)
        message.success('已选择管理员: ' + identityName)
        // 刷新数据
        await Promise.all([loadUsers(identityName), loadAdminBalance(identityName), loadTxs(identityName)])
      } else {
        message.error(resp.message || '选择用户失败')
      }
    } catch (e: any) {
      message.error('选择用户失败: ' + e.message)
    }
  }

  const bankOfAdmin = useMemo(() => {
    if (!currentIdentity) return null
    const w = wallets.find(x => x.file.replace('.id','') === currentIdentity)
    return w?.orgName || null
  }, [currentIdentity, wallets])

  // 加载本银行用户
  const loadUsers = async (identityName?: string) => {
    const admin = identityName || currentIdentity
    if (!admin) return
    const bank = bankOfAdmin
    if (!bank) return
    setLoadingUsers(true)
    try {
      // 从钱包中过滤该银行所有用户
      const bankUsers = wallets.filter(w => w.orgName === bank)
      const identityNames = bankUsers.map(w => w.file.replace('.id',''))
      // 批量余额
      const balancesResp = await apiPost<{ success: boolean; data: { balances: Record<string, number> } }>('/api/balances', { identityNames })
      const balances = balancesResp.success ? balancesResp.data.balances : {}
      const rows: UserRow[] = bankUsers.map(w => ({
        key: w.file,
        identityName: w.file.replace('.id',''),
        name: w.fullName,
        org: w.orgName,
        role: w.userName,
        orgType: w.orgType,
        balance: balances[w.file.replace('.id','')] ?? 0,
      }))
      setUsers(rows)
      // 计算银行总余额
      const total = rows.reduce((sum, r) => sum + (r.balance || 0), 0)
      setBankTotalBalance(total)
    } catch (e: any) {
      message.error('加载银行用户失败: ' + e.message)
      setUsers([])
      setBankTotalBalance(0)
    } finally { setLoadingUsers(false) }
  }

  // 加载管理员余额
  const loadAdminBalance = async (identityName?: string) => {
    const admin = identityName || currentIdentity
    if (!admin) return
    try {
      const b = await apiGet<{ success: boolean; data: { balance: number } }>(`/api/balance/${encodeURIComponent(admin)}`)
      setAdminBalance(b?.data?.balance || 0)
    } catch (e: any) {
      setAdminBalance(0)
    }
  }

  // 加载交易（银行维度：使用管理员身份调用全网接口，再过滤本银行相关）
  const loadTxs = async (identityName?: string) => {
    const admin = identityName || currentIdentity
    if (!admin) return
    setLoadingTxs(true)
    try {
      const resp = await apiPost<any>('/api/all-transactions', { identityName: admin, pageSize: '50', offset: '0' })
      const list: TxItem[] = (resp?.data?.transactions || []).map((tx: any) => ({
        id: tx.txId || tx.key || tx.id,
        type: tx.transactionType || tx.type || '-',
        amount: (tx.amount ?? '0').toString(),
        from: tx.from,
        to: tx.to,
        spender: tx.spender,
        timestamp: (typeof tx.timestamp === 'number' && tx.timestamp > 1e12)
          ? tx.timestamp
          : (typeof tx.timestamp === 'number' ? tx.timestamp * 1000 : Date.now()),
        status: 'success',
      }))
      setTxs(list.sort((a,b)=> b.timestamp - a.timestamp))
    } catch (e: any) {
      message.error('加载交易失败: ' + e.message)
      setTxs([])
    } finally { setLoadingTxs(false) }
  }

  // 当 currentIdentity 变化时加载数据
  useEffect(() => {
    if (currentIdentity) {
      loadUsers()
      loadAdminBalance()
      loadTxs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdentity])

  const userColumns: ColumnsType<UserRow> = [
    { title: '身份', dataIndex: 'identityName', key: 'identityName' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '角色', dataIndex: 'role', key: 'role', render: v => v === 'Admin' ? <Tag color="gold">Admin</Tag> : <Tag>用户</Tag> },
    { title: '余额', dataIndex: 'balance', key: 'balance', render: v => <Text>{v}</Text> },
  ]

  const txColumns: ColumnsType<TxItem> = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: v => new Date(v).toLocaleString() },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => v || '-' },
    { title: '金额', dataIndex: 'amount', key: 'amount' },
    { title: 'From', dataIndex: 'from', key: 'from', ellipsis: true },
    { title: 'To', dataIndex: 'to', key: 'to', ellipsis: true },
    { title: 'Spender', dataIndex: 'spender', key: 'spender', ellipsis: true },
    // 隐藏状态列：不展示失败/成功标签
  ]

  const addBatchRow = () => setBatchRows(prev => [...prev, { recipient: '', amount: 0 }])
  const removeBatchRow = (idx: number) => setBatchRows(prev => prev.filter((_,i)=>i!==idx))
  const updateBatchRow = (idx: number, patch: Partial<{ recipient: string; amount: number }>) => setBatchRows(prev => prev.map((r,i)=> i===idx ? { ...r, ...patch } : r))
  const submitBatch = async () => {
    if (!currentIdentity) { message.warning('请先选择管理员'); return }
    const transfers = batchRows.filter(r => r.recipient && r.amount > 0).map(r => ({ recipient: r.recipient.trim(), amount: String(r.amount) }))
    if (transfers.length === 0) { message.warning('请填写至少一条有效转账'); return }
    try {
      setSubmittingBatch(true)
      const resp = await apiPost<any>('/api/batch-transfer', { identityName: currentIdentity, transfers })
      if (resp.success) {
        const ok = resp.data.results.filter((r: any) => r.success).length
        message.success(`批量转账完成，成功 ${ok}/${transfers.length}`)
        // 清除表单记录
        setBatchRows([{ recipient: '', amount: 0 }])
      } else {
        message.error('批量转账失败')
      }
      await Promise.all([loadAdminBalance(), loadTxs(), loadUsers()])
    } catch (e: any) { message.error('批量转账失败: ' + e.message) }
    finally { setSubmittingBatch(false) }
  }

  return (
    <Layout>
      <Header style={{ background: '#fff', padding: '0 16px', borderBottom: '1px solid #eee' }}>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>银行管理后台</Title>
          <Space>
            <UserSwitchOutlined />
            <Select
              style={{ width: 320 }}
              placeholder="选择银行 Admin 身份"
              value={currentIdentity || undefined}
              onChange={handleSelectAdmin}
              options={adminCandidates.map(id => ({ label: id, value: id }))}
              allowClear
            />
          </Space>
        </div>
      </Header>
      <Content>
        <div className="container">
          <div className="section">
            <Space size={24} wrap>
              <Statistic title="当前管理员" value={currentIdentity || '-'} prefix={<ProfileOutlined />} />
              <Statistic title="管理员余额" value={adminBalance} prefix={<DollarOutlined />} />
              <Statistic title="银行总余额" value={bankTotalBalance} prefix={<DollarOutlined />} />
              <Statistic title="所属银行" value={bankOfAdmin || '-'} />
            </Space>
          </div>

          <div className="section">
            <div className="page-title">本银行用户</div>
            <Table<UserRow>
              rowKey="key"
              columns={userColumns}
              dataSource={users}
              loading={loadingUsers}
              pagination={{ pageSize: 8 }}
            />
          </div>

          <div className="section">
            <div className="page-title">本银行相关交易</div>
            <Table<TxItem>
              rowKey={r => r.id || String(r.timestamp)}
              columns={txColumns}
              dataSource={txs}
              loading={loadingTxs}
              pagination={{ pageSize: 10 }}
            />
          </div>

          <div className="section">
            <div className="page-title">批量转账</div>
            <Space direction="vertical" style={{ width: '100%' }}>
              {batchRows.map((row, idx) => (
                <Flex key={idx} gap={12} align="center" style={{ width: '100%' }}>
                  <Tooltip title="接收者账户地址">
                    <Input placeholder="收款账户地址" value={row.recipient} onChange={e=>updateBatchRow(idx,{ recipient: e.target.value })} style={{ flex: 1 }} />
                  </Tooltip>
                  <InputNumber min={1} precision={0} placeholder="金额" value={row.amount} onChange={v=>updateBatchRow(idx,{ amount: Number(v||0) })} />
                  <Button danger onClick={()=>removeBatchRow(idx)} disabled={batchRows.length<=1}>删除</Button>
                </Flex>
              ))}
              <Space>
                <Button onClick={addBatchRow} disabled={submittingBatch}>新增一行</Button>
                <Button type="primary" icon={<SendOutlined />} loading={submittingBatch} onClick={submitBatch}>提交批量转账</Button>
              </Space>
            </Space>
          </div>
        </div>
      </Content>
    </Layout>
  )
}

