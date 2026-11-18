// Minimal CDP rig: launch isolated headless Chrome, drive a page, record via screencast, encode GIF.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

export const pause = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ width = 390, height = 844, dpr = 2, port = 9400 + Math.floor(Math.random() * 90), args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'rig-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
    '--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu', ...args, 'about:blank',
  ], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await pause(100); } }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0; const pending = new Map(); const listeners = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    else (listeners.get(m.method) || []).forEach(f => f(m.params));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const on = (method, f) => listeners.set(method, [...(listeners.get(method) || []), f]);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const page = {
    send, on, width, height, dpr,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
    async goto(url) { await send('Page.navigate', { url }); await pause(300); },
    async waitFor(expr, ms = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await page.eval(expr)) return; } catch {} await pause(100); }
      throw Error('Timed out waiting for: ' + expr);
    },
    async waitText(text, ms) { await page.waitFor(`document.body.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})`, ms); },
    async tap(x, y) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await pause(60);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    // Find a pressable/button by its visible text or aria-label, scroll into view, tap its centre.
    async press(text, { exact = true } = {}) {
      const pt = await page.eval(`(()=>{const t=${JSON.stringify(text.toLowerCase())};const els=[...document.querySelectorAll('[role="button"],button,[role="link"],a,[tabindex]')];
        const e=els.find(e=>(${exact}?e.innerText.trim().toLowerCase()===t:e.innerText.toLowerCase().includes(t))||(e.getAttribute('aria-label')||'').toLowerCase()===t);
        if(!e)throw Error('no button '+t);e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await page.tap(pt.x, pt.y);
    },
    async focus(selector) {
      const pt = await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing ${selector}');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await page.tap(pt.x, pt.y);
    },
    async type(text, perChar = 55) { for (const ch of text) { await send('Input.insertText', { text: ch }); await pause(perChar + Math.random() * 40); } },
    async key(key = 'Enter') { const code = { Enter: 13 }[key]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code }); },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')); },

    // Screencast recording → list of {file, t}
    async emulate() {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    },
    async record() {
      await page.emulate(); await pause(250);
      console.log('viewport', await page.eval('innerWidth+"x"+innerHeight'));
      const dir = mkdtempSync(join(tmpdir(), 'rec-')); const frames = [];
      const session = { active: true };
      page._session = session;
      if (!page._hooked) {
        page._hooked = true;
        on('Page.screencastFrame', p => {
          send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
          page._off = Date.now() / 1000 - p.metadata.timestamp;
          const ss = page._session;
          if (!ss || !ss.active || !ss.on) return;
          const file = join(ss.dir, String(ss.frames.length).padStart(5, '0') + '.jpg');
          const buf = Buffer.from(p.data, 'base64');
          // Drop frames not at the full viewport size (the first frame after a start can be stale).
          if (Math.abs(p.metadata.deviceWidth - width) > 1 || Math.abs(p.metadata.deviceHeight - height) > 1) { page._drops = (page._drops || 0) + 1; if (!page._fixing) { page._fixing = true; page.emulate().finally(() => { page._fixing = false; }); } return; }
          writeFileSync(file, buf);
          ss.frames.push({ file, t: p.metadata.timestamp });
        });
      }
      Object.assign(session, { dir, frames, on: true });
      await send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width * dpr, maxHeight: height * dpr, everyNthFrame: 1 });
      const t0 = Date.now() / 1000;
      return {
        pause() { session.on = false; if (frames.length) frames.at(-1).cut = true; },
        async resume() {
          await page.emulate(); await pause(200);
          session.on = true;
          // Restarting the screencast makes Chrome send the current screen at once.
          await send('Page.stopScreencast');
          await send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width * dpr, maxHeight: height * dpr, everyNthFrame: 1 });
          await pause(120);
        },
        async stop(out, { fps = 15, scale = 360, tail = 1.2 } = {}) {
          await pause(150);
          const stopT = Date.now() / 1000 - (page._off || 0);
          session.active = false; await send('Page.stopScreencast');
          // constant-rate resample of the variable-rate frames
          const tEnd = Math.max(frames.at(-1).t + tail, stopT); const list = [];
          for (let i = 0; i < frames.length; i++) {
            const d = frames[i].cut ? 1 / 15 : (i + 1 < frames.length ? frames[i + 1].t : tEnd) - frames[i].t;
            list.push(`file '${frames[i].file}'\nduration ${Math.max(d, 0.001).toFixed(4)}`);
          }
          list.push(`file '${frames.at(-1).file}'`);
          writeFileSync(join(dir, 'list.txt'), list.join('\n'));
          if (process.env.TDEBUG) { const ts = frames.map(f => f.t); let neg = 0; for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i-1]) neg++; console.log('t', ts[0].toFixed(2), ts.at(-1).toFixed(2), 'stop', stopT.toFixed(2), 'neg', neg, 'cuts', frames.filter(f=>f.cut).length, 'synth', frames.filter(f=>!f.file.endsWith('jpg')).length); }
          execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
            '-vf', `fps=${fps},scale=${scale}:${Math.round(scale * height / width / 2) * 2}:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
            '-loop', '0', out]);
          rmSync(dir, { recursive: true, force: true });
          if (page._drops) console.log('dropped', page._drops); page._drops = 0;
          return frames.length;
        },
      };
    },
    async close() { try { ws.close(); } catch {} chrome.kill(); await pause(400); try { rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
  return page;
}
