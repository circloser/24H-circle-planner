/**
 * Lightweight i18n dictionary. Korean (ko) and English (en) are fully
 * translated for the app chrome; ja/zh/fr/es/ru cover the most visible strings
 * and fall back to English (then the key) for anything missing.
 */

export const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];

export type TKey =
  | 'header.mySchedules'
  | 'header.viewSlots'
  | 'header.saveAs'
  | 'header.presets'
  | 'header.export'
  | 'header.settings'
  | 'settings.title'
  | 'settings.language'
  | 'settings.font'
  | 'settings.fontFamily'
  | 'settings.fontSize'
  | 'settings.background'
  | 'settings.close'
  | 'size.small'
  | 'size.medium'
  | 'size.large'
  | 'bg.none'
  | 'bg.dots'
  | 'bg.grid'
  | 'bg.diagonal'
  | 'bg.gradient'
  | 'bg.paper'
  | 'bg.checker'
  | 'bg.waves'
  | 'bg.memo'
  | 'settings.bgPattern'
  | 'settings.bgColor'
  | 'settings.bgImage'
  | 'settings.uploadImage'
  | 'settings.removeImage'
  | 'theme.light'
  | 'theme.dark'
  | 'theme.system'
  | 'common.save'
  | 'common.cancel';

type Dict = Record<TKey, string>;

const ko: Dict = {
  'header.mySchedules': '내 시간표',
  'header.viewSlots': '내 시간표 보기',
  'header.saveAs': '다른 이름으로 저장…',
  'header.presets': '프리셋',
  'header.export': '내보내기',
  'header.settings': '설정',
  'settings.title': '설정',
  'settings.language': '언어',
  'settings.font': '폰트',
  'settings.fontFamily': '글꼴',
  'settings.fontSize': '글자 크기',
  'settings.background': '배경',
  'settings.close': '닫기',
  'size.small': '작게',
  'size.medium': '보통',
  'size.large': '크게',
  'bg.none': '없음',
  'bg.dots': '도트',
  'bg.grid': '그리드',
  'bg.diagonal': '대각선',
  'bg.gradient': '그라데이션',
  'bg.paper': '종이',
  'bg.checker': '체크',
  'bg.waves': '물결',
  'bg.memo': '메모지',
  'settings.bgPattern': '패턴',
  'settings.bgColor': '단색',
  'settings.bgImage': '이미지',
  'settings.uploadImage': '이미지 업로드',
  'settings.removeImage': '제거',
  'theme.light': '라이트',
  'theme.dark': '다크',
  'theme.system': '시스템',
  'common.save': '저장',
  'common.cancel': '취소',
};

const en: Dict = {
  'header.mySchedules': 'My Schedules',
  'header.viewSlots': 'View saved',
  'header.saveAs': 'Save as…',
  'header.presets': 'Presets',
  'header.export': 'Export',
  'header.settings': 'Settings',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.font': 'Font',
  'settings.fontFamily': 'Font family',
  'settings.fontSize': 'Font size',
  'settings.background': 'Background',
  'settings.close': 'Close',
  'size.small': 'Small',
  'size.medium': 'Medium',
  'size.large': 'Large',
  'bg.none': 'None',
  'bg.dots': 'Dots',
  'bg.grid': 'Grid',
  'bg.diagonal': 'Diagonal',
  'bg.gradient': 'Gradient',
  'bg.paper': 'Paper',
  'bg.checker': 'Checker',
  'bg.waves': 'Waves',
  'bg.memo': 'Memo',
  'settings.bgPattern': 'Pattern',
  'settings.bgColor': 'Solid color',
  'settings.bgImage': 'Image',
  'settings.uploadImage': 'Upload image',
  'settings.removeImage': 'Remove',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
};

// Skeleton languages — cover the most visible chrome; everything else falls
// back to English via the lookup chain.
const ja: Partial<Dict> = {
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

const zh: Partial<Dict> = {
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

const fr: Partial<Dict> = {
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

const es: Partial<Dict> = {
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

const ru: Partial<Dict> = {
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

export const TRANSLATIONS: Record<Lang, Partial<Dict>> = { ko, en, ja, zh, fr, es, ru };

/** Resolve a key for a language: lang → English → the key itself. */
export function translate(lang: Lang, key: TKey): string {
  return TRANSLATIONS[lang]?.[key] ?? en[key] ?? key;
}
