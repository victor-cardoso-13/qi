// Pior caso da TV: 10 jogadores (todos no Início), nos 3 estilos. Tudo mudo.
// Uso: (npx vite --port 5200 rodando) PORTA=5200 node scripts/tv-10.mjs [escada|pista|torre] [casas=20]
import { chromium } from 'playwright';
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const estilo = process.argv[2] ?? 'escada', casas = process.argv[3] ?? '20';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const abrir = async (url, w) => { const p = await ctx.newPage(); if (w) await p.setViewportSize(w); await p.goto(url); return p; };
const A = await abrir(`${base}?local&speed=25&as=p0`);
await A.fill('#nome', 'Ana'); await A.click('[data-act=criar]');
await A.waitForSelector('.lobby'); const code = (await A.textContent('.cod')).trim();
const nomes = ['Beto', 'Carla', 'Davi', 'Eva', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'João'];
for (const [k, n] of nomes.entries()) { const p = await abrir(`${base}?local&speed=25&as=p${k + 1}&sala=${code}`); await p.waitForSelector('[data-act=entrar-aqui]'); await p.fill('#nome', n); await p.click('[data-act=entrar-aqui]'); }
const T = await abrir(`${base}?local&speed=25&tv=${code}`, { width: 1280, height: 720 });
await A.click(`[data-act=tamanho][data-v="${casas}"]`);
await A.click('[data-act=cockpit]'); await A.click(`[data-act=estilo][data-v=${estilo}]`); await A.screenshot({ path: 'prints/cockpit-10-390x844.png' }); await A.click('[data-act=cockpit-fechar]');
await A.click('[data-act=iniciar]');
const foto = async (nome) => { for (const [w, h] of [[1280, 720], [1920, 1080]]) { await T.setViewportSize({ width: w, height: h }); await T.waitForTimeout(250); await T.screenshot({ path: `prints/tv10-${estilo}-${nome}-${w}x${h}.png` }); } };
await T.waitForSelector('.qscr, .prep'); await foto('inicio');
await T.waitForSelector('.revela', { timeout: 20000 }); await foto('resultado');
await A.click('[data-act=cockpit]'); await A.click('[data-act=encerrar]'); await A.click('[data-act=encerrar-sim]');
await T.waitForSelector('.fimsala'); await foto('fim');
await browser.close();
