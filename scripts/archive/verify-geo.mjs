/**
 * Verifies the GEO (generative-engine optimization) layer in the PRODUCTION
 * build (dist/):
 *  - the raw #root HTML carries crawlable content (so non-JS AI bots can read it);
 *  - FAQPage + HowTo + WebApplication(featureList) structured data are present;
 *  - robots.txt explicitly allows the major AI crawlers;
 *  - llms.txt exists and follows the spec (H1 + blockquote summary).
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const read = (f) => (fs.existsSync(path.join(DIST, f)) ? fs.readFileSync(path.join(DIST, f), 'utf8') : '');

const html = read('index.html');
const robots = read('robots.txt');
const llms = read('llms.txt');

const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Google-Extended', 'PerplexityBot'];
const missingBots = aiBots.filter((b) => !robots.includes(b));

const checks = {
  rootCrawlableContent:
    html.includes('24시간 원형 시간표') &&
    html.includes('주요 기능') &&
    html.includes('자주 묻는 질문') &&
    /<div id="root">[\s\S]*<h1[\s>]/.test(html),
  faqSchema: html.includes('"@type": "FAQPage"') && html.includes('"@type": "Question"'),
  howToSchema: html.includes('"@type": "HowTo"') && html.includes('"@type": "HowToStep"'),
  webAppFeatureList: html.includes('"@type": "WebApplication"') && html.includes('"featureList"'),
  robotsAllowsAIBots: missingBots.length === 0,
  robotsSitemap: /Sitemap:\s*https:\/\/24houring\.com\/sitemap\.xml/.test(robots),
  llmsTxtSpec: llms.startsWith('# 24Houring') && /\n>\s/.test(llms) && llms.includes('https://24houring.com/'),
};

console.log('robots AI bots present:', aiBots.filter((b) => robots.includes(b)).join(', ') || '(none)');
if (missingBots.length) console.log('  MISSING bots:', missingBots.join(', '));
console.log('llms.txt bytes:', llms.length, '| #root content bytes:', (html.match(/<div id="root">[\s\S]*?<\/div>\s*<script/) || [''])[0].length);
console.log('checks:', JSON.stringify(checks, null, 0));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
