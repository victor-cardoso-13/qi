import { describe, expect, it } from 'vitest';
import {
  ajudaGanha, aplicarResultado, chancesNivel, classificar, eliminar2, embaralhar, nivelSolo, perguntaSolo,
  proximaPergunta, tempoGasto, vencedores, type Pergunta,
} from '../src/motor/motor.ts';
import { NIVEIS, type Nivel } from '../src/motor/regras.ts';
import { readFileSync } from 'node:fs';
import { TEXTOS_FIXOS, partesBoasVindas, partesFim, partesPergunta, partesResposta, textoCerta, textoPergunta } from '../src/motor/narracao.ts';
import banco from '../public/questions.json';

const BANCO = banco as Pergunta[];

describe('banco de perguntas', () => {
  it('tem 1000 perguntas, 5 alternativas e resposta válida', () => {
    expect(BANCO).toHaveLength(1000);
    for (const q of BANCO) {
      expect(q.alternativas).toHaveLength(5);
      expect(q.correta).toBeGreaterThanOrEqual(0);
      expect(q.correta).toBeLessThan(5);
    }
  });
});

describe('níveis pela posição', () => {
  it('começo nunca QI e reta final nunca Médio', () => {
    expect(chancesNivel(0, 20).qi).toBe(0);
    expect(chancesNivel(19, 20).medio).toBe(0);
  });
  it('partida curta estica a escala: 6 de 12 casas equivale a 10 de 20', () => {
    const a = chancesNivel(6, 12), b = chancesNivel(10, 20);
    expect(a.dificil).toBeCloseTo(b.dificil, 10);
  });
  it('as chances somam 1', () => {
    for (const ref of [0, 3, 7, 12, 18]) {
      const p = chancesNivel(ref, 16);
      expect(p.medio + p.dificil + p.qi).toBeCloseTo(1, 10);
    }
  });
});

describe('movimento (sem 2x)', () => {
  it('acertou +1, errou fica parado, nunca passa da chegada', () => {
    expect(aplicarResultado(5, true, 16)).toEqual({ pos: 6, delta: 1 });
    expect(aplicarResultado(5, false, 16)).toEqual({ pos: 5, delta: 0 });
    expect(aplicarResultado(16, true, 16)).toEqual({ pos: 16, delta: 0 });
    expect(aplicarResultado(0, false, 16).pos).toBe(0);
  });
});

