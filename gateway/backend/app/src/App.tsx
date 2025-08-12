import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Button, Space, Tag, Modal, Spin, Empty, message, Typography, Form, Input, Select, InputNumber, Divider, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  ReloadOutlined, 
  DesktopOutlined, 
  SettingOutlined,
  EyeOutlined,
  UserOutlined,
  MonitorOutlined,
  ApiOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  LockOutlined,
  LoginOutlined
} from '@ant-design/icons';
import LanguageSelector from './components/LanguageSelector';
import './App.css';

const { Content, Sider } = Layout;
const { Text, Title } = Typography;
const { Option } = Select;

interface NetworkStatus {
  status: 'running' | 'stopped' | 'unknown';
  nodes: Array<{
    name: string;
    status: string;
    type: string;
  }>;
  timestamp: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  node: string;
}

interface BankConfig {
  name: string;      // 中文显示名称
  identifier: string; // 英文MSP标识
}

interface NetworkConfig {
  centralBankName: string;    // 央行中文名称
  centralBankIdentifier: string; // 央行英文标识
  banks: BankConfig[];
}

interface LoginForm {
  username: string;
  password: string;
}

const App: React.FC = () => {
  const { t } = useTranslation();
  
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>({
    username: 'admin',
    password: 'admin123'
  });

  // 侧边栏状态
  const [selectedMenu, setSelectedMenu] = useState('monitor');
  
  // 运行监控状态
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedNode, setSelectedNode] = useState('');

  // 网络管理状态
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({
    centralBankName: 'pboc',
    centralBankIdentifier: 'pboc',
    banks: [
      { name: 'icbc', identifier: 'icbc' },
      { name: 'abc', identifier: 'abc' }
    ]
  });
  const [networkConfigLoading, setNetworkConfigLoading] = useState(false);

  // 用户管理状态
  const [selectedBank, setSelectedBank] = useState('');
  const [userCount, setUserCount] = useState(1);
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  
  // 代币初始化状态
  const [tokenInitConfig, setTokenInitConfig] = useState({
    name: 'Digital Currency',
    symbol: 'DCEP',
    decimals: '2',
    adminUser: 'Admin@pboc.example.com'
  });
  const [tokenInitLoading, setTokenInitLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [centralBankUsers, setCentralBankUsers] = useState<string[]>([]);

  // 登录处理
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      message.error(t('login.pleaseEnterUsernamePassword'));
      return;
    }

    setLoginLoading(true);
    try {
      // 测试认证
      const response = await fetch('/api/admin/network/status', {
        headers: {
          'Authorization': `Basic ${btoa(`${loginForm.username}:${loginForm.password}`)}`
        }
      });

      if (response.ok) {
        setIsLoggedIn(true);
        message.success(t('login.loginSuccess'));
        // 登录成功后加载数据
        fetchNetworkStatus();
        fetchAvailableBanks();
        fetchTokenInfo();
        fetchCentralBankUsers();
      } else {
        message.error(t('login.loginFailed'));
      }
    } catch (error) {
      message.error(t('login.networkError'));
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出处理
  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedMenu('monitor');
    message.success(t('login.logoutSuccess'));
  };

  // 检查登录状态
  const checkLoginStatus = async () => {
    // 不自动检查登录状态，用户需要手动登录
    setIsLoggedIn(false);
  };

  // 获取认证头
  const getAuthHeader = () => {
    return `Basic ${btoa(`${loginForm.username}:${loginForm.password}`)}`;
  };

  // 获取可用银行列表
  const fetchAvailableBanks = async () => {
    if (!isLoggedIn) return;
    
    try {
      const response = await fetch('/api/admin/banks', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableBanks(data.banks || []);
      }
    } catch (error) {
      console.error('获取银行列表失败:', error);
    }
  };

  // 运行监控功能
  const fetchNetworkStatus = async () => {
    if (!isLoggedIn) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/network/status', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setNetworkStatus(data);
      } else {
        message.error('获取网络状态失败');
      }
    } catch (error) {
      message.error('获取网络状态失败');
    } finally {
      setLoading(false);
    }
  };

  const viewNodeLogs = async (nodeName: string) => {
    if (!isLoggedIn) return;
    
    setSelectedNode(nodeName);
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/admin/logs/${nodeName}`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      message.error('获取日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  // 网络管理功能
  const startNetworkWithClean = async () => {
    if (!isLoggedIn) return;
    
    if (!confirm(t('network.startConfirm'))) {
      return;
    }
    
    setNetworkConfigLoading(true);
    try {
      console.log('[前端] 开始执行清除网络操作...');
      
      // 先清除网络
      const cleanResponse = await fetch('/api/admin/network/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
      });
      
      console.log('[前端] 清除网络响应状态:', cleanResponse.status);
      const cleanData = await cleanResponse.json();
      console.log('[前端] 清除网络响应数据:', cleanData);
      
      if (!cleanResponse.ok) {
        console.error('[前端] 清除网络失败:', cleanData);
        message.error(cleanData.error || '网络清除失败');
        return;
      }
      
      console.log('[前端] 清除网络成功，开始启动网络...');
      message.success(t('network.networkCleanSuccess'));
      
      // 等待一下再启动网络
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 再启动网络
      console.log('[前端] 开始执行启动网络操作...');
      const startResponse = await fetch('/api/admin/network/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
      });
      
      console.log('[前端] 启动网络响应状态:', startResponse.status);
      const startData = await startResponse.json();
      console.log('[前端] 启动网络响应数据:', startData);
      
      if (startResponse.ok) {
        console.log('[前端] 启动网络成功');
        message.success(t('network.networkStartSuccess'));
        fetchNetworkStatus();
      } else {
        console.error('[前端] 启动网络失败:', startData);
        message.error(startData.error || t('network.startNetworkFailed'));
      }
    } catch (error) {
      console.error('[前端] 网络启动异常:', error);
              message.error(t('network.networkOperationFailed'));
    } finally {
      setNetworkConfigLoading(false);
    }
  };

  const setupNetwork = async () => {
    if (!isLoggedIn) return;
    
    if (!confirm(t('network.reconfigureConfirm'))) {
      return;
    }
    
    setNetworkConfigLoading(true);
    try {
      const response = await fetch('/api/admin/network/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          centralBankName: networkConfig.centralBankName,
          centralBankIdentifier: networkConfig.centralBankIdentifier,
          banks: networkConfig.banks
        })
      });
      const data = await response.json();
      if (response.ok) {
        message.success(t('network.networkConfigSuccess'));
        fetchNetworkStatus();
      } else {
        message.error(data.error || t('network.networkConfigFailed'));
      }
    } catch (error) {
              message.error(t('network.networkOperationFailed'));
    } finally {
      setNetworkConfigLoading(false);
    }
  };

  const addBank = () => {
    const bankId = `bank${networkConfig.banks.length + 1}`;
    const newBank = {
      name: bankId,
      identifier: bankId
    };
    setNetworkConfig({
      ...networkConfig,
      banks: [...networkConfig.banks, newBank]
    });
  };

  const removeBank = (index: number) => {
    const newBanks = networkConfig.banks.filter((_, i) => i !== index);
    setNetworkConfig({
      ...networkConfig,
      banks: newBanks
    });
  };

  const updateBank = (index: number, field: 'name' | 'identifier', value: string) => {
    const newBanks = [...networkConfig.banks];
    newBanks[index] = { ...newBanks[index], name: value, identifier: value };
    setNetworkConfig({
      ...networkConfig,
      banks: newBanks
    });
  };

  // 用户管理功能
  const addUsers = async () => {
    if (!isLoggedIn) return;
    
    if (!selectedBank) {
      message.error(t('users.pleaseSelectBank'));
      return;
    }
    
    setUserManagementLoading(true);
    try {
      const response = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          bank: selectedBank,
          count: userCount
        })
      });
      const data = await response.json();
      if (response.ok) {
        message.success(t('users.addSuccess', { bank: selectedBank, count: userCount }));
      } else {
        message.error(data.error || t('users.addFailed'));
      }
    } catch (error) {
              message.error(t('users.addFailed'));
    } finally {
      setUserManagementLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return t('common.running');
      case 'stopped': return t('common.stopped');
      default: return t('common.unknown');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'green';
      case 'stopped': return 'red';
      default: return 'orange';
    }
  };

  // 代币初始化功能
  const initializeToken = async () => {
    if (!isLoggedIn) return;
    
    setTokenInitLoading(true);
    try {
      console.log('[前端] 开始代币初始化，参数:', tokenInitConfig);
      const response = await fetch('/api/admin/token/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify(tokenInitConfig)
      });
      
      const data = await response.json();
      console.log('[前端] 代币初始化响应:', data);
      
      if (response.ok) {
        message.success(data.message || t('token.initSuccess'));
        console.log('[前端] 代币初始化成功，开始刷新代币信息');
        // 延迟一下再刷新，确保后端处理完成
        setTimeout(() => {
          fetchTokenInfo();
        }, 1000);
      } else {
        message.error(data.error || t('token.initFailed'));
      }
    } catch (error) {
      console.error('[前端] 代币初始化异常:', error);
              message.error(t('token.initFailed'));
    } finally {
      setTokenInitLoading(false);
    }
  };

  // 获取代币信息
  const fetchTokenInfo = async () => {
    if (!isLoggedIn) return;
    
    try {
      const response = await fetch('/api/admin/token/info', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[前端] 代币信息响应:', data);
        // 处理不同的数据结构
        if (data.data) {
          setTokenInfo(data.data);
        } else if (data.success !== undefined) {
          setTokenInfo(data);
        } else {
          setTokenInfo({ initialized: false, info: null });
        }
      } else {
        console.error('[前端] 代币信息查询失败:', response.status);
        setTokenInfo({ initialized: false, info: null });
      }
    } catch (error) {
      console.error('获取代币信息失败:', error);
      setTokenInfo({ initialized: false, info: null });
    }
  };

  // 获取央行管理员用户
  const fetchCentralBankUsers = async () => {
    if (!isLoggedIn) return;
    
    try {
      const response = await fetch('/api/admin/token/central-bank-users', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCentralBankUsers(data.data.users || []);
        // 如果找到央行用户，自动设置第一个为默认值
        if (data.data.users && data.data.users.length > 0) {
          setTokenInitConfig(prev => ({
            ...prev,
            adminUser: data.data.users[0]
          }));
        }
      }
    } catch (error) {
      console.error('获取央行用户失败:', error);
    }
  };

  // 测试代币初始化环境
  const testTokenEnvironment = async () => {
    if (!isLoggedIn) return;
    
    try {
      const response = await fetch('/api/admin/token/test', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('环境检查结果:', data.data);
        message.info(t('token.environmentCheckComplete'));
      } else {
        message.error(t('token.environmentCheckFailed'));
      }
    } catch (error) {
              message.error(t('token.environmentCheckFailed'));
    }
  };

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchNetworkStatus();
      fetchAvailableBanks();
      fetchTokenInfo();
      fetchCentralBankUsers();
    }
  }, [isLoggedIn]);

  // 切换到“代币初始化”页时，自动刷新一次初始化状态与央行用户列表
  useEffect(() => {
    if (isLoggedIn && selectedMenu === 'token') {
      fetchTokenInfo();
      fetchCentralBankUsers();
    }
  }, [isLoggedIn, selectedMenu]);

  const totalNodes = networkStatus?.nodes?.length || 0;
  const runningNodes = networkStatus?.nodes?.filter(node => node.status === 'running').length || 0;

  // 渲染登录界面
  const renderLoginPage = () => (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <Title level={2} style={{ textAlign: 'center', marginBottom: 0 }}>
            {t('login.title')}
          </Title>
        </div>
        
          <Form layout="vertical" className="login-form">
            <Form.Item label={t('login.username')}>
            <Input
              prefix={<UserOutlined />}
                placeholder={t('login.usernamePlaceholder')}
              value={loginForm.username}
              onChange={(e) => setLoginForm({
                ...loginForm,
                username: e.target.value
              })}
              onPressEnter={handleLogin}
            />
          </Form.Item>
          
            <Form.Item label={t('login.password')}>
            <Input.Password
              prefix={<LockOutlined />}
                placeholder={t('login.passwordPlaceholder')}
              value={loginForm.password}
              onChange={(e) => setLoginForm({
                ...loginForm,
                password: e.target.value
              })}
              onPressEnter={handleLogin}
            />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              icon={<LoginOutlined />}
              loading={loginLoading}
              onClick={handleLogin}
            >
                {t('login.loginButton')}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );

  // 渲染运行监控界面
  const renderMonitorPage = () => (
    <div className="admin-content">
      {/* 网络状态概览 */}
      <Row gutter={[24, 24]} className="stats-row">
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title={t('monitor.totalNodes')}
              value={totalNodes}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title={t('monitor.runningNodes')}
              value={runningNodes}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title={t('monitor.networkStatus')}
              value={networkStatus ? getStatusText(networkStatus.status) : '-'}
              prefix={<SettingOutlined />}
              valueStyle={{ 
                color: networkStatus?.status === 'running' ? '#3f8600' : 
                       networkStatus?.status === 'stopped' ? '#cf1322' : '#faad14'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 网络监控 */}
      <Card 
        title={
          <Space>
            <MonitorOutlined />
            {t('monitor.networkMonitor')}
          </Space>
        }
        className="control-card"
      >
        <div className="control-buttons">
          <Button 
            type="primary" 
            icon={<ReloadOutlined />}
            onClick={fetchNetworkStatus}
            loading={loading}
          >
            {t('monitor.refreshStatus')}
          </Button>
        </div>
        
        {networkStatus && (
          <div className="status-info">
            <Text type="secondary">
              {t('monitor.updateTime', { time: new Date(networkStatus.timestamp).toLocaleString() })}
            </Text>
          </div>
        )}
      </Card>

      {/* 节点状态 */}
      <Card 
        title={
          <Space>
            <DesktopOutlined />
            {t('monitor.nodeStatus')}
          </Space>
        }
        className="nodes-card"
      >
        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <Text>{t('common.loading')}</Text>
          </div>
        ) : networkStatus?.nodes?.length ? (
          <Row gutter={[16, 16]}>
            {networkStatus.nodes.map((node, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={index}>
                <div className="node-card">
                  <div className="node-info">
                    <div className="node-name">
                      <Text strong>{node.name}</Text>
                    </div>
                    <div className="node-details">
                      <Space>
                        <Tag color={getStatusColor(node.status)}>
                          {getStatusText(node.status)}
                        </Tag>
                        <Tag color="blue">{node.type}</Tag>
                        <Button 
                          type="link" 
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => viewNodeLogs(node.name)}
                        >
                          {t('monitor.viewLogs')}
                        </Button>
                      </Space>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description={t('monitor.noInfo')} />
        )}
      </Card>
    </div>
  );

  // 渲染网络管理界面
  const renderNetworkManagementPage = () => (
    <div className="admin-content">
      <Card 
        title={
          <Space>
            <ApiOutlined />
            {t('network.title')}
          </Space>
        }
        className="control-card"
      >
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={24}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ minWidth: 80, fontWeight: 500 }}>{t('network.centralBankId')}</span>
                <Input
                  value={networkConfig.centralBankIdentifier}
                  onChange={(e) => setNetworkConfig({
                    ...networkConfig,
                    centralBankName: e.target.value,
                    centralBankIdentifier: e.target.value
                  })}
                  placeholder={t('network.centralBankPlaceholder')}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>

          <Divider orientation="left">{t('network.participatingBanks')}</Divider>
          
          {networkConfig.banks.map((bank, index) => (
            <Row gutter={16} key={index} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 80, fontWeight: 500 }}>{t('network.bankId')}</span>
                  <Input
                    value={bank.identifier}
                    onChange={(e) => updateBank(index, 'name', e.target.value)}
                    placeholder={t('network.bankPlaceholder')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeBank(index)}
                    disabled={networkConfig.banks.length <= 1}
                  >
                    {t('network.deleteBank')}
                  </Button>
                </div>
              </Col>
            </Row>
          ))}

          <Button 
            type="dashed" 
            icon={<PlusOutlined />}
            onClick={addBank}
            style={{ width: '100%', marginBottom: 24 }}
          >
            {t('network.addBank')}
          </Button>

          <Space>
            <Button 
              type="primary"
              onClick={startNetworkWithClean}
              loading={networkConfigLoading}
            >
              {t('network.startNetwork')}
            </Button>
            <Button 
              type="default"
              onClick={setupNetwork}
              loading={networkConfigLoading}
            >
              {t('network.reconfigure')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );

  // 渲染代币初始化界面
  const renderTokenInitPage = () => (
    <div className="admin-content">
      <Card 
        title={
          <Space>
            <ApiOutlined />
            {t('token.title')}
          </Space>
        }
      >
        {(() => {
          console.log('[前端] 渲染代币状态，tokenInfo:', tokenInfo);
          return tokenInfo?.initialized ? (
            <Alert
              message={t('token.initialized', { info: tokenInfo.info ?? '' })}
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
          ) : (
            <Alert
              message={t('token.notInitialized')}
              description={tokenInfo?.error || undefined}
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          );
        })()}
        
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label={t('token.tokenName')}>
                <Input
                  value={tokenInitConfig.name}
                  onChange={(e) => setTokenInitConfig({
                    ...tokenInitConfig,
                    name: e.target.value
                  })}
                  placeholder={t('token.namePlaceholder')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('token.tokenSymbol')}>
                <Input
                  value={tokenInitConfig.symbol}
                  onChange={(e) => setTokenInitConfig({
                    ...tokenInitConfig,
                    symbol: e.target.value
                  })}
                  placeholder={t('token.symbolPlaceholder')}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label={t('token.decimals')}>
                <Input
                  value={tokenInitConfig.decimals}
                  onChange={(e) => setTokenInitConfig({
                    ...tokenInitConfig,
                    decimals: e.target.value
                  })}
                  placeholder={t('token.decimalsPlaceholder')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('token.centralBankAdmin')}>
                <Select
                  value={tokenInitConfig.adminUser}
                  onChange={(value) => setTokenInitConfig({
                    ...tokenInitConfig,
                    adminUser: value
                  })}
                  placeholder={t('token.adminPlaceholder')}
                  style={{ width: '100%' }}
                >
                  {centralBankUsers.map(user => (
                    <Option key={user} value={user}>{user}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Space>
            <Button 
              type="primary"
              onClick={initializeToken}
              loading={tokenInitLoading}
              disabled={tokenInfo?.initialized}
            >
              {t('token.initializeToken')}
            </Button>
            <Button 
              type="default"
              onClick={() => setTokenInitConfig({
                name: 'Digital Currency',
                symbol: 'DCEP',
                decimals: '2',
                adminUser: 'Admin@pboc.example.com'
              })}
            >
              {t('token.resetParams')}
            </Button>
            <Button 
              type="dashed"
              onClick={testTokenEnvironment}
            >
              {t('token.testEnvironment')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );

  // 渲染用户管理界面
  const renderUserManagementPage = () => (
    <div className="admin-content">
      <Card 
        title={
          <Space>
            <TeamOutlined />
            {t('users.title')}
          </Space>
        }
        className="control-card"
      >
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label={t('users.selectBank')}>
                <Select
                  value={selectedBank}
                  onChange={setSelectedBank}
                  placeholder={t('users.bankPlaceholder')}
                  style={{ width: '100%' }}
                >
                  {availableBanks.map(bank => (
                    <Option key={bank} value={bank}>{bank}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('users.userCount')}>
                <InputNumber
                  value={userCount}
                  onChange={(value) => setUserCount(value || 1)}
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Button 
            type="primary"
            icon={<UserOutlined />}
            onClick={addUsers}
            loading={userManagementLoading}
            disabled={!selectedBank}
          >
            {t('users.addUsers')}
          </Button>
        </Form>
      </Card>
    </div>
  );

  const menuItems = [
    {
      key: 'monitor',
      icon: <MonitorOutlined />,
      label: t('navigation.monitor'),
    },
    {
      key: 'network',
      icon: <ApiOutlined />,
      label: t('navigation.network'),
    },
    {
      key: 'token',
      icon: <ApiOutlined />,
      label: t('navigation.token'),
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: t('navigation.users'),
    },
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'monitor':
        return renderMonitorPage();
      case 'network':
        return renderNetworkManagementPage();
      case 'token':
        return renderTokenInitPage();
      case 'users':
        return renderUserManagementPage();
      default:
        return renderMonitorPage();
    }
  };

  // 如果未登录，显示登录界面
  if (!isLoggedIn) {
    return renderLoginPage();
  }

  return (
    <div className="admin-layout">
      <Layout style={{ height: '100vh' }}>
        <Sider width={200} theme="dark">
          <div className="logo">
            <Title level={4} style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>
              {t('admin.title')}
            </Title>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            items={menuItems}
            onClick={({ key }) => setSelectedMenu(key)}
            theme="dark"
          />
          <div className="logout-section">
            <Button 
              type="text" 
              icon={<UserOutlined />}
              onClick={handleLogout}
              style={{ color: 'white', width: '100%', textAlign: 'left' }}
            >
              {t('login.logout')}
            </Button>
          </div>
        </Sider>
        <Layout>
          <div style={{ 
            padding: '16px 24px', 
            background: '#fff', 
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <LanguageSelector />
          </div>
          <Content style={{ padding: '24px', overflow: 'auto' }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>

      {/* 日志查看弹窗 */}
      <Modal
        title={t('monitor.logsTitle', { nodeName: selectedNode })}
        open={showLogs}
        onCancel={() => setShowLogs(false)}
        footer={[
          <Button key="close" onClick={() => setShowLogs(false)}>
            {t('common.close')}
          </Button>
        ]}
        width={1000}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '70vh', overflow: 'hidden' }}
      >
        <div className="logs-container">
          {logsLoading ? (
            <div className="loading-container">
              <Spin />
              <Text>{t('monitor.loadingLogs')}</Text>
            </div>
          ) : logs.length > 0 ? (
            <div className="logs-content">
              {logs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.level.toLowerCase()}`}>
                  <div className="log-time">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <Tag color={log.level === 'ERROR' ? 'red' : 
                              log.level === 'WARN' ? 'orange' : 
                              log.level === 'DEBUG' ? 'green' : 'blue'}>
                    {log.level}
                  </Tag>
                  <div className="log-message">{log.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description={t('monitor.noLogs')} />
          )}
      </div>
      </Modal>
      </div>
  );
};

export default App;
