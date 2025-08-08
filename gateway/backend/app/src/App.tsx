import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Button, Space, Tag, Modal, Spin, Empty, message, Typography, Form, Input, Select, InputNumber, Divider } from 'antd';
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
  DeleteOutlined
} from '@ant-design/icons';
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

const App: React.FC = () => {
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



  // 获取可用银行列表
  const fetchAvailableBanks = async () => {
    try {
      const response = await fetch('/api/admin/banks', {
        headers: {
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
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
    setLoading(true);
    try {
      const response = await fetch('/api/admin/network/status', {
        headers: {
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
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
    setSelectedNode(nodeName);
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/admin/logs/${nodeName}`, {
        headers: {
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
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
    if (!confirm('如果执行，将会清除现有网络，是否确认？')) {
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
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
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
      message.success('网络清除成功，正在启动网络...');
      
      // 等待一下再启动网络
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 再启动网络
      console.log('[前端] 开始执行启动网络操作...');
      const startResponse = await fetch('/api/admin/network/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
        },
      });
      
      console.log('[前端] 启动网络响应状态:', startResponse.status);
      const startData = await startResponse.json();
      console.log('[前端] 启动网络响应数据:', startData);
      
      if (startResponse.ok) {
        console.log('[前端] 启动网络成功');
        message.success('网络启动成功');
        fetchNetworkStatus();
      } else {
        console.error('[前端] 启动网络失败:', startData);
        message.error(startData.error || '网络启动失败');
      }
    } catch (error) {
      console.error('[前端] 网络启动异常:', error);
      message.error('网络启动失败');
    } finally {
      setNetworkConfigLoading(false);
    }
  };

  const setupNetwork = async () => {
    if (!confirm('确定要重新配置网络吗？这将根据当前配置重新设置网络。')) {
      return;
    }
    
    setNetworkConfigLoading(true);
    try {
      const response = await fetch('/api/admin/network/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
        },
        body: JSON.stringify({
          centralBankName: networkConfig.centralBankName,
          centralBankIdentifier: networkConfig.centralBankIdentifier,
          banks: networkConfig.banks
        })
      });
      const data = await response.json();
      if (response.ok) {
        message.success('网络配置成功');
        fetchNetworkStatus();
      } else {
        message.error(data.error || '网络配置失败');
      }
    } catch (error) {
      message.error('网络配置失败');
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
    if (!selectedBank) {
      message.error('请选择银行');
      return;
    }
    
    setUserManagementLoading(true);
    try {
      const response = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
        },
        body: JSON.stringify({
          bank: selectedBank,
          count: userCount
        })
      });
      const data = await response.json();
      if (response.ok) {
        message.success(`成功为${selectedBank}添加${userCount}个用户`);
      } else {
        message.error(data.error || '添加用户失败');
      }
    } catch (error) {
      message.error('添加用户失败');
    } finally {
      setUserManagementLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      default: return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'green';
      case 'stopped': return 'red';
      default: return 'orange';
    }
  };

  useEffect(() => {
    fetchNetworkStatus();
    fetchAvailableBanks();
  }, []);

  const totalNodes = networkStatus?.nodes?.length || 0;
  const runningNodes = networkStatus?.nodes?.filter(node => node.status === 'running').length || 0;

  // 渲染运行监控界面
  const renderMonitorPage = () => (
    <div className="admin-content">
      {/* 网络状态概览 */}
      <Row gutter={[24, 24]} className="stats-row">
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="总节点数"
              value={totalNodes}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="运行中节点"
              value={runningNodes}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stats-card">
            <Statistic
              title="网络状态"
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
            网络监控
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
            刷新状态
          </Button>
        </div>
        
        {networkStatus && (
          <div className="status-info">
            <Text type="secondary">
              更新时间: {new Date(networkStatus.timestamp).toLocaleString()}
            </Text>
          </div>
        )}
      </Card>

      {/* 节点状态 */}
      <Card 
        title={
          <Space>
            <DesktopOutlined />
            节点状态
          </Space>
        }
        className="nodes-card"
      >
        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <Text>加载中...</Text>
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
                          日志
                        </Button>
                      </Space>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无节点信息" />
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
                          网络配置管理
          </Space>
        }
        className="control-card"
      >
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={24}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ minWidth: 80, fontWeight: 500 }}>央行标识</span>
                <Input
                  value={networkConfig.centralBankIdentifier}
                  onChange={(e) => setNetworkConfig({
                    ...networkConfig,
                    centralBankName: e.target.value,
                    centralBankIdentifier: e.target.value
                  })}
                  placeholder="央行标识"
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
          </Row>

          <Divider orientation="left">参与银行配置</Divider>
          
          {networkConfig.banks.map((bank, index) => (
            <Row gutter={16} key={index} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 80, fontWeight: 500 }}>银行标识</span>
                  <Input
                    value={bank.identifier}
                    onChange={(e) => updateBank(index, 'name', e.target.value)}
                    placeholder="银行标识"
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeBank(index)}
                    disabled={networkConfig.banks.length <= 1}
                  >
                    删除
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
            添加银行
          </Button>

          <Space>
            <Button 
              type="primary"
              onClick={startNetworkWithClean}
              loading={networkConfigLoading}
            >
              启动网络
            </Button>
            <Button 
              type="default"
              onClick={setupNetwork}
              loading={networkConfigLoading}
            >
              重新配置
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
            用户管理
          </Space>
        }
        className="control-card"
      >
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="选择银行">
                <Select
                  value={selectedBank}
                  onChange={setSelectedBank}
                  placeholder="请选择银行"
                  style={{ width: '100%' }}
                >
                  {availableBanks.map(bank => (
                    <Option key={bank} value={bank}>{bank}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="用户数量">
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
            添加用户
          </Button>
        </Form>
      </Card>
    </div>
  );

  const menuItems = [
    {
      key: 'monitor',
      icon: <MonitorOutlined />,
      label: '运行监控',
    },
    {
      key: 'network',
      icon: <ApiOutlined />,
      label: '网络管理',
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'monitor':
        return renderMonitorPage();
      case 'network':
        return renderNetworkManagementPage();
      case 'users':
        return renderUserManagementPage();
      default:
        return renderMonitorPage();
    }
  };

  return (
    <div className="admin-layout">
      <Layout style={{ height: '100vh' }}>
        <Sider width={200} theme="dark">
          <div className="logo">
            <Title level={4} style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>
              CBDC 管理后台
            </Title>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            items={menuItems}
            onClick={({ key }) => setSelectedMenu(key)}
            theme="dark"
          />
        </Sider>
        <Layout>
          <Content style={{ padding: '24px', overflow: 'auto' }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>

      {/* 日志查看弹窗 */}
      <Modal
        title={`${selectedNode} 日志`}
        open={showLogs}
        onCancel={() => setShowLogs(false)}
        footer={[
          <Button key="close" onClick={() => setShowLogs(false)}>
            关闭
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
              <Text>加载日志中...</Text>
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
            <Empty description="暂无日志" />
          )}
      </div>
      </Modal>
      </div>
  );
};

export default App;
