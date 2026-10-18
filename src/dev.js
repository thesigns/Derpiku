// Developer mode — localhost only (loaded dynamically, never loaded at all on the GitHub Pages build).
// Lets you test the game without leaving the house: simulated GPS, walking with the arrows or an auto-walk,
// shifting the clock (spirits, seasons, walk expiry), forcing state and previewing haiku.
import { WALK_DISTANCES, MAX_ACCURACY_M, MAX_SPEED_KMH, clock, fakeGps, moveFake, setFake, notifyFake, distanceM } from './walk.js';
import { haikuFor, seasonFor } from './texts.js';

const STORAGE_KEY = 'derpiku-dev';
const WALK_KMH = 5;
const STEP_M = 100;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PRESETS = [
  ['Kraków', 50.0614, 19.9366],
  ['Warszawa', 52.2297, 21.0122],
  ['Reykjavík', 64.1466, -21.9426],
  ['Longyearbyen', 78.2232, 15.6267],
  ['New York', 40.7128, -74.0060],
  ['Singapore', 1.3521, 103.8198],
  ['Nairobi', -1.2921, 36.8219],
  ['Sydney', -33.8688, 151.2093],
  ['Ushuaia', -54.8019, -68.3030],
];
const ACCURACIES = [8, 30, 49, 80, 200];
const CLOCK_SKIPS = [['+1 min', 60e3], ['+10 min', 600e3], ['+1 h', 3600e3], ['+1 d', 86400e3], ['+30 d', 30 * 86400e3]];

