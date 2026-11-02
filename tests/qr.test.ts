import { describe, expect, it } from 'vitest';
import { qrSvg } from '../src/ui/qr.ts';

describe('QR code interno', () => {
  it('gera um svg com o desenho', () => {
    const svg = qrSvg('https://victor-cardoso-13.github.io/qi/?sala=ABCD');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<path d="M');
    expect(svg).not.toContain('http://api'); // nada de site de fora
  });
  it('links diferentes dão desenhos diferentes', () => {
    expect(qrSvg('https://x.com/?sala=AAAA')).not.toBe(qrSvg('https://x.com/?sala=BBBB'));
  });
});
