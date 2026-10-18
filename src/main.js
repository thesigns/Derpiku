import { load, save } from './store.js';
import {
  WALK_DISTANCES, MAX_ACCURACY_M, clock,
  getFix, watchFix, distanceM, isExpired, haikuBlocker,
} from './walk.js';
import { loadTexts, pickHaiku, dayIndex } from './texts.js';
import { createCreature } from './creature.js';
import { createGlobe } from './globe.js';
import { createSpiritView } from './spirit-view.js';
import { createRadar, compassNeedsPermission, requestCompassPermission, watchCompass } from './radar.js';

const O = globalThis.Orbits;
const SPIRITS = globalThis.DERPIKU_SPIRITS;
const PIGEON = SPIRITS.findIndex(s => s.group === 'background');
const FORECAST_HORIZON_MS = 60 * O.DAY_MS;
const LIVE_FIX_MAX_AGE_MS = 5000;
const GROUP_LABELS = {
  background: 'Everywhere, always', common: 'Common', medium: 'Uncommon', rare: 'Rare',
  'very rare': 'Very rare', regional: 'Warm places only', polar: 'Loves the poles',
};
const DEFAULT_STATE = {
  version: 2,
  segment: null,    // { lat, lon, startedAt, distanceM } — walk segment; cleared after the haiku or after 3 h
  walkDistanceM: 500,
  onboarded: false,
  haikuLog: { day: -1, counts: {} },
};

const $ = id => document.getElementById(id);
let state = { ...DEFAULT_STATE };
let lastFix = null;   // in memory only, never saved
let busy = false;
let stopWatch = null;

const creature = createCreature($('creature-body'), $('creature-face'));
const globe = createGlobe($('globe'), { spirits: SPIRITS, now: () => clock.now(), onSelect: selectSpirit });
const spiritView = createSpiritView($('spirit'), $('spirit-label'), { spirits: SPIRITS, anchor: spiritAnchor });
const radar = createRadar($('radar'));

// The spirit floats above Derpiku's head, tail pointing at it; leave room for the label above it.
function spiritAnchor() {
  const m = creature.metrics();
  const r = Math.max(16, Math.min(38, m.size * 0.27));
  const labelSpace = 40;
  const y = Math.max(labelSpace + r * 1.75, m.headY - r * 2.7);
  return { x: m.cx, y, r };
}

function persist() {
  return save('state', state);
}

function activeScreen() {
  const s = document.querySelector('.screen.active');
  return s ? s.id.replace('screen-', '') : 'home';
}

