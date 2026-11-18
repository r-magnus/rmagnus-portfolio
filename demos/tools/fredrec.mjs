import { launch, pause } from './rig.mjs';
for (const demo of process.argv.slice(2)) {
  const p = await launch({ width: 402, height: 874, dpr: 2 });
  await p.goto(`http://127.0.0.1:8799/fred.html?demo=${demo}&wait`); await pause(1200);
  await p.eval(`document.fonts.ready.then(()=>1)`);
  const rec = await p.record();
  await pause(300);
  p.eval(`play(${JSON.stringify(demo)})`);
  await p.waitFor('window.__done === true', 60000);
  const n = await rec.stop(`out/fred-${demo}.gif`, { fps: 15, scale: 360, tail: 0.1 });
  console.log(demo, n, 'frames');
  await p.close();
}
process.exit(0);
