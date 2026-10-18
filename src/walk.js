// Walk (GDD 5): GPS readings and haiku conditions. The route isn't tracked — only the segment start and where you pet Derpiku count.
export const MAX_ACCURACY_M = 50;
export const MAX_SPEED_KMH = 12;
export const WALK_TTL_MS = 3 * 60 * 60 * 1000;
export const WALK_DISTANCES = [
  { meters: 250, label: 'Short stroll', hint: '250 m · about 3 minutes' },
  { meters: 500, label: 'Stroll', hint: '500 m · about 6 minutes' },
  { meters: 1000, label: 'Long walk', hint: '1 km · about 12 minutes' },
];

// Clock with an offset — developer mode can “fast-forward” time.
export const clock = {
  offsetMs: 0,
  now() { return Date.now() + this.offsetMs; },
};

// Simulated GPS for testing (developer mode, localhost only).
export const fakeGps = {
  enabled: false,
  lat: 50.0614,
  lon: 19.9366,
  accuracy: 8,
  heading: null,
  listeners: new Set(),
};

function fakeFix() {
  return { lat: fakeGps.lat, lon: fakeGps.lon, accuracy: fakeGps.accuracy, heading: fakeGps.heading, time: clock.now() };
}

export function notifyFake() {
  const fix = fakeFix();
  fakeGps.listeners.forEach(fn => fn(fix));
}

export function moveFake(northM, eastM) {
  fakeGps.heading = (Math.atan2(eastM, northM) * 180 / Math.PI + 360) % 360;
  fakeGps.lat += northM / 111320;
  fakeGps.lon += eastM / (111320 * Math.cos(fakeGps.lat * Math.PI / 180));
  notifyFake();
}

export function setFake(lat, lon) {
  fakeGps.lat = lat;
  fakeGps.lon = lon;
  notifyFake();
}

function toFix(p) {
  // heading: direction of movement in degrees from north (null when standing still) — fallback when there's no compass
  return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, heading: p.coords.heading, time: clock.now() };
}

export function getFix() {
  if (fakeGps.enabled) return Promise.resolve(fakeFix());
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({ code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => resolve(toFix(p)),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

// Live progress, only while the app is open. Returns a stop function.
export function watchFix(onFix) {
  if (fakeGps.enabled) {
    fakeGps.listeners.add(onFix);
    onFix(fakeFix());
    return () => fakeGps.listeners.delete(onFix);
  }
  if (!('geolocation' in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    p => onFix(toFix(p)),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkProgress(walk, fix) {
  return Math.min(1, distanceM(walk, fix) / walk.distanceM);
}

export function isExpired(walk, now) {
  return now - walk.startedAt > WALK_TTL_MS;
}

// null when Derpiku may say a haiku; otherwise the reason: expired / accuracy / distance / speed.
export function haikuBlocker(walk, fix, now) {
  if (isExpired(walk, now)) return 'expired';
  if (fix.accuracy > MAX_ACCURACY_M) return 'accuracy';
  const d = distanceM(walk, fix);
  if (d < walk.distanceM) return 'distance';
  const minMs = d / (MAX_SPEED_KMH / 3.6) * 1000;
  if (now - walk.startedAt < minMs) return 'speed';
  return null;
}
