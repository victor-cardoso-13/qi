# QI — instruções para o Claude

Quiz de conhecimentos (1000 perguntas, 5 alternativas) para jogar **sozinho** (sequência) ou em **sala** (corrida de 12/16/20 casas, cada um no seu celular).
**Esta pasta é só do QI**: repositório https://github.com/victor-cardoso-13/qi, publicado em https://victor-cardoso-13.github.io/qi/ .
Não mexa em outros jogos daqui. A versão antiga (JS puro, Firebase Hosting em `qi-quiz-831e67.web.app`) está em `../qi-antigo/` e **continua no ar** (o Victor pediu para não desligar o link antigo).

## Como falar com o usuário
Português, linguagem simples, passo a passo (ele não programa). Mudança visual: mock primeiro, publicar só depois do "ok".
Imagens: salvar em `prints/` e dar hiperlink relativo. HTML: abrir no Safari na hora.

## Visual (aprovado pelo Victor): painel HUD verde-menta
Quase preto `#0a0c10`, verde `#34d399`, cantos marcados, números em JetBrains Mono, texto em Inter (`src/estilo.css`). É exceção à identidade creme dos outros jogos. Os mocks estão em `mocks/`.
O bloco `@media (display-mode: standalone)` do `estilo.css` (tela cheia no iOS 26) **não pode ser apagado**.

## Regras da casa (todas em `src/motor/regras.ts`, testadas em `tests/motor.test.ts`)
- **Solo:** primeiro erro **ou tempo esgotado** acaba. Nível pela sequência (0–5 médio, 6–12 difícil, 13+ QI). Ajudas: 2 Pular + 1 Eliminar 2; a cada 10 acertos ganha 1 sorteada (Pular ou Eliminar). Pausa livre (esconde a pergunta; sair da aba pausa sozinho). Prefere perguntas ainda não vistas (`vistas` no aparelho/conta). Recorde = número + data. **Sem títulos.**
- **Sala:** acertou +1, errou fica parado (não existe 2x nem −1). Rapidez só **desempata**: vence quem chega com a **menor soma dos tempos de resposta** (sem resposta = tempo todo). Eliminar 2 uma vez por partida; sem Pular. Sem pausa; tem "Sair da sala" (anfitrião sai → outro assume). Revelação da categoria 3 s, resultado 4,5 s.
- Tamanho da partida: o anfitrião escolhe 12/16/20 (as faixas Médio/Difícil/QI esticam proporcionalmente).

## Mestre de cerimônias (voz na TV) — feito igual ao Chutômetro
- Tela da TV = `?tv=CODIGO` (botão "Abrir tabuleiro em outra tela" no celular do anfitrião). Nela, o botão **"Tocar para ligar o narrador"** (precisa de um toque) liga a voz.
- Fala só: boas-vindas, "Vamos começar!", **categoria + pergunta**, **resposta certa** ("Muito bem!"/"Ninguém acertou desta vez."), fim de jogo. **Nunca diz nomes de jogadores** (pedido do Victor). Não lê as alternativas.
- Voz = **áudios gravados do Edge TTS (pt-BR Antonio)** em `public/voz/*.mp3` (`q-ID`, `r-ID`, frases fixas) + `indice.json`; falta algum → voz do aparelho. Falas em `src/motor/narracao.ts`, tocador em `src/ui/narrador.ts`. **Mudou texto de fala ou pergunta?** `node scripts/lista-falas.ts > data/falas.json && python3 scripts/gerar-narracao.py` (só ESCREVE arquivos, retomável; usa `edge-tts`). O teste confere que `indice.json` bate com os textos.
- Sincronia: a TV grava `voz` (batida a cada 5 s) na sala. Com a batida recente, o anfitrião põe `cur.leitura` na fase `prep` e só começa a contar o tempo quando a TV grava `cur.lido` (ou no limite `esperaMaxima`); a revelação dura o tempo de falar a resposta. TV desligada = jogo normal.
- **NUNCA testar com som.** `?local` (só dev) e `?mudo` deixam o narrador mudo. Teste: `npx vite --port 5200` e `PORTA=5200 node scripts/tv-sim.mjs`.

## Organização
- `src/motor/` regras puras (`regras.ts`, `motor.ts`). `src/ui/` telas (`inicio`, `solo`, `sala`, `comum`, `dados`). `src/main.ts` liga toques.
- `src/nuvem/`: `conta.ts` (login, projeto **jogos-sem-anuncio**), `sincronia.ts` (gaveta do aparelho ↔ `jogadores/{uid}/jogos/qi`: nome, recorde, vitórias, vistas), `salas-db.ts` + `salas-config.ts` (**Firebase próprio do QI, Realtime Database, só para salas** — exceção histórica; regras em `../qi-antigo/database.rules.json`, deploy com `firebase deploy --only database --project qi-quiz-831e67` de lá).
- Login é opcional: "Convidado" joga igual, com a gaveta `convidado` só no aparelho.
- Perguntas: `data/src/*.json` → `node scripts/build-questions.mjs` gera `public/questions.json` (**congelado**: ids usados em `vistas`; não regerar sem motivo).
- Teste de sala com várias abas: `npx vite --port 5200` e `PORTA=5200 node scripts/sala-sim.mjs` (usa `?local`, só em dev). `?speed=N` acelera tempos; `?q=ID` força a 1ª pergunta do solo (testes).

## Antes de publicar
1. `npm test` e `npx tsc --noEmit -p .` (Node: `source ~/.nvm/nvm.sh`).
2. `PORTA=<porta> node scripts/prints.mjs prints` (avisa se algo rola nas telas de jogo) e `scripts/sala-sim.mjs`.
3. Pior caso de texto: perguntas 238 (mais longa) e 855 (alternativas mais longas) devem caber sem rolagem.

## Publicar
`export PATH="$HOME/.local/bin:$PATH"`; ramo novo → commit → `gh pr create` → `gh pr merge --merge --delete-branch` → `gh run watch`.
Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
