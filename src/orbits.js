// Derpiku — spirit orbit model.
// Pure math, no DOM: used by the simulator and by the game's orbit screen.
// Orbits are circular and fixed (no precession). Position depends only on time.
(function (root) {
  'use strict';

  const EARTH_RADIUS_KM = 6371;
  const HALF_CIRCUMFERENCE_KM = Math.PI * EARTH_RADIUS_KM; // ~20015 km: "the whole Earth" range
  const DEG = Math.PI / 180;
  const MIN_MS = 60000;
  const DAY_MS = 86400000;
  const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
  // Epoch the spirit phases are counted from. Must never change after release.
  const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

  // Earth rotation angle (Greenwich mean sidereal time) in radians.
  function gmst(tMs) {
    const days = (tMs - J2000_MS) / DAY_MS;
    const deg = (280.46061837 + 360.98564736629 * days) % 360;
    return (deg < 0 ? deg + 360 : deg) * DEG;
  }

  function latLonToVec(latDeg, lonDeg, out) {
    out = out || new Float64Array(3);
    const la = latDeg * DEG, lo = lonDeg * DEG;
    out[0] = Math.cos(la) * Math.cos(lo);
    out[1] = Math.cos(la) * Math.sin(lo);
    out[2] = Math.sin(la);
    return out;
  }

  function vecToLatLon(v) {
    return {
      lat: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG,
      lon: Math.atan2(v[1], v[0]) / DEG,
    };
  }

  // Unit vector (Earth-fixed frame) of the point below the spirit.
  // spirit: { inclination [°], periodMin [min], raan [°], phase [°] }
  function subpointVec(spirit, tMs, out) {
    out = out || new Float64Array(3);
    const u = spirit.phase * DEG + 2 * Math.PI * (tMs - EPOCH_MS) / (spirit.periodMin * MIN_MS);
    const node = spirit.raan * DEG - gmst(tMs);
    const i = spirit.inclination * DEG;
    const cu = Math.cos(u), su = Math.sin(u);
    const cn = Math.cos(node), sn = Math.sin(node);
    const ci = Math.cos(i), si = Math.sin(i);
    out[0] = cn * cu - sn * su * ci;
    out[1] = sn * cu + cn * su * ci;
    out[2] = su * si;
    return out;
  }

  // Spirit's angle along its orbit (argument of latitude) at time tMs.
  function orbitAngle(spirit, tMs) {
    return spirit.phase * DEG + 2 * Math.PI * (tMs - EPOCH_MS) / (spirit.periodMin * MIN_MS);
  }

  // Orbit point in the inertial frame (stars fixed, Earth rotating) — for drawing orbits.
  function orbitPointInertial(spirit, u, out) {
    out = out || new Float64Array(3);
    const node = spirit.raan * DEG;
    const i = spirit.inclination * DEG;
    const cu = Math.cos(u), su = Math.sin(u);
    const cn = Math.cos(node), sn = Math.sin(node);
    out[0] = cn * cu - sn * su * Math.cos(i);
    out[1] = sn * cu + cn * su * Math.cos(i);
    out[2] = su * Math.sin(i);
    return out;
  }

  // Earth-fixed vector → inertial frame (rotation by sidereal time).
  function earthToInertial(v, tMs, out) {
    out = out || new Float64Array(3);
    const g = gmst(tMs), c = Math.cos(g), s = Math.sin(g);
    const x = v[0], y = v[1];
    out[0] = x * c - y * s;
    out[1] = x * s + y * c;
    out[2] = v[2];
    return out;
  }

  function subpoint(spirit, tMs) {
    return vecToLatLon(subpointVec(spirit, tMs));
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function distanceKm(a, b) {
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * EARTH_RADIUS_KM;
  }

  function rangeRad(spirit) {
    return Math.min(spirit.rangeKm / EARTH_RADIUS_KM, Math.PI);
  }

  // Highest latitude (in degrees) from which the spirit is ever in range.
  function maxReachLat(spirit) {
    const inc = spirit.inclination <= 90 ? spirit.inclination : 180 - spirit.inclination;
    return Math.min(90, inc + rangeRad(spirit) / DEG);
  }

  function canEverReach(spirit, latDeg) {
    return Math.abs(latDeg) <= maxReachLat(spirit);
  }

  // Spirit selection: the closest one (km) among spirits in range.
  // mode 'relative' compares distance relative to each spirit's range (for experiments).
  // Returns { index, distKm }, or null when no spirit is in range.
  function pickSpirit(spirits, playerVec, tMs, mode) {
    const v = new Float64Array(3);
    let best = null, bestScore = -Infinity;
    for (let s = 0; s < spirits.length; s++) {
      const sp = spirits[s];
      if (sp.enabled === false) continue;
      subpointVec(sp, tMs, v);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(v, playerVec))));
      const r = rangeRad(sp);
      if (ang > r) continue;
      const score = mode === 'relative' ? -ang / r : -ang;
      if (score > bestScore) {
        bestScore = score;
        best = { index: s, distKm: ang * EARTH_RADIUS_KM };
      }
    }
    return best;
  }

  function inRangeAt(spirit, playerVec, tMs, v) {
    subpointVec(spirit, tMs, v);
    return dot(v, playerVec) >= Math.cos(rangeRad(spirit));
  }

  // Next pass of a spirit over the player: coarse steps, then bisection to 1 s.
  // Returns { start, end } (ms), or null when there is no pass within the horizon.
  function nextPass(spirit, playerVec, fromMs, horizonMs, stepMs) {
    stepMs = stepMs || MIN_MS;
    const v = new Float64Array(3);
    const toMs = fromMs + horizonMs;
    const refine = (lo, hi, loInside) => {
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if (inRangeAt(spirit, playerVec, mid, v) === loInside) lo = mid; else hi = mid;
      }
      return hi;
    };
    let start = null;
    if (inRangeAt(spirit, playerVec, fromMs, v)) {
      start = fromMs;
    } else {
      for (let t = fromMs; t < toMs; t += stepMs) {
        if (inRangeAt(spirit, playerVec, t + stepMs, v)) {
          start = refine(t, t + stepMs, false);
          break;
        }
      }
      if (start === null) return null;
    }
    for (let t = start; t < start + DAY_MS * 3; t += stepMs) {
      if (!inRangeAt(spirit, playerVec, t + stepMs, v)) {
        return { start, end: refine(t, t + stepMs, true) };
      }
    }
    return { start, end: Infinity };
  }

  // Next window for spirit `index`: the stretch of time in which pickSpirit picks exactly this spirit.
  // This is the forecast shown to the player (GDD 6.4, 7.5). Returns { start, end } (ms) or null.
  function nextCatchWindow(spirits, index, playerVec, fromMs, horizonMs, stepMs, mode) {
    stepMs = stepMs || MIN_MS;
    const picked = (t) => {
      const p = pickSpirit(spirits, playerVec, t, mode);
      return p !== null && p.index === index;
    };
    const refine = (lo, hi, loState) => {
      while (hi - lo > 1000) {
        const mid = (lo + hi) / 2;
        if (picked(mid) === loState) lo = mid; else hi = mid;
      }
      return hi;
    };
    const toMs = fromMs + horizonMs;
    let start = null;
    if (picked(fromMs)) {
      start = fromMs;
    } else {
      for (let t = fromMs; t < toMs; t += stepMs) {
        if (picked(t + stepMs)) {
          start = refine(t, t + stepMs, false);
          break;
        }
      }
      if (start === null) return null;
    }
    for (let t = start; t < start + DAY_MS * 3; t += stepMs) {
      if (!picked(t + stepMs)) return { start, end: refine(t, t + stepMs, true) };
    }
    return { start, end: Infinity };
  }

  // Single-location analysis: who is closest each minute, passes, statistics.
  function analyzeLocation(spirits, latDeg, lonDeg, opts) {
    const stepMs = (opts.stepSec || 60) * 1000;
    const steps = Math.round(opts.days * DAY_MS / stepMs);
    const mode = opts.mode || 'km';
    const p = latLonToVec(latDeg, lonDeg);
    const S = spirits.length;
    const nearest = new Int16Array(steps);
    const inRange = new Uint8Array(steps * S);
    const v = new Float64Array(3);
    const cosR = spirits.map(s => Math.cos(rangeRad(s)));
    const rr = spirits.map(rangeRad);

    for (let k = 0; k < steps; k++) {
      const t = opts.startMs + k * stepMs;
      let best = -1, bestScore = -Infinity;
      for (let s = 0; s < S; s++) {
        if (spirits[s].enabled === false) continue;
        subpointVec(spirits[s], t, v);
        const d = dot(v, p);
        if (d < cosR[s]) continue;
        inRange[k * S + s] = 1;
        const score = mode === 'relative' ? -Math.acos(Math.min(1, d)) / rr[s] : d;
        if (score > bestScore) { bestScore = score; best = s; }
      }
      nearest[k] = best;
    }

    const runs = (test) => {
      const out = [];
      let open = -1;
      for (let k = 0; k <= steps; k++) {
        const on = k < steps && test(k);
        if (on && open < 0) open = k;
        if (!on && open >= 0) { out.push({ start: opts.startMs + open * stepMs, end: opts.startMs + k * stepMs }); open = -1; }
      }
      return out;
    };

    const perSpirit = spirits.map((sp, s) => {
      const passes = runs(k => inRange[k * S + s] === 1);
      const nearestWindows = runs(k => nearest[k] === s);
      let inRangeSteps = 0, nearestSteps = 0;
      for (let k = 0; k < steps; k++) {
        inRangeSteps += inRange[k * S + s];
        if (nearest[k] === s) nearestSteps++;
      }
      let maxGapMs = 0;
      for (let w = 1; w < nearestWindows.length; w++) {
        maxGapMs = Math.max(maxGapMs, nearestWindows[w].start - nearestWindows[w - 1].end);
      }
      const totalNearestMs = nearestSteps * stepMs;
      return {
        index: s,
        reachable: canEverReach(sp, latDeg),
        inRangeFrac: inRangeSteps / steps,
        nearestFrac: nearestSteps / steps,
        passes,
        nearestWindows,
        avgNearestWindowMin: nearestWindows.length ? totalNearestMs / nearestWindows.length / MIN_MS : 0,
        maxNearestGapMs: maxGapMs,
      };
    });

    let switches = 0, gapSteps = 0;
    const stints = [];
    let runLen = 1;
    for (let k = 0; k < steps; k++) {
      if (nearest[k] < 0) gapSteps++;
      if (k > 0) {
        if (nearest[k] !== nearest[k - 1]) { switches++; stints.push(runLen); runLen = 1; } else runLen++;
      }
    }
    stints.push(runLen);
    stints.sort((a, b) => a - b);

    return {
      startMs: opts.startMs,
      stepMs,
      steps,
      days: opts.days,
      nearest,
      perSpirit,
      switchesPerDay: switches / opts.days,
      medianStintMin: stints[Math.floor(stints.length / 2)] * stepMs / MIN_MS,
      gapFrac: gapSteps / steps,
    };
  }

  // Whole-world grid analysis, computed in chunks (advance) so the UI doesn't block.
  function createGridAnalysis(spirits, opts) {
    const g = opts.gridDeg;
    const latMin = opts.latMin, latMax = opts.latMax;
    const rows = Math.ceil((latMax - latMin) / g);
    const cols = Math.round(360 / g);
    const n = rows * cols;
    const stepMs = opts.stepMin * MIN_MS;
    const totalSteps = Math.round(opts.days * DAY_MS / stepMs);
    const mode = opts.mode || 'km';
    const active = [];
    spirits.forEach((sp, s) => { if (sp.enabled !== false) active.push(s); });
    const A = active.length;

    const cx = new Float64Array(n), cy = new Float64Array(n), cz = new Float64Array(n);
    const weight = new Float64Array(n);
    const cellLat = new Float64Array(n), cellLon = new Float64Array(n);
    const tmp = new Float64Array(3);
    for (let r = 0; r < rows; r++) {
      const lat = Math.min(latMax, latMin + (r + 0.5) * g);
      for (let c = 0; c < cols; c++) {
        const lon = -180 + (c + 0.5) * g;
        const i = r * cols + c;
        latLonToVec(lat, lon, tmp);
        cx[i] = tmp[0]; cy[i] = tmp[1]; cz[i] = tmp[2];
        weight[i] = Math.cos(lat * DEG);
        cellLat[i] = lat; cellLon[i] = lon;
      }
    }

    const last = new Int16Array(n).fill(-2);
    const gapRun = new Int32Array(n), maxGapRun = new Int32Array(n), gapSteps = new Int32Array(n);
    const switches = new Int32Array(n), inRangeSum = new Int32Array(n);
    const nearestSteps = new Int32Array(n * A);
    const svx = new Float64Array(A), svy = new Float64Array(A), svz = new Float64Array(A);
    const cosR = new Float64Array(A), rr = new Float64Array(A);
    active.forEach((s, a) => { rr[a] = rangeRad(spirits[s]); cosR[a] = Math.cos(rr[a]); });
    let step = 0;

    function advance(maxSteps) {
      const end = Math.min(totalSteps, step + maxSteps);
      for (; step < end; step++) {
        const t = opts.startMs + step * stepMs;
        for (let a = 0; a < A; a++) {
          subpointVec(spirits[active[a]], t, tmp);
          svx[a] = tmp[0]; svy[a] = tmp[1]; svz[a] = tmp[2];
        }
        for (let i = 0; i < n; i++) {
          let best = -1, bestScore = -Infinity, count = 0;
          for (let a = 0; a < A; a++) {
            const d = cx[i] * svx[a] + cy[i] * svy[a] + cz[i] * svz[a];
            if (d < cosR[a]) continue;
            count++;
            const score = mode === 'relative' ? -Math.acos(Math.min(1, d)) / rr[a] : d;
            if (score > bestScore) { bestScore = score; best = a; }
          }
          inRangeSum[i] += count;
          if (best < 0) {
            gapSteps[i]++;
            if (++gapRun[i] > maxGapRun[i]) maxGapRun[i] = gapRun[i];
          } else {
            gapRun[i] = 0;
            nearestSteps[i * A + best]++;
          }
          if (last[i] !== -2 && last[i] !== best) switches[i]++;
          last[i] = best;
        }
      }
      return step >= totalSteps;
    }

    function result() {
      const done = step;
      const days = done * stepMs / DAY_MS;
      const gapFrac = new Float64Array(n), maxGapMin = new Float64Array(n);
      const switchesPerDay = new Float64Array(n), meanStintMin = new Float64Array(n);
      const inRangeAvg = new Float64Array(n), dominant = new Int16Array(n);
      const shareNearest = new Float64Array(spirits.length);
      let wSum = 0, wGap = 0, wSwitches = 0, cellsWithGap = 0, worstGapMin = 0;
      for (let i = 0; i < n; i++) {
        gapFrac[i] = gapSteps[i] / done;
        maxGapMin[i] = maxGapRun[i] * opts.stepMin;
        switchesPerDay[i] = switches[i] / days;
        meanStintMin[i] = done * opts.stepMin / (switches[i] + 1);
        inRangeAvg[i] = inRangeSum[i] / done;
        let dom = -1, domSteps = 0;
        for (let a = 0; a < A; a++) {
          const k = nearestSteps[i * A + a];
          if (k > domSteps) { domSteps = k; dom = active[a]; }
          shareNearest[active[a]] += weight[i] * k / done;
        }
        dominant[i] = dom;
        wSum += weight[i];
        wGap += weight[i] * gapFrac[i];
        wSwitches += weight[i] * switchesPerDay[i];
        if (gapSteps[i] > 0) cellsWithGap++;
        worstGapMin = Math.max(worstGapMin, maxGapMin[i]);
      }
      for (let s = 0; s < shareNearest.length; s++) shareNearest[s] /= wSum;
      return {
        rows, cols, gridDeg: g, latMin, latMax, days,
        cellLat, cellLon,
        gapFrac, maxGapMin, switchesPerDay, meanStintMin, inRangeAvg, dominant,
        shareNearest,
        globalGapFrac: wGap / wSum,
        cellsWithGapFrac: cellsWithGap / n,
        worstGapMin,
        meanSwitchesPerDay: wSwitches / wSum,
      };
    }

    return {
      advance,
      result,
      get progress() { return step / totalSteps; },
    };
  }

  const api = {
    EARTH_RADIUS_KM, HALF_CIRCUMFERENCE_KM, EPOCH_MS, DAY_MS, MIN_MS, DEG,
    gmst, latLonToVec, vecToLatLon, subpointVec, subpoint, dot, distanceKm,
    orbitAngle, orbitPointInertial, earthToInertial,
    rangeRad, maxReachLat, canEverReach, pickSpirit, nextPass, nextCatchWindow,
    analyzeLocation, createGridAnalysis,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Orbits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
