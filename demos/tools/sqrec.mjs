import { launch, pause } from './rig.mjs';
const BASE = 'http://localhost:8787';
const hook = `const WS0=window.WebSocket;window.WebSocket=class extends WS0{constructor(...a){super(...a);window.__ws=this;}};window.__dev=op=>window.__ws.send(JSON.stringify({type:'dev',dev:op}));`;
const host = await launch({ width: 390, height: 844, dpr: 2 });
await host.send('Page.addScriptToEvaluateOnNewDocument', { source: hook });
const names = ['Maya', 'Jamie', 'Theo'];
const friends = [];
for (const [i] of names.entries()) friends.push(await launch({ width: 390, height: 844, dpr: 1, port: 9500 + i }));
const mark = () => {};
const OPTS = { fps: 15, scale: 360, tail: 0.1 };
const moveOn = async () => { try { await pause(400); await host.press('Move on anyway'); } catch {} };
try {
  // ── 1. Gather ──
  await host.goto(BASE + '/'); await host.waitText('Host a lobby'); await pause(1500);
  let rec = await host.record();
  await pause(1300);
  await host.focus('[aria-label="Your name"]'); await host.type('Ryan', 120);
  await pause(500);
  mark('press host'); await host.press('Host a lobby'); await host.waitText('Invite friends'); mark('lobby');
  const code = (await host.eval(`document.body.innerText`)).split('\n').map((s) => s.trim()).find((s) => /^[A-Z]{4}$/.test(s));
  mark('pause'); rec.pause();
  for (const [i, f] of friends.entries()) { await f.goto(`${BASE}/join/${code}`); await pause(1200); await f.waitText('Join ' + code); await f.focus('input'); await f.type(names[i], 5); }
  await rec.resume(); mark('resume'); await pause(1400);
  for (const [i, f] of friends.entries()) { await f.press('Join ' + code); await host.waitText(names[i]); await pause(1000); }
  await pause(1800);
  console.log('gather', await rec.stop('out/sq-gather.gif', OPTS));

  // ── 2. Write & rate ──
  await host.press('Start'); await host.waitText('Write quests', 10000); await pause(2500);
  rec = await host.record();
  await pause(800);
  await host.focus('[aria-label="New quest"]'); await host.type('Get a stranger to teach you a dance move', 45);
  await pause(400); await host.press('Add');
  const qs = ['Find a dog and learn its name', 'Order a drink in a fake accent', 'High-five a stranger'];
  for (const [i, f] of friends.entries()) { await f.waitText('Write quests'); await f.focus('[aria-label="New quest"]'); await f.type(qs[i], 2); await f.press('Add'); await pause(700); }
  await host.waitText('pts', 20000); await pause(1800);
  rec.pause();
  await host.press('Review deck'); await moveOn(); await host.waitText('Deck (', 20000); await pause(800);
  await rec.resume(); await pause(1600);
  await host.eval(`(()=>{const s=[...document.querySelectorAll('div')].filter(d=>d.scrollHeight>d.clientHeight+40&&getComputedStyle(d).overflowY!=='visible').sort((a,b)=>b.clientHeight-a.clientHeight)[0];s&&s.scrollBy({top:420,behavior:'smooth'})})()`);
  await pause(2200);
  console.log('write', await rec.stop('out/sq-write.gif', OPTS));

  // ── 3. Race & crown ──
  await host.press('Deal', { exact: false }); await moveOn(); await host.waitText('Live standings', 20000); await pause(1500);
  rec = await host.record();
  await pause(1800);
  await host.eval(`__dev({op:'simulateRounds',rounds:1})`); await pause(2600);
  await host.eval(`__dev({op:'simulateRounds',rounds:1})`); await pause(2400);
  rec.pause();
  await host.eval(`__dev({op:'skipToEnd'})`); await host.waitText('Judge the proofs', 15000); await pause(1200);
  await host.press('Judge the proofs'); await host.waitText('judged', 15000); await pause(1000);
  await rec.resume(); await pause(1500);
  await host.press('Counts', { exact: false }); await pause(1300);
  try { await host.press('Counts', { exact: false }); await pause(1300); } catch {}
  rec.pause();
  await host.press('Final results'); await moveOn(); await host.waitText('Everyone', 15000); await pause(600);
  await rec.resume(); await pause(3200);
  console.log('crown', await rec.stop('out/sq-race.gif', OPTS));
} catch (e) { console.error('ERR', e.message); await host.shot('ex/sq-err.png'); }
for (const f of friends) await f.close();
await host.close();
process.exit(0);
