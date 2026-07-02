/**
 * Partial dictionaries — cover the most visible chrome only and fall back to
 * English (then the key) for anything missing. See translate().
 */
import type { TKey } from './ko';

export const ja: Partial<Record<TKey, string>> = {
  'header.mySchedules': 'マイ時間割',
  'header.presets': 'プリセット',
  'header.export': 'エクスポート',
  'header.settings': '設定',
  'settings.title': '設定',
  'settings.language': '言語',
  'settings.font': 'フォント',
  'settings.fontFamily': '書体',
  'settings.fontSize': '文字サイズ',
  'settings.background': '背景',
};

export const zh: Partial<Record<TKey, string>> = {
  'header.mySchedules': '我的时间表',
  'header.presets': '预设',
  'header.export': '导出',
  'header.settings': '设置',
  'settings.title': '设置',
  'settings.language': '语言',
  'settings.font': '字体',
  'settings.fontFamily': '字体',
  'settings.fontSize': '字号',
  'settings.background': '背景',
};

export const fr: Partial<Record<TKey, string>> = {
  'header.mySchedules': 'Mes plannings',
  'header.presets': 'Préréglages',
  'header.export': 'Exporter',
  'header.settings': 'Paramètres',
  'settings.title': 'Paramètres',
  'settings.language': 'Langue',
  'settings.font': 'Police',
  'settings.fontFamily': 'Police',
  'settings.fontSize': 'Taille du texte',
  'settings.background': 'Arrière-plan',
};

export const es: Partial<Record<TKey, string>> = {
  'header.mySchedules': 'Mis horarios',
  'header.presets': 'Ajustes',
  'header.export': 'Exportar',
  'header.settings': 'Ajustes',
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.font': 'Fuente',
  'settings.fontFamily': 'Fuente',
  'settings.fontSize': 'Tamaño de texto',
  'settings.background': 'Fondo',
};

export const ru: Partial<Record<TKey, string>> = {
  'header.mySchedules': 'Мои расписания',
  'header.presets': 'Пресеты',
  'header.export': 'Экспорт',
  'header.settings': 'Настройки',
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.font': 'Шрифт',
  'settings.fontFamily': 'Шрифт',
  'settings.fontSize': 'Размер текста',
  'settings.background': 'Фон',
};