function fmtMeters(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} km` : `${Math.round(m)} m`;
}

// ---------- speech bubble ----------

function showBubble(text, { caption = '', copy = false, glow = null } = {}) {
  $('bubble-text').textContent = text;
  $('bubble-caption').textContent = caption;
  $('bubble-caption').hidden = !caption;
  $('bubble-copy').hidden = !copy;
  $('bubble-copy').textContent = 'Copy';
  $('bubble').hidden = false;
  // while saying a haiku, Derpiku glows in the colour of the spirit it heard it from
  creature.setMood(glow ? 'fed' : 'hungry', glow);
  placeBubble();
  $('bubble').classList.remove('pop');
  void $('bubble').offsetWidth;
  $('bubble').classList.add('pop');
}

function say(text) {
  showBubble(text);
}

// A bubble or a spirit may hover above Derpiku — then Derpiku moves down to make room.
function updateLift() {
  creature.setLift(!$('bubble').hidden ? 0.64 : spiritView.position() ? 0.62 : 0.56);
}

// The bubble's tail points at the top of Derpiku's head; if the bubble doesn't fit, it sticks to the top of the terrarium.
function placeBubble() {
  const bubble = $('bubble');
  spiritView.setHidden(!bubble.hidden);
  updateLift();
  creature.setGaze(spiritView.position());
  if (bubble.hidden) return;
  const area = $('terrarium').clientHeight;
  const [, headY] = creature.headTop();
  const bottom = Math.max(0, area - headY + 16);
  const fits = bottom + bubble.offsetHeight <= area - 8;
  bubble.style.top = fits ? 'auto' : '8px';
  bubble.style.bottom = fits ? `${bottom}px` : 'auto';
}

new ResizeObserver(placeBubble).observe($('terrarium'));

$('bubble-close').addEventListener('click', () => {
  $('bubble').hidden = true;
  creature.setMood('hungry');
  placeBubble();
});
$('bubble-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('bubble-text').textContent);
    $('bubble-copy').textContent = 'Copied';
  } catch (e) {
    $('bubble-copy').textContent = 'Select the text to copy';
  }
});

// ---------- walk segment: progress ----------

function liveFix() {
  return lastFix && stopWatch && clock.now() - lastFix.time <= LIVE_FIX_MAX_AGE_MS ? lastFix : null;
}

function segmentStatus() {
  const seg = state.segment;
  if (!seg) return { text: 'Rub Derpiku with your finger.', progress: 0 };
  const fix = liveFix();
  if (!fix || fix.accuracy > MAX_ACCURACY_M) {
    return { text: `Walk ${fmtMeters(seg.distanceM)} from where you started, then rub Derpiku.`, progress: null };
  }
  const d = distanceM(seg, fix);
  const left = seg.distanceM - d;
  return left > 0
    ? { text: `${fmtMeters(Math.ceil(left))} to go · straight line from where you started`, progress: d / seg.distanceM }
    : { text: 'Far enough! Rub Derpiku for a haiku.', progress: 1 };
}

function render() {
  const s = segmentStatus();
  $('status').textContent = s.text;
  $('radar-info').textContent = state.segment ? s.text : 'Rub Derpiku to start a walk — the circle shows how far to go.';
  const paws = $('pawprints');
  paws.hidden = !state.segment;
  const filled = s.progress == null ? 0 : Math.floor(Math.min(1, s.progress) * 5 + 1e-9);
  paws.querySelectorAll('span').forEach((el, i) => el.classList.toggle('on', i < filled));
  creature.setWalking(!!state.segment);
  creature.setExcitement(state.segment && s.progress ? Math.min(1, s.progress) : 0);
  radar.setSegment(state.segment);
}

// ---------- GPS ----------

function gpsErrorText(err) {
  if (err && err.code === 1) return 'I need location access to sniff the sky. You can allow it in your browser settings.';
  if (err && err.code === 'unsupported') return 'This device can’t tell me where the sky is.';
  return 'I couldn’t find the sky just now. Pet me again in a moment.';
}

function onFix(fix) {
  lastFix = fix;
  globe.setPlayer(fix.lat, fix.lon);
  radar.setFix(fix);
  refreshHomeSpirit();
  render();
}

// Live tracking only while the app is open: during a walk segment or on the Radar.
function startWatching() {
  if (stopWatch || document.hidden || !(state.segment || activeScreen() === 'radar')) return;
  stopWatch = watchFix(onFix);
}

function stopWatching() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}

// One-off reading. Live tracking is paused meanwhile: with an active watchPosition,
// a reading with maximumAge 0 can hang until the timeout.
async function freshFix() {
  stopWatching();
  try {
    const fix = await getFix();
    onFix(fix);
    return fix;
  } finally {
    startWatching();
  }
}

// ---------- spirit above Derpiku ----------

const SPIRIT_FIX_MAX_AGE_MS = 10 * 60 * 1000;
const SPIRIT_FIX_REFRESH_MS = 5 * 60 * 1000;
let spiritTimer = 0;
let geoGranted = false;

// The spirit is shown only with a fresh and accurate GPS reading.
function goodFix() {
  return lastFix && lastFix.accuracy <= MAX_ACCURACY_M && clock.now() - lastFix.time <= SPIRIT_FIX_MAX_AGE_MS ? lastFix : null;
}

function spiritAbove(fix, now) {
  const pick = O.pickSpirit(SPIRITS, O.latLonToVec(fix.lat, fix.lon), now, 'km');
  return pick ? pick.index : PIGEON;
}

function refreshHomeSpirit() {
  clearTimeout(spiritTimer);
  const fix = goodFix();
  if (!fix) {
    spiritView.show(null);
    $('spirit-label').innerHTML = '';
    creature.setGaze(null);
    updateLift();
    return;
  }
  const now = clock.now();
  const vec = O.latLonToVec(fix.lat, fix.lon);
  const index = spiritAbove(fix, now);
  const w = O.nextCatchWindow(SPIRITS, index, vec, now, 3 * O.DAY_MS, 60000, 'km');
  const left = w && Number.isFinite(w.end) ? w.end - now : Infinity;
  spiritView.show(index);
  spiritView.setEndingSoon(left < 60000);
  $('spirit-label').innerHTML = `<b>${SPIRITS[index].name}</b>` +
    (Number.isFinite(left) ? (left < 60000 ? 'leaving any moment!' : `above you for another ${fmtDuration(left)}`) : '');
  updateLift();
  creature.setGaze(spiritView.position());
  spiritTimer = setTimeout(refreshHomeSpirit, Math.max(1000, Math.min(15000, left + 1000)));
}

// When location access is already granted, refresh the position every few minutes so the spirit stays right.
function backgroundFix() {
  if (!geoGranted || document.hidden || stopWatch || busy) return;
  freshFix().catch(() => refreshHomeSpirit());
}

async function watchGeoPermission() {
  if (!navigator.permissions) return;
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    const update = () => {
      geoGranted = p.state === 'granted';
      if (geoGranted && !goodFix()) backgroundFix();
    };
    p.addEventListener('change', update);
    update();
  } catch (e) {
    // the browser doesn't reveal the permission state — the spirit appears after the first reading
  }
}

// ---------- petting: the whole game is controlled by it ----------

async function resetSegment() {
  state.segment = null;
  stopWatching();
  startWatching();
  await persist();
  render();
}

function expireSegmentIfOld() {
  if (state.segment && isExpired(state.segment, clock.now())) resetSegment();
}

async function startSegment(fix) {
  state.segment = { lat: fix.lat, lon: fix.lon, startedAt: clock.now(), distanceM: state.walkDistanceM };
  await persist();
  startWatching();
  render();
}

async function sayHaiku(fix, now) {
  const index = spiritAbove(fix, now);
  const spirit = SPIRITS[index];
  const day = dayIndex(now);
  if (state.haikuLog.day !== day) state.haikuLog = { day, counts: {} };
  const nth = state.haikuLog.counts[index] || 0;
  state.haikuLog.counts[index] = nth + 1;
  const haiku = pickHaiku(spirit.animal, { index, at: now, hemisphere: fix.lat < 0 ? 'S' : 'N', nth });
  state.segment = null;
  await persist();
  stopWatching();
  startWatching();
  showBubble(haiku, { caption: `— ${spirit.name}`, copy: true, glow: spirit.color });
  creature.poke(0.35);
  creature.express('happy', 2500);
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([30, 60, 30]);
  render();
}

async function onPetAt(fix) {
  const now = clock.now();
  if (fix.accuracy > MAX_ACCURACY_M) {
    creature.express('no', 1400);
    creature.shakeHead();
    say('I can’t sense the sky here — the GPS is too fuzzy. Pet me again in a moment.');
    return;
  }
  if (!state.segment || isExpired(state.segment, now)) {
    await startSegment(fix);
    creature.express('open', 700);
    say(`Walk ${fmtMeters(state.segment.distanceM)} away and pet me — I’ll tell you a haiku!`);
    return;
  }
  const blocker = haikuBlocker(state.segment, fix, now);
  if (blocker === 'distance') {
    const left = Math.max(1, Math.ceil(state.segment.distanceM - distanceM(state.segment, fix)));
    creature.express('sniff', 1400);
    say(`Walk ${fmtMeters(left)} more and pet me — I’ll tell you a haiku!`);
    return;
  }
  if (blocker === 'speed') {
    await startSegment(fix);
    creature.express('no', 1400);
    creature.shakeHead();
    say(`Whoa, that was too fast — walk, don’t ride! Let’s start over: walk ${fmtMeters(state.segment.distanceM)} away and pet me.`);
    return;
  }
  await sayHaiku(fix, now);
}

creature.onPet(async () => {
  if (busy) return;
  busy = true;
  creature.express('sniff', 3000);
  try {
    const fix = liveFix() || await freshFix();
    await onPetAt(fix);
  } catch (err) {
    creature.express('no', 1400);
    say(gpsErrorText(err));
  } finally {
    busy = false;
    render();
  }
});

creature.onTap(() => {
  creature.express('open', 500);
  // an accidental tap must not take away the haiku being read
  if ($('bubble').hidden || $('bubble-copy').hidden) say('Pet me!');
});

// ---------- Radar ----------

let stopCompass = null;

function startCompass() {
  if (stopCompass) return;
  stopCompass = watchCompass(deg => radar.setCompass(deg));
}

function stopCompassWatch() {
  if (stopCompass) stopCompass();
  stopCompass = null;
  radar.setCompass(null);
}

$('btn-compass').addEventListener('click', async () => {
  if (await requestCompassPermission()) {
    $('btn-compass').hidden = true;
    startCompass();
  }
});

function enterRadar() {
  radar.refreshColors();
  radar.start();
  startWatching();
  if (compassNeedsPermission()) $('btn-compass').hidden = !!stopCompass;
  else startCompass();
  render();
}

function leaveRadar() {
  radar.stop();
  stopCompassWatch();
  if (!state.segment) stopWatching();
}

// ---------- orbit screen ----------

let selected = null;
let forecastTimer = 0;

function fmtDuration(ms) {
  const total = Math.floor(ms / 60000);
  if (total < 1) return 'less than a minute';
  const d = Math.floor(total / 1440), h = Math.floor(total % 1440 / 60), m = total % 60;
  if (d > 0) return `${d} d ${h} h ${m} m`;
  if (h > 0) return `${h} h ${m} m`;
  return `${m} m`;
}

function fmtPeriod(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m} m` : `${m} m`;
}

