import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.RTPS_URL || 'http://127.0.0.1:8000/cyber_spire.html';
const CONCURRENCY = Number(process.env.RTPS_CONCURRENCY || 4);
const TIMEOUT_MS = Number(process.env.RTPS_TIMEOUT_MS || 30 * 60 * 1000);
const HEADLESS = process.env.RTPS_HEADLESS !== 'false';

async function loadParams() {
  const raw = await fs.readFile(path.join(__dirname, 'param.json'), 'utf8');
  const configs = JSON.parse(raw);
  return configs.map((cfg) => cfg.paramName).filter(Boolean);
}

async function waitForCompletion(page, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await page.evaluate(() => window.__runState || 'idle').catch(() => 'crashed');
    if (state === 'victory' || state === 'gameover') {
      return state;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function runOne(browser, paramName) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[DEBUG-WIN]') || text.includes('[DEBUG-DEATH]')) {
        console.log(`[${paramName}] ${text}`);
      }
    });

    const url = `${BASE_URL}?param=${encodeURIComponent(paramName)}&mode=auto`;
    await page.goto(url, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => window.__runState === 'running' || window.__runState === 'victory' || window.__runState === 'gameover', null, {
      timeout: 30000,
    }).catch(() => {});

    const result = await waitForCompletion(page, TIMEOUT_MS);
    console.log(`[${paramName}] ${result}`);
    return { paramName, result };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(browser, items, concurrency) {
  const queue = [...items];
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const paramName = queue.shift();
      if (!paramName) continue;
      try {
        results.push(await runOne(browser, paramName));
      } catch (error) {
        results.push({ paramName, result: 'error', error: String(error?.message || error) });
        console.error(`[${paramName}] error:`, error);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function zipResults() {
  const res = await fetch('http://127.0.0.1:8000/zip_results');
  if (!res.ok) {
    throw new Error(`zip_results failed: ${res.status}`);
  }
  return await res.json();
}

async function main() {
  const params = await loadParams();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const results = await runPool(browser, params, CONCURRENCY);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close().catch(() => {});
  }

  const zip = await zipResults();
  console.log(`ZIP: ${zip.zip_file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
