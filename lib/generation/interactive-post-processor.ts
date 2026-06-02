/**
 * Interactive HTML Post-Processor
 *
 * Ported from Python's PostProcessor class (learn-your-way/concept_to_html.py:287-385)
 *
 * Handles:
 * - LaTeX delimiter conversion ($$...$$ -> \[...\], $...$ -> \(...\))
 * - KaTeX CSS/JS injection with auto-render and MutationObserver
 * - Script tag protection during LaTeX conversion
 */

/**
 * Main entry point: post-process generated interactive HTML
 * Converts LaTeX delimiters and injects KaTeX rendering resources.
 */
export function postProcessInteractiveHtml(html: string): string {
  // Only process if HTML contains LaTeX delimiters
  const hasLatex = /\$\$[^$]+\$\$|\$[^$\n]+?\$/.test(html);

  if (hasLatex) {
    // Convert LaTeX delimiters while protecting script tags
    html = convertLatexDelimiters(html);
  }

  // Ensure executable scripts run after interactive controls exist in the DOM.
  // Many generated widgets bind events immediately, so leaving scripts in <head>
  // causes dead buttons/sliders when those queries run before <body> is parsed.
  html = normalizeInteractiveScriptExecutionOrder(html);

  // Inject KaTeX resources only if HTML contains LaTeX and KaTeX is not already present
  if (hasLatex && !html.toLowerCase().includes('katex')) {
    html = injectKatex(html);
  }

  return html;
}

export function normalizeInteractiveScriptExecutionOrder(html: string): string {
  const executableScripts: string[] = [];

  const withoutExecutableScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    const isJsonConfig =
      /type\s*=\s*["']application\/json["']/i.test(match) ||
      /id\s*=\s*["']widget-config["']/i.test(match);

    if (isJsonConfig) {
      return match;
    }

    executableScripts.push(match);
    return '';
  });

  if (executableScripts.length === 0) {
    return html;
  }

  const payload = '\n' + executableScripts.join('\n') + '\n';
  const bodyCloseIdx = withoutExecutableScripts.lastIndexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return (
      withoutExecutableScripts.substring(0, bodyCloseIdx) +
      payload +
      withoutExecutableScripts.substring(bodyCloseIdx)
    );
  }

  const htmlCloseIdx = withoutExecutableScripts.lastIndexOf('</html>');
  if (htmlCloseIdx !== -1) {
    return (
      withoutExecutableScripts.substring(0, htmlCloseIdx) +
      payload +
      withoutExecutableScripts.substring(htmlCloseIdx)
    );
  }

  return withoutExecutableScripts + payload;
}

/**
 * Convert LaTeX delimiters while protecting <script> tags.
 *
 * - Protects script blocks from modification
 * - Converts $$...$$ to \[...\] (display math)
 * - Converts $...$ to \(...\) (inline math)
 * - Restores script blocks after conversion
 */
function convertLatexDelimiters(html: string): string {
  const scriptBlocks: string[] = [];

  // Protect script tags by replacing them with placeholders
  let processed = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    scriptBlocks.push(match);
    return `__SCRIPT_BLOCK_${scriptBlocks.length - 1}__`;
  });

  // Convert display math: $$...$$ -> \[...\]
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]');

  // Convert inline math: $...$ -> \(...\)
  // Use non-greedy match and exclude newlines to avoid false positives
  processed = processed.replace(/\$([^$\n]+?)\$/g, '\\($1\\)');

  // Restore script blocks using indexOf + substring (not .replace())
  // because script content may contain $ characters that .replace()
  // would interpret as special substitution patterns.
  for (let i = 0; i < scriptBlocks.length; i++) {
    const placeholder = `__SCRIPT_BLOCK_${i}__`;
    const idx = processed.indexOf(placeholder);
    if (idx !== -1) {
      processed =
        processed.substring(0, idx) +
        scriptBlocks[i] +
        processed.substring(idx + placeholder.length);
    }
  }

  return processed;
}

/**
 * Inject KaTeX CSS, JS, auto-render, and MutationObserver before </head>.
 * Falls back to appending at end if </head> is not found.
 */
function injectKatex(html: string): string {
  const katexInjection = `
<link rel="stylesheet" href="/katex/katex.min.css">
<script src="/katex/katex.min.js"></script>
<script src="/katex/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    const katexOptions = {
        delimiters: [
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ],
        throwOnError: false,
        strict: false,
        trust: true
    };

    let renderTimeout;
    function safeRender() {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            renderMathInElement(document.body, katexOptions);
        }, 100);
    }

    renderMathInElement(document.body, katexOptions);

    const observer = new MutationObserver((mutations) => {
        let shouldRender = false;
        mutations.forEach((mutation) => {
            if (mutation.target &&
                mutation.target.className &&
                typeof mutation.target.className === 'string' &&
                mutation.target.className.includes('katex')) {
                return;
            }
            shouldRender = true;
        });

        if (shouldRender) {
            safeRender();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    setInterval(() => {
        const text = document.body.innerText;
        if (text.includes('\\\\(') || text.includes('$$')) {
            safeRender();
        }
    }, 2000);
});
</script>`;

  // Use indexOf + substring instead of String.replace() because the
  // katexInjection string contains '$' characters that .replace() would
  // interpret as special substitution patterns ($$ → $, $' → post-match text).
  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx !== -1) {
    return (
      html.substring(0, headCloseIdx) +
      katexInjection +
      '\n</head>' +
      html.substring(headCloseIdx + 7)
    );
  }

  // Fallback: inject before </body> if </head> is missing
  const bodyCloseIdx = html.indexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return (
      html.substring(0, bodyCloseIdx) +
      katexInjection +
      '\n</body>' +
      html.substring(bodyCloseIdx + 7)
    );
  }

  // Last resort: append at end
  return html + katexInjection;
}
