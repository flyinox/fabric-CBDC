import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Statistic, Button, Space, Tag, Modal, Spin, Empty, message, Typography } from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  ReloadOutlined, 
  DesktopOutlined, 
  SettingOutlined,
  EyeOutlined,
  UserOutlined
} from '@ant-design/icons';
import './App.css';

const { Content } = Layout;
const { Text } = Typography;

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

const App: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedNode, setSelectedNode] = useState('');

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

  const startNetwork = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/network/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
        },
      });
      const data = await response.json();
      if (response.ok) {
        message.success('网络启动成功');
        fetchNetworkStatus();
      } else {
        message.error(data.error || '网络启动失败');
      }
    } catch (error) {
      message.error('网络启动失败');
    } finally {
      setLoading(false);
    }
  };

  const stopNetwork = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/network/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic YWRtaW46YWRtaW4xMjM='
        },
      });
      const data = await response.json();
      if (response.ok) {
        message.success('网络停止成功');
        fetchNetworkStatus();
      } else {
        message.error(data.error || '网络停止失败');
      }
    } catch (error) {
      message.error('网络停止失败');
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
  }, []);

  const totalNodes = networkStatus?.nodes?.length || 0;
  const runningNodes = networkStatus?.nodes?.filter(node => node.status === 'running').length || 0;

  return (
    <div className="admin-layout">
      <div className="admin-header">
        <div className="header-content">
          <h1 className="header-title">CBDC 管理后台</h1>
          <p className="header-subtitle">央行数字货币网络管理系统</p>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchNetworkStatus}
          loading={loading}
          type="primary"
          ghost
        >
          刷新状态
        </Button>
      </div>
      
      <Content className="admin-content">
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
                prefix={<PlayCircleOutlined />}
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

        {/* 网络控制 */}
        <Card 
          title={
            <Space>
              <SettingOutlined />
              网络控制
            </Space>
          }
          className="control-card"
        >
          <div className="control-buttons">
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />}
              onClick={startNetwork}
              loading={loading}
              disabled={networkStatus?.status === 'running'}
            >
              启动网络
            </Button>
            
            <Button 
              danger
              icon={<StopOutlined />}
              onClick={stopNetwork}
              loading={loading}
              disabled={networkStatus?.status === 'stopped'}
            >
              停止网络
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

        {/* 快速操作 */}
        <Card 
          title={
            <Space>
              <UserOutlined />
              快速操作
            </Space>
          }
          className="quick-actions-card"
        >
          <Space>
            <Button 
              icon={<UserOutlined />}
              onClick={() => message.info('用户管理功能开发中...')}
            >
              用户管理
            </Button>
            
            <Button 
              icon={<SettingOutlined />}
              onClick={() => message.info('网络配置功能开发中...')}
            >
              网络配置
            </Button>
          </Space>
        </Card>
      </Content>

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
        width={800}
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
                  <Text type="secondary" className="log-time">
                    {log.timestamp}
                  </Text>
                  <Tag color={log.level === 'ERROR' ? 'red' : 
                              log.level === 'WARN' ? 'orange' : 
                              log.level === 'DEBUG' ? 'green' : 'blue'}>
                    {log.level}
                  </Tag>
                  <Text className="log-message">{log.message}</Text>
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
