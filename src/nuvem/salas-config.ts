/**
 * Firebase próprio do QI (Realtime Database), usado SÓ para as salas online.
 * É uma exceção histórica ao padrão da fábrica (que usa o Firestore do "jogos-sem-anuncio").
 * Login e progresso usam o projeto compartilhado (src/nuvem/config.ts). Não é senha.
 */
export const salasConfig = {
  apiKey: 'AIzaSyCZQKDPmc90pmHIJ0O9e6c8bngujuU29-A',
  authDomain: 'qi-quiz-831e67.firebaseapp.com',
  databaseURL: 'https://qi-quiz-831e67-default-rtdb.firebaseio.com',
  projectId: 'qi-quiz-831e67',
  appId: '1:91015825779:web:5c4f592c4163866d761d06',
};
