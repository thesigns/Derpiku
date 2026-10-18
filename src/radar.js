// Radar (GDD 10): a minimal view without a street map — segment start, target circle,
// current position with a heading arrow, scale and north. Everything in metres relative to the start.
const NICE_STEPS = [10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
const M_PER_DEG = 111320;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function angleLerp(a, b, f) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * f + 360) % 360;
}

export function createRadar(canvas) {
  const ctx = canvas.getContext('2d');
  const st = {
    w: 0, h: 0, dpr: 1, running: false,
    segment: null, fix: null, trail: [],
    compass: null, heading: null, viewR: 300,
  };
  let raf = 0, last = 0, colors = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = rect.width;
    st.h = rect.height;
    canvas.width = Math.round(st.w * st.dpr);
    canvas.height = Math.round(st.h * st.dpr);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function readColors() {
    colors = {
      bg: cssVar('--bg'), ink: cssVar('--ink'), muted: cssVar('--muted'),
      line: cssVar('--line'), accent: cssVar('--accent'), card: cssVar('--card'),
    };
  }

  // metres east / north of the reference point
  function toLocal(p, ref) {
    return [
      (p.lon - ref.lon) * M_PER_DEG * Math.cos(ref.lat * Math.PI / 180),
      (p.lat - ref.lat) * M_PER_DEG,
    ];
  }

  function draw(t, dt) {
    const { w, h } = st;
    const c = colors;
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.max(40, Math.min(w, h) / 2 - 28);
    const ref = st.segment || st.fix;

    // scale: fit the target circle and the current position, smoothly
    let need = 120;
    if (st.segment) need = Math.max(need, st.segment.distanceM * 1.2);
    if (st.fix && ref) {
      const [x, y] = toLocal(st.fix, ref);
      need = Math.max(need, Math.hypot(x, y) * 1.15 + Math.min(st.fix.accuracy, 200));
    }
    st.viewR += (need - st.viewR) * (1 - Math.exp(-dt * 4));
    const scale = R / st.viewR;

    // rings at a “nice” step
    const step = NICE_STEPS.find(s => st.viewR / s <= 4) || NICE_STEPS[NICE_STEPS.length - 1];
    ctx.strokeStyle = c.line;
    ctx.fillStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let r = step; r * scale <= R + 0.5; r += step) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(r >= 1000 ? `${r / 1000} km` : `${r} m`, cx + r * scale * 0.71 + 3, cy - r * scale * 0.71 - 3);
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // rotating radar sweep
    const sweep = (t * 0.6) % (Math.PI * 2);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.6, cx, cy) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.095, c.accent + '33');
      grad.addColorStop(0.0955, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // north
    ctx.fillStyle = c.ink;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - R - 8);

    if (!ref) {
      ctx.fillStyle = c.muted;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Waiting for your location…', cx, cy + 4);
      return;
    }
    const P = p => {
      const [x, y] = toLocal(p, ref);
      return [cx + x * scale, cy - y * scale];
    };

    // target circle around the start
    if (st.segment) {
      const reached = st.fix && Math.hypot(...toLocal(st.fix, st.segment)) >= st.segment.distanceM;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 12;
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = reached ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, st.segment.distanceM * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('start', cx, cy + 18);
    }

    // trail from this session (in memory only)
    if (st.trail.length > 1) {
      ctx.strokeStyle = c.accent + '66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      st.trail.forEach((p, i) => {
        const [x, y] = P(p);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }

    if (st.fix) {
      const [x, y] = P(st.fix);
      ctx.beginPath();
      ctx.arc(x, y, Math.min(st.fix.accuracy * scale, R), 0, Math.PI * 2);
      ctx.fillStyle = c.accent + '1f';
      ctx.fill();

      // heading: compass, or the GPS direction of movement without one
      const target = st.compass != null ? st.compass
        : Number.isFinite(st.fix.heading) && st.fix.heading !== null ? st.fix.heading : null;
      if (target != null) st.heading = st.heading == null ? target : angleLerp(st.heading, target, 1 - Math.exp(-dt * 8));
      else st.heading = null;
      if (st.heading != null) {
        const a = st.heading * Math.PI / 180;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(9, -6);
        ctx.lineTo(-9, -6);
        ctx.closePath();
        ctx.fillStyle = c.accent;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = c.accent;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.card;
      ctx.stroke();
    }
  }

  function loop(now) {
    if (!st.running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    draw(now / 1000, dt);
    raf = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (st.running) return;
      readColors();
      st.running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      st.running = false;
      cancelAnimationFrame(raf);
    },
    setSegment(segment) {
      if (!segment || !st.segment || segment.startedAt !== st.segment.startedAt) st.trail = [];
      st.segment = segment;
    },
    setFix(fix) {
      st.fix = fix;
      if (fix && fix.accuracy <= 100) {
        const lastP = st.trail[st.trail.length - 1];
        if (!lastP || Math.hypot(...toLocal(fix, lastP)) > 3) st.trail.push({ lat: fix.lat, lon: fix.lon });
        if (st.trail.length > 600) st.trail.shift();
      }
    },
    setCompass(deg) { st.compass = deg; },
    refreshColors() { readColors(); },
  };
}

// ---------- compass ----------

export function compassNeedsPermission() {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
}

export async function requestCompassPermission() {
  try {
    return (await DeviceOrientationEvent.requestPermission()) === 'granted';
  } catch (e) {
    return false;
  }
}

// Calls onHeading(degrees from north, clockwise). Returns a stop function.
export function watchCompass(onHeading) {
  const screenAngle = () => (screen.orientation && screen.orientation.angle) || 0;
  if ('ondeviceorientationabsolute' in window) {
    const handler = e => {
      if (e.alpha != null) onHeading((360 - e.alpha + screenAngle()) % 360);
    };
    window.addEventListener('deviceorientationabsolute', handler);
    return () => window.removeEventListener('deviceorientationabsolute', handler);
  }
  const handler = e => {
    if (e.webkitCompassHeading != null) onHeading((e.webkitCompassHeading + screenAngle()) % 360);
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}
