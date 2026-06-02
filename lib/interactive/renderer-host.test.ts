import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InteractiveIframeHost } from '@/components/scene-renderers/InteractiveIframeHost';
import { InteractiveRenderer } from '@/components/scene-renderers/interactive-renderer';

describe('interactive renderer host alignment', () => {
  it('renders a placeholder instead of an inline iframe', () => {
    const html = renderToStaticMarkup(
      createElement(InteractiveRenderer, {
        sceneId: 'scene-1',
        content: {
          type: 'interactive',
          url: 'https://example.com/demo',
          html: '<html><head></head><body><button>Start</button></body></html>',
        },
      }),
    );

    expect(html).not.toContain('<iframe');
  });

  it('exposes a stable interactive iframe host component', () => {
    expect(typeof InteractiveIframeHost).toBe('function');
  });
});
