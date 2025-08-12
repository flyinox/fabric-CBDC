const i18next = require('i18next');
const path = require('path');
const fs = require('fs');

// 支持的语言列表
const supportedLanguages = ['zh-CN', 'en-US', 'ja-JP'];

// 默认语言
const defaultLanguage = 'zh-CN';

// 初始化 i18next
function initI18n() {
  const resources = {};
  
  // 加载所有语言包
  supportedLanguages.forEach(lang => {
    try {
      const langPath = path.join(__dirname, 'locales', `${lang}.json`);
      if (fs.existsSync(langPath)) {
        const langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
        resources[lang] = {
          translation: langData
        };
      }
    } catch (error) {
      console.error(`Failed to load language pack for ${lang}:`, error);
    }
  });

  return i18next.init({
    resources,
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });
}

// 获取语言包
function getLanguagePack(lang) {
  try {
    const langPath = path.join(__dirname, 'locales', `${lang}.json`);
    if (fs.existsSync(langPath)) {
      return JSON.parse(fs.readFileSync(langPath, 'utf8'));
    }
  } catch (error) {
    console.error(`Failed to load language pack for ${lang}:`, error);
  }
  return null;
}

// 翻译函数
function t(key, options = {}) {
  return i18next.t(key, options);
}

// 切换语言
function changeLanguage(lang) {
  if (supportedLanguages.includes(lang)) {
    return i18next.changeLanguage(lang);
  }
  return Promise.reject(new Error(`Unsupported language: ${lang}`));
}

// 获取当前语言
function getCurrentLanguage() {
  return i18next.language;
}

// 获取支持的语言列表
function getSupportedLanguages() {
  return supportedLanguages;
}

module.exports = {
  initI18n,
  getLanguagePack,
  t,
  changeLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  supportedLanguages,
  defaultLanguage
};
