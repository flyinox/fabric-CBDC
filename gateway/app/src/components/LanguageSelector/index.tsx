import React, { useState } from 'react';
import { ActionSheet } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import './index.css';

interface LanguageSelectorProps {
  className?: string;
  style?: React.CSSProperties;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className, style }) => {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  const languages = [
    { label: '🇨🇳 简体中文', value: 'zh-CN' },
    { label: '🇺🇸 English', value: 'en-US' },
    { label: '🇯🇵 日本語', value: 'ja-JP' },
    { label: '🇸🇦 العربية', value: 'ar-SA' },
    { label: '🇷🇺 Русский', value: 'ru-RU' },
  ];

  const currentLang = i18n.language;
  const currentLanguage = languages.find(lang => lang.value === currentLang);

  const handleLanguageChange = (language: typeof languages[0]) => {
    if (language.value !== currentLang) {
      i18n.changeLanguage(language.value);
    }
    setVisible(false);
  };

  const actions = languages.map(lang => ({
    text: lang.label,
    key: lang.value,
    onClick: () => handleLanguageChange(lang)
  }));

  return (
    <div className={`language-selector-dropdown ${className || ''}`} style={style}>
      <div 
        className="language-selector-trigger"
        onClick={() => setVisible(true)}
      >
        🌐 {currentLanguage ? currentLanguage.label.split(' ')[1] || currentLanguage.label : '中文'}
      </div>
      
      <ActionSheet
        visible={visible}
        actions={actions}
        onClose={() => setVisible(false)}
        cancelText="取消"
      />
    </div>
  );
};

export default LanguageSelector;
