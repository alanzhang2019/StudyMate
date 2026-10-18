/**
 * 学生作品的「语音识别兜底」注入脚本
 *
 * 背景：Chrome / Edge 的 webkitSpeechRecognition 走的是 Google 的在线识别服务，
 * 国内网络下 start() 后必然抛 `error: network`。学生在本机双击 HTML 时 likewise 失败，
 * 但在课堂上用 Chrome 演示时常常以为「是平台上传后不支持」。
 *
 * 方案：在作品 HTML 里注入一层 SpeechRecognition 包装器——
 *   1. 先照常调原生实现（境外可用时行为完全不变）；
 *   2. 一旦原生报 network / service-not-allowed，就自动切换到平台自有 ASR
 *      （getUserMedia + MediaRecorder → POST /api/camp/asr）；
 *   3. 结果以标准 SpeechRecognitionEvent 结构回调，作品代码一行都不用改。
 *
 * 只在作品真的用到 SpeechRecognition 且服务端配了 ASR 时才注入，
 * 避免给所有作品平白加一段脚本；`?noshim=1` 可临时关闭便于排查。
 */

export const CAMP_ASR_ENDPOINT = '/api/camp/asr';

/** 作品是否用到了 Web Speech API（够用即可，避免把整个 HTML 当 JS 解析） */
export function usesSpeechRecognition(html: string): boolean {
  return /SpeechRecognition/.test(html);
}