export function isLocalhost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost');
}

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function fmtMs(ms) {
  const neg = ms < 0;
  let s = Math.round(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  const out = (d ? `${d} d ` : '') + (d || h ? `${h} h ` : '') + `${m} m ${s} s`;
  return (neg ? '−' : '') + out;
}

const STYLE = `
.dev-settings { margin-top: 28px; padding: 14px; border: 1px dashed var(--accent); border-radius: 12px; }
.dev-settings h2 { margin-top: 0 !important; }
.dev-settings small { color: var(--muted); font-weight: 400; }
.dev-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0; font-size: 14px; }
.dev-row > b { min-width: 74px; }
.dev-settings input[type=number] { width: 96px; }
.dev-settings button, .dev-settings select, .dev-settings input, .dev-bar button, .dev-bar select {
  font: inherit; font-size: 13px; padding: 4px 8px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--card); color: var(--ink);
}
.dev-readout { font: 12px/1.45 ui-monospace, Consolas, monospace; white-space: pre-wrap; background: var(--card);
  border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin: 8px 0 0; }
.dev-bar { position: fixed; top: calc(env(safe-area-inset-top) + 52px); left: 50%; transform: translateX(-50%);
  width: min(544px, calc(100% - 16px)); z-index: 30; background: rgba(20, 18, 30, 0.88); color: #f3f0fa;
  border-radius: 12px; padding: 6px 8px; font-size: 12px; backdrop-filter: blur(4px); }
.dev-bar .dev-line { font: 11px/1.4 ui-monospace, Consolas, monospace; white-space: pre-wrap; margin-bottom: 4px; }
.dev-bar .dev-controls { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.dev-bar button, .dev-bar select { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.2); padding: 3px 7px; }
.dev-bar .dev-tag { font-weight: 700; color: #b8adff; }
.dev-bar.collapsed { width: auto; left: auto; right: 8px; transform: none; }
.dev-bar.collapsed .dev-line, .dev-bar.collapsed .dev-controls > :not(.dev-toggle) { display: none; }
`;

export function setupDev(app) {
  const { SPIRITS, O } = app;
  const cfg = Object.assign({ devMode: true, fake: true, lat: PRESETS[0][1], lon: PRESETS[0][2], accuracy: 8, clockOffset: 0, collapsed: false }, loadConfig());
  const save = () => {
    cfg.fake = fakeGps.enabled;
    cfg.lat = fakeGps.lat;
    cfg.lon = fakeGps.lon;
    cfg.accuracy = fakeGps.accuracy;
    cfg.clockOffset = clock.offsetMs;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  };
  fakeGps.enabled = cfg.fake;
  fakeGps.lat = cfg.lat;
  fakeGps.lon = cfg.lon;
  fakeGps.accuracy = cfg.accuracy;
  clock.offsetMs = cfg.clockOffset;

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  // After every position / clock change: a new reading (instant from the simulator) and a refresh of everything time-dependent.
  const sync = async () => {
    save();
    if (fakeGps.enabled) {
      try { await app.freshFix(); } catch (e) { /* no GPS */ }
    }
    app.refreshAll();
    readout();
  };

  const spiritOptions = SPIRITS.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');

  // ---------- settings section ----------

  const panel = document.createElement('section');
  panel.className = 'dev-settings';
  panel.innerHTML = `
    <h2>Developer mode <small>(localhost only)</small></h2>
    <label class="dev-row"><input type="checkbox" id="dev-on"> Show developer bar on the main screens</label>
    <label class="dev-row"><input type="checkbox" id="dev-fake"> Simulated GPS (instead of the real one)</label>
    <div class="dev-row"><b>Location</b>
      <select id="dev-preset"><option value="">preset…</option>${PRESETS.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('')}</select>
      <input id="dev-lat" type="number" step="0.0001"> <input id="dev-lon" type="number" step="0.0001">
      <button id="dev-go">Go</button>
    </div>
    <div class="dev-row"><b>Accuracy</b>
      <select id="dev-acc">${ACCURACIES.map(a => `<option value="${a}">${a} m${a > MAX_ACCURACY_M ? ' (too fuzzy)' : ''}</option>`).join('')}</select>
    </div>
    <div class="dev-row"><b>Clock</b> <span id="dev-clock"></span></div>
    <div class="dev-row">${CLOCK_SKIPS.map(([l, ms]) => `<button data-skip="${ms}">${l}</button>`).join('')}<button id="dev-now">Real time</button></div>
    <div class="dev-row"><b>Walk</b>
      <button id="dev-endwalk">Reset walk segment</button>
    </div>
    <div class="dev-row"><b>Haiku</b>
      <select id="dev-h-spirit">${spiritOptions}</select>
      <select id="dev-h-season">${SEASONS.map(s => `<option>${s}</option>`).join('')}</select>
      <button id="dev-h-show">Show next</button>
    </div>
    <div class="dev-row"><button id="dev-onboarding">Replay onboarding</button><button id="dev-reset">Reset everything</button></div>
    <pre class="dev-readout" id="dev-readout"></pre>`;
  document.querySelector('#screen-settings .settings').appendChild(panel);
  const $ = sel => panel.querySelector(sel);

  $('#dev-on').checked = cfg.devMode;
  $('#dev-fake').checked = fakeGps.enabled;
  $('#dev-acc').value = String(fakeGps.accuracy);
  const syncLatLon = () => {
    $('#dev-lat').value = fakeGps.lat.toFixed(5);
    $('#dev-lon').value = fakeGps.lon.toFixed(5);
  };
  syncLatLon();

  $('#dev-on').addEventListener('change', e => {
    cfg.devMode = e.target.checked;
    save();
    readout();
  });
  $('#dev-fake').addEventListener('change', e => {
    fakeGps.enabled = e.target.checked;
    app.restartWatch();
    sync();
  });
  $('#dev-preset').addEventListener('change', e => {
    const p = PRESETS[Number(e.target.value)];
    if (!p) return;
    setFake(p[1], p[2]);
    syncLatLon();
    e.target.value = '';
    sync();
  });
  $('#dev-go').addEventListener('click', () => {
    const lat = Number($('#dev-lat').value), lon = Number($('#dev-lon').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    setFake(lat, lon);
    sync();
  });
  $('#dev-acc').addEventListener('change', e => {
    fakeGps.accuracy = Number(e.target.value);
    notifyFake();
    sync();
  });
  panel.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => skip(Number(b.dataset.skip))));
  $('#dev-now').addEventListener('click', () => {
    clock.offsetMs = 0;
    sync();
  });
  $('#dev-endwalk').addEventListener('click', async () => {
    await app.resetSegment();
    readout();
  });
  let haikuIndex = 0;
  $('#dev-h-show').addEventListener('click', () => {
    const s = SPIRITS[Number($('#dev-h-spirit').value)];
    const season = $('#dev-h-season').value;
    const i = haikuIndex++ % 4;
    app.showScreen('home');
    app.showBubble(haikuFor(s.animal, season, i), { caption: `— ${s.name} · ${season} ${i + 1}/4`, copy: true });
  });
  $('#dev-onboarding').addEventListener('click', async () => {
    app.getState().onboarded = false;
    await app.persist();
    location.reload();
  });
  $('#dev-reset').addEventListener('click', async () => {
    await app.resetState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  });

  // ---------- floating bar on the game screens ----------

  const bar = document.createElement('div');
  bar.className = 'dev-bar' + (cfg.collapsed ? ' collapsed' : '');
  bar.hidden = !cfg.devMode;
  bar.innerHTML = `
    <div class="dev-line" id="dev-bar-line"></div>
    <div class="dev-controls">
      <button class="dev-toggle dev-tag" title="Collapse / expand">DEV</button>
      <button data-move="1,0" title="100 m north">↑</button>
      <button data-move="0,-1" title="100 m west">←</button>
      <button data-move="0,1" title="100 m east">→</button>
      <button data-move="-1,0" title="100 m south">↓</button>
      <button data-target title="Jump just past the target circle (and advance the clock so the speed check passes)">🎯 target</button>
      <select data-auto title="Auto-walk at 5 km/h">
        <option value="0">auto-walk off</option><option value="1">walk ×1</option><option value="10">walk ×10</option><option value="60">walk ×60</option>
      </select>
      <button data-bar-skip="600000">+10 min</button>
      <button data-acc title="Toggle good / too fuzzy GPS">±m</button>
    </div>`;
  document.getElementById('app').appendChild(bar);

  bar.querySelector('.dev-toggle').addEventListener('click', () => {
    cfg.collapsed = !cfg.collapsed;
    bar.classList.toggle('collapsed', cfg.collapsed);
    save();
  });
  bar.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
    const [n, e] = b.dataset.move.split(',').map(Number);
    walkStep(n * STEP_M, e * STEP_M);
  }));
  bar.querySelector('[data-target]').addEventListener('click', jumpToTarget);
  bar.querySelector('[data-bar-skip]').addEventListener('click', () => skip(600000));
  bar.querySelector('[data-acc]').addEventListener('click', () => {
    fakeGps.accuracy = fakeGps.accuracy > MAX_ACCURACY_M ? 8 : 80;
    $('#dev-acc').value = String(fakeGps.accuracy);
    notifyFake();
    sync();
  });

  let autoTimer = 0, heading = Math.random() * Math.PI * 2;
  bar.querySelector('[data-auto]').addEventListener('change', e => {
    clearInterval(autoTimer);
    const factor = Number(e.target.value);
    if (!factor) return;
    ensureFake();
    autoTimer = setInterval(() => {
      heading += (Math.random() - 0.5) * 0.35;
      const d = WALK_KMH / 3.6 * factor;
      moveFake(Math.cos(heading) * d, Math.sin(heading) * d);
      clock.offsetMs += (factor - 1) * 1000;
      sync();
    }, 1000);
  });

  // ---------- actions ----------

  function ensureFake() {
    if (fakeGps.enabled) return;
    fakeGps.enabled = true;
    $('#dev-fake').checked = true;
    app.restartWatch();
  }

  // A walking step: moves the position and the clock as if the distance were walked at 5 km/h.
  function walkStep(northM, eastM) {
    ensureFake();
    moveFake(northM, eastM);
    clock.offsetMs += Math.hypot(northM, eastM) / (WALK_KMH / 3.6) * 1000;
    syncLatLon();
    sync();
  }

  function jumpToTarget() {
    const walk = app.getState().segment;
    if (!walk) {
      flash('Pet Derpiku first — that starts the walk');
      return;
    }
    ensureFake();
    const d = walk.distanceM + 15;
    setFake(walk.lat + d / 111320, walk.lon);
    const needMs = d / (WALK_KMH / 3.6) * 1000;
    const elapsed = clock.now() - walk.startedAt;
    if (elapsed < needMs) clock.offsetMs += needMs - elapsed;
    syncLatLon();
    sync();
  }

  function skip(ms) {
    clock.offsetMs += ms;
    sync();
  }

  let flashText = '', flashUntil = 0;
  function flash(text) {
    flashText = text;
    flashUntil = Date.now() + 2500;
    readout();
  }

  // ---------- state readout ----------

  function readout() {
    const st = app.getState();
    const fix = app.getLastFix();
    const now = clock.now();
    const lines = [];
    const gps = fakeGps.enabled ? 'sim' : 'real';
    lines.push(fix
      ? `GPS ${gps} ${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)} ±${Math.round(fix.accuracy)} m${fix.accuracy > MAX_ACCURACY_M ? ' (too fuzzy)' : ''} · fix ${fmtMs(now - fix.time)} ago`
      : `GPS ${gps} · no fix yet`);
    const seg = st.segment;
    if (seg) {
      const d = fix ? distanceM(seg, fix) : 0;
      const elapsed = now - seg.startedAt;
      const minMs = d / (MAX_SPEED_KMH / 3.6) * 1000;
      lines.push(`Walk ${Math.round(d)} / ${seg.distanceM} m (${Math.min(100, Math.round(d / seg.distanceM * 100))}%) · ${fmtMs(elapsed)}` +
        (elapsed < minMs ? ` · too fast until +${fmtMs(minMs - elapsed)}` : ''));
    } else {
      lines.push(`No walk — pet Derpiku to start · distance ${WALK_DISTANCES.find(w => w.meters === st.walkDistanceM)?.label || st.walkDistanceM + ' m'}`);
    }
    if (fix) {
      const vec = O.latLonToVec(fix.lat, fix.lon);
      const pick = O.pickSpirit(SPIRITS, vec, now, 'km');
      const idx = pick ? pick.index : app.PIGEON;
      const w = O.nextCatchWindow(SPIRITS, idx, vec, now, 3 * O.DAY_MS, 60000, 'km');
      lines.push(`Above ${SPIRITS[idx].name}${w && Number.isFinite(w.end) ? `, ${fmtMs(w.end - now)} left` : ''}`);
    }
    const local = new Date(now);
    lines.push(`Clock ${clock.offsetMs ? fmtMs(clock.offsetMs) + ' ahead' : 'real time'} · ${local.toLocaleString()} · ${seasonFor(now, fix && fix.lat < 0 ? 'S' : 'N')}`);
    if (Date.now() < flashUntil) lines.unshift(`⚠ ${flashText}`);

    $('#dev-readout').textContent = lines.join('\n');
    $('#dev-clock').textContent = clock.offsetMs ? `${fmtMs(clock.offsetMs)} ahead` : 'real time';
    // the bar shows only what matters while playing: warning, walk, spirit overhead, clock offset
    const short = lines.filter(l => /^(⚠|Walk|No walk|Above)/.test(l));
    if (clock.offsetMs) short.push(`Clock ${fmtMs(clock.offsetMs)} ahead`);
    if (fix && fix.accuracy > MAX_ACCURACY_M) short.push(`GPS too fuzzy (±${Math.round(fix.accuracy)} m)`);
    bar.querySelector('#dev-bar-line').textContent = short.join('\n');
    // in settings the bar would only get in the way — everything is in the section above
    bar.hidden = !cfg.devMode || document.getElementById('screen-settings').classList.contains('active');
  }

  setInterval(readout, 500);
  if (fakeGps.enabled) {
    app.restartWatch();
    sync();
  } else {
    readout();
  }
}
