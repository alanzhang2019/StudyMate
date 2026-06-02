import { normalizeInteractiveScriptExecutionOrder } from '@/lib/generation/interactive-post-processor';

/**
 * Patch embedded HTML to display correctly inside an iframe.
 *
 * Injects CSS that keeps the iframe document on a full 16:9 canvas instead of
 * shrinking to the natural document height, which causes large blank regions
 * and interactive controls piling up in one corner.
 */
export function patchHtmlForIframe(html: string): string {
  html = normalizeInteractiveScriptExecutionOrder(html);
  const iframeCss = `<style data-iframe-patch>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  body { min-height: 100vh; }
</style>`;
  const supportScript = `<script data-iframe-support>
  (function() {
    if (window.__interactiveSupportInstalled) return;
    window.__interactiveSupportInstalled = true;

    var originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this && this.nodeType === 1) {
        this.__interactiveListenerTypes = this.__interactiveListenerTypes || {};
        this.__interactiveListenerTypes[type] = (this.__interactiveListenerTypes[type] || 0) + 1;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    function parseWidgetConfig() {
      var configEl = document.getElementById('widget-config');
      if (!configEl) return null;
      try {
        return JSON.parse(configEl.textContent || '{}');
      } catch (_error) {
        return null;
      }
    }

    function hasHandler(element, type) {
      if (!element) return false;
      var listeners = element.__interactiveListenerTypes || {};
      if (listeners[type] > 0) return true;
      if (type === 'click' && typeof element.onclick === 'function') return true;
      if (type === 'input' && typeof element.oninput === 'function') return true;
      if (type === 'change' && typeof element.onchange === 'function') return true;
      return false;
    }

    function findLeaf(regex) {
      var nodes = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || el.children.length > 0) continue;
        if (regex.test(text)) return el;
      }
      return null;
    }

    function setLeafText(regex, text) {
      var el = findLeaf(regex);
      if (!el) return false;
      el.textContent = text;
      return true;
    }

    function installEngineeringFallback() {
      var config = parseWidgetConfig();
      if (!config || config.type !== 'simulation') return;

      var conceptText = String(config.concept || '') + ' ' + String(config.description || '');
      if (!/engineering|workload|effort|project|工程|工作量/i.test(conceptText)) return;

      var startBtn =
        document.getElementById('mainBtn') ||
        document.getElementById('start-btn');
      var resetBtn = document.getElementById('reset-btn');
      var halfBtn =
        document.getElementById('preset-half-btn') ||
        document.getElementById('pre-half-btn');
      var thirdBtn =
        document.getElementById('preset-third-btn') ||
        document.getElementById('pre-third-btn');
      var toggleBtn = document.getElementById('toggle-controls-btn');
      var jiaSlider = document.getElementById('jia-slider');
      var yiSlider = document.getElementById('yi-slider');

      if (!startBtn || !jiaSlider || !yiSlider) return;

      var alreadyLive =
        hasHandler(startBtn, 'click') ||
        hasHandler(jiaSlider, 'input') ||
        hasHandler(yiSlider, 'input') ||
        (halfBtn && hasHandler(halfBtn, 'click')) ||
        (thirdBtn && hasHandler(thirdBtn, 'click')) ||
        typeof window.handleMainButton === 'function' ||
        typeof window.startSimulation === 'function';
      if (alreadyLive) return;

      var state = {
        running: false,
        elapsedDays: 0,
        progress: 0,
        targetRatio: 0.5,
        frameHandle: 0,
        lastTick: 0,
      };

      function sliderValue(input) {
        return Math.max(1, Number(input.value || 1));
      }

      function dailyRate() {
        return 1 / sliderValue(jiaSlider) + 1 / sliderValue(yiSlider);
      }

      function targetPercent() {
        return state.targetRatio * 100;
      }

      function stopLoop() {
        state.running = false;
        state.lastTick = 0;
        if (state.frameHandle) {
          cancelAnimationFrame(state.frameHandle);
          state.frameHandle = 0;
        }
      }

      function render() {
        var target = targetPercent();
        var statusText = state.running
          ? '进行中'
          : state.progress >= target
            ? '已完成'
            : '等待开始';

        startBtn.textContent = state.running
          ? '暂停'
          : state.progress > 0 && state.progress < target
            ? '继续'
            : '启动';

        if (resetBtn) {
          resetBtn.style.display = state.progress > 0 || state.running ? '' : 'none';
        }

        setLeafText(/已完成[:：]\\s*[\\d.]+%/, '已完成: ' + state.progress.toFixed(0) + '%');
        setLeafText(/时间[:：]\\s*[\\d.]+\\s*天/, '时间: ' + state.elapsedDays.toFixed(1) + ' 天');
        if (!setLeafText(/状态[:：].*/, '状态：' + statusText)) {
          setLeafText(/等待开始|进行中|已完成|静止/, statusText);
        }
        setLeafText(/甲效率[:：].*/, '甲效率: 1/' + sliderValue(jiaSlider) + ' 工程/天');
        setLeafText(/乙效率[:：].*/, '乙效率: 1/' + sliderValue(yiSlider) + ' 工程/天');
      }

      function resetSimulation() {
        stopLoop();
        state.elapsedDays = 0;
        state.progress = 0;
        render();
      }

      function tick(now) {
        if (!state.running) return;
        if (!state.lastTick) state.lastTick = now;
        var delta = Math.min(0.25, (now - state.lastTick) / 1000);
        state.lastTick = now;
        state.elapsedDays += delta * 2;
        state.progress = Math.min(targetPercent(), state.elapsedDays * dailyRate() * 100);
        if (state.progress >= targetPercent()) {
          stopLoop();
        }
        render();
        if (state.running) {
          state.frameHandle = requestAnimationFrame(tick);
        }
      }

      function startSimulation() {
        if (state.progress >= targetPercent()) {
          resetSimulation();
        }
        if (state.running) {
          stopLoop();
          render();
          return;
        }
        state.running = true;
        state.frameHandle = requestAnimationFrame(tick);
        render();
      }

      function applyPreset(targetRatio) {
        state.targetRatio = targetRatio;
        resetSimulation();
      }

      function toggleControls() {
        if (!toggleBtn) return;
        var panel = toggleBtn.parentElement;
        while (panel && panel.children.length < 3) {
          panel = panel.parentElement;
        }
        if (!panel) return;
        var collapsed = panel.getAttribute('data-collapsed') === 'true';
        var nextCollapsed = !collapsed;
        Array.from(panel.children).forEach(function(child) {
          if (child === toggleBtn) return;
          child.style.display = nextCollapsed ? 'none' : '';
        });
        panel.setAttribute('data-collapsed', nextCollapsed ? 'true' : 'false');
        toggleBtn.textContent = nextCollapsed ? '显示控制面板' : '隐藏控制面板';
      }

      jiaSlider.addEventListener('input', render);
      yiSlider.addEventListener('input', render);
      startBtn.addEventListener('click', function(event) {
        event.preventDefault();
        startSimulation();
      });
      if (resetBtn) {
        resetBtn.addEventListener('click', function(event) {
          event.preventDefault();
          resetSimulation();
        });
      }
      if (halfBtn) {
        halfBtn.addEventListener('click', function(event) {
          event.preventDefault();
          applyPreset(0.5);
        });
      }
      if (thirdBtn) {
        thirdBtn.addEventListener('click', function(event) {
          event.preventDefault();
          applyPreset(1 / 3);
        });
      }
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function(event) {
          event.preventDefault();
          toggleControls();
        });
      }

      render();
    }

    function boot() {
      try {
        installEngineeringFallback();
      } catch (_error) {}
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      window.addEventListener('load', boot, { once: true });
    } else {
      setTimeout(boot, 0);
    }
  })();
</script>`;
  const debugScript = `<script data-iframe-debug>
  (function() {
    if (window.__interactiveDebugPatched) return;
    window.__interactiveDebugPatched = true;
    function report(msg, data) {
      try {
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'interactive-click-dead',
            runId: 'pre-fix',
            hypothesisId: 'B',
            location: 'lib/utils/iframe.ts',
            msg: '[DEBUG] ' + msg,
            data: data || null,
            ts: Date.now(),
          }),
        }).catch(function() {});
      } catch (e) {}
    }
    var originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      var target = this;
      var targetInfo = null;
      if (target && target.nodeType === 1) {
        targetInfo = {
          tag: target.tagName || null,
          id: target.id || null,
          className: target.className || null,
          typeAttr: target.getAttribute ? target.getAttribute('type') : null
        };
      } else if (target === document) {
        targetInfo = { tag: '#document' };
      } else if (target === window) {
        targetInfo = { tag: '#window' };
      }
      if (targetInfo && (
        targetInfo.id === 'mainBtn' ||
        targetInfo.id === 'jia-slider' ||
        targetInfo.id === 'yi-slider' ||
        targetInfo.className === 'preset-btn' ||
        targetInfo.tag === '#document' ||
        targetInfo.tag === '#window'
      )) {
        report('iframe addEventListener observed', {
          eventType: type,
          target: targetInfo,
          listenerType: typeof listener,
          readyState: document.readyState,
        });
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    window.addEventListener('error', function(event) {
      report('iframe runtime error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
    report('iframe debug patch installed', { readyState: document.readyState });
  })();
</script>`;

  // Insert right after <head> or at the start of the document
  const headIdx = html.indexOf('<head>');
  if (headIdx !== -1) {
    const insertPos = headIdx + 6; // after <head>
    return html.substring(0, insertPos) + '\n' + iframeCss + '\n' + supportScript + '\n' + debugScript + html.substring(insertPos);
  }

  const headWithAttrs = html.indexOf('<head ');
  if (headWithAttrs !== -1) {
    const closeAngle = html.indexOf('>', headWithAttrs);
    if (closeAngle !== -1) {
      const insertPos = closeAngle + 1;
      return html.substring(0, insertPos) + '\n' + iframeCss + '\n' + supportScript + '\n' + debugScript + html.substring(insertPos);
    }
  }

  // Fallback: prepend
  return iframeCss + supportScript + debugScript + html;
}

export function resolveInteractiveIframeSource(content: { url: string; html?: string }): {
  srcDoc?: string;
  src?: string;
} {
  const srcDoc = content.html ? patchHtmlForIframe(content.html) : undefined;
  return {
    srcDoc,
    src: srcDoc ? undefined : content.url,
  };
}
