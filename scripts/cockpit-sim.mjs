// Teste do Cockpit (celular do anfitrião): tirar jogador, bloqueio de volta, encerrar o jogo. TUDO MUDO.
// Uso: (npx vite --port 5200 rodando) PORTA=5200 node scripts/cockpit-sim.mjs
import { chromium } from 'playwright';
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const abrir = async (url, w) => { const p = await ctx.newPage(); if (w) await p.setViewportSize(w); await p.goto(url); return p; };
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };
const A = await abrir(`${base}?local&speed=25&as=pA`);
await A.fill('#nome', 'Ana'); await A.click('[data-act=criar]');
await A.waitForSelector('.lobby'); const code = (await A.textContent('.cod')).trim();
const mk = async (id, nome) => { const p = await abrir(`${base}?local&speed=25&as=${id}&sala=${code}`); await p.waitForSelector('[data-act=entrar-aqui]'); await p.fill('#nome', nome); await p.click('[data-act=entrar-aqui]'); return p; };
const B = await mk('pB', 'Beto'), D = await mk('pD', 'Davi');
const T = await abrir(`${base}?local&speed=25&tv=${code}`, { width: 1280, height: 720 });
ok(!(await B.$('[data-act=cockpit]')), 'quem não é anfitrião não vê o Cockpit');
await A.click('[data-act=iniciar]'); await A.waitForSelector('.qscr, .prep');
// 1) tirar o Davi no meio da partida
await A.click('[data-act=cockpit]'); await A.click('[data-act=tirar][data-id=pD]'); await A.screenshot({ path: 'prints/cockpit-tirar-390x844.png' });
await A.click('[data-act=tirar-sim]'); await A.click('[data-act=cockpit-fechar]');
await D.waitForFunction(() => /retirou/.test(document.body.innerText), null, { timeout: 5000 }).then(() => ok(true, 'Davi saiu da sala e viu o aviso'), () => ok(false, 'Davi não viu o aviso'));
const D2 = await abrir(`${base}?local&speed=25&as=pD&sala=${code}`);
await D2.waitForSelector('[data-act=entrar-aqui]'); await D2.fill('#nome', 'Davi'); await D2.click('[data-act=entrar-aqui]');
await D2.waitForTimeout(800);
ok(!(await D2.$('.qscr, .prep, .revela')) && /n[ãa]o deixou|retirou/.test(await D2.innerText('body')), 'Davi não consegue voltar');
ok(/\/2\b/.test(await A.innerText('.streak')), 'o jogo continua com 2 jogadores (contador /2)');
// 2) trocar o estilo pela TV (padrão: escada)
ok(!!(await T.$('.tab.esc')), 'TV começa na escada');
await A.click('[data-act=cockpit]'); await A.click('[data-act=estilo][data-v=pista]'); await A.click('[data-act=cockpit-fechar]');
await T.waitForSelector('.tab.pis', { timeout: 5000 }).then(() => ok(true, 'TV mudou para a pista'), () => ok(false, 'TV não mudou'));
await A.click('[data-act=cockpit]'); await A.click('[data-act=estilo][data-v=torre]'); await A.click('[data-act=cockpit-fechar]');
await T.waitForSelector('.tab.tor', { timeout: 5000 }).then(() => ok(true, 'TV mudou para a torre'), () => ok(false, 'TV não mudou'));
await A.click('[data-act=cockpit]'); await A.click('[data-act=estilo][data-v=escada]'); await A.click('[data-act=cockpit-fechar]');
await T.waitForSelector('.tab.esc');
// 3) encerrar o jogo a qualquer momento
await A.click('[data-act=cockpit]'); await A.click('[data-act=encerrar]'); await A.screenshot({ path: 'prints/cockpit-encerrar-390x844.png' }); await A.click('[data-act=encerrar-sim]');
await T.waitForSelector('.fimsala', { timeout: 5000 }).then(() => ok(true, 'TV mostra o fim do jogo'), () => ok(false, 'TV não mostrou o fim'));
ok(/encerrado/i.test(await T.innerText('body')), 'texto "Jogo encerrado"');
await T.screenshot({ path: 'prints/tv-encerrado-1280x720.png' }); await A.screenshot({ path: 'prints/host-encerrado-390x844.png' });
ok(!!(await A.$('[data-act=nova]')), 'anfitrião pode começar nova partida');
await A.click('[data-act=nova]'); await A.waitForSelector('.qscr, .prep'); ok(true, 'nova partida começou');
await browser.close();
