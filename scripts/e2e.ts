// End-to-end walkthrough in a real browser, with screenshots in out/e2e/.
// Usage: npm run dev (in another terminal), then: npm run e2e -- [base-url] [photo.jpg | sample]
// Uses your installed Google Chrome (puppeteer-core). Calls the real AI if a key is set;
// "sample" uses the app's sample photos and their stored AI run, so it needs no quota.
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer, { type Page } from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:5173';
const PHOTO = process.argv[3] || 'public/samples/canal-downstream.jpg';
const OUT = 'out/e2e';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });
const SAMPLE = PHOTO === 'sample';
if (!SAMPLE && !existsSync(PHOTO)) throw new Error(`Photo not found: ${PHOTO}`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const errors: string[] = [];
let shot = 0;

async function snap(page: Page, name: string, full = true) {
  shot++;
  await new Promise((r) => setTimeout(r, 350));
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-${name}.png`, fullPage: full });
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('tandem.theme', t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

async function clickText(page: Page, selector: string, text: string) {
  const ok = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.innerText.trim().toLowerCase().startsWith(t.toLowerCase()));
      el?.click();
      return !!el;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`No ${selector} starting with "${text}"`);
}

/** Pick an option inside the question card whose legend is `title`. */
async function answer(page: Page, title: string, option: string) {
  const ok = await page.evaluate(
    (t, o) => {
      const fs = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent?.trim() === t);
      const label = fs && [...fs.querySelectorAll<HTMLLabelElement>('label.opt')].find((l) => l.innerText.trim().toLowerCase().startsWith(o.toLowerCase()));
      label?.click();
      return !!label;
    },
    title,
    option,
  );
  if (!ok) throw new Error(`Could not answer ${title} = ${option}`);
}

const next = (page: Page) => clickText(page, '.sticky-actions button', 'continue').catch(() => clickText(page, '.sticky-actions button', 'compare').catch(() => clickText(page, '.sticky-actions button', 'check my')));

try {
  const page = await browser.newPage();
  // tsx keeps function names with a __name helper that does not exist in the page.
  await page.evaluateOnNewDocument('window.__name = (f) => f');
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // Home, both themes, phone and desktop
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await setTheme(page, 'light');
  await snap(page, 'home-phone-light');
  await setTheme(page, 'dark');
  await snap(page, 'home-phone-dark');
  await setTheme(page, 'light');
  await page.setViewport({ width: 1280, height: 860 });
  await snap(page, 'home-desktop-light', false);

  // The check
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/#/check`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.site');
  await clickText(page, '.site', 'C1');
  await snap(page, 'site', false);
  await next(page);
  await page.waitForSelector('.photo-slot');

  if (SAMPLE) {
    await clickText(page, 'button', 'Not at a stream');
    await page.waitForFunction(() => document.querySelectorAll('.photo-slot.filled').length >= 1, { timeout: 15000 });
  } else {
    const inputs = await page.$$('input[type=file]');
    await (inputs[0] as unknown as { uploadFile: (p: string) => Promise<void> }).uploadFile(PHOTO);
    await (inputs[1] as unknown as { uploadFile: (p: string) => Promise<void> }).uploadFile(PHOTO);
    await page.waitForFunction(() => document.querySelectorAll('.photo-slot.filled').length >= 2, { timeout: 15000 });
  }
  await snap(page, 'photos');
  await next(page);

  // Page 1: deliberately disagree with the photo on the banks
  await answer(page, 'Channel Form', 'Flat');
  await answer(page, 'Bottom Type', 'Natural');
  await answer(page, 'Bank Type', 'Natural');
  await answer(page, 'Habitats', 'None of these');
  await answer(page, 'Natural Debris', 'None of these');
  await answer(page, 'Water Flow', 'Slow');
  await snap(page, 'questions-1');
  await next(page);

  await answer(page, 'Water Aspect', 'Muddy'); // the AI is not trusted on water colour: it should hold back
  for (const q of ['Water Withdrawal', 'Draining Pipes', 'Sewage discharge', 'Construction']) await answer(page, q, 'No');
  await answer(page, 'Barriers', 'I’m not sure');
  await snap(page, 'questions-2');
  await next(page);

  await answer(page, 'Impervious Areas (Left)', 'Yes');
  await answer(page, 'Impervious Areas (Right)', 'Yes');
  await answer(page, 'Vegetation (Left)', 'No');
  await answer(page, 'Vegetation (Right)', 'No');
  await answer(page, 'Invasive Species', 'No');
  await answer(page, 'Vegetation Cuts', 'No');
  await snap(page, 'questions-3');
  await next(page);

  await clickText(page, 'label.rating', 'Good quality');
  await snap(page, 'rating');
  await next(page);

  // Wait for the AI (it may still be working) and walk the review
  await snap(page, 'review-waiting', false);
  await page.waitForFunction(() => !document.querySelector('.spinner'), { timeout: 180000 });
  await snap(page, 'review-first');
  // This walkthrough is itself automation, so the app must say so and quarantine the record.
  const flagged = await page.evaluate(() => document.body.innerText.includes('Automated input'));
  if (!flagged) errors.push('The automated walkthrough was not flagged as automated input');
  let guard = 0;
  while (guard++ < 30) {
    const done = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('See the results')));
    if (done) break;
    const acted = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('main button')];
      const pick = (t: string) => buttons.find((b) => b.innerText.trim().startsWith(t));
      const unconfirmed = buttons.find((x) => x.innerText.trim().startsWith('I saw it too') && x.getAttribute('aria-pressed') !== 'true');
      const b = pick('Change to') || pick('Update to match') || pick('Use “') || pick('Keep as answered') || pick('Keep my answer') || unconfirmed;
      if (b) {
        b.click();
        return b.innerText.trim();
      }
      const cont = pick('Continue');
      cont?.click();
      return cont ? 'Continue' : '';
    });
    if (!acted) break;
    if (guard <= 3) await snap(page, `review-step-${guard}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  await clickText(page, 'button', 'See the results');
  await page.waitForSelector('.health-badge');
  await snap(page, 'results-light');
  await setTheme(page, 'dark');
  await snap(page, 'results-dark');
  await setTheme(page, 'light');

  // Researcher views
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/#/records`, { waitUntil: 'networkidle0' });
  await snap(page, 'records');
  const notCounted = await page.evaluate(() => [...document.querySelectorAll('.record-card')].filter((c) => (c as HTMLElement).innerText.includes('Not counted')).length);
  if (notCounted < 2) errors.push(`Expected this run and the demo bot record to be "Not counted", got ${notCounted}`);
  await page.goto(`${BASE}/#/records/demo-toulouse-t21`, { waitUntil: 'networkidle0' });
  await snap(page, 'record-detail');
  await page.goto(`${BASE}/#/about`, { waitUntil: 'networkidle0' });
  await snap(page, 'about');
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`Browser errors:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: ${shot} screenshots in ${OUT}/`);
