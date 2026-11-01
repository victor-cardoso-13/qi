/**
 * TODAS as regras da casa do QI num lugar só, comentadas com exemplos.
 * Este arquivo não sabe que existe tela.
 */
export type Nivel = 'medio' | 'dificil' | 'qi';

export const NIVEIS: Nivel[] = ['medio', 'dificil', 'qi'];
export const NIVEL_NOME: Record<Nivel, string> = { medio: 'Médio', dificil: 'Difícil', qi: 'QI' };
/** Segundos para responder, por nível. Acabou o tempo = errou. */
export const TEMPO: Record<Nivel, number> = { medio: 20, dificil: 30, qi: 40 };

export const CATEGORIAS: Record<string, string> = {
  arte: 'Arte',
  historia: 'História',
  esportes: 'Esportes',
  ciencias: 'Ciências',
  geografia: 'Geografia',
  geral: 'Conhecimentos Gerais',
  tecnologia: 'Tecnologia',
  portugues: 'Língua Portuguesa e Literatura',
};

/** ---------- Sala (várias pessoas, cada uma no seu celular) ---------- */
export const MAX_JOGADORES = 10;
/**
 * Tamanho da partida = quantas casas até a chegada. O anfitrião escolhe.
 * Ex.: curta = 12 casas (uns 8 min), normal = 16, longa = 20.
 */
export const TAMANHOS = { curta: 12, normal: 16, longa: 20 } as const;
export const TAMANHO_PADRAO: number = TAMANHOS.normal;
/** Revelação da categoria antes da pergunta (era 6 s quando existia o 2x; agora só mostra o tema). */
export const PREP_MS = 3000;
/** Tempo mostrando o resultado da rodada antes da próxima pergunta. */
export const REVELA_MS = 4500;
/** Acertou: +1 casa. Errou ou não respondeu: fica parado (nunca volta). Não existe mais o 2x. */
export const CASAS_POR_ACERTO = 1;

/** ---------- Solo (sequência: o primeiro erro acaba) ---------- */
/**
 * Dificuldade pela sequência (acertos até agora):
 *   0–5 acertos  → próxima é Médio   (perguntas 1 a 6)
 *   6–12 acertos → próxima é Difícil (perguntas 7 a 13)
 *   13+ acertos  → próxima é QI      (pergunta 14 em diante)
 */
export const SOLO_FAIXAS = { dificil: 6, qi: 13 } as const;
export const SOLO_AJUDAS_INICIAIS = { pular: 2, eliminar: 1 } as const;
/** A cada 10 acertos seguidos ganha 1 ajuda sorteada: Pular ou Eliminar 2. */
export const SOLO_GANHA_A_CADA = 10;
