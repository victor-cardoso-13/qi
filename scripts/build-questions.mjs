// Junta data/src/*.json em questions.json, atribui ids, embaralha com posição equilibrada e valida o banco.
// Formato de escrita: { "p": pergunta, "c": resposta certa, "e": [4 alternativas erradas] }
// Uso: node scripts/build-questions.mjs [--strict]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../data/src/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/questions.json', import.meta.url));
const CATS = ['arte', 'historia', 'esportes', 'ciencias', 'geografia', 'geral', 'tecnologia', 'portugues'];
const TIERS = ['medio', 'dificil', 'qi'];
const TARGET = { medio: 38, dificil: 50, qi: 37 }; // por categoria => 1000 no total
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const BAN = /(todas as (anteriores|alternativas|acima)|nenhuma das (anteriores|alternativas|acima)|\b[a-e] e [a-e]\b.*(corretas?|certas?)|ambas|alternativas? [a-e])/i;
const TEMPORAL = /\b(atualmente|atual |hoje em dia|mais recente|recorde atual|ultimo(a)? (campe|vencedor))/i;

const errors = [], warns = [];
const all = [];
for (const cat of CATS) for (const nivel of TIERS) {
  const f = path.join(SRC, `${cat}-${nivel}.json`);
  if (!fs.existsSync(f)) { warns.push(`faltando ${cat}-${nivel}.json (alvo ${TARGET[nivel]})`); continue; }
  let arr; try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`${f}: JSON inválido (${e.message})`); continue; }
  arr.forEach((q, i) => {
    const e = Array.isArray(q.e) ? q.e : [];
    all.push({ pergunta: q.p, certa: q.c, erradas: e, cat, nivel, _src: `${cat}-${nivel}#${i + 1}` });
  });
  if (arr.length !== TARGET[nivel]) warns.push(`${cat}-${nivel}: ${arr.length} perguntas (alvo ${TARGET[nivel]})`);
}

// posição da certa: ciclos embaralhados de A..E (distribuição uniforme); erradas em ordem embaralhada
let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let cyc = [];
for (const q of all) {
  if (typeof q.certa !== 'string' || !Array.isArray(q.erradas) || q.erradas.length !== 4) { errors.push(`${q._src}: precisa de "c" e 4 erradas em "e"`); q.alternativas = []; continue; }
  if (!cyc.length) cyc = shuf([0, 1, 2, 3, 4]);
  const pos = cyc.pop(); const er = shuf(q.erradas);
  q.alternativas = [...er.slice(0, pos), q.certa, ...er.slice(pos)]; q.correta = pos;
}
const stems = new Map();
let longest = 0;
for (const q of all) {
  const w = (m) => errors.push(`${q._src}: ${m}`);
  if (typeof q.pergunta !== 'string' || q.pergunta.length < 12) { w('pergunta inválida'); continue; }
  if (q.pergunta.length > 260) w('pergunta longa demais (>260)');
  if (!Array.isArray(q.alternativas) || q.alternativas.length !== 5) { continue; }
  if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta > 4) { w('correta fora de 0..4'); continue; }
  const n = q.alternativas.map((a) => a.toLowerCase().replace(/\s+/g, ' ').trim());
  if (new Set(n).size !== 5) w('alternativas repetidas');
  if (q.alternativas.some((a) => typeof a !== 'string' || !a.trim() || a.length > 90)) w('alternativa vazia ou longa (>90)');
  if (BAN.test(q.pergunta + ' ' + q.alternativas.join(' | '))) w('usa "todas/nenhuma/A e B" (quebra com embaralhamento)');
  if (TEMPORAL.test(q.pergunta)) w('fato que muda com o tempo (ancorar o ano)');
  const k = norm(q.pergunta);
  if (stems.has(k)) w(`pergunta duplicada de ${stems.get(k)}`); else stems.set(k, q._src);
  const lens = q.alternativas.map((a) => a.length);
  if (lens[q.correta] === Math.max(...lens) && lens.filter((l) => l === lens[q.correta]).length === 1) longest++;
}
const share = all.length ? longest / all.length : 0;
if (all.length >= 40 && share > 0.32) warns.push(`resposta correta é a mais longa em ${(share * 100).toFixed(0)}% (ideal ≈20%) — vazamento de gabarito`);
const dist = [0, 0, 0, 0, 0]; all.forEach((q) => Number.isInteger(q.correta) && dist[q.correta]++);

// quase-duplicatas (Jaccard de palavras)
const STOP = new Set('qual quem quais quando onde como para pela pelo uma umas uns dos das nos nas que foi sao esta este esse essa dessa deste destes sigla significa empresa criou criada criado fundou escreveu autor nome capital pais cidade seguintes entre sobre apos antes ainda mais menos muito'.split(' '));
const toks = all.map((q) => new Set(norm(q.pergunta).split(' ').filter((w) => w.length > 3 && !STOP.has(w))));
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  let inter = 0; for (const w of toks[i]) if (toks[j].has(w)) inter++;
  const u = toks[i].size + toks[j].size - inter;
  if (u && inter >= 4 && inter / u > 0.6) warns.push(`quase duplicada: ${all[i]._src} ~ ${all[j]._src}`);
}

const out = all.map((q, i) => ({ id: i + 1, cat: q.cat, nivel: q.nivel, pergunta: q.pergunta.trim(), alternativas: q.alternativas.map((a) => a.trim()), correta: q.correta }));
if (!errors.length) fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${all.length} perguntas | gabarito por posição A-E: ${dist.join('/')} | correta=mais longa: ${(share * 100).toFixed(0)}%`);
warns.forEach((w) => console.log('aviso:', w));
errors.forEach((e) => console.log('ERRO:', e));
if (errors.length) { console.log(`${errors.length} erro(s) — questions.json NÃO gerado.`); process.exit(1); }
console.log('questions.json gerado.');
