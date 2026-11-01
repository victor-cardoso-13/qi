// Prints automáticos nos aparelhos que importam. Uso: (npx vite --port 5199 rodando) node scripts/prints.mjs <pasta>
// Nunca iPhone SE. iPad 1180×820 e 820×1180; iPhone em pé 440×800 e 390×844; deitado 956×360; e 393×852 com área segura.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const pasta = process.argv[2] ?? 'prints';
mkdirSync(pasta, { recursive: true });
const telas = { 'ipad-deitado': [1180, 820], 'ipad-em-pe': [820, 1180], 'iphone-440x800': [440, 800], 'iphone-390x844': [390, 844], 'iphone-deitado': [956, 360] };
const base = `http://localhost:${process.env.PORTA ?? 5199}/`;
const browser = await chromium.launch();
const falhas = [];

async function rolagem(page, rotulo) { // nada deve rolar nas telas de jogo
  const r = await page.evaluate(() => { const v = document.querySelector('.vista'); return v ? v.scrollHeight - v.clientHeight : 0; });
  if (r > 1) falhas.push(`${rotulo}: rola ${r}px`);
}

for (const q of [238, 855, 1]) {
  for (const [nome, [width, height]] of Object.entries(telas)) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(`${base}?q=${q}&speed=0.0001`);
    if (q === 238) { await page.waitForTimeout(300); await page.screenshot({ path: `${pasta}/inicio-${nome}.png` }); await rolagem(page, `inicio ${nome}`); }
    await page.click('[data-act=solo]');
    await page.waitForSelector('.opt');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${pasta}/solo-q${q}-${nome}.png` });
    await rolagem(page, `solo q${q} ${nome}`);
    if (q === 238) {
      await page.click('[data-act=pausar]'); await page.waitForTimeout(200);
      await page.screenshot({ path: `${pasta}/solo-pausa-${nome}.png` });
      await page.click('[data-act=continuar]');
      await page.click('.opt >> nth=0'); await page.waitForTimeout(250);
      await page.screenshot({ path: `${pasta}/solo-erro-${nome}.png` });
      await rolagem(page, `solo erro ${nome}`);
      await page.click('[data-act=resultado]'); await page.waitForTimeout(250);
      await page.screenshot({ path: `${pasta}/solo-fim-${nome}.png` });
      await rolagem(page, `solo fim ${nome}`);
    }
    await page.close();
  }
}
await browser.close();
console.log(falhas.length ? 'ROLAGEM:\n' + falhas.join('\n') : 'nenhuma rolagem nas telas de jogo');
