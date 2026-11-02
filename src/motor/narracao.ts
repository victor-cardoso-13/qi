/** Falas do mestre de cerimônias da sala (tela da TV `?tv=CODIGO`). Funções puras (sem tela, sem som). Nunca diz nome de jogador. */
import { CATEGORIAS } from './regras.ts';
import type { Pergunta } from './motor.ts';

/**
 * Uma fala é uma lista de partes. Parte com `clip` tem áudio gravado (Edge TTS, pasta public/voz/, feito por
 * scripts/gerar-narracao.py a partir de scripts/lista-falas.ts); sem `clip`, ou se o áudio faltar, fala a voz do aparelho.
 */
export interface Parte { t: string; clip?: string }

export const TEXTOS_FIXOS: Record<string, string> = {
  'boas-vindas': 'Bem-vindos ao QI! Escaneiem o código na tela para entrar. Quem chegar primeiro à linha de chegada, ganha!',
  'vamos-comecar': 'Vamos começar!',
  'fim-de-jogo': 'Fim de jogo! Parabéns a todos!',
  'acabaram': 'Acabaram as perguntas! Fim de jogo!',
  'ninguem-acertou': 'Ninguém acertou desta vez.',
  'acertaram': 'Muito bem!',
};
for (const [id, nome] of Object.entries(CATEGORIAS)) TEXTOS_FIXOS[`cat-${id}`] = `Categoria: ${nome}.`;

export const textoPergunta = (q: Pergunta) => q.pergunta;
export const textoCerta = (q: Pergunta) => `A resposta certa é: ${q.alternativas[q.correta]}.`;

const fixa = (clip: string): Parte => ({ t: TEXTOS_FIXOS[clip], clip });

export const partesBoasVindas = (): Parte[] => [fixa('boas-vindas')];

/** "Vamos começar! Categoria: História. <pergunta>" (a abertura só na 1ª pergunta da partida). */
export const partesPergunta = (q: Pergunta, abertura: boolean): Parte[] => [
  ...(abertura ? [fixa('vamos-comecar')] : []),
  fixa(`cat-${q.cat}`),
  { t: textoPergunta(q), clip: `q-${q.id}` },
];

/** Fim de cada pergunta: a resposta certa e, se ninguém acertou, um aviso curto. Sem nomes. */
export const partesResposta = (q: Pergunta, alguemAcertou: boolean): Parte[] => [
  { t: textoCerta(q), clip: `r-${q.id}` },
  fixa(alguemAcertou ? 'acertaram' : 'ninguem-acertou'),
];

export const partesFim = (acabaram: boolean): Parte[] => [fixa(acabaram ? 'acabaram' : 'fim-de-jogo')];

export const textoDasPartes = (ps: Parte[]) => ps.map((p) => p.t).join(' ');

/**
 * Melhor voz em português do Brasil entre as do aparelho (só usada se o áudio gravado faltar).
 * No Microsoft Edge aparecem as vozes neurais ("Microsoft Antonio Online (Natural)").
 */
export function escolherVoz<T extends { name: string; lang: string }>(vozes: T[]): T | undefined {
  const pt = vozes.filter((v) => /^pt[-_]BR$/i.test(v.lang));
  const nota = (v: T) =>
    (/Antonio/i.test(v.name) ? 100 : 0) + (/Online|Natural/i.test(v.name) ? 50 : 0) + (/Francisca|Thalita/i.test(v.name) ? 40 : 0)
    + (/Google/i.test(v.name) ? 20 : 0) + (/Luciana|Felipe|Eddy|Reed|Rocko/i.test(v.name) ? 10 : 0);
  return pt.reduce<T | undefined>((m, v) => (!m || nota(v) > nota(m) ? v : m), undefined);
}

/** Quanto tempo (ms) uma fala leva, no mínimo, para o jogo seguir mesmo se o som falhar. */
export const duracaoEstimada = (texto: string) => 1500 + texto.length * 75;
/** Folga máxima que a sala espera a leitura da pergunta antes de seguir sem a TV (ms). */
export const esperaMaxima = (ps: Parte[]) => ps.reduce((s, p) => s + duracaoEstimada(p.t), 0) * 1.6 + 4000;
