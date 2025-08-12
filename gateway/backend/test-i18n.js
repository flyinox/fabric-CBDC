const { initI18n, t, changeLanguage, getCurrentLanguage, getSupportedLanguages } = require('./i18n');

async function testI18n() {
  console.log('=== 测试 i18n 功能 ===\n');
  
  // 初始化
  await initI18n();
  console.log('1. 初始化完成');
  console.log(`   当前语言: ${getCurrentLanguage()}`);
  console.log(`   支持的语言: ${getSupportedLanguages().join(', ')}\n`);
  
  // 测试中文
  console.log('2. 测试中文 (zh-CN):');
  console.log(`   健康消息: ${t('health.message')}`);
  console.log(`   认证错误: ${t('auth.needAuth')}`);
  console.log(`   网络状态: ${t('network.status')}\n`);
  
  // 切换到英文
  console.log('3. 切换到英文 (en-US):');
  await changeLanguage('en-US');
  console.log(`   当前语言: ${getCurrentLanguage()}`);
  console.log(`   健康消息: ${t('health.message')}`);
  console.log(`   认证错误: ${t('auth.needAuth')}`);
  console.log(`   网络状态: ${t('network.status')}\n`);
  
  // 切换到日文
  console.log('4. 切换到日文 (ja-JP):');
  await changeLanguage('ja-JP');
  console.log(`   当前语言: ${getCurrentLanguage()}`);
  console.log(`   健康消息: ${t('health.message')}`);
  console.log(`   认证错误: ${t('auth.needAuth')}`);
  console.log(`   网络状态: ${t('network.status')}\n`);
  
  // 切换回中文
  console.log('5. 切换回中文 (zh-CN):');
  await changeLanguage('zh-CN');
  console.log(`   当前语言: ${getCurrentLanguage()}`);
  console.log(`   健康消息: ${t('health.message')}`);
  console.log(`   认证错误: ${t('auth.needAuth')}`);
  console.log(`   网络状态: ${t('network.status')}\n`);
  
  console.log('=== 测试完成 ===');
}

// 运行测试
testI18n().catch(console.error);
