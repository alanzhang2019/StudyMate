// 轻量 CDP 客户端 + 公众号后台操作
// 用法: node cdp_wechat.js <inspect|fill|figs|cover|draft|shot> [args]
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const TARGET_FILE = path.join(ROOT, '_cdp_target.json');
const TOKEN = '1690824997';
const EDIT_URL = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&createType=0&token=${TOKEN}&lang=zh_CN`;

function log(...a) { console.log(...a); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function connect() {
  const v = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(() => rej(new Error('ws timeout')), 10000); });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const myId = ++id;
    pending.set(myId, res);
    const msg = { id: myId, method, params };
    if (sessionId) msg.sessionId = sessionId;
    ws.send(JSON.stringify(msg));
    setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); rej(new Error('timeout: ' + method)); } }, 30000);
  });
  return { ws, send, events, close: () => ws.close() };
}

async function getSession(c) {
  let targetId = null;
  if (fs.existsSync(TARGET_FILE)) {
    try { targetId = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf8')).targetId; } catch (e) { }
  }
  // 校验 target 还活着
  let alive = false;
  if (targetId) {
    const t = await c.send('Target.getTargets');
    alive = t.result.targetInfos.some(x => x.targetId === targetId);
  }
  if (!alive) {
    const r = await c.send('Target.createTarget', { url: EDIT_URL });
    targetId = r.result.targetId;
    fs.writeFileSync(TARGET_FILE, JSON.stringify({ targetId }));
    log('created new tab', targetId);
  } else {
    log('reusing tab', targetId);
  }
  const att = await c.send('Target.attachToTarget', { targetId, flatten: true });
  return att.result.sessionId;
}

async function ev(c, sid, expr, awaitPromise = false) {
  const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, sid);
  if (r.result && r.result.exceptionDetails) return { __error: r.result.exceptionDetails.text || JSON.stringify(r.result.exceptionDetails) };
  return r.result && r.result.result ? r.result.result.value : undefined;
}

async function shot(c, sid, name) {
  const p = path.join(ROOT, name || '_shot.png');
  const r = await c.send('Page.captureScreenshot', { format: 'png' }, sid);
  fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
  log('shot ->', p);
}

(async () => {
  const cmd = process.argv[2] || 'inspect';
  const c = await connect();
  const sid = await getSession(c);

  if (cmd === 'inspect') {
    await c.send('Page.enable', {}, sid);
    await new Promise(r => setTimeout(r, 6000));
    const info = await ev(c, sid, `JSON.stringify({url:location.href,title:document.title,
      inputs:[...document.querySelectorAll('input')].map(i=>({id:i.id,type:i.type,ph:i.placeholder,cls:(i.className||'').toString().slice(0,60)})),
      files:[...document.querySelectorAll('input[type=file]')].map(i=>({id:i.id,accept:i.accept,cls:(i.className||'').toString().slice(0,60)})),
      iframes:[...document.querySelectorAll('iframe')].map(f=>({id:f.id,name:f.name,cls:(f.className||'').toString().slice(0,40)})),
      ce:[...document.querySelectorAll('[contenteditable]')].map(e=>({id:e.id,tag:e.tagName,cls:(e.className||'').toString().slice(0,60)})),
      btns:[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(Boolean).slice(0,30)
    })`);
    log('url:', (await ev(c, sid, 'location.href')));
    let parsed = info;
    if (typeof info === 'string') { try { parsed = JSON.parse(info); } catch (e) { } }
    fs.writeFileSync(path.join(ROOT, '_dom.json'), JSON.stringify(parsed, null, 1), 'utf8');
    if (parsed && typeof parsed === 'object') {
      log('inputs:', parsed.inputs.length, '| files:', parsed.files.length, '| iframes:', parsed.iframes.length, '| ce:', parsed.ce.length);
      log('--- TITLE CANDIDATES ---');
      log(JSON.stringify(parsed.inputs.filter(i => (i.ph || '').includes('标题') || i.id === 'title'), null, 1));
      log('--- IFRAMES ---'); log(JSON.stringify(parsed.iframes, null, 1));
      log('--- CONTENTEDITABLE ---'); log(JSON.stringify(parsed.ce, null, 1));
    }
    await shot(c, sid, '_shot_inspect.png');
  }

  if (cmd === 'nav') {
    await c.send('Page.enable', {}, sid);
    await c.send('Page.navigate', { url: process.argv[3] || EDIT_URL }, sid);
    await new Promise(r => setTimeout(r, 8000));
    log('url:', await ev(c, sid, 'location.href'));
    await shot(c, sid, '_shot_nav.png');
  }

  if (cmd === 'pm') {
    const info = await ev(c, sid, `JSON.stringify({
      pms:[...document.querySelectorAll('.ProseMirror')].map((e,i)=>({i, txt:(e.innerText||'').slice(0,120), html:(e.innerHTML||'').slice(0,600), ph:e.getAttribute('data-placeholder'), children:[...e.children].map(ch=>({tag:ch.tagName,cls:(ch.className||'').toString().slice(0,40),ph:ch.getAttribute('data-placeholder')})).slice(0,10)})),
      titleEl: (()=>{const t=document.querySelector('#title,.input_title,[data-placeholder*="标题"]'); return t?{tag:t.tagName,id:t.id,cls:(t.className||'').toString()}:null;})(),
      imgBtn: [...document.querySelectorAll('[class*="js_image"],[data-tooltip*="图片"],[title*="图片"]')].map(b=>({tag:b.tagName,cls:(b.className||'').toString().slice(0,50),title:b.getAttribute('title')||b.getAttribute('data-tooltip')})).slice(0,10)
    })`);
    log(typeof info === 'string' ? info : JSON.stringify(info, null, 1));
  }

  // 实验：粘贴一小段 HTML
  if (cmd === 'testpaste') {
    const r = await ev(c, sid, `(()=>{
      const el=document.querySelectorAll('.ProseMirror')[1]; el.focus();
      const dt=new DataTransfer();
      dt.setData('text/html','<p style="color:#2B50A8;font-size:17px">测试段落ABC</p>');
      dt.setData('text/plain','测试段落ABC');
      el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
      return 'ok';
    })()`);
    log('dispatch:', r);
    await new Promise(r2 => setTimeout(r2, 2500));
    log('innerText:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerText.slice(0,200)`));
    log('html:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerHTML.slice(0,400)`));
  }

  // 实验：上传一张图片到正文
  if (cmd === 'testimg') {
    const file = process.argv[3];
    const click = await ev(c, sid, `(()=>{const b=document.querySelector('a.js_imagedialog'); if(b){b.click();return 'clicked';} return 'nobtn';})()`);
    log('click:', click);
    await new Promise(r2 => setTimeout(r2, 3000));
    const fi = await ev(c, sid, `JSON.stringify([...document.querySelectorAll('input[type=file]')].map((i,n)=>({n,accept:i.accept,cls:(i.className||'').toString(),vis:i.offsetParent!==null})))`);
    log('file inputs:', fi);
    const doc = await c.send('DOM.getDocument', { depth: -1 }, sid);
    const q = await c.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' }, sid);
    log('nodeId:', q.result.nodeId);
    if (q.result.nodeId && file) {
      await c.send('DOM.setFileInputFiles', { files: [file], nodeId: q.result.nodeId }, sid);
      log('files set');
      await new Promise(r2 => setTimeout(r2, 12000));
      log('img count:', await ev(c, sid, `document.querySelectorAll('.ProseMirror img').length`));
      log('html tail:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerHTML.slice(-600)`));
    }
  }

  // 清空正文
  if (cmd === 'clear') {
    await ev(c, sid, `(()=>{const el=document.querySelectorAll('.ProseMirror')[1]; el.focus();
      document.execCommand('selectAll'); document.execCommand('delete'); return 'cleared';})()`);
    await new Promise(r2 => setTimeout(r2, 1500));
    log('len:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerText.length`));
  }

  if (cmd === 'all') {
    const artPath = path.join(ROOT, 'content', 'ai-native-edu', '01-article.html');
    const imgDir = path.join(ROOT, 'content', 'ai-native-edu', 'images');
    let html = fs.readFileSync(artPath, 'utf8');

    // 标题
    const title = '四十二年，它一直是最优解';
    log('title:', await ev(c, sid, `(()=>{const t=document.querySelector('#title'); t.value=${JSON.stringify(title)};
      t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true}));
      t.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true})); return t.value;})()`));

    // 作者
    log('author:', await ev(c, sid, `(()=>{const a=document.querySelector('#author'); a.value='Alan张老师';
      a.dispatchEvent(new Event('input',{bubbles:true})); a.dispatchEvent(new Event('change',{bubbles:true})); return a.value;})()`));

    // 清空正文
    await ev(c, sid, `(()=>{const el=document.querySelectorAll('.ProseMirror')[1]; el.focus();
      document.execCommand('selectAll'); document.execCommand('delete'); return 'c';})()`);
    await sleep(1200);

    const parts = html.split(/(<img[^>]*>)/i).filter(s => s.trim());
    log('parts:', parts.length);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (/^<img/i.test(p.trim())) {
        const m = p.match(/src="([^"]+)"/);
        if (!m) continue;
        const file = path.join(imgDir, path.basename(m[1]));
        log(`[${i}] IMG ${path.basename(file)} exists=${fs.existsSync(file)}`);
        if (fs.existsSync(file)) {
          const before = await ev(c, sid, `document.querySelectorAll('.ProseMirror img.js_insertlocalimg').length`);
          await ev(c, sid, `(()=>{const b=document.querySelector('a.js_imagedialog'); if(b){b.click();return 1;} return 0;})()`);
          await sleep(3000);
          const doc = await c.send('DOM.getDocument', { depth: -1 }, sid);
          const q = await c.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' }, sid);
          await c.send('DOM.setFileInputFiles', { files: [file], nodeId: q.result.nodeId }, sid);
          await sleep(11000);
          const after = await ev(c, sid, `document.querySelectorAll('.ProseMirror img.js_insertlocalimg').length`);
          log(`   uploaded: ${before} -> ${after}`);
          if (after === before) log('   !! no new image, dialog may be open');
        }
      } else {
        const r = await ev(c, sid, `(function(){
          const el=document.querySelectorAll('.ProseMirror')[1]; el.focus();
          const h=${JSON.stringify(p)};
          const dt=new DataTransfer(); dt.setData('text/html',h); dt.setData('text/plain',h.replace(/<[^>]+>/g,''));
          el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
          return el.innerText.length;
        })()`);
        await sleep(700);
        log(`[${i}] TEXT -> len ${r}`);
      }
    }
    log('total imgs:', await ev(c, sid, `document.querySelectorAll('.ProseMirror img.js_insertlocalimg').length`));
    log('text len:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerText.length`));
  }

  // 探测封面 / 摘要入口
  if (cmd === 'coverinfo') {
    const info = await ev(c, sid, `JSON.stringify({
      covers:[...document.querySelectorAll('[class*="cover"]')].slice(0,20).map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,70),txt:(e.innerText||'').trim().slice(0,40)})),
      digest:(()=>{const d=document.querySelector('#digest,.js_digest,[placeholder*="摘要"]'); return d?{tag:d.tagName,id:d.id,cls:(d.className||'').toString().slice(0,60),ph:d.placeholder}:null;})(),
      files:[...document.querySelectorAll('input[type=file]')].map((i,n)=>({n,accept:i.accept,cls:(i.className||'').toString()}))
    })`);
    log(typeof info === 'string' ? info : JSON.stringify(info, null, 1));
  }

  // 上传封面：node cdp_wechat.js cover <file>
  if (cmd === 'cover') {
    const file = process.argv[3];
    const click = await ev(c, sid, `(()=>{
      const b=document.querySelector('.js_cover_btn_area');
      if(b){ b.click(); return 'clicked cover btn'; }
      return 'nocover';
    })()`);
    log('click:', click);
    await sleep(3000);
    const fs2 = await ev(c, sid, `JSON.stringify([...document.querySelectorAll('input[type=file]')].map((i,n)=>({n,accept:i.accept})))`);
    log('file inputs:', fs2);
    const doc = await c.send('DOM.getDocument', { depth: -1 }, sid);
    const all = await c.send('DOM.querySelectorAll', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' }, sid);
    const ids = all.result.nodeIds || [];
    log('nodeIds:', JSON.stringify(ids));
    const target = ids[ids.length - 1];
    if (file && target) {
      await c.send('DOM.setFileInputFiles', { files: [file], nodeId: target }, sid);
      log('cover files set on node', target);
      await sleep(12000);
      log('cover imgs:', await ev(c, sid, `JSON.stringify([...document.querySelectorAll('.setting-group__cover img,[class*="cover"] img')].map(i=>i.src.slice(0,100)))`));
      log('dialog buttons:', await ev(c, sid, `JSON.stringify([...document.querySelectorAll('.weui-desktop-dialog button,.dialog_wrp button,[class*="dialog"] button')].map(b=>({t:(b.innerText||'').trim().slice(0,12),cls:(b.className||'').toString().slice(0,40)})).filter(x=>x.t).slice(0,15))`));
    }
  }

  // 确认封面弹窗 + 填摘要
  if (cmd === 'coverok') {
    const r = await ev(c, sid, `(()=>{
      const vis=b=>b.offsetParent!==null;
      let btns=[...document.querySelectorAll('button')].filter(b=>{const t=(b.innerText||'').trim(); return t==='完成'&&vis(b);});
      if(!btns.length) btns=[...document.querySelectorAll('button')].filter(b=>{const t=(b.innerText||'').trim(); return t==='下一步'&&vis(b);});
      if(!btns.length) btns=[...document.querySelectorAll('button')].filter(b=>{const t=(b.innerText||'').trim(); return t==='确定'&&vis(b);});
      if(btns.length){ btns[btns.length-1].click(); return 'clicked:'+btns.length; }
      return 'nobtn';
    })()`);
    log('confirm:', r);
    await sleep(4000);
    log('cover src:', await ev(c, sid, `JSON.stringify([...document.querySelectorAll('.setting-group__cover img')].map(i=>i.src.slice(0,110)))`));
    log('has_first_cover:', await ev(c, sid, `!!document.querySelector('.appmsg.has_first_cover')`));
  }

  if (cmd === 'digest') {
    const d = process.argv[3] || '';
    log('digest set:', await ev(c, sid, `(()=>{const t=document.querySelector('#js_description'); t.value=${JSON.stringify(d)};
      t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true})); return t.value.length;})()`));
  }

  // 保存为草稿（绝不点发表）
  if (cmd === 'save') {
    const r = await ev(c, sid, `(()=>{
      const vis=b=>b.offsetParent!==null;
      const b=[...document.querySelectorAll('button')].filter(x=>((x.innerText||'').trim()==='保存为草稿')&&vis(x));
      if(b.length){ b[0].click(); return 'clicked save'; }
      return 'nosave';
    })()`);
    log('save:', r);
    await sleep(8000);
    log('url:', await ev(c, sid, 'location.href'));
    log('toast:', await ev(c, sid, `JSON.stringify([...document.querySelectorAll('.weui-desktop-toast,.weui-desktop-dialog__bd,.weui-desktop-tips,[class*="toast"]')].map(e=>(e.innerText||'').trim().slice(0,60)).filter(Boolean).slice(0,5))`));
    await c.send('Page.enable', {}, sid);
    await shot(c, sid, '_shot_saved.png');
  }

  // 状态总览
  if (cmd === 'status') {
    log('url:', await ev(c, sid, 'location.href'));
    log('title:', await ev(c, sid, `document.querySelector('#title')?document.querySelector('#title').value:'n/a'`));
    log('author:', await ev(c, sid, `document.querySelector('#author')?document.querySelector('#author').value:'n/a'`));
    log('digest len:', await ev(c, sid, `document.querySelector('#js_description')?document.querySelector('#js_description').value.length:'n/a'`));
    log('imgs:', await ev(c, sid, `document.querySelectorAll('.ProseMirror img.js_insertlocalimg').length`));
    log('text len:', await ev(c, sid, `document.querySelectorAll('.ProseMirror')[1].innerText.length`));
    log('cover:', await ev(c, sid, `!!document.querySelector('.appmsg.has_first_cover')`));
  }

  if (cmd === 'shot') { await c.send('Page.enable', {}, sid); await shot(c, sid, process.argv[3]); }

  c.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
