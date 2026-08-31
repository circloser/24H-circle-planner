/**
 * IndexNow submission — pushes every sitemap URL to api.indexnow.org so
 * IndexNow-participating engines (Bing/Copilot, Yandex, Naver, Seznam, …)
 * pick up new/changed pages immediately instead of waiting for a crawl.
 *
 * Run AFTER a deploy has propagated (the key file must be live):
 *   node scripts/indexnow.mjs
 */
const HOST = '24houring.com';
const KEY = 'd74ad950188d13c991e0f55fe8588c7a'; // must match public/<key>.txt

const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
const keyBody = (await keyRes.text()).trim();
if (!keyRes.ok || keyBody !== KEY) {
  console.error(`key file not live yet (${keyRes.status}, body=${JSON.stringify(keyBody.slice(0, 40))}) — deploy first`);
  process.exit(1);
}

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) { console.error('no <loc> entries in live sitemap'); process.exit(1); }
console.log(`submitting ${urls.length} urls for ${HOST}`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`indexnow: HTTP ${res.status} ${res.statusText}`);
const text = await res.text();
if (text) console.log(text);
process.exit(res.ok ? 0 : 1);
