import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言包
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import arSA from './locales/ar-SA.json';
import ruRU from './locales/ru-RU.json';

const resources = {
  'zh-CN': {
    translation: zhCN
  },
  'en-US': {
    translation: enUS
  },
  'ja-JP': {
    translation: jaJP
  },
  'ar-SA': {
    translation: arSA
  },
  'ru-RU': {
    translation: ruRU
  }
};

i18n
  .use(LanguageDetector) // 自动检测用户语言
  .use(initReactI18next) // 集成React
  .init({
    resources,
    fallbackLng: 'zh-CN', // 回退语言
    lng: 'zh-CN', // 默认语言
    
    detection: {
      // 优先级：localStorage > navigator language > fallback
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'], // 缓存到localStorage
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false // React已经默认转义
    },

    react: {
      useSuspense: false // 禁用Suspense，避免加载问题
    }
  });

export default i18n;
