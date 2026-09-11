// Keep the reading directory aligned with the actual, reviewed articles.
// This only updates existing cards; order and the curated reading path remain.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const file = 'public/guides/index.html';
const doc = new JSDOM(readFileSync(file, 'utf8')).window.document;
let count = 0;
for (const card of doc.querySelectorAll('a.gcard[href^="/guides/"]')) {
  const slug = card.getAttribute('href').split('/').pop();
  const article = new JSDOM(readFileSync(`public/guides/${slug}.html`, 'utf8')).window.document;
  for (const lang of ['ko', 'en']) {
    const section = article.querySelector(`main > div.lang-${lang}`);
    const title = section?.querySelector('h1')?.cloneNode(true);
    title?.querySelectorAll('.en').forEach(el => el.remove());
    const lead = section?.querySelector('.lead') || section?.querySelector('p');
    const heading = card.querySelector(`h3 .lang-${lang}`);
    const summary = card.querySelector(`p .lang-${lang}`);
    if (!title || !lead || !heading || !summary) throw new Error(`Incomplete ${lang} card: ${slug}`);
    heading.textContent = title.textContent.trim();
    summary.textContent = lead.textContent.trim();
  }
  count++;
}
writeFileSync(file, '<!doctype html>\n' + doc.documentElement.outerHTML + '\n');
console.log(`Synced ${count} bilingual guide cards.`);
