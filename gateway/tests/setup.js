// 测试设置文件
// 这里可以添加全局的测试配置

// 设置测试超时时间
jest.setTimeout(30000);

// 全局测试配置
global.console = {
  ...console,
  // 在测试中禁用某些 console 输出
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 