/** 生成注入用的 <script> 片段 */
export function buildSpeechShim(endpoint: string = CAMP_ASR_ENDPOINT): string {
  const js = `
(function () {
  var NATIVE = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ASR_URL = ${JSON.stringify(endpoint)};
  var nativeBroken = false;
  var seq = 0;

  function fire(self, name, ev) {
    var h = self['on' + name];
    if (typeof h === 'function') {
      try { h.call(self, ev); } catch (e) { console.error('[sr] handler error', e); }
    }
  }
  function errEv(code, msg) { return { error: code, message: msg || code }; }
  function makeResult(transcript, isFinal) {
    var alt = { transcript: transcript, confidence: 0.9 };
    var list = { 0: alt, length: 1, isFinal: !!isFinal };
    var results = { 0: list, length: 1 };
    return { resultIndex: 0, results: results };
  }

  function CampSpeechRecognition() {
    this.lang = 'zh-CN';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.onstart = null; this.onaudiostart = null; this.onspeechstart = null;
    this.onspeechend = null; this.onresult = null; this.onnomatch = null;
    this.onerror = null; this.onend = null;
    this._native = null; this._rec = null; this._stream = null;
    this._chunks = []; this._stopped = true; this._switching = false;
  }

  CampSpeechRecognition.prototype.start = function () {
    this._stopped = false;
    this._chunks = [];
    if (!nativeBroken && NATIVE) {
      try { this._startNative(); return; } catch (e) { /* 落到服务端兜底 */ }
    }
    this._startServer();
  };

  CampSpeechRecognition.prototype._startNative = function () {
    var self = this;
    var r = new NATIVE();
    r.lang = this.lang;
    r.continuous = this.continuous;
    r.interimResults = this.interimResults;
    r.maxAlternatives = this.maxAlternatives || 1;
    r.onstart = function (e) { fire(self, 'start', e); };
    r.onaudiostart = function (e) { fire(self, 'audiostart', e); };
    r.onspeechstart = function (e) { fire(self, 'speechstart', e); };
    r.onspeechend = function (e) { fire(self, 'speechend', e); };
    r.onresult = function (e) { fire(self, 'result', e); };
    r.onnomatch = function (e) { fire(self, 'nomatch', e); };
    r.onend = function (e) {
      // 正在切兜底时原生还会补一个 end，别把它透出去 —— 作品会以为识别已结束
      if (self._switching) { self._switching = false; return; }
      fire(self, 'end', e);
    };
    r.onerror = function (e) {
      var code = e && e.error;
      // not-allowed 是用户拒绝授权，换服务端也拿不到音频，不切
      if (code === 'network' || code === 'service-not-allowed') {
        nativeBroken = true;
        self._switching = true;
        try { r.abort(); } catch (_) {}
        self._startServer();
        return;
      }
      fire(self, 'error', e);
    };
    this._native = r;
    r.start();
  };

  CampSpeechRecognition.prototype._startServer = function () {
    var self = this;
    this._native = null;
    fire(self, 'start', {});
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fire(self, 'error', errEv('audio-capture', '当前浏览器不支持麦克风'));
      fire(self, 'end', {});
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (self._stopped) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      self._stream = stream;
      fire(self, 'audiostart', {});
      fire(self, 'speechstart', {});
      if (typeof MediaRecorder === 'undefined') {
        stream.getTracks().forEach(function (t) { t.stop(); });
        fire(self, 'error', errEv('audio-capture', '当前浏览器不支持录音'));
        fire(self, 'end', {});
        return;
      }
      var mime = '';
      var CAND = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      for (var i = 0; i < CAND.length; i++) {
        if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(CAND[i])) {
          mime = CAND[i]; break;
        }
      }
      var rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (e) { rec = new MediaRecorder(stream); }
      self._rec = rec;
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) {
          self._chunks.push(e.data);
          self._upload(false);
        }
      };
      rec.onstop = function () {
        self._upload(true);
        stream.getTracks().forEach(function (t) { t.stop(); });
      };
      // 每 2.5 秒产一个片段，作为 interim 结果上传一次
      try { rec.start(2500); } catch (e) { rec.start(); }
    }).catch(function (err) {
      var name = err && err.name;
      var code = (name === 'NotAllowedError' || name === 'SecurityError')
        ? 'not-allowed' : 'audio-capture';
      fire(self, 'error', errEv(code, (err && err.message) || name));
      fire(self, 'end', {});
    });
  };

  CampSpeechRecognition.prototype._upload = function (isFinal) {
    var self = this;
    if (!this._chunks.length) {
      if (isFinal) { fire(self, 'nomatch', {}); fire(self, 'end', {}); }
      return;
    }
    var blob = new Blob(this._chunks, {
      type: (this._chunks[0] && this._chunks[0].type) || 'audio/webm',
    });
    var fd = new FormData();
    fd.append('audio', blob, 'speech.webm');
    fd.append('lang', this.lang || 'zh-CN');
    var mine = ++seq;
    fetch(ASR_URL, { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!isFinal && mine !== seq) return; // 已有更新片段，丢弃过期 interim
        var text = '';
        if (j && j.success) text = String((j.data && j.data.text) || j.text || '').trim();
        if (!text) {
          // 没识别到内容也要收尾，否则作品会一直停在「正在听」
          if (isFinal) { fire(self, 'nomatch', {}); fire(self, 'end', {}); }
          return;
        }
        fire(self, 'result', makeResult(text, isFinal));
        if (isFinal) { fire(self, 'end', {}); }
      })
      .catch(function () {
        if (isFinal) {
          fire(self, 'error', errEv('network', '语音识别服务不可用'));
          fire(self, 'end', {});
        }
      });
  };

  CampSpeechRecognition.prototype.stop = function () {
    this._stopped = true;
    if (this._native) {
      try { this._native.stop(); } catch (e) {}
      return;
    }
    if (this._rec && this._rec.state !== 'inactive') {
      try { this._rec.stop(); } catch (e) { fire(this, 'end', {}); }
      return;
    }
    fire(this, 'end', {});
  };

  CampSpeechRecognition.prototype.abort = function () {
    this._stopped = true;
    if (this._native) {
      try { this._native.abort(); } catch (e) {}
      return;
    }
    if (this._rec && this._rec.state !== 'inactive') {
      try { this._rec.stop(); } catch (e) {}
    }
    if (this._stream) {
      this._stream.getTracks().forEach(function (t) { t.stop(); });
    }
    fire(this, 'end', {});
  };

  window.CampSpeechRecognition = CampSpeechRecognition;
  window.SpeechRecognition = CampSpeechRecognition;
  window.webkitSpeechRecognition = CampSpeechRecognition;
})();
`;
  return '<script>' + js + '</script>';
}

/**
 * 把兜底脚本插到作品 HTML 的最前面（必须在作品自身脚本之前执行，
 * 才能包装掉 window.SpeechRecognition）。找不到 head/html 标签就直接前置。
 */
export function injectSpeechShim(
  html: string,
  opts: { enabled: boolean },
): string {
  if (!opts.enabled || !usesSpeechRecognition(html)) return html;
  const shim = buildSpeechShim();

  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + shim + html.slice(at);
  }
  const htmlMatch = html.match(/<html[^>]*>/i);
  if (htmlMatch && htmlMatch.index !== undefined) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, at) + shim + html.slice(at);
  }
  return shim + html;
}
