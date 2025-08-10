import React from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';

interface LanguageSelectorProps {
  className?: string;
  style?: React.CSSProperties;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className, style }) => {
  const { t, i18n } = useTranslation();

  const languages = [
    { label: '🇨🇳 简体中文', value: 'zh-CN' },
    { label: '🇺🇸 English', value: 'en-US' },
    { label: '🇯🇵 日本語', value: 'ja-JP' },
    { label: '🇸🇦 العربية', value: 'ar-SA' },
    { label: '🇷🇺 Русский', value: 'ru-RU' }
  ];

  const handleLanguageChange = (language: string) => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
    }
  };

  return (
    <div className={className} style={style}>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
        options={languages}
        suffixIcon={<GlobalOutlined />}
        style={{ minWidth: 120 }}
        size="small"
      />
    </div>
  );
};

export default LanguageSelector;
