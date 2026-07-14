import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.RTPS_URL || 'http://127.0.0.1:8000/index.html';
const CONCURRENCY = Number(process.env.RTPS_CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.RTPS_TIMEOUT_MS || 30 * 60 * 1000);
const STALL_MS = Number(process.env.RTPS_STALL_MS || 120 * 1000);
const HEADLESS = process.env.RTPS_HEADLESS !== 'false';
const LOG_DIR = path.join(__dirname, 'log');
const RESULT_FILE = path.join(LOG_DIR, 'result.json');
const RUN_LOG_FILE = path.join(LOG_DIR, `playwright_run_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);

let runLogStream = null;
let ownedServerProcess = null;
let shuttingDown = false;

function isShutdownError(error) {
  const message = String(error?.name || '') + ' ' + String(error?.message || error || '');
  return shuttingDown || /AbortError|Interrupted|SIGINT|shutting down/i.test(message);
}

function requestShutdown(reason = 'interrupted') {
  if (shuttingDown) return;
  shuttingDown = true;
  writeRunLogLine(`[RUN] ${reason}`);
  stopOwnedServer().catch(() => {});
}

function writeRunLogLine(line) {
  const output = String(line).replace(/\r?\n$/, '');
  process.stdout.write(output + '\n');
  if (runLogStream) {
    runLogStream.write(output + '\n');
  }
}

function writeRunErrorLine(line) {
  const output = String(line).replace(/\r?\n$/, '');
  process.stderr.write(output + '\n');
  if (runLogStream) {
    runLogStream.write(output + '\n');
  }
}

async function clearLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const entries = await fs.readdir(LOG_DIR, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(LOG_DIR, entry.name);
    if (entry.isFile() && entry.name !== 'result.json') {
      await fs.rm(fullPath, { force: true });
    }
  }));
}

async function loadParams() {
  const raw = await fs.readFile(path.join(__dirname, 'data.js'), 'utf8');
  const match = raw.match(/window\.RTPS_PARAM_LIST\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('RTPS_PARAM_LIST not found in data.js');
  }
  return JSON.parse(match[1]);
}

async function loadResults() {
  try {
    const raw = await fs.readFile(RESULT_FILE, 'utf8');
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items.filter((cfg) => cfg && cfg.paramName);
  } catch {
    return [];
  }
}

async function saveResults(results) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.writeFile(RESULT_FILE, JSON.stringify(results, null, 2), 'utf8');
}

async function waitForCompletion(page, timeoutMs, stallMs, getLastProgressAt) {
  const started = Date.now();
  let lastState = null;
  let lastUrl = page.url();
  let pageClosed = false;
  page.once('close', () => {
    pageClosed = true;
  });

  while (Date.now() - started < timeoutMs) {
    if (shuttingDown) {
      const err = new Error('Interrupted');
      err.name = 'AbortError';
      throw err;
    }
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

    if (pageClosed || snapshot.state === 'crashed') {
      if (shuttingDown) {
        const err = new Error('Interrupted');
        err.name = 'AbortError';
        throw err;
      }
      throw new Error('Page crashed');
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
    if (shuttingDown) {
      const err = new Error('Interrupted');
      err.name = 'AbortError';
      throw err;
    }
    let lastProgressAt = Date.now();
    const bumpProgress = () => { lastProgressAt = Date.now(); };

    page.on('console', (msg) => {
      const text = msg.text();
      bumpProgress();
      if (text.includes('[DEBUG-WIN]') || text.includes('[DEBUG-DEATH]')) {
        writeRunLogLine(`[${paramName}] ${text}`);
      }
    });

    const url = `${BASE_URL}?param=${encodeURIComponent(paramName)}&mode=auto`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      return window.__runState === 'running' ||
        window.__runState === 'victory' ||
        window.__runState === 'gameover' ||
        (window.player && window.player.hp <= 0);
    }, null, {
      timeout: 30000,
    }).catch(() => {});

    const result = await waitForCompletion(page, TIMEOUT_MS, STALL_MS, () => lastProgressAt);
    writeRunLogLine(`[${paramName}] ${result}`);
    return { paramName, result };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(browser, items, concurrency) {
  const queue = [...items];
  const results = [];

  async function worker() {
    while (queue.length > 0 && !shuttingDown) {
      const paramName = queue.shift();
      if (!paramName) continue;
      try {
        results.push(await runOne(browser, paramName));
      } catch (error) {
        if (isShutdownError(error)) {
          return;
        }
        results.push({ paramName, result: 'error', error: String(error?.message || error) });
        writeRunErrorLine(`[${paramName}] error: ${error?.stack || String(error)}`);
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

async function waitForServerReady(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:8000/params');
      if (res.ok) return;
    } catch (e) {}
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('server did not become ready');
}

async function startServerIfNeeded() {
  try {
    const res = await fetch('http://127.0.0.1:8000/params');
    if (res.ok) {
      return false;
    }
  } catch {}

  ownedServerProcess = spawn('python', ['server.py'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  ownedServerProcess.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk));
  });
  ownedServerProcess.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk));
  });
  return true;
}

async function stopOwnedServer() {
  if (!ownedServerProcess) return;
  const proc = ownedServerProcess;
  ownedServerProcess = null;
  try {
    proc.kill();
  } catch {}
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const onlyNonVictory = process.env.RTPS_ONLY_NONVICTORY === '1' || process.env.RTPS_ONLY_NONVICTORY === 'true';
  const onlyParam = process.env.RTPS_ONLY_PARAM;
  const params = await loadParams();
  const previousResults = await loadResults();
  const previousResultMap = new Map(previousResults.map((item) => [item.paramName, item]));
  let runParams = params;
  if (onlyParam) {
    runParams = params.filter((cfg) => cfg.paramName === onlyParam);
    writeRunLogLine(`Filtered params: ${runParams.length} / ${params.length} (only param: ${onlyParam})`);
  } else if (onlyNonVictory) {
    runParams = params.filter((cfg) => previousResultMap.get(cfg.paramName)?.result !== 'victory');
    writeRunLogLine(`Filtered params: ${runParams.length} / ${params.length} (only non-victory via log/result.json)`);
  }

  await clearLogDir();
  runLogStream = createWriteStream(RUN_LOG_FILE, { flags: 'a' });
  writeRunLogLine(`[RUN] log dir cleared`);
  writeRunLogLine(`[RUN] saving stdout/stderr to ${path.basename(RUN_LOG_FILE)}`);

  const startedServer = await startServerIfNeeded();
  if (startedServer) {
    writeRunLogLine(`[RUN] started local server.py`);
  }

  const onSigint = () => requestShutdown('interrupted by Ctrl+C');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigint);

  try {
    await waitForServerReady();
    const browser = await chromium.launch({ headless: HEADLESS });
    const runResults = [];
    try {
      const results = await runPool(browser, runParams.map((cfg) => cfg.paramName), CONCURRENCY);
      runResults.push(...results);
      writeRunLogLine(JSON.stringify(results, null, 2));
    } finally {
      await browser.close().catch(() => {});
    }

    const mergedResults = [...previousResults];
    for (const item of runResults) {
      const idx = mergedResults.findIndex((entry) => entry.paramName === item.paramName);
      if (idx >= 0) {
        mergedResults[idx] = item;
      } else {
        mergedResults.push(item);
      }
    }
    await saveResults(mergedResults);

    const zip = await zipResults();
    writeRunLogLine(`ZIP: ${zip.zip_file}`);
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigint);
    await stopOwnedServer();
    await new Promise((resolve) => runLogStream?.end(resolve));
  }
}

main().catch((error) => {
  if (isShutdownError(error)) {
    process.exitCode = 130;
    return;
  }
  writeRunErrorLine(error?.stack || String(error));
  process.exitCode = 1;
  stopOwnedServer().catch(() => {});
  if (runLogStream) {
    runLogStream.end();
  }
});