function updateForecast() {
  clearTimeout(forecastTimer);
  if (selected == null) return;
  const spirit = SPIRITS[selected];
  const el = $('card-forecast');
  if (!lastFix) {
    el.textContent = 'Share your location to see when it floats above you.';
    $('btn-locate').hidden = false;
    return;
  }
  $('btn-locate').hidden = true;
  if (!O.canEverReach(spirit, lastFix.lat)) {
    el.textContent = 'Never above you.';
    return;
  }
  const now = clock.now();
  const w = O.nextCatchWindow(SPIRITS, selected, O.latLonToVec(lastFix.lat, lastFix.lon), now, FORECAST_HORIZON_MS, 60000, 'km');
  if (!w) el.textContent = 'Not anytime soon.';
  else if (w.start <= now) el.textContent = `Above you now — for another ${fmtDuration(w.end - now)}.`;
  else el.textContent = `Above you in ${fmtDuration(w.start - now)}, for ${fmtDuration(w.end - w.start)}.`;
  forecastTimer = setTimeout(updateForecast, 30000);
}

// Who is above the player now (i.e. whose haiku it would be), for how long, and who comes next.
let overheadTimer = 0;

function spiritButton(i) {
  const s = SPIRITS[i];
  return `<button class="spirit-name" data-spirit="${i}"><span class="swatch" style="background:${s.color}"></span>${s.name}</button>`;
}

