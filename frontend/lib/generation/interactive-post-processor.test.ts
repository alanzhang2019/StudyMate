import { describe, expect, it } from 'vitest';
import { postProcessInteractiveHtml } from '@/lib/generation/interactive-post-processor';

describe('postProcessInteractiveHtml', () => {
  it('moves executable scripts to the end of body so DOM-dependent bindings run after controls exist', () => {
    const input = `<!DOCTYPE html>
<html>
  <head>
    <title>Demo</title>
    <script>
      const mainBtn = document.getElementById('mainBtn');
      if (mainBtn) {
        mainBtn.onclick = () => {};
      }
    </script>
    <script type="application/json" id="widget-config">{"type":"simulation"}</script>
  </head>
  <body>
    <button id="mainBtn">启动</button>
  </body>
</html>`;

    const output = postProcessInteractiveHtml(input);

    const bodyStart = output.indexOf('<body>');
    const buttonIndex = output.indexOf('<button id="mainBtn">');
    const executableScriptIndex = output.indexOf("const mainBtn = document.getElementById('mainBtn');");
    const bodyClose = output.indexOf('</body>');
    const configIndex = output.indexOf('id="widget-config"');

    expect(bodyStart).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(bodyStart);
    expect(executableScriptIndex).toBeGreaterThan(buttonIndex);
    expect(executableScriptIndex).toBeLessThan(bodyClose);
    expect(configIndex).toBeLessThan(bodyStart);
  });
});
