/**
 * Mestre de cerimônias da sala: a tela da TV (`?tv=CODIGO`) fala a categoria, a pergunta e a resposta certa
 * (sem nomes de jogadores). Voz = áudios gravados do Edge TTS (Antonio) em public/voz/; se faltar algum, a voz do aparelho.
 * Só liga depois de um toque na TV (o navegador exige). Em testes (`?local` ou `?mudo`) NUNCA toca som.
 */
import { duracaoEstimada, escolherVoz, esperaMaxima, partesBoasVindas, partesFim, partesPergunta, partesResposta, textoDasPartes, type Parte } from '../motor/narracao.ts';
import { PERGUNTAS, VELOCIDADE, params } from './comum.ts';
import { local } from '../nuvem/salas-db.ts';

export const MUDO = local || params.has('mudo');
const BASE = import.meta.env.BASE_URL;
const SILENCIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

let ligado = false;
let falando = false;
let rodada = 0;
let legenda = '';
let indice: Record<string, string> = {};
let cancelarParte: (() => void) | null = null;
const audio = typeof Audio !== 'undefined' && !MUDO ? new Audio() : undefined;
const sintese = () => (typeof window !== 'undefined' && !MUDO ? window.speechSynthesis : undefined);

export const narradorLigado = () => ligado;
export const narradorFalando = () => falando;
export const legendaAtual = () => legenda;

/** Liga o narrador. Chamar DENTRO de um toque: o navegador só libera o som depois de um toque da pessoa. */
export async function ligarNarrador() {
  ligado = true;
  try { sintese()?.speak(new SpeechSynthesisUtterance('')); } catch { /* sem voz do aparelho */ }
  if (audio) { audio.src = SILENCIO; audio.play().catch(() => { /* sem áudio: cai na voz do aparelho */ }); }
  if (!MUDO) { document.documentElement.requestFullscreen?.().catch(() => {}); navigator.wakeLock?.request('screen').catch(() => {}); }
  try { indice = await (await fetch(`${BASE}voz/indice.json`)).json(); } catch { indice = {}; }
}

export function desligarNarrador() { ligado = false; parar(); }

export function parar() {
  rodada++;
  sintese()?.cancel();
  audio?.pause();
  cancelarParte?.();
}

/** Toca um mp3 gravado. Resolve true se tocou até o fim, false se falhou (aí usa-se a voz do aparelho). */
function tocar(clip: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!audio) return resolve(false);
    const limpar = () => { audio.onended = audio.onerror = null; cancelarParte = null; };
    audio.onended = () => { limpar(); resolve(true); };
    audio.onerror = () => { limpar(); resolve(false); };
    cancelarParte = () => { limpar(); resolve(true); };
    audio.src = `${BASE}voz/${clip}.mp3`;
    audio.play().catch(() => { limpar(); resolve(false); });
  });
}

function falarAparelho(texto: string): Promise<void> {
  const ss = sintese();
  return new Promise((resolve) => {
    // Sem som (testes) ou voz falhou: "dura" o tempo de leitura e o jogo segue só com a legenda.
    const tempo = setTimeout(() => fim(), MUDO ? 300 / VELOCIDADE : (duracaoEstimada(texto) * (ss ? 2.2 : 1) + 2000) / VELOCIDADE);
    const fim = () => { clearTimeout(tempo); cancelarParte = null; resolve(); };
    cancelarParte = fim;
    if (!ss) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    const v = escolherVoz(ss.getVoices());
    if (v) u.voice = v;
    u.onend = fim; u.onerror = fim;
    ss.speak(u);
  });
}

/** Fala as partes em sequência. Resolve quando termina (ou é interrompida). Sem narrador ligado, não faz nada. */
export function narrar(partes: Parte[]): Promise<void> {
  if (!ligado) return Promise.resolve();
  parar();
  const meu = rodada;
  legenda = textoDasPartes(partes);
  falando = true;
  return new Promise<void>((resolve) => {
    let feito = false;
    const tempo = setTimeout(() => fim(), esperaMaxima(partes) / VELOCIDADE); // rede de segurança
    const fim = () => { if (feito) return; feito = true; clearTimeout(tempo); if (meu === rodada) falando = false; resolve(); };
    void (async () => {
      for (const p of partes) {
        if (meu !== rodada) return fim();
        const gravada = !MUDO && p.clip && indice[p.clip] === p.t && VELOCIDADE === 1; // texto mudou desde a gravação? usa a voz do aparelho
        if (!(gravada && await tocar(p.clip!))) { if (meu === rodada) await falarAparelho(p.t); }
      }
      fim();
    })();
  });
}

// ---------- ligação com a sala ----------
export interface VistaSala {
  status: string; game: number; exhausted?: boolean;
  cur?: { n: number; phase?: string; qid?: number; leitura?: boolean; ans?: number };
  acertou: boolean;
}
export interface AcoesSala { lido(n: number): void }

let dito = '';
let aberturaDe = -1;

/** Chamada a cada mudança da sala (só na TV). Fala uma vez por fase de cada rodada. */
export function aoMudar(v: VistaSala | null, acoes: AcoesSala) {
  if (!ligado || !v) return;
  const c = v.cur;
  let chave = '';
  if (v.status === 'finished') chave = `${v.game}:fim`;
  else if (v.status === 'playing' && c?.phase && c.qid) chave = `${v.game}:${c.n}:${c.phase}`;
  if (!chave || chave === dito) return;
  const q = c?.qid ? PERGUNTAS.get(c.qid) : undefined;
  if (v.status === 'finished') { dito = chave; void narrar(partesFim(!!v.exhausted)); return; }
  if (!q) return;
  if (c!.phase === 'prep') {
    dito = chave;
    const abertura = aberturaDe !== v.game; aberturaDe = v.game;
    const n = c!.n;
    void narrar(partesPergunta(q, abertura)).then(() => { if (c!.leitura) acoes.lido(n); });
  } else if (c!.phase === 'reveal') {
    dito = chave;
    void narrar(partesResposta(q, v.acertou));
  }
}

export const boasVindas = () => narrar(partesBoasVindas());
