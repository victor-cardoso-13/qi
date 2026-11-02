// Sala com 2 jogadores + tela da TV com o narrador ligado, TUDO MUDO (?local nunca toca som). Confere que:
// o anfitrião espera a leitura (cur.leitura/lido), a legenda aparece e a partida chega ao fim.
// Uso: (npx vite --port 5200 rodando) PORTA=5200 node scripts/tv-sim.mjs
import { chromium } from 'playwright';
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const erros = [];
const abrir = async (url, w) => { const p = await ctx.newPage(); if (w) await p.setViewportSize(w); p.on('pageerror', (e) => erros.push(e.message)); await p.goto(url); return p; };
const A = await abrir(`${base}?local&speed=25&as=pA`);
await A.fill('#nome', 'Ana'); await A.click('[data-act=criar]');
await A.waitForSelector('.lobby'); const code = (await A.textContent('.cod')).trim();
const B = await abrir(`${base}?local&speed=25&as=pB&sala=${code}`); await B.waitForSelector('[data-act=entrar-aqui]'); await B.fill('#nome', 'Beto'); await B.click('[data-act=entrar-aqui]');
const T = await abrir(`${base}?local&speed=25&tv=${code}`, { width: 1280, height: 720 });
await T.waitForSelector('[data-act=som]'); await T.click('[data-act=som]');
await T.waitForSelector('.somtv.on');
await A.click('[data-act=tamanho][data-v="12"]'); await A.click('[data-act=iniciar]');
let fim = false, leituras = 0, legendas = new Set(), visto = new Set();
const t0 = Date.now();
while (!fim && Date.now() - t0 < 120000) {
  for (const [p, i] of [[A, 0], [B, 1]]) { const o = await p.$(`.opt[data-i="${i}"]:not([disabled])`); if (o) await o.click().catch(() => {}); }
  const lei = await A.$('.prep .dica'); if (lei) { const k = await A.evaluate(() => document.querySelector('.prep .dica')?.textContent); if (k?.includes('narrador')) leituras++; }
  const leg = await T.evaluate(() => document.querySelector('.tvnar small')?.textContent || ''); if (leg) legendas.add(leg.replace('🎙️ ', ''));
  fim = !!(await A.$('.fimsala'));
  await A.waitForTimeout(100);
}
console.log('fim:', fim, '| fases de leitura vistas no celular:', leituras > 0, '| legendas distintas na TV:', legendas.size, '| erros:', erros.length ? erros : 'nenhum');
console.log([...legendas].slice(0, 6).join('\n'));
await T.screenshot({ path: 'prints/tv-narrador.png' });
await browser.close();
process.exit(fim && leituras > 0 && legendas.size > 3 && !erros.length ? 0 : 1);
