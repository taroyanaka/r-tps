import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.RTPS_URL || 'http://127.0.0.1:8000/index.html';
const CONCURRENCY = Number(process.env.RTPS_CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.RTPS_TIMEOUT_MS || 30 * 60 * 1000);
const STALL_MS = Number(process.env.RTPS_STALL_MS || 120 * 1000);
const HEADLESS = process.env.RTPS_HEADLESS !== 'false';

async function loadParams() {
  const raw = await fs.readFile(path.join(__dirname, 'param.json'), 'utf8');
  const configs = JSON.parse(raw);
  return configs.map((cfg) => cfg.paramName).filter(Boolean);
}

async function waitForCompletion(page, timeoutMs, stallMs, getLastProgressAt) {
  const started = Date.now();
  let lastState = null;
  let lastUrl = page.url();

  while (Date.now() - started < timeoutMs) {
    const snapshot = await page.evaluate(() => {
      const state = window.__runState || 'idle';
      const result = window.__runResult || null;
      const playerHp = window.player?.hp ?? null;
      const panel = document.getElementById('main-panel');
      const panelText = panel ? panel.textContent || '' : '';
      return { state, result, playerHp, panelText };
    }).catch(() => ({ state: 'crashed', result: 'crashed', panelText: '' }));

    const currentUrl = page.url();
    const stateChanged = snapshot.state !== lastState;
    const urlChanged = currentUrl !== lastUrl;

    if (stateChanged || urlChanged) {
      lastState = snapshot.state;
      lastUrl = currentUrl;
    }

    if (snapshot.state === 'victory' || snapshot.state === 'gameover' || snapshot.playerHp === 0) {
      if (snapshot.playerHp === 0 && snapshot.state !== 'gameover') {
        return 'gameover';
      }
      return snapshot.state;
    }

    if (Date.now() - getLastProgressAt() > stallMs) {
      throw new Error(`Stalled for more than ${stallMs}ms while state=${snapshot.state}`);
    }

    await page.waitForTimeout(1000);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function runOne(browser, paramName) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    let lastProgressAt = Date.now();
    const bumpProgress = () => { lastProgressAt = Date.now(); };

    page.on('console', (msg) => {
      const text = msg.text();
      bumpProgress();
      if (text.includes('[DEBUG-WIN]') || text.includes('[DEBUG-DEATH]')) {
        console.log(`[${paramName}] ${text}`);
      }
    });

    const url = `${BASE_URL}?param=${encodeURIComponent(paramName)}&mode=auto`;
    await page.goto(url, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      return window.__runState === 'running' ||
        window.__runState === 'victory' ||
        window.__runState === 'gameover' ||
        (window.player && window.player.hp <= 0);
    }, null, {
      timeout: 30000,
    }).catch(() => {});

    const result = await waitForCompletion(page, TIMEOUT_MS, STALL_MS, () => lastProgressAt);
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
