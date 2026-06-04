// Build-time inlined Pretendard subsets via Vite ?inline query.
// Vite ?inline returns a data URI string: "data:font/woff2;base64,..."
// These are lazy-imported only when <ExportDialog> opens (T9).
// For the spike script, we fetch from /fonts/ at runtime instead
// (Node can't run Vite transforms directly).
export { default as pretendardRegular } from './pretendard-regular.woff2?inline';
export { default as pretendardBold } from './pretendard-bold.woff2?inline';

// T9: OTF ?url exports — lazy-fetched at PDF export time only (NOT ?inline to avoid bundle bloat).
// Format chosen: OTF — the official Pretendard v1.3.9 release ships .otf under dist/public/static/.
// jsPDF's addFont API accepts OTF binary data via the same addFileToVFS call as TTF.
export { default as pretendardRegularTtfUrl } from './pretendard-regular.otf?url';
export { default as pretendardBoldTtfUrl } from './pretendard-bold.otf?url';
