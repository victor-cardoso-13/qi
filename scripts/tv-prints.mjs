// Fotos do tabuleiro da TV no meio da partida (4 jogadores, TUDO MUDO: ?local nunca toca som).
// Uso: (npx vite --port 5200 rodando) PORTA=5200 node scripts/tv-prints.mjs [casas=20]
import { chromium } from 'playwright';
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const casas = process.argv[2] ?? '20';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const abrir = async (url, w) => { const p = await ctx.newPage(); if (w) await p.setViewportSize(w); await p.goto(url); return p; };
const A = await abrir(`${base}?local&speed=25&as=pA`);
await A.fill('#nome', 'Ana'); await A.click('[data-act=criar]');
await A.waitForSelector('.lobby'); const code = (await A.textContent('.cod')).trim();
const outros = [];
for (const [id, nome] of [['pB', 'Beto'], ['pC', 'Carla'], ['pD', 'Davi']]) {
  const p = await abrir(`${base}?local&speed=25&as=${id}&sala=${code}`); await p.waitForSelector('[data-act=entrar-aqui]');
  await p.fill('#nome', nome); await p.click('[data-act=entrar-aqui]'); outros.push(p);
}
const T = await abrir(`${base}?local&speed=25&tv=${code}`, { width: 1280, height: 720 });
await A.click(`[data-act=tamanho][data-v="${casas}"]`); await A.click('[data-act=iniciar]');
const todos = [A, ...outros];
// cada um "chuta" uma alternativa diferente: alguns acertam, outros não
const t0 = Date.now();
let rodadas = 0;
while (Date.now() - t0 < 60000 && rodadas < 9) {
  for (const [k, p] of todos.entries()) { const o = await p.$(`.opt[data-i="${(k + rodadas) % 5}"]:not([disabled])`); if (o) { await o.click().catch(() => {}); } }
  if (await T.$('.revela')) { rodadas++; await T.waitForSelector('.revela', { state: 'detached' }).catch(() => {}); }
  await A.waitForTimeout(80);
}
await T.waitForSelector('.qscr, .prep');
await T.screenshot({ path: `prints/tv-tabuleiro-${casas}-1280x720.png` });
await T.setViewportSize({ width: 1920, height: 1080 }); await T.waitForTimeout(300);
await T.screenshot({ path: `prints/tv-tabuleiro-${casas}-1920x1080.png` });
await browser.close();
