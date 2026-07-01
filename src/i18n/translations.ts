/**
 * Lightweight i18n dictionary. Korean (ko) and English (en) are fully
 * translated; ja/zh/fr/es/ru cover the most visible chrome and fall back to
 * English (then the key) for anything missing.
 *
 * Korean values MUST stay byte-identical to the strings the component tests
 * assert (tests render without a PreferencesProvider, so t() resolves to ko).
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
  | 'header.design'
  | 'footer.guides'
  | 'footer.stories'
  | 'footer.faq'
  | 'footer.about'
  | 'footer.privacy'
  | 'footer.contact'
  | 'settings.title'
  | 'settings.language'
  | 'settings.font'
  | 'settings.fontFamily'
  | 'settings.fontSize'
  | 'settings.background'
  | 'settings.close'
  | 'settings.bgPattern'
  | 'settings.bgColor'
  | 'settings.bgImage'
  | 'settings.uploadImage'
  | 'settings.removeImage'
  | 'settings.icons'
  | 'settings.iconsShow'
  | 'settings.iconsHide'
  | 'settings.colorTheme'
  | 'settings.reset'
  | 'settings.resetBody'
  | 'settings.resetConfirm'
  | 'settings.clock'
  | 'settings.clockDigital'
  | 'settings.clockNowLine'
  | 'settings.timeline'
  | 'settings.lineColor'
  | 'settings.lineWidth'
  | 'settings.lineReset'
  | 'settings.lineRemove'
  | 'settings.worldClocks'
  | 'settings.addLine'
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
  | 'theme.light'
  | 'theme.dark'
  | 'theme.system'
  | 'theme.lightMode'
  | 'theme.darkMode'
  | 'theme.systemMode'
  | 'common.save'
  | 'common.cancel'
  | 'preset.galleryTitle'
  | 'preset.galleryDesc'
  | 'preset.applyTitle'
  | 'preset.applyBody'
  | 'preset.applyConfirm'
  | 'preset.themeOriginal'
  | 'export.resolution'
  | 'export.transparentBg'
  | 'export.png'
  | 'export.pdf'
  | 'export.pdfNote'
  | 'export.jsonExport'
  | 'export.jsonImport'
  | 'export.importTitle'
  | 'export.importBody'
  | 'export.importConfirm'
  | 'export.svgNotFound'
  | 'export.pngDone'
  | 'export.pngFail'
  | 'export.pdfDone'
  | 'export.pdfFail'
  | 'export.jsonDone'
  | 'export.jsonFail'
  | 'export.jsonImportFail'
  | 'export.imported'
  | 'export.preview'
  | 'export.tableImage'
  | 'export.tableImageNote'
  | 'export.csvSave'
  | 'export.csvNote'
  | 'export.adLabel'
  | 'header.savePreset'
  | 'preset.myPresets'
  | 'preset.saveTitle'
  | 'preset.saveName'
  | 'preset.savePlaceholder'
  | 'preset.saved'
  | 'preset.deletePreset'
  | 'day.add'
  | 'day.delete'
  | 'day.indicator'
  | 'day.thumb'
  | 'day.addTitle'
  | 'day.addBody'
  | 'day.addDuplicate'
  | 'day.addEmpty'
  | 'day.addPreset'
  | 'app.saved'
  | 'app.saving'
  | 'export.backup'
  | 'export.range'
  | 'export.rangeStart'
  | 'export.rangeEnd'
  | 'export.rangeCircle'
  | 'export.rangeTable'
  | 'export.rangeImage'
  | 'export.rangeCsv'
  | 'export.rangeCount'
  | 'export.rangeEmpty'
  | 'export.rangeSaved'
  | 'export.rangeFailed'
  | 'export.backupNote'
  | 'export.backupExport'
  | 'export.backupRestore'
  | 'export.backupDone'
  | 'export.backupFail'
  | 'export.restoreTitle'
  | 'export.restoreBody'
  | 'export.restoreConfirm'
  | 'export.restored'
  | 'export.restoreFail'
  | 'day.deleteTitle'
  | 'day.deleteBody'
  | 'day.deleteConfirm'
  | 'day.max'
  | 'memo.clearAll'
  | 'memo.clearTitle'
  | 'memo.clearBody'
  | 'memo.clearConfirm'
  | 'slot.atCapacity'
  | 'slot.emptyPre'
  | 'slot.saveAsInline'
  | 'slot.emptyPost'
  | 'slot.load'
  | 'slot.delete'
  | 'slot.rename'
  | 'slot.renameEdit'
  | 'slot.renameSave'
  | 'slot.renameCancel'
  | 'slot.loadTitle'
  | 'slot.loadBody'
  | 'slot.deleteTitle'
  | 'slot.deleteBody'
  | 'saveAs.title'
  | 'saveAs.placeholder'
  | 'saveAs.nameLabel'
  | 'saveAs.capacity'
  | 'saveAs.saved'
  | 'saveAs.copySuffix'
  | 'hub.editTitle'
  | 'hub.titleLabel'
  | 'hub.placeholder'
  | 'circle.emptyHint'
  | 'circle.ariaTimeline'
  | 'app.loaded'
  | 'memo.add'
  | 'memo.placeholderHint'
  | 'memo.title'
  | 'mobile.editHint'
  | 'block.add'
  | 'block.addTitle'
  | 'block.name'
  | 'block.namePlaceholder'
  | 'block.start'
  | 'block.end'
  | 'block.color'
  | 'block.invalid'
  | 'welcome.title'
  | 'welcome.subtitle'
  | 'welcome.howto'
  | 'welcome.gClick'
  | 'welcome.gDrag'
  | 'welcome.gEdit'
  | 'welcome.gTap'
  | 'welcome.gAdd'
  | 'welcome.startPreset'
  | 'welcome.startBlank'
  | 'empty.heroTitle'
  | 'empty.heroCta'
  | 'transfer.menu'
  | 'transfer.title'
  | 'transfer.body'
  | 'transfer.note'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.welcome'
  | 'auth.signedOut'
  | 'auth.loginFailed'
  | 'sync.synced'
  | 'sync.syncing'
  | 'sync.offline'
  | 'sync.error'
  | 'sync.appliedFromCloud'
  | 'sync.undo'
  | 'goals.open'
  | 'goals.title'
  | 'goals.empty'
  | 'goals.add'
  | 'goals.labelPlaceholder'
  | 'goals.periodDay'
  | 'goals.periodWeek'
  | 'goals.hUnit'
  | 'goals.mUnit'
  | 'goals.hm'
  | 'goals.delete'
  | 'goals.untitled'
  | 'goals.hoursLabel'
  | 'goals.minutesLabel'
  | 'goals.pickLabel'
  | 'goals.noLabels'
  | 'goals.saveDiaryHint'
  | 'sharelink.copy'
  | 'sharelink.copied'
  | 'sharelink.copyFail'
  | 'sharelink.importTitle'
  | 'sharelink.importBody'
  | 'sharelink.importConfirm'
  | 'analytics.open'
  | 'analytics.title'
  | 'analytics.subtitle'
  | 'analytics.trend'
  | 'analytics.empty'
  | 'analytics.untitled'
  | 'cat.sleep'
  | 'cat.work'
  | 'cat.meal'
  | 'cat.leisure'
  | 'cat.commute'
  | 'cat.other'
  | 'diary.open'
  | 'diary.title'
  | 'diary.saveToday'
  | 'diary.saved'
  | 'diary.loaded'
  | 'diary.deleted'
  | 'diary.empty'
  | 'diary.delete'
  | 'diary.today'
  | 'diary.locked'
  | 'diary.unlock'
  | 'diary.lock'
  | 'diary.unlockedToast'
  | 'diary.relocked'
  | 'diary.confirmSaveTitle'
  | 'diary.confirmSave'
  | 'diary.confirmSaveBody'
  | 'diary.confirmOverwriteBody'
  | 'diary.confirmSaveCta'
  | 'diary.confirmLoadTitle'
  | 'diary.confirmLoad'
  | 'diary.confirmLoadBody'
  | 'diary.confirmLoadCta'
  | 'diary.confirmDeleteTitle'
  | 'diary.confirmDelete'
  | 'diary.confirmDeleteBody'
  | 'diary.confirmDeleteCta'
  | 'diary.note'
  | 'diary.addNoteTitle'
  | 'diary.addNotePrompt'
  | 'diary.notePlaceholder'
  | 'diary.noteSave'
  | 'diary.noteSkip'
  | 'diary.noteSaved'
  | 'diary.noteChars'
  | 'diary.noteEditable'
  | 'diary.prevDay'
  | 'diary.nextDay'
  | 'diary.hasNote'
  | 'diary.exit'
  | 'diary.exited'
  | 'analytics.scopeCurrent'
  | 'analytics.scopeAll'
  | 'analytics.scopeDiary'
  | 'analytics.rangeAll'
  | 'analytics.rangeMonth'
  | 'analytics.rangeWeek'
  | 'memo.delete'
  | 'memo.placeholder'
  | 'memo.show'
  | 'memo.hide'
  | 'view.full'
  | 'view.day'
  | 'view.night'
  | 'view.table'
  | 'view.cycle'
  | 'view.record'
  | 'record.labelPlaceholder'
  | 'record.start'
  | 'record.stop'
  | 'record.cancel'
  | 'record.recording'
  | 'record.or'
  | 'record.add'
  | 'record.empty'
  | 'record.delete'
  | 'record.clear'
  | 'record.minOnly'
  | 'record.untitled'
  | 'record.startTime'
  | 'record.endTime'
  | 'table.csv'
  | 'table.image'
  | 'table.reorder'
  | 'table.exported'
  | 'share.button'
  | 'share.text'
  | 'share.saved'
  | 'share.noChart'
  | 'share.fail'
  | 'home.button'
  | 'home.title'
  | 'home.body'
  | 'home.install'
  | 'home.installed'
  | 'home.copyLink'
  | 'home.copied'
  | 'clock.tools'
  | 'clock.clock'
  | 'clock.timer'
  | 'clock.alarm'
  | 'clock.analog'
  | 'clock.digital'
  | 'clock.start'
  | 'clock.pause'
  | 'clock.reset'
  | 'clock.clear'
  | 'clock.close'
  | 'clock.alarmTime'
  | 'clock.alarmOn'
  | 'clock.alarmOff'
  | 'clock.timerDone'
  | 'clock.alarmRing'
  | 'clock.calendar'
  | 'clock.today'
  | 'clock.weather'
  | 'clock.weatherSearch'
  | 'clock.weatherSet'
  | 'clock.weatherEmpty'
  | 'clock.weatherError'
  | 'clock.weatherRefresh'
  | 'clock.myLocation'
  | 'memo.list'
  | 'memo.listTitle'
  | 'memo.listDesc'
  | 'memo.listEmpty'
  | 'memo.restore'
  | 'memo.hideFromScreen'
  | 'memo.deleteForever'
  | 'memo.alignLeft'
  | 'memo.alignCenter'
  | 'rim.placeholder'
  | 'rim.delete'
  | 'rim.move'
  | 'about.open';

type Dict = Record<TKey, string>;

const ko: Dict = {
  'header.mySchedules': '내 시간표',
  'header.viewSlots': '내 시간표 보기',
  'header.saveAs': '다른 이름으로 저장…',
  'header.presets': '프리셋',
  'header.export': '내보내기',
  'header.settings': '설정',
  'header.design': '디자인',
  'footer.guides': '가이드',
  'footer.stories': '스토리',
  'footer.faq': 'FAQ',
  'footer.about': '소개',
  'footer.privacy': '개인정보처리방침',
  'footer.contact': '문의',
  'settings.title': '설정',
  'settings.language': '언어',
  'settings.font': '폰트',
  'settings.fontFamily': '글꼴',
  'settings.fontSize': '글자 크기',
  'settings.background': '배경',
  'settings.close': '닫기',
  'settings.bgPattern': '패턴',
  'settings.bgColor': '단색',
  'settings.bgImage': '이미지',
  'settings.uploadImage': '이미지 업로드',
  'settings.removeImage': '제거',
  'settings.icons': '아이콘',
  'settings.iconsShow': '표시',
  'settings.iconsHide': '숨김',
  'settings.colorTheme': '색상 테마',
  'settings.reset': '전체 초기화',
  'settings.resetBody': '모든 데이터(시간표·날짜·메모·설정·프리셋·백업)가 삭제되고 처음 상태로 돌아갑니다. 초기화하시겠습니까?',
  'settings.resetConfirm': '초기화',
  'settings.clock': '시계',
  'settings.clockDigital': '디지털 시계',
  'settings.clockNowLine': '현재 시간선',
  'settings.timeline': '시간선',
  'settings.lineColor': '선 색상',
  'settings.lineWidth': '선 두께',
  'settings.lineReset': '기본값',
  'settings.lineRemove': '시간선 삭제',
  'settings.worldClocks': '세계 시간선',
  'settings.addLine': '추가',
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
  'theme.light': '라이트',
  'theme.dark': '다크',
  'theme.system': '시스템',
  'theme.lightMode': '라이트 모드',
  'theme.darkMode': '다크 모드',
  'theme.systemMode': '시스템 설정',
  'common.save': '저장',
  'common.cancel': '취소',
  'preset.galleryTitle': '라이프스타일 프리셋',
  'preset.galleryDesc': '원하는 루틴을 선택하면 적용 여부를 확인한 뒤 현재 시간표에 반영됩니다.',
  'preset.applyTitle': '{name} 적용',
  'preset.applyBody': "'{name}' 프리셋을 현재 시간표에 적용할까요? 기존 시간표는 덮어쓰여집니다.",
  'preset.applyConfirm': '현재 창에 적용',
  'preset.themeOriginal': '원본',
  'export.resolution': '해상도',
  'export.transparentBg': '투명 배경',
  'export.png': 'PNG 내보내기',
  'export.pdf': 'PDF 내보내기',
  'export.pdfNote': 'A4 세로 300 DPI (210×297mm)',
  'export.jsonExport': 'JSON 내보내기',
  'export.jsonImport': 'JSON 가져오기',
  'export.importTitle': '시간표 가져오기',
  'export.importBody': '기존 시간표가 덮어쓰여집니다. 가져올까요?',
  'export.importConfirm': '가져오기',
  'export.svgNotFound': 'SVG 요소를 찾을 수 없습니다',
  'export.pngDone': 'PNG 내보내기 완료',
  'export.pngFail': 'PNG 내보내기 실패',
  'export.pdfDone': 'PDF 내보내기 완료',
  'export.pdfFail': 'PDF 내보내기 실패',
  'export.jsonDone': 'JSON 내보내기 완료',
  'export.jsonFail': 'JSON 내보내기 실패',
  'export.jsonImportFail': 'JSON 가져오기 실패',
  'export.imported': '시간표를 가져왔습니다',
  'export.preview': '미리보기',
  'export.tableImage': '표 이미지로 저장',
  'export.tableImageNote': '현재 표를 이미지(PNG)로 저장합니다.',
  'export.csvSave': 'CSV로 저장',
  'export.csvNote': '시작·끝·항목을 CSV 파일로 내보냅니다.',
  'export.adLabel': '광고',
  'header.savePreset': '프리셋으로 저장',
  'preset.myPresets': '내 프리셋',
  'preset.saveTitle': '프리셋으로 저장',
  'preset.saveName': '프리셋 이름',
  'preset.savePlaceholder': '예: 나의 평일 루틴',
  'preset.saved': '"{name}" 프리셋으로 저장했습니다',
  'preset.deletePreset': '프리셋 삭제',
  'day.add': '날짜 추가',
  'day.delete': '이 날짜 삭제',
  'day.indicator': '{n}일 중 {m}일',
  'day.thumb': '{m}일째',
  'day.addTitle': '날짜 추가',
  'day.addBody': '새 날짜를 어떻게 시작할까요?',
  'day.addDuplicate': '현재 시간표 복제',
  'day.addEmpty': '빈 시간표',
  'day.addPreset': '프리셋에서 선택',
  'app.saved': '저장됨',
  'app.saving': '저장 중…',
  'export.backup': '백업',
  'export.range': '기간',
  'export.rangeStart': '시작 날짜',
  'export.rangeEnd': '종료 날짜',
  'export.rangeCircle': '원형',
  'export.rangeTable': '표',
  'export.rangeImage': '이미지로 저장',
  'export.rangeCsv': 'CSV로 저장',
  'export.rangeCount': '이 기간에 저장된 일기 {n}개',
  'export.rangeEmpty': '선택한 기간에 저장된 일기가 없어요',
  'export.rangeSaved': '{n}일 분량을 저장했어요',
  'export.rangeFailed': '내보내기에 실패했어요',
  'export.backupNote': '데이터는 이 브라우저에만 저장됩니다. 백업 파일로 저장해 두면 다른 기기로 옮기거나 복구할 수 있어요.',
  'export.backupExport': '전체 백업 내보내기',
  'export.backupRestore': '백업에서 복원',
  'export.backupDone': '백업을 내보냈습니다',
  'export.backupFail': '백업 내보내기 실패',
  'export.restoreTitle': '백업에서 복원',
  'export.restoreBody': '현재 기기의 모든 데이터가 백업 내용으로 덮어쓰여집니다. 복원할까요?',
  'export.restoreConfirm': '복원',
  'export.restored': '복원했습니다. 새로고침합니다…',
  'export.restoreFail': '복원 실패',
  'day.deleteTitle': '날짜 삭제',
  'day.deleteBody': '이 날짜의 시간표가 삭제됩니다. 삭제할까요?',
  'day.deleteConfirm': '삭제',
  'day.max': '최대 20일까지 추가할 수 있어요',
  'memo.clearAll': '메모 모두 삭제',
  'memo.clearTitle': '메모 모두 삭제',
  'memo.clearBody': '모든 메모가 삭제됩니다. 삭제할까요?',
  'memo.clearConfirm': '모두 삭제',
  'slot.atCapacity': '최대 10개 슬롯에 도달했습니다. 새 슬롯을 저장하려면 기존 슬롯을 삭제하세요.',
  'slot.emptyPre': '저장된 시간표가 없습니다. ',
  'slot.saveAsInline': '다른 이름으로 저장',
  'slot.emptyPost': '으로 추가해보세요.',
  'slot.load': '불러오기',
  'slot.delete': '삭제',
  'slot.rename': '이름 변경',
  'slot.renameEdit': '슬롯 이름 편집',
  'slot.renameSave': '이름 저장',
  'slot.renameCancel': '이름 편집 취소',
  'slot.loadTitle': '시간표 불러오기',
  'slot.loadBody': "기존 시간표가 덮어쓰여집니다. '{name}'을(를) 불러올까요?",
  'slot.deleteTitle': '슬롯 삭제',
  'slot.deleteBody': "'{name}'을(를) 삭제할까요?",
  'saveAs.title': '다른 이름으로 저장',
  'saveAs.placeholder': '시간표 이름',
  'saveAs.nameLabel': '슬롯 이름',
  'saveAs.capacity': '최대 10개 슬롯입니다. 기존 슬롯을 먼저 삭제하세요.',
  'saveAs.saved': '"{name}"이(가) 저장되었습니다',
  'saveAs.copySuffix': '(사본)',
  'hub.editTitle': '시간표 제목 편집',
  'hub.titleLabel': '시간표 제목',
  'hub.placeholder': '예: 평일 루틴',
  'circle.emptyHint': '프리셋을 선택하거나 빈 영역을 클릭해 시작하세요',
  'circle.ariaTimeline': '24시간 원형 타임라인',
  'app.loaded': '{name}을(를) 불러왔습니다',
  'memo.add': '메모 추가',
  'memo.placeholderHint': '메모를 추가할 수 있습니다',
  'memo.title': '메모',
  'mobile.editHint': '항목을 탭하면 편집 · 아래 + 버튼으로 시간 추가',
  'block.add': '일정 추가',
  'block.addTitle': '일정 추가',
  'block.name': '이름',
  'block.namePlaceholder': '예: 오전 업무',
  'block.start': '시작 시간',
  'block.end': '끝 시간',
  'block.color': '색상',
  'block.invalid': '시작과 끝 시간을 다르게 입력하세요.',
  'welcome.title': '하루를 한눈에, 원형 시간표',
  'welcome.subtitle': '아래 예시를 바로 바꾸거나, 프리셋으로 30초 만에 시작하세요.',
  'welcome.howto': '편집하는 법',
  'welcome.gClick': '클릭 — 시간대 나누기',
  'welcome.gDrag': '경계 드래그 — 시간 조절',
  'welcome.gEdit': '더블클릭 — 이름·색·아이콘',
  'welcome.gTap': '탭 — 이름·색·아이콘 편집',
  'welcome.gAdd': '+ 일정 추가 — 시작·끝 시간 입력',
  'welcome.startPreset': '프리셋으로 시작',
  'welcome.startBlank': '직접 편집',
  'empty.heroTitle': '시간표가 비어 있어요',
  'empty.heroCta': '프리셋으로 30초 만에 시작',
  'sharelink.copy': '링크 복사',
  'sharelink.copied': '시간표 링크가 복사되었어요',
  'sharelink.copyFail': '링크 복사에 실패했어요',
  'transfer.menu': '다른 기기로 (QR)',
  'transfer.title': '다른 기기로 보내기',
  'transfer.body': '다른 기기의 카메라로 이 QR을 스캔하면 현재 시간표를 가져옵니다.',
  'transfer.note': '여러 날짜·일기·메모 등 전체 데이터는 내보내기 → 백업을 이용하세요.',
  'auth.login': '구글로 로그인',
  'auth.logout': '로그아웃',
  'auth.welcome': '로그인되었습니다',
  'auth.signedOut': '로그아웃되었습니다',
  'auth.loginFailed': '로그인에 실패했습니다',
  'sync.synced': '동기화됨',
  'sync.syncing': '동기화 중…',
  'sync.offline': '오프라인',
  'sync.error': '동기화 오류',
  'sync.appliedFromCloud': '클라우드에서 동기화되었습니다',
  'sync.undo': '되돌리기',
  'goals.open': '목표/미션',
  'goals.title': '목표 · 미션',
  'goals.empty': '아직 목표가 없습니다. 운동·공부처럼 시간 목표를 추가해 보세요.',
  'goals.add': '목표 추가',
  'goals.labelPlaceholder': '항목명 (예: 운동, 공부)',
  'goals.periodDay': '하루',
  'goals.periodWeek': '주간',
  'goals.hUnit': '시간',
  'goals.mUnit': '분',
  'goals.hm': '{h}시간 {m}분',
  'goals.delete': '삭제',
  'goals.untitled': '(이름 없음)',
  'goals.hoursLabel': '시간',
  'goals.minutesLabel': '분',
  'goals.pickLabel': '시간표 항목 선택',
  'goals.noLabels': '먼저 시간표에 항목(라벨)을 입력해 주세요.',
  'goals.saveDiaryHint': '오늘 일기를 저장하면 하루 목표에 반영돼요.',
  'sharelink.importTitle': '공유된 시간표 불러오기',
  'sharelink.importBody': '링크로 공유된 시간표를 불러올까요? 현재 시간표가 대체됩니다.',
  'sharelink.importConfirm': '불러오기',
  'analytics.open': '시간 분석',
  'analytics.title': '시간 분석',
  'analytics.subtitle': '{n}일 기준 · 하루 평균',
  'analytics.trend': '일별 추세',
  'analytics.empty': '저장된 일기가 없어요. 일기를 저장하면 시간 분석에 반영돼요.',
  'analytics.untitled': '(제목 없음)',
  'cat.sleep': '수면',
  'cat.work': '업무·학업',
  'cat.meal': '식사',
  'cat.leisure': '여가',
  'cat.commute': '이동',
  'cat.other': '기타',
  'diary.open': '일기',
  'diary.title': '시간표 일기',
  'diary.saveToday': '오늘 저장',
  'diary.saved': '오늘 시간표를 일기에 저장했어요',
  'diary.loaded': '일기에서 불러왔어요',
  'diary.deleted': '일기에서 삭제했어요',
  'diary.empty': '날짜를 눌러 그날의 시간표를 기록하세요.',
  'diary.delete': '삭제',
  'diary.today': '오늘',
  'diary.locked': '🔒 보호된 일기예요. 편집하려면 잠금을 해제하세요.',
  'diary.unlock': '잠금 해제',
  'diary.lock': '잠금',
  'diary.unlockedToast': '잠금을 해제했어요. 이제 편집할 수 있어요.',
  'diary.relocked': '다시 잠갔어요.',
  'diary.confirmSaveTitle': '일기 저장',
  'diary.confirmSave': '일기를 저장하시겠습니까?',
  'diary.confirmSaveBody': '{date}에 현재 시간표를 일기로 기록합니다.',
  'diary.confirmOverwriteBody': '{date}에 이미 저장된 일기를 덮어씁니다.',
  'diary.confirmSaveCta': '저장',
  'diary.confirmLoadTitle': '일기 불러오기',
  'diary.confirmLoad': '일기를 불러오시겠습니까?',
  'diary.confirmLoadBody': '현재 시간표가 {date} 기록으로 바뀌고 잠깁니다.',
  'diary.confirmLoadCta': '불러오기',
  'diary.confirmDeleteTitle': '일기 삭제',
  'diary.confirmDelete': '저장된 일기를 삭제합니다.',
  'diary.confirmDeleteBody': '{date}의 일기를 삭제할까요? 삭제하면 되돌릴 수 없습니다.',
  'diary.confirmDeleteCta': '삭제',
  'diary.note': '노트',
  'diary.addNoteTitle': '노트 추가',
  'diary.addNotePrompt': '{date}에 텍스트(노트)를 추가하시겠습니까?',
  'diary.notePlaceholder': '오늘 하루를 자유롭게 기록하세요…',
  'diary.noteSave': '노트 저장',
  'diary.noteSkip': '건너뛰기',
  'diary.noteSaved': '노트가 저장되었습니다',
  'diary.noteChars': '{n}자',
  'diary.noteEditable': '수정 가능',
  'diary.prevDay': '이전 일기',
  'diary.nextDay': '다음 일기',
  'diary.hasNote': '노트 있음',
  'diary.exit': '일기 나가기',
  'diary.exited': '시간표 편집 모드로 돌아왔어요',
  'analytics.scopeCurrent': '현재 시간표',
  'analytics.scopeAll': '전체 일정',
  'analytics.scopeDiary': '일기',
  'analytics.rangeAll': '전체',
  'analytics.rangeMonth': '최근 1달',
  'analytics.rangeWeek': '최근 1주일',
  'memo.delete': '메모 삭제',
  'memo.placeholder': '메모를 입력하세요',
  'memo.show': '메모 보이기',
  'memo.hide': '메모 숨기기',
  'view.full': '24시간',
  'view.day': '낮 6–18',
  'view.night': '밤 18–6',
  'view.table': '표',
  'view.cycle': '시간표 보기 전환 (24시간 → 낮 → 밤 → 표)',
  'view.record': '기록',
  'record.labelPlaceholder': '무엇을 기록할까요? (예: 운동, 공부)',
  'record.start': '시작',
  'record.stop': '종료',
  'record.cancel': '취소',
  'record.recording': '기록 중',
  'record.or': '또는',
  'record.add': '추가',
  'record.empty': '아직 기록이 없습니다. 시작을 눌러 실시간으로 기록하세요.',
  'record.delete': '삭제',
  'record.clear': '오늘 기록 모두 지우기',
  'record.minOnly': '{m}분',
  'record.untitled': '(이름 없음)',
  'record.startTime': '시작 시간',
  'record.endTime': '종료 시간',
  'table.csv': 'CSV',
  'table.image': '이미지',
  'table.reorder': '순서 변경',
  'table.exported': '내보냈어요',
  'share.button': '공유하기',
  'share.text': '내 하루 시간표 — 24Houring',
  'share.saved': '시간표 이미지를 저장했어요. 인스타그램 등에 올려보세요!',
  'share.noChart': '공유할 시간표를 찾을 수 없습니다.',
  'share.fail': '공유에 실패했습니다',
  'home.button': '첫 화면에 추가',
  'home.title': '브라우저 첫 화면에 추가',
  'home.body': '24Houring을 앱처럼 빠르게 열 수 있어요. 모바일은 공유 메뉴에서 “홈 화면에 추가”, 데스크톱은 주소창의 설치 아이콘 또는 브라우저 메뉴 → “앱으로 설치/바로가기 만들기”를 선택하세요.',
  'home.install': '지금 설치',
  'home.installed': '설치되었습니다',
  'home.copyLink': '주소 복사',
  'home.copied': '주소를 복사했어요',
  'clock.tools': '시계 도구',
  'clock.clock': '시계',
  'clock.timer': '타이머',
  'clock.alarm': '알람',
  'clock.analog': '아날로그',
  'clock.digital': '디지털',
  'clock.start': '시작',
  'clock.pause': '일시정지',
  'clock.reset': '초기화',
  'clock.clear': '지우기',
  'clock.close': '닫기',
  'clock.alarmTime': '알람 시각',
  'clock.alarmOn': '켜짐',
  'clock.alarmOff': '꺼짐',
  'clock.timerDone': '⏰ 타이머 종료!',
  'clock.alarmRing': '⏰ 알람!',
  'clock.calendar': '캘린더',
  'clock.today': '오늘',
  'clock.weather': '날씨',
  'clock.weatherSearch': '도시 검색',
  'clock.weatherSet': '지역 설정',
  'clock.weatherEmpty': '지역을 검색해 설정하세요.',
  'clock.weatherError': '날씨를 불러오지 못했습니다.',
  'clock.weatherRefresh': '새로고침',
  'clock.myLocation': '현재 위치',
  'memo.list': '메모 목록',
  'memo.listTitle': '메모 목록',
  'memo.listDesc': '화면에서 지운 메모도 여기에 남아 있어요. 눈 아이콘으로 화면 표시를 켜고 끄고, 휴지통으로 완전히 삭제합니다.',
  'memo.listEmpty': '아직 메모가 없습니다.',
  'memo.restore': '화면에 표시',
  'memo.hideFromScreen': '화면에서 숨김',
  'memo.deleteForever': '완전 삭제',
  'memo.alignLeft': '왼쪽 정렬',
  'memo.alignCenter': '가운데 정렬',
  'rim.placeholder': '메모…',
  'rim.delete': '메모 삭제',
  'rim.move': '테두리 따라 이동',
  'about.open': '24Houring 소개 · 사용 안내',
};

const en: Dict = {
  'header.mySchedules': 'My Schedules',
  'header.viewSlots': 'View saved',
  'header.saveAs': 'Save as…',
  'header.presets': 'Presets',
  'header.export': 'Export',
  'header.settings': 'Settings',
  'header.design': 'Design',
  'footer.guides': 'Guides',
  'footer.stories': 'Stories',
  'footer.faq': 'FAQ',
  'footer.about': 'About',
  'footer.privacy': 'Privacy Policy',
  'footer.contact': 'Contact',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.font': 'Font',
  'settings.fontFamily': 'Font family',
  'settings.fontSize': 'Font size',
  'settings.background': 'Background',
  'settings.close': 'Close',
  'settings.bgPattern': 'Pattern',
  'settings.bgColor': 'Solid color',
  'settings.bgImage': 'Image',
  'settings.uploadImage': 'Upload image',
  'settings.removeImage': 'Remove',
  'settings.icons': 'Icons',
  'settings.iconsShow': 'Show',
  'settings.iconsHide': 'Hide',
  'settings.colorTheme': 'Color theme',
  'settings.reset': 'Reset all',
  'settings.resetBody': 'All data (schedules, days, memos, settings, presets, backups) will be deleted and the app returns to its initial state. Reset?',
  'settings.resetConfirm': 'Reset',
  'settings.clock': 'Clock',
  'settings.clockDigital': 'Digital clock',
  'settings.clockNowLine': 'Current-time line',
  'settings.timeline': 'Time lines',
  'settings.lineColor': 'Line color',
  'settings.lineWidth': 'Line width',
  'settings.lineReset': 'Default',
  'settings.lineRemove': 'Remove time line',
  'settings.worldClocks': 'World time lines',
  'settings.addLine': 'Add',
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
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'theme.lightMode': 'Light mode',
  'theme.darkMode': 'Dark mode',
  'theme.systemMode': 'System',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'preset.galleryTitle': 'Lifestyle presets',
  'preset.galleryDesc':
    "Pick a routine; you'll confirm before it's applied to your current schedule.",
  'preset.applyTitle': 'Apply {name}',
  'preset.applyBody':
    'Apply the "{name}" preset to your current schedule? This overwrites your current schedule.',
  'preset.applyConfirm': 'Apply to current',
  'preset.themeOriginal': 'Original',
  'export.resolution': 'Resolution',
  'export.transparentBg': 'Transparent background',
  'export.png': 'Export PNG',
  'export.pdf': 'Export PDF',
  'export.pdfNote': 'A4 portrait 300 DPI (210×297mm)',
  'export.jsonExport': 'Export JSON',
  'export.jsonImport': 'Import JSON',
  'export.importTitle': 'Import schedule',
  'export.importBody': 'This will overwrite your current schedule. Import?',
  'export.importConfirm': 'Import',
  'export.svgNotFound': 'SVG element not found',
  'export.pngDone': 'PNG exported',
  'export.pngFail': 'PNG export failed',
  'export.pdfDone': 'PDF exported',
  'export.pdfFail': 'PDF export failed',
  'export.jsonDone': 'JSON exported',
  'export.jsonFail': 'JSON export failed',
  'export.jsonImportFail': 'JSON import failed',
  'export.imported': 'Schedule imported',
  'export.preview': 'Preview',
  'export.tableImage': 'Save table image',
  'export.tableImageNote': 'Save the current table as an image (PNG).',
  'export.csvSave': 'Save as CSV',
  'export.csvNote': 'Export start, end and label as a CSV file.',
  'export.adLabel': 'Advertisement',
  'header.savePreset': 'Save as preset',
  'preset.myPresets': 'My presets',
  'preset.saveTitle': 'Save as preset',
  'preset.saveName': 'Preset name',
  'preset.savePlaceholder': 'e.g. My weekday routine',
  'preset.saved': 'Saved preset "{name}"',
  'preset.deletePreset': 'Delete preset',
  'day.add': 'Add day',
  'day.delete': 'Delete this day',
  'day.indicator': 'Day {m} of {n}',
  'day.thumb': 'Day {m}',
  'day.addTitle': 'Add day',
  'day.addBody': 'How should the new day start?',
  'day.addDuplicate': 'Duplicate current',
  'day.addEmpty': 'Empty schedule',
  'day.addPreset': 'Choose a preset',
  'app.saved': 'Saved',
  'app.saving': 'Saving…',
  'export.backup': 'Backup',
  'export.range': 'Range',
  'export.rangeStart': 'Start date',
  'export.rangeEnd': 'End date',
  'export.rangeCircle': 'Circle',
  'export.rangeTable': 'Table',
  'export.rangeImage': 'Save image',
  'export.rangeCsv': 'Save as CSV',
  'export.rangeCount': '{n} saved diaries in range',
  'export.rangeEmpty': 'No saved diaries in the selected range',
  'export.rangeSaved': 'Exported {n} day(s)',
  'export.rangeFailed': 'Export failed',
  'export.backupNote': 'Your data lives only in this browser. Save a backup file to move it to another device or recover it later.',
  'export.backupExport': 'Export full backup',
  'export.backupRestore': 'Restore from backup',
  'export.backupDone': 'Backup exported',
  'export.backupFail': 'Backup export failed',
  'export.restoreTitle': 'Restore from backup',
  'export.restoreBody': 'This overwrites ALL data on this device with the backup. Restore?',
  'export.restoreConfirm': 'Restore',
  'export.restored': 'Restored. Reloading…',
  'export.restoreFail': 'Restore failed',
  'day.deleteTitle': 'Delete day',
  'day.deleteBody': "This day's schedule will be deleted. Delete it?",
  'day.deleteConfirm': 'Delete',
  'day.max': 'You can add up to 20 days',
  'memo.clearAll': 'Delete all memos',
  'memo.clearTitle': 'Delete all memos',
  'memo.clearBody': 'All memos will be deleted. Delete them?',
  'memo.clearConfirm': 'Delete all',
  'slot.atCapacity': "You've reached 10 slots. Delete one to save a new slot.",
  'slot.emptyPre': 'No saved schedules yet. Add one with ',
  'slot.saveAsInline': 'Save as',
  'slot.emptyPost': '.',
  'slot.load': 'Load',
  'slot.delete': 'Delete',
  'slot.rename': 'Rename',
  'slot.renameEdit': 'Edit slot name',
  'slot.renameSave': 'Save name',
  'slot.renameCancel': 'Cancel rename',
  'slot.loadTitle': 'Load schedule',
  'slot.loadBody': 'This overwrites your current schedule. Load "{name}"?',
  'slot.deleteTitle': 'Delete slot',
  'slot.deleteBody': 'Delete "{name}"?',
  'saveAs.title': 'Save as',
  'saveAs.placeholder': 'Schedule name',
  'saveAs.nameLabel': 'Slot name',
  'saveAs.capacity': 'You have 10 slots. Delete one first.',
  'saveAs.saved': '"{name}" saved',
  'saveAs.copySuffix': '(copy)',
  'hub.editTitle': 'Edit schedule title',
  'hub.titleLabel': 'Schedule title',
  'hub.placeholder': 'e.g. Weekday routine',
  'circle.emptyHint': 'Pick a preset or click an empty area to start',
  'circle.ariaTimeline': '24-hour circular timeline',
  'app.loaded': '{name} loaded',
  'memo.add': 'Add memo',
  'memo.placeholderHint': 'You can add memos here',
  'memo.title': 'Memos',
  'mobile.editHint': 'Tap an item to edit · use the + button below to add a time block',
  'block.add': 'Add item',
  'block.addTitle': 'Add item',
  'block.name': 'Name',
  'block.namePlaceholder': 'e.g. Morning work',
  'block.start': 'Start time',
  'block.end': 'End time',
  'block.color': 'Color',
  'block.invalid': 'Start and end times must differ.',
  'welcome.title': 'Your whole day, at a glance',
  'welcome.subtitle': 'Edit the example below, or start in 30 seconds with a preset.',
  'welcome.howto': 'How to edit',
  'welcome.gClick': 'Click — split a time block',
  'welcome.gDrag': 'Drag a boundary — adjust the time',
  'welcome.gEdit': 'Double-click — name, color, icon',
  'welcome.gTap': 'Tap — edit name, color, icon',
  'welcome.gAdd': '+ Add item — type start & end times',
  'welcome.startPreset': 'Start with a preset',
  'welcome.startBlank': 'Edit it myself',
  'empty.heroTitle': 'Your timetable is empty',
  'empty.heroCta': 'Start in 30s with a preset',
  'sharelink.copy': 'Copy link',
  'sharelink.copied': 'Schedule link copied',
  'sharelink.copyFail': 'Could not copy the link',
  'transfer.menu': 'Send to device (QR)',
  'transfer.title': 'Send to another device',
  'transfer.body': "Scan this QR with another device's camera to import the current timetable.",
  'transfer.note': 'For all data (multiple days, diary, memos), use Export → Backup.',
  'auth.login': 'Sign in with Google',
  'auth.logout': 'Sign out',
  'auth.welcome': 'Signed in',
  'auth.signedOut': 'Signed out',
  'auth.loginFailed': 'Sign-in failed',
  'sync.synced': 'Synced',
  'sync.syncing': 'Syncing…',
  'sync.offline': 'Offline',
  'sync.error': 'Sync error',
  'sync.appliedFromCloud': 'Synced from the cloud',
  'sync.undo': 'Undo',
  'goals.open': 'Goals',
  'goals.title': 'Goals & Missions',
  'goals.empty': 'No goals yet. Add a time goal like exercise or study.',
  'goals.add': 'Add goal',
  'goals.labelPlaceholder': 'Activity (e.g. exercise, study)',
  'goals.periodDay': 'Daily',
  'goals.periodWeek': 'Weekly',
  'goals.hUnit': 'h',
  'goals.mUnit': 'm',
  'goals.hm': '{h}h {m}m',
  'goals.delete': 'Delete',
  'goals.untitled': '(untitled)',
  'goals.hoursLabel': 'Hours',
  'goals.minutesLabel': 'Minutes',
  'goals.pickLabel': 'Pick a timetable item',
  'goals.noLabels': 'Add items (labels) to your timetable first.',
  'goals.saveDiaryHint': "Save today's diary to update daily goals.",
  'sharelink.importTitle': 'Open shared schedule',
  'sharelink.importBody': 'Open the schedule shared via this link? Your current one will be replaced.',
  'sharelink.importConfirm': 'Open',
  'analytics.open': 'Time analysis',
  'analytics.title': 'Time analysis',
  'analytics.subtitle': 'Across {n} day(s) · daily average',
  'analytics.trend': 'Daily trend',
  'analytics.empty': 'No saved diaries yet. Save a diary and it will appear in the analysis.',
  'analytics.untitled': '(untitled)',
  'cat.sleep': 'Sleep',
  'cat.work': 'Work & study',
  'cat.meal': 'Meals',
  'cat.leisure': 'Leisure',
  'cat.commute': 'Commute',
  'cat.other': 'Other',
  'diary.open': 'Diary',
  'diary.title': 'Timetable diary',
  'diary.saveToday': 'Save today',
  'diary.saved': "Saved today's timetable to your diary",
  'diary.loaded': 'Loaded from your diary',
  'diary.deleted': 'Removed from your diary',
  'diary.empty': "Tap a date to log that day's timetable.",
  'diary.delete': 'Delete',
  'diary.today': 'Today',
  'diary.locked': '🔒 This diary is protected. Unlock it to edit.',
  'diary.unlock': 'Unlock',
  'diary.lock': 'Lock',
  'diary.unlockedToast': 'Unlocked — you can edit now.',
  'diary.relocked': 'Locked again.',
  'diary.confirmSaveTitle': 'Save diary',
  'diary.confirmSave': 'Save this diary?',
  'diary.confirmSaveBody': 'Records the current timetable as a diary entry on {date}.',
  'diary.confirmOverwriteBody': 'This overwrites the diary already saved on {date}.',
  'diary.confirmSaveCta': 'Save',
  'diary.confirmLoadTitle': 'Load diary',
  'diary.confirmLoad': 'Load this diary?',
  'diary.confirmLoadBody': 'Your current timetable will be replaced by the {date} record and locked.',
  'diary.confirmLoadCta': 'Load',
  'diary.confirmDeleteTitle': 'Delete diary',
  'diary.confirmDelete': 'This removes the saved diary.',
  'diary.confirmDeleteBody': "Delete the diary for {date}? This can't be undone.",
  'diary.confirmDeleteCta': 'Delete',
  'diary.note': 'Note',
  'diary.addNoteTitle': 'Add a note',
  'diary.addNotePrompt': 'Add a text note to {date}?',
  'diary.notePlaceholder': 'Write freely about your day…',
  'diary.noteSave': 'Save note',
  'diary.noteSkip': 'Skip',
  'diary.noteSaved': 'Note saved',
  'diary.noteChars': '{n} chars',
  'diary.noteEditable': 'Editable',
  'diary.prevDay': 'Previous diary',
  'diary.nextDay': 'Next diary',
  'diary.hasNote': 'Has note',
  'diary.exit': 'Exit diary',
  'diary.exited': 'Back to timetable editing',
  'analytics.scopeCurrent': 'Current',
  'analytics.scopeAll': 'All days',
  'analytics.scopeDiary': 'Diary',
  'analytics.rangeAll': 'All',
  'analytics.rangeMonth': 'Last month',
  'analytics.rangeWeek': 'Last week',
  'memo.delete': 'Delete memo',
  'memo.placeholder': 'Type a memo…',
  'memo.show': 'Show memos',
  'memo.hide': 'Hide memos',
  'view.full': '24h',
  'view.day': 'Day 6–18',
  'view.night': 'Night 18–6',
  'view.table': 'Table',
  'view.cycle': 'Switch view (24h → Day → Night → Table)',
  'view.record': 'Record',
  'record.labelPlaceholder': 'What are you tracking? (e.g. exercise, study)',
  'record.start': 'Start',
  'record.stop': 'Stop',
  'record.cancel': 'Cancel',
  'record.recording': 'Recording',
  'record.or': 'or',
  'record.add': 'Add',
  'record.empty': 'No records yet. Press Start to track in real time.',
  'record.delete': 'Delete',
  'record.clear': 'Clear today',
  'record.minOnly': '{m}m',
  'record.untitled': '(untitled)',
  'record.startTime': 'Start time',
  'record.endTime': 'End time',
  'table.csv': 'CSV',
  'table.image': 'Image',
  'table.reorder': 'Reorder',
  'table.exported': 'Exported',
  'share.button': 'Share',
  'share.text': 'My daily timetable — 24Houring',
  'share.saved': 'Saved the timetable image — post it to Instagram and beyond!',
  'share.noChart': 'Could not find a timetable to share.',
  'share.fail': 'Share failed',
  'home.button': 'Add to home screen',
  'home.title': 'Add to your home screen',
  'home.body': 'Open 24Houring like an app. On mobile, use the browser share menu → “Add to Home Screen”. On desktop, click the install icon in the address bar, or the browser menu → “Install / Create shortcut”.',
  'home.install': 'Install now',
  'home.installed': 'Installed',
  'home.copyLink': 'Copy link',
  'home.copied': 'Link copied',
  'clock.tools': 'Clock tools',
  'clock.clock': 'Clock',
  'clock.timer': 'Timer',
  'clock.alarm': 'Alarm',
  'clock.analog': 'Analog',
  'clock.digital': 'Digital',
  'clock.start': 'Start',
  'clock.pause': 'Pause',
  'clock.reset': 'Reset',
  'clock.clear': 'Clear',
  'clock.close': 'Close',
  'clock.alarmTime': 'Alarm time',
  'clock.alarmOn': 'On',
  'clock.alarmOff': 'Off',
  'clock.timerDone': '⏰ Timer finished!',
  'clock.alarmRing': '⏰ Alarm!',
  'clock.calendar': 'Calendar',
  'clock.today': 'Today',
  'clock.weather': 'Weather',
  'clock.weatherSearch': 'Search city',
  'clock.weatherSet': 'Set region',
  'clock.weatherEmpty': 'Search to set your region.',
  'clock.weatherError': 'Could not load weather.',
  'clock.weatherRefresh': 'Refresh',
  'clock.myLocation': 'My location',
  'memo.list': 'Memo list',
  'memo.listTitle': 'Memo list',
  'memo.listDesc': 'Memos removed from the screen stay here. Toggle the eye to show/hide on screen, or the trash to delete for good.',
  'memo.listEmpty': 'No memos yet.',
  'memo.restore': 'Show on screen',
  'memo.hideFromScreen': 'Hide from screen',
  'memo.deleteForever': 'Delete forever',
  'memo.alignLeft': 'Align left',
  'memo.alignCenter': 'Align center',
  'rim.placeholder': 'Memo…',
  'rim.delete': 'Delete memo',
  'rim.move': 'Drag along the rim',
  'about.open': 'About 24Houring · guide',
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

/**
 * Resolve a key for a language: lang → English → the key itself.
 * Optional `vars` replace `{name}`-style placeholders in the resolved string.
 */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string>): string {
  let s = TRANSLATIONS[lang]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(`{${k}}`, vars[k]);
    }
  }
  return s;
}
