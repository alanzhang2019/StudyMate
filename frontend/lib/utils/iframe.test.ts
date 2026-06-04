import { describe, expect, it } from 'vitest';
import { patchHtmlForIframe, resolveInteractiveIframeSource } from '@/lib/utils/iframe';

describe('patchHtmlForIframe', () => {
  it('injects full-height iframe styles instead of auto-height layout', () => {
    const html = '<html><head></head><body><button>Start</button></body></html>';

    const patched = patchHtmlForIframe(html);

    expect(patched).toContain('height: 100%');
    expect(patched).toContain('body { min-height: 100vh; }');
    expect(patched).not.toContain('html { height: auto; }');
    expect(patched).not.toContain('body { height: auto; }');
  });
});

describe('resolveInteractiveIframeSource', () => {
  it('uses srcDoc for inline html scenes', () => {
    const result = resolveInteractiveIframeSource({
      url: 'https://example.com/interactive',
      html: '<html><head></head><body>demo</body></html>',
    });

    expect(result.srcDoc).toContain('demo');
    expect(result.src).toBeUndefined();
  });

  it('uses src for url based scenes instead of writing the url into srcDoc', () => {
    const url = 'https://example.com/interactive';

    const result = resolveInteractiveIframeSource({ url });

    expect(result.src).toBe(url);
    expect(result.srcDoc).toBeUndefined();
  });
});
