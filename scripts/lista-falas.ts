// Lista TODAS as falas gravadas do mestre de cerimônias (clip → texto), a partir do mesmo código que o jogo usa.
// Uso: node scripts/lista-falas.ts > data/falas.json   (depois: python3 scripts/gerar-narracao.py)
import { readFileSync } from 'node:fs';
import { TEXTOS_FIXOS, textoCerta, textoPergunta } from '../src/motor/narracao.ts';
import type { Pergunta } from '../src/motor/motor.ts';

const perguntas: Pergunta[] = JSON.parse(readFileSync(new URL('../public/questions.json', import.meta.url), 'utf8'));
const falas: Record<string, string> = { ...TEXTOS_FIXOS };
for (const q of perguntas) { falas[`q-${q.id}`] = textoPergunta(q); falas[`r-${q.id}`] = textoCerta(q); }
process.stdout.write(JSON.stringify(falas));