function updateOverhead() {
  clearTimeout(overheadTimer);
  if (activeScreen() !== 'orbits') return;
  if (!lastFix) {
    $('overhead-now').textContent = 'Share your location to see which spirit is above you.';
    $('overhead-next').textContent = '';
    $('btn-overhead-locate').hidden = false;
    return;
  }
  $('btn-overhead-locate').hidden = true;
  const now = clock.now();
  const vec = O.latLonToVec(lastFix.lat, lastFix.lon);
  const curIndex = spiritAbove(lastFix, now);
  const curWindow = O.nextCatchWindow(SPIRITS, curIndex, vec, now, 3 * O.DAY_MS, 60000, 'km');
  const end = curWindow ? curWindow.end : Infinity;
  $('overhead-now').innerHTML = `<b>Above you now</b> ${spiritButton(curIndex)}` +
    (Number.isFinite(end) ? ` for another ${fmtDuration(end - now)}` : '');
  if (Number.isFinite(end)) {
    const after = end + 1000;
    const nextIndex = spiritAbove(lastFix, after);
    const nextWindow = O.nextCatchWindow(SPIRITS, nextIndex, vec, after, 3 * O.DAY_MS, 60000, 'km');
    $('overhead-next').innerHTML = `<b>Next</b> ${spiritButton(nextIndex)}` +
      (nextWindow && Number.isFinite(nextWindow.end) ? ` for ${fmtDuration(nextWindow.end - end)}` : '');
  } else {
    $('overhead-next').textContent = '';
  }
  overheadTimer = setTimeout(updateOverhead, Math.max(1000, Math.min(30000, end - now + 1500)));
}

$('overhead').addEventListener('click', e => {
  const b = e.target.closest('[data-spirit]');
  if (b) selectSpirit(Number(b.dataset.spirit));
});

async function locateForOrbits() {
  $('overhead-now').textContent = 'Looking for the sky…';
  try {
    await freshFix();
  } catch (err) {
    $('overhead-now').textContent = gpsErrorText(err);
    return;
  }
  updateOverhead();
  updateForecast();
}

$('btn-overhead-locate').addEventListener('click', locateForOrbits);

function selectSpirit(i) {
  selected = i;
  globe.select(i);
  document.querySelectorAll('#spirit-chips button').forEach((b, k) => b.classList.toggle('on', k === i));
  if (i == null) {
    $('spirit-card').hidden = true;
    clearTimeout(forecastTimer);
    return;
  }
  const s = SPIRITS[i];
  $('card-swatch').style.background = s.color;
  $('card-name').textContent = s.name;
  $('card-meta').textContent = `${GROUP_LABELS[s.group]} · circles the Earth every ${fmtPeriod(s.periodMin)}`;
  $('card-forecast').textContent = 'Calculating…';
  $('spirit-card').hidden = false;
  setTimeout(updateForecast, 30);
}

