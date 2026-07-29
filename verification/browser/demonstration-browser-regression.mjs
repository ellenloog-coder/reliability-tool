import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.DEMO_BASE_URL || 'http://127.0.0.1:8005';
await fs.mkdir('verification/screenshots/demonstration', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], browserVersion = await browser.version();
async function run(testCase, viewport, action, shot) {
  const page = await browser.newPage({ viewport }); const consoleErrors = [], networkFailures = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(e.message));
  page.on('requestfailed', r => networkFailures.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  let actual = '', status = 'PASS';
  try { await page.goto(baseURL, { waitUntil: 'networkidle' }); await page.locator('[data-mode="demo"]').click(); await page.locator('#demoMethodSample').waitFor(); await action(page); actual = (await page.locator('#demoPanel').innerText()).slice(0, 4000); if (/NaN|Infinity|undefined/.test(actual) || consoleErrors.length || networkFailures.length) status = 'FAIL'; if (shot) await page.screenshot({ path: `verification/screenshots/demonstration/${shot}.png`, fullPage: true }); }
  catch (e) { status = 'FAIL'; actual = e.message; }
  results.push({ testCase, browser: `Chromium ${browserVersion}`, viewport: `${viewport.width}x${viewport.height}`, expected: 'Demonstration renders and interaction produces finite results', actual, status, evidence: { screenshot: shot ? `verification/screenshots/demonstration/${shot}.png` : null, observedValues: { chart: await page.locator('#demoPanel svg').count().catch(() => 0) }, consoleErrors, networkFailures }, notes: '' }); await page.close();
}
await run('Sample Plan default', {width:1440,height:900}, async p => { await p.locator('#demoRunButton').click(); await p.locator('#demoPanel svg').waitFor(); }, 'sample-plan-default');
await run('Sample Plan c1', {width:1440,height:900}, async p => { await p.locator('#demoAllowableFailures').fill('1'); await p.locator('#demoRunButton').click(); }, 'sample-plan-c1');
await run('Sample Evaluate demonstrated', {width:1440,height:900}, async p => { await p.locator('#demoWorkflowEvaluate').click(); await p.locator('#demoUnitsTested').fill('30'); await p.locator('#demoObservedFailures').fill('0'); await p.locator('#demoRunButton').click(); }, 'sample-evaluate-demonstrated');
await run('Time Plan MTBF', {width:1440,height:900}, async p => { await p.locator('#demoMethodTime').click(); await p.locator('#demoRunButton').click(); }, 'time-plan-mtbf');
await run('Time Evaluate zero failure', {width:1440,height:900}, async p => { await p.locator('#demoMethodTime').click(); await p.locator('#demoWorkflowEvaluate').click(); await p.locator('#demoRunButton').click(); }, 'time-evaluate-zero-failure');
await run('Chinese UI', {width:1440,height:900}, async p => { await p.locator('#chineseButton').click(); await p.locator('#demoRunButton').click(); }, 'demonstration-chinese');
await run('Mobile layout', {width:390,height:844}, async p => { await p.locator('#demoRunButton').click(); const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2); if (overflow) throw new Error('horizontal overflow'); }, 'demonstration-mobile');
await fs.writeFile('verification/demonstration-browser-regression-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), baseURL, browser: `Chromium ${browserVersion}`, total: results.length, passed: results.filter(r=>r.status==='PASS').length, failed: results.filter(r=>r.status==='FAIL').length, blocked: 0, results }, null, 2));
console.log(JSON.stringify({ browser: browserVersion, total: results.length, passed: results.filter(r=>r.status==='PASS').length, failed: results.filter(r=>r.status==='FAIL').length }, null, 2));
await browser.close();
