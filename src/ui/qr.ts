/**
 * QR code feito aqui dentro (nada é enviado a sites de fora).
 * Devolve um <svg> pronto (só números e cores fixas, seguro para innerHTML).
 */
import qrcode from 'qrcode-generator';

export function qrSvg(texto: string, cor = '#e8ecf1', fundo = '#0a0c10'): string {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const borda = 2; // faixa vazia em volta, para a câmera achar o código
  const lado = n + borda * 2;
  let quadrados = '';
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) if (qr.isDark(l, c)) quadrados += `M${c + borda} ${l + borda}h1v1h-1z`;
  }
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="QR code da sala"><rect width="${lado}" height="${lado}" fill="${fundo}"/><path d="${quadrados}" fill="${cor}"/></svg>`;
}