function buildChips() {
  const box = $('spirit-chips');
  SPIRITS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.animal[0];
    b.title = s.name;
    b.style.setProperty('--chip', s.color);
    b.addEventListener('click', () => selectSpirit(selected === i ? null : i));
    box.appendChild(b);
  });
}

$('card-close').addEventListener('click', () => selectSpirit(null));
$('btn-locate').addEventListener('click', locateForOrbits);

// ---------- navigation, settings, onboarding ----------

function showScreen(name) {
  const previous = activeScreen();
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
  if (previous === 'radar' && name !== 'radar') leaveRadar();
  if (name === 'radar') enterRadar();
  if (name === 'orbits') {
    globe.start();
    updateOverhead();
    // When location access is already granted, don't make the player tap — show who is above them right away.
    if (!lastFix && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(p => { if (p.state === 'granted' && !lastFix) locateForOrbits(); })
        .catch(() => {});
    }
  } else {
    globe.stop();
    clearTimeout(overheadTimer);
  }
}

document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));
$('btn-settings').addEventListener('click', () => showScreen('settings'));
$('btn-settings-back').addEventListener('click', () => showScreen('home'));

function buildDistanceOptions(container, name) {
  container.innerHTML = '';
  for (const d of WALK_DISTANCES) {
    const label = document.createElement('label');
    label.className = 'option';
    label.innerHTML = `<input type="radio" name="${name}" value="${d.meters}"><span><b>${d.label}</b><small>${d.hint}</small></span>`;
    const input = label.querySelector('input');
    input.checked = d.meters === state.walkDistanceM;
    input.addEventListener('change', async () => {
      state.walkDistanceM = d.meters;
      await persist();
      document.querySelectorAll(`input[value="${d.meters}"]`).forEach(x => { x.checked = true; });
    });
    container.appendChild(label);
  }
}

$('btn-onboarding-done').addEventListener('click', async () => {
  state.onboarded = true;
  await persist();
  $('onboarding').hidden = true;
});

// ---------- developer mode (localhost only) ----------

const IS_LOCALHOST = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname) || location.hostname.endsWith('.localhost');

async function setupDevMode() {
  if (!IS_LOCALHOST) return;
  let setupDev;
  try {
    ({ setupDev } = await import('./dev.js'));
  } catch (e) {
    console.warn('Derpiku: developer mode failed to load', e);
    return;
  }
  setupDev({
    SPIRITS, O, PIGEON,
    getState: () => state,
    getLastFix: () => lastFix,
    persist, render, freshFix, resetSegment, showBubble, showScreen,
    restartWatch() {
      stopWatching();
      startWatching();
    },
    refreshAll() {
      expireSegmentIfOld();
      refreshHomeSpirit();
      updateOverhead();
      updateForecast();
      render();
    },
    async resetState() {
      state = { ...DEFAULT_STATE, haikuLog: { day: -1, counts: {} } };
      await persist();
    },
  });
}

// ---------- start ----------

async function init() {
  const saved = await load('state');
  if (saved && saved.version === 2) state = { ...DEFAULT_STATE, ...saved };
  else if (saved) state = { ...DEFAULT_STATE, walkDistanceM: saved.walkDistanceM || 500, onboarded: !!saved.onboarded };
  await loadTexts();
  buildChips();
  buildDistanceOptions($('distance-options'), 'distance');
  buildDistanceOptions($('onboarding-options'), 'distance-onboarding');
  if (!state.onboarded) $('onboarding').hidden = false;
  expireSegmentIfOld();
  render();
  // Developer mode has to take over GPS before the game first asks for it — otherwise a late
  // real reading would overwrite the simulated one.
  await setupDevMode();
  startWatching();
  watchGeoPermission();
  setInterval(expireSegmentIfOld, 60000);
  setInterval(backgroundFix, SPIRIT_FIX_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopWatching();
    } else {
      expireSegmentIfOld();
      startWatching();
      refreshHomeSpirit();
      if (!goodFix()) backgroundFix();
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => radar.refreshColors());
  // No service worker on localhost (always fresh files), unless the URL has ?sw — for testing offline mode.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    if (!IS_LOCALHOST || new URLSearchParams(location.search).has('sw')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }
  }
}

init();
