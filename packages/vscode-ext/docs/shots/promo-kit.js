// Shared engine of the promo videos. A page calls Promo.start(video) with its timeline.
// scripts/vscode-video.mjs then calls render(t) for each frame, in time order.
(() => {
  const $ = (id) => document.getElementById(id);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const prog = (t, a, b) => ease(clamp01((t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  // 0 before a, fades in over `f`, holds, fades out before b.
  const span = (t, a, b, f = 0.35) => Math.min(prog(t, a, a + f), 1 - prog(t, b - f, b));
  const typed = (text, t, a, b) => text.slice(0, Math.round(text.length * clamp01((t - a) / (b - a))));
  const show = (el, o, dy = 0) => {
    el.style.opacity = o;
    el.style.transform = dy ? `translateY(${(1 - o) * dy}px)` : '';
  };

  const ICON = {
    pulse: '<svg class="icon" viewBox="0 0 16 16"><path d="M1 8h3l2-5 3 10 2-5h4" /></svg>',
    key: '<svg class="icon" viewBox="0 0 16 16"><circle cx="5.5" cy="10.5" r="3" /><path d="M7.7 8.3 14 2M11.5 4.5l2 2" /></svg>',
  };

  const WINDOW = `
    <div id="win">
      <div class="titlebar">
        <div class="menu"><span>File</span><span>Edit</span><span>Selection</span><span>View</span><span>Go</span><span>Run</span><span>Terminal</span><span>Help</span></div>
        <div class="search"><svg class="icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>my-project</div>
        <div class="winctl">
          <span><svg class="icon" viewBox="0 0 16 16"><path d="M3 8h10" /></svg></span>
          <span><svg class="icon" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" /></svg></span>
          <span><svg class="icon" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg></span>
        </div>
      </div>
      <div class="main">
        <nav class="activity">
          <span><svg class="icon" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v11h2M14 3l5 5v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5M14 3v5h5" /></svg></span>
          <span><svg class="icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg></span>
          <span><svg class="icon" viewBox="0 0 24 24"><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 7v10M18 10c0 4-5 4-11 7" /></svg></span>
          <span><svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /><path d="M4 19h2" /></svg></span>
          <span id="act-ext"><svg class="icon" viewBox="0 0 24 24"><rect x="3.5" y="12.5" width="8" height="8" /><rect x="12.5" y="12.5" width="8" height="8" /><rect x="3.5" y="3.5" width="8" height="8" /><rect x="14" y="2" width="8" height="8" transform="rotate(10 18 6)" /></svg></span>
          <div class="grow"></div>
          <span><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5" /></svg></span>
          <span><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg></span>
        </nav>

        <aside id="side">
          <div class="side-head">EXTENSIONS: MARKETPLACE</div>
          <div class="ext-search"><span id="ext-q"></span><span class="caret" id="ext-caret"></span><span class="ph" id="ext-ph">Search Extensions in Marketplace</span></div>
          <div id="result">
            <div class="mark"></div>
            <div class="txt">
              <b>AI Quota Tool</b>
              <div class="desc">See remaining AI quota for Claude, Copilot, Codex, Grok and Cursor</div>
              <div class="pub">BasantPandey<span class="btn" id="r-install">Install</span></div>
            </div>
          </div>
        </aside>

        <section class="group">
          <div class="tabs"><div class="tab" id="tab"></div></div>
          <div class="pane" id="welcome">
            <svg viewBox="0 0 100 100" fill="currentColor"><path d="M71 6 37 37 16 21l-8 4v50l8 4 21-16 34 31 21-10V16zM16 62V38l12 12zm55 6L48 50l23-18z" /></svg>
            <div>Show All Commands  Ctrl + Shift + P</div>
          </div>
          <div class="pane" id="details">
            <div class="d-head">
              <div class="mark"></div>
              <div>
                <h1>AI Quota Tool</h1>
                <div class="pub">BasantPandey</div>
                <div class="desc">See remaining AI quota for Claude, Copilot, Codex, Grok and Cursor, plus API key spend.</div>
                <div class="d-btns" id="d-btns"><span id="install">Install</span></div>
              </div>
            </div>
            <div class="d-tabs"><span class="on">DETAILS</span><span>FEATURES</span><span>CHANGELOG</span></div>
            <div class="d-body">
              <div>
                <h2>AI Quota Tool</h2>
                <p>Monitor your remaining AI quota for Claude, GitHub Copilot, OpenAI Codex, and Grok, plus the balance or spend of your API keys - live in VS Code.</p>
                <p>Sign-in opens Chrome or Edge in a new profile. The extension never sees your password.</p>
              </div>
              <div>
                <h2>Features</h2>
                <p>Status bar item - remaining quota at a glance for each Account.</p>
                <p>One panel, three tabs - Usage, Accounts, and Keys.</p>
                <p>Named Keys - the balance or spend of each API key.</p>
              </div>
            </div>
          </div>
          <div class="pane" id="panel-pane"><iframe id="panel" title="AI Quota Tool" src="webview.html?tab=accounts&amp;theme=dark"></iframe></div>
        </section>
      </div>
      <footer class="status">
        <span class="remote"><svg class="icon" viewBox="0 0 16 16"><path d="M2 6l3-3 3 3M14 10l-3 3-3-3M5 3v6M11 13V7" /></svg></span>
        <span><svg class="icon" viewBox="0 0 16 16"><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5.5" r="1.5" /><path d="M4.5 5v6M11.5 7c0 3-4 2.5-7 4" /></svg>main</span>
        <span>⊗ 0&nbsp;&nbsp;⚠ 0</span>
        <span class="grow"></span>
        <span id="quota"></span>
        <span><svg class="icon" viewBox="0 0 16 16"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14h3" /></svg></span>
      </footer>

      <div id="palette">
        <div class="in"><span id="pal-q"></span><span class="caret"></span></div>
        <ul>
          <li class="sel"><span id="pal-1t"></span><i>recently used</i></li>
          <li><span>AI Quota Tool: Open Dashboard</span><i></i></li>
        </ul>
      </div>

      <div id="browser">
        <div class="b-top">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <div class="b-url"><svg class="icon" viewBox="0 0 16 16"><rect x="4" y="7" width="8" height="6" rx="1" /><path d="M6 7V5a2 2 0 0 1 4 0v2" /></svg>claude.ai/login</div>
          <span class="b-tag">New profile</span>
        </div>
        <div class="b-page" id="b-login">
          <h3>Sign in</h3>
          <p>Sign in on the real site. VS Code never sees your password.</p>
          <div class="b-field" id="b-email"></div>
          <div class="b-btn">Continue</div>
        </div>
        <div class="b-page" id="b-ok" style="opacity: 0">
          <div class="b-ok">✓</div>
          <h3>You are signed in</h3>
          <p>Go back to VS Code and click Done.</p>
        </div>
      </div>

      <div class="toast" id="toast-wait">
        <div class="row"><span class="info">i</span><span>Sign in to Claude in the browser window. Then click Done.</span></div>
        <div class="acts"><span id="done">Done</span><span class="ghost">Cancel</span></div>
      </div>
      <div class="toast" id="toast-ok">
        <div class="row"><span class="info">i</span><span>Stored the Claude session cookie in VS Code SecretStorage. The browser profile is deleted.</span></div>
      </div>

      <div id="dim"></div>
      <div id="callout"><div class="note" id="co-note"></div><div class="big" id="co-big"></div><div class="arrow" id="co-arrow"></div></div>

      <div id="ripple"></div>
      <svg id="cursor" viewBox="0 0 26 26"><path d="M3 2v19l5-5 3.5 8 3-1.3L11 15h7z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round" /></svg>
    </div>`;

  let V;

  window.setMark = (svg) => {
    for (const el of document.querySelectorAll('.mark')) el.innerHTML = svg;
    $('tab').dataset.mark = svg;
  };

  // The tab above the editor: a label, or null for no tab.
  function editorTab(label) {
    $('tab').style.display = label ? '' : 'none';
    $('tab').innerHTML = `<span class="mark">${$('tab').dataset.mark ?? ''}</span>${label}<span class="x">×</span>`;
  }

  function scenes(t) {
    const { hookEnd, start, end } = V;
    show($('hook'), span(t, 0, hookEnd, 0.3));
    show($('hook1'), prog(t, 0.15, 0.7), 20);
    const pop = prog(t, 0.9, 1.3);
    $('limit').style.opacity = pop;
    $('limit').style.transform = `scale(${0.85 + 0.15 * pop})`;
    show($('hook2'), prog(t, 1.9, 2.4), 20);

    show($('brand'), span(t, hookEnd, start, 0.3));
    const m = prog(t, hookEnd + 0.1, hookEnd + 0.7);
    $('b-mark').style.opacity = m;
    $('b-mark').style.transform = `scale(${0.6 + 0.4 * m}) rotate(${(1 - m) * -12}deg)`;
    show($('b-title'), prog(t, hookEnd + 0.4, hookEnd + 0.9), 24);
    show($('b-tag'), prog(t, hookEnd + 0.7, hookEnd + 1.2), 18);
    [...$('chips').children].forEach((c, i) => show(c, prog(t, hookEnd + 1.1 + i * 0.12, hookEnd + 1.5 + i * 0.12), 14));

    const cta = $('cta');
    show(cta, prog(t, end, end + 0.5));
    show(cta.querySelector('.mark'), prog(t, end + 0.2, end + 0.7), 20);
    show(cta.querySelector('h1'), prog(t, end + 0.4, end + 0.9), 20);
    show(cta.querySelector('p'), prog(t, end + 0.6, end + 1.1), 16);
    show(cta.querySelector('.cmd'), prog(t, end + 0.9, end + 1.4), 16);
    show(cta.querySelector('.url'), prog(t, end + 1.2, end + 1.7), 12);

    const v = span(t, start, end, 0.45);
    $('view').style.opacity = v;
    $('view').style.transform = `translateY(${(1 - v) * 40}px) scale(${0.97 + 0.03 * v})`;
  }

  // Each subtitle shows until the next one starts.
  let subs = [];
  function caption(t) {
    show($('cap'), span(t, V.start, V.end));
    const cap = [...V.caps].reverse().find((c) => t >= c.at) ?? V.caps[0];
    $('cap-step').textContent = cap.step;
    $('cap-title').textContent = cap.title;
    show($('cap-title'), cap === V.caps[0] ? 1 : prog(t, cap.at, cap.at + 0.45), 14);
    subs.forEach(({ el, a, b }) => show(el, span(t, a, b, 0.3), 10));
  }

  // Camera: fit a rectangle of the 1280x800 window into the 1344x840 view.
  const VW = 1344, VH = 840, WW = 1280, WH = 800;
  const FULL = { x: 0, y: 0, w: WW, h: WH };
  let cam = { s: 1, tx: 0, ty: 0 };
  function camera(t) {
    const keys = V.camera ?? [];
    let r = FULL;
    for (let i = 0; i < keys.length; i++) {
      const [a, ra] = keys[i];
      const [b, rb] = keys[i + 1] ?? keys[i];
      if (t >= a) {
        const k = b === a ? 1 : prog(t, a, b);
        r = { x: lerp(ra.x, rb.x, k), y: lerp(ra.y, rb.y, k), w: lerp(ra.w, rb.w, k), h: lerp(ra.h, rb.h, k) };
      }
    }
    const s = Math.min(VW / r.w, VH / r.h);
    const tx = Math.min(0, Math.max(VW - s * WW, VW / 2 - s * (r.x + r.w / 2)));
    const ty = Math.min(0, Math.max(VH - s * WH, VH / 2 - s * (r.y + r.h / 2)));
    cam = { s, tx, ty };
    $('win').style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  // Center of an element, in window coordinates.
  function centerOf(el) {
    const w = $('view').getBoundingClientRect();
    let r = el.getBoundingClientRect();
    if (el.ownerDocument !== document) {
      const f = $('panel').getBoundingClientRect();
      r = { left: f.left + r.left * cam.s, top: f.top + r.top * cam.s, width: r.width * cam.s, height: r.height * cam.s };
    }
    return { x: (r.left - w.left - cam.tx + r.width / 2) / cam.s, y: (r.top - w.top - cam.ty + r.height / 2) / cam.s };
  }

  // Elements in the real panel. Each finder runs at render time, because the panel changes.
  const doc = () => $('panel').contentDocument;
  const inPanel = (selector) => () => doc().querySelector(selector);
  const button = (label) => () =>
    [...doc().querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label || b.textContent.trim() === label);
  // React reads the value from the native setter and the input or change event.
  function setValue(el, value) {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
    const Ev = el.ownerDocument.defaultView.Event;
    el.dispatchEvent(new Ev(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }
  const point = (x, y) => () => ({ x, y });

  const lastPos = new Map();
  function pos(i) {
    const found = V.cursor[i][1]();
    const c = found && ('x' in found ? found : centerOf(found));
    if (c) lastPos.set(i, c);
    return lastPos.get(i) ?? lastPos.get(i - 1) ?? { x: 640, y: 400 };
  }
  function cursor(t) {
    const keys = V.cursor;
    show($('cursor'), span(t, keys[0][0] - 0.3, keys.at(-1)[0] + 0.4, 0.3));
    const i = Math.max(0, keys.findLastIndex(([at]) => at <= t));
    const a = pos(i);
    const b = pos(Math.min(i + 1, keys.length - 1));
    const k = i + 1 < keys.length ? prog(t, keys[i][0], keys[i + 1][0]) : 0;
    const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k);
    const click = V.clicks.map(([at]) => at).find((c) => t >= c && t < c + 0.45);
    const press = click == null ? 1 : 1 - 0.15 * Math.sin(Math.PI * clamp01((t - click) / 0.2));
    $('cursor').style.transform = `translate(${x - 4}px, ${y - 3}px) scale(${press})`;
    const ring = click == null ? 0 : clamp01((t - click) / 0.45);
    Object.assign($('ripple').style, { left: `${x}px`, top: `${y}px`, opacity: click == null ? 0 : 1 - ring, transform: `scale(${0.4 + ring * 1.2})` });
  }

  async function settle() {
    const w = $('panel').contentWindow;
    await new Promise((r) => setTimeout(r, 60));
    await new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(r)));
  }

  // Post host messages when the wanted panel state changes. Each part posts on its own.
  let lastTab, lastSnapshot;
  const lastForms = new Map();
  async function panel(t) {
    const state = V.panel(t);
    const w = $('panel').contentWindow;
    let changed = false;
    if (state.tab != null && state.tab !== lastTab) {
      lastTab = state.tab;
      w.postMessage({ type: 'show_tab', tab: state.tab }, '*');
      changed = true;
    }
    const snapshot = JSON.stringify(state.snapshot);
    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      w.postMessage({ type: 'snapshot', snapshot: state.snapshot }, '*');
      changed = true;
    }
    for (const form of state.forms ?? []) {
      const key = JSON.stringify(form);
      if (lastForms.get(form.target) === key) continue;
      lastForms.set(form.target, key);
      w.postMessage({ type: 'form_status', form }, '*');
      changed = true;
    }
    if (changed) await settle();
  }

  // Real clicks and other one-time actions in the panel, in time order.
  let actions = [];
  async function act(t) {
    let changed = false;
    while (actions.length && actions[0][0] <= t) {
      actions.shift()[1]();
      changed = true;
    }
    for (const [a, b, find, text] of V.typing ?? []) {
      if (t < a || t > b + 0.2) continue;
      const el = find();
      const value = typed(text, t, a, b);
      if (el && el.value !== value) {
        setValue(el, value);
        changed = true;
      }
    }
    if (changed) await settle();
  }

  function statusItem(t) {
    const q = $('quota');
    const { html, warn } = V.status(t);
    q.innerHTML = html;
    q.className = warn ? 'warn' : '';
    q.style.opacity = prog(t, V.statusFrom, V.statusFrom + 0.3);

    // A large copy of the item (or its tooltip) above the real one, with the rest of the window dimmed.
    const now = V.callouts.find(([a, b]) => t >= a && t < b) ?? V.callouts.findLast(([a]) => t >= a) ?? V.callouts[0];
    const [a, b, note, tip] = now;
    const on = span(t, a, b, 0.4);
    $('dim').style.opacity = 0.6 * on;
    show($('callout'), on, 16);
    $('co-note').textContent = note;
    $('co-big').innerHTML = tip ?? q.innerHTML;
    $('co-big').className = tip ? 'big tip' : `big ${q.className}`;
    $('callout').style.right = `${WW - (q.offsetLeft + q.offsetWidth)}px`;
    $('co-arrow').style.marginRight = `${q.offsetWidth / 2 - 12}px`;
  }

  window.Promo = {
    $, clamp01, ease, prog, lerp, span, typed, show, ICON, editorTab, inPanel, button, setValue, point, FULL,
    start(video) {
      V = video;
      $('view').innerHTML = WINDOW;
      const all = V.caps.flatMap((c, ci) =>
        c.subs.map(([at, html], i) => ({ at, html, end: c.subs[i + 1]?.[0] ?? V.caps[ci + 1]?.at ?? V.end })),
      );
      $('cap-sub').innerHTML = all.map((s) => `<span>${s.html}</span>`).join('');
      subs = all.map((s, i) => ({ el: $('cap-sub').children[i], a: s.at, b: s.end }));
      actions = [
        ...V.clicks.filter(([, , real]) => real).map(([at, find]) => [at, () => find()?.click()]),
        ...(V.actions ?? []),
      ].sort((x, y) => x[0] - y[0]);
      window.DURATION = V.duration;
      window.render = async (t) => {
        scenes(t);
        caption(t);
        camera(t);
        V.frame?.(t);
        statusItem(t);
        await panel(t);
        await act(t);
        cursor(t);
      };
    },
  };
})();