describe('desempate pela soma dos tempos', () => {
  const j = (id: string, pos: number, tt: number, n = 0) => ({ id, pos, tt, j: n });
  it('classifica por casas e, empatados, pelo menor tempo total', () => {
    const r = classificar([j('a', 10, 90, 0), j('b', 10, 70, 1), j('c', 12, 500, 2)]);
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
  it('dois chegam juntos: vence o mais rápido; só um vencedor', () => {
    expect(vencedores([j('a', 16, 300), j('b', 16, 250), j('c', 15, 1)], 16)).toEqual(['b']);
  });
  it('tempos idênticos empatam de verdade', () => {
    expect(vencedores([j('a', 16, 250), j('b', 16, 250)], 16).sort()).toEqual(['a', 'b']);
  });
  it('ninguém chegou: sem vencedor', () => {
    expect(vencedores([j('a', 15, 1)], 16)).toEqual([]);
  });
  it('tempo gasto: o que levou, no máximo o limite; sem resposta = limite', () => {
    expect(tempoGasto(1000, 4000, 20000)).toBe(3000);
    expect(tempoGasto(1000, 99999, 20000)).toBe(20000);
    expect(tempoGasto(1000, undefined, 20000)).toBe(20000);
    expect(tempoGasto(1000, 500, 20000)).toBe(0);
  });
});

describe('eliminar 2', () => {
  it('nunca esconde a certa e sempre esconde 2 diferentes', () => {
    for (let c = 0; c < 5; c++) for (let s = 0; s < 50; s++) {
      const fora = eliminar2(`q${s}:x`, c);
      expect(fora).toHaveLength(2);
      expect(fora).not.toContain(c);
      expect(fora[0]).not.toBe(fora[1]);
    }
  });
  it('embaralhar é permutação', () => {
    expect(embaralhar(5).sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('sala: sorteio de perguntas', () => {
  it('nunca repete e esgota o banco inteiro', () => {
    const usadas: Record<string, boolean> = {};
    let cat: string | undefined;
    for (let i = 0; i < 1000; i++) {
      const q = proximaPergunta(BANCO, usadas, (i / 1000) * 16, 16, cat);
      expect(q).not.toBeNull();
      expect(usadas[q!.id]).toBeUndefined();
      usadas[q!.id] = true;
      cat = q!.cat;
    }
    expect(proximaPergunta(BANCO, usadas, 5, 16)).toBeNull();
  });
});

describe('solo', () => {
  it('nível pela sequência: 0–5 médio, 6–12 difícil, 13+ QI', () => {
    const por = (n: number): Nivel => nivelSolo(n);
    expect([0, 5, 6, 12, 13, 40].map(por)).toEqual(['medio', 'medio', 'dificil', 'dificil', 'qi', 'qi']);
  });
  it('a pergunta sai do nível da sequência', () => {
    for (const [seq, nivel] of [[0, 'medio'], [8, 'dificil'], [15, 'qi']] as const) {
      expect(perguntaSolo(BANCO, seq, new Set(), new Set())!.nivel).toBe(nivel);
    }
  });
  it('prefere perguntas ainda não vistas', () => {
    const medias = BANCO.filter((q) => q.nivel === 'medio');
    const vistas = new Set(medias.slice(0, medias.length - 3).map((q) => q.id));
    const livres = new Set(medias.slice(-3).map((q) => q.id));
    for (let i = 0; i < 30; i++) expect(livres.has(perguntaSolo(BANCO, 0, new Set(), vistas)!.id)).toBe(true);
  });
  it('quando tudo do nível já foi visto, volta a usar as vistas, mas nunca repete na mesma partida', () => {
    const medias = BANCO.filter((q) => q.nivel === 'medio');
    const todasVistas = new Set(medias.map((q) => q.id));
    const naPartida = new Set(medias.slice(1).map((q) => q.id));
    expect(perguntaSolo(BANCO, 0, naPartida, todasVistas)!.id).toBe(medias[0].id);
  });
  it('nível esgotado usa o mais próximo', () => {
    const naPartida = new Set(BANCO.filter((q) => q.nivel === 'qi').map((q) => q.id));
    expect(perguntaSolo(BANCO, 20, naPartida, new Set())!.nivel).toBe('dificil');
    expect(NIVEIS).toContain('dificil');
  });
  it('ajuda: só em 10, 20, 30… acertos, sorteando entre Pular e Eliminar', () => {
    expect(ajudaGanha(0)).toBeNull();
    expect(ajudaGanha(9)).toBeNull();
    expect(ajudaGanha(11)).toBeNull();
    expect(ajudaGanha(10, () => 0.1)).toBe('pular');
    expect(ajudaGanha(20, () => 0.9)).toBe('eliminar');
  });
});

describe('mestre de cerimônias (voz)', () => {
  const falas = () => {
    const f: Record<string, string> = { ...TEXTOS_FIXOS };
    for (const q of BANCO) { f[`q-${q.id}`] = textoPergunta(q); f[`r-${q.id}`] = textoCerta(q); }
    return f;
  };
  it('a pergunta abre com a categoria e a resposta certa vem do banco', () => {
    const q = BANCO[0];
    expect(partesPergunta(q, false).map((p) => p.clip)).toEqual(['cat-arte', 'q-1']);
    expect(partesPergunta(q, true)[0].clip).toBe('vamos-comecar');
    expect(textoCerta(q)).toBe('A resposta certa é: Leonardo da Vinci.');
    expect(partesResposta(q, false).map((p) => p.clip)).toEqual(['r-1', 'ninguem-acertou']);
  });
  it('toda categoria do banco tem frase gravada', () => {
    for (const q of BANCO) expect(TEXTOS_FIXOS[`cat-${q.cat}`], q.cat).toBeTruthy();
  });
  it('nunca fala nome de jogador (só fixas, perguntas e respostas)', () => {
    for (const p of [...partesBoasVindas(), ...partesFim(true), ...partesFim(false), ...partesResposta(BANCO[1], true)]) expect(p.clip).toBeTruthy();
  });
  it('os áudios gravados (indice.json) batem com o texto de hoje', () => {
    const f = falas();
    const idx = JSON.parse(readFileSync(new URL('../public/voz/indice.json', import.meta.url), 'utf8')) as Record<string, string>;
    for (const [clip, texto] of Object.entries(f)) expect(idx[clip], clip).toBe(texto);
  });
});
