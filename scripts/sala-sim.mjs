// Simula uma sala com 3 abas (modo local, só em dev) até o fim da partida e confere as regras.
// Uso: (npx vite --port 5200 rodando) PORTA=5200 node scripts/sala-sim.mjs
import { chromium } from 'playwright';
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const erros = [];
const abrir = async (url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.stack?.split('\n').slice(0, 4).join(' <- '))); await p.goto(url); return p; };
const A = await abrir(`${base}?local&speed=25&as=pA`);
await A.fill('#nome', 'Ana'); await A.click('[data-act=criar]');
await A.waitForSelector('.lobby'); const code = (await A.textContent('.cod')).trim();
const B = await abrir(`${base}?local&speed=25&as=pB&sala=${code}`); await B.waitForSelector('[data-act=entrar-aqui]'); await B.fill('#nome', 'Beto'); await B.click('[data-act=entrar-aqui]');
const C = await abrir(`${base}?local&speed=25&as=pC&sala=${code}`); await C.waitForSelector('[data-act=entrar-aqui]'); await C.fill('#nome', 'Cris'); await C.click('[data-act=entrar-aqui]');
await A.waitForFunction(() => document.querySelectorAll('.moves li').length === 3);
await A.click('[data-act=tamanho][data-v="12"]');
await A.click('[data-act=iniciar]');
// cada aba responde sempre a alternativa A (ou B), sem olhar a certa: alguns acertam, outros erram
let fim = false, rodadas = 0;
const t0 = Date.now();
while (!fim && Date.now() - t0 < 150000) {
  for (const [p, i] of [[A, 0], [B, 1], [C, 2]]) {
    const o = await p.$(`.opt[data-i="${i}"]:not([disabled])`);
    if (o) { await o.click().catch(() => {}); }
  }
  fim = !!(await A.$('.fimsala'));
  await A.waitForTimeout(150);
}
console.log('fim da partida:', fim, 'erros de página:', erros.length ? erros : 'nenhum');
if (fim) {
  console.log('vencedor:', await A.textContent('.winner'));
  console.log('ranking:', (await A.$$eval('.rank li', (l) => l.map((x) => x.innerText.replace(/\n+/g, ' | ')))).join(' // '));
  await A.setViewportSize({ width: 390, height: 844 }); await A.screenshot({ path: 'prints/sala-fim.png' });
}
await browser.close();
process.exit(fim && !erros.length ? 0 : 1);
