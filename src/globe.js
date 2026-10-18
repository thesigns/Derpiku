// Orbit screen (GDD 7): the Earth in orthographic projection on a 2D canvas, spirit orbits,
// drag to rotate, tap a spirit. Orbits live in the inertial frame — the Earth turns beneath them.
const O = globalThis.Orbits;

const MIN_PERIOD = 90, MAX_PERIOD = 2200;

function orbitRadius(spirit) {
  const f = (Math.log(spirit.periodMin) - Math.log(MIN_PERIOD)) / (Math.log(MAX_PERIOD) - Math.log(MIN_PERIOD));
  return 1.12 + 0.4 * Math.max(0, Math.min(1, f));
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function createGlobe(canvas, { spirits, now, onSelect }) {
  const ctx = canvas.getContext('2d');
  const st = {
    w: 0, h: 0, dpr: 1, R: 100, cx: 0, cy: 0,
    yaw: 0, pitch: 0.35, selected: -1, player: null,
    running: false, aimed: false,
  };
  const stars = Array.from({ length: 90 }, (_, i) => {
    const r = Math.sin(i * 12.9898) * 43758.5453;
    const r2 = Math.sin(i * 78.233) * 12345.6789;
    return { x: r - Math.floor(r), y: r2 - Math.floor(r2), a: 0.25 + ((i * 37) % 10) / 20 };
  });
  const radii = spirits.map(orbitRadius);
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  let raf = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = rect.width;
    st.h = rect.height;
    canvas.width = Math.round(st.w * st.dpr);
    canvas.height = Math.round(st.h * st.dpr);
    st.R = Math.max(40, (Math.min(st.w, st.h) / 2 - 18) / 1.55);
    st.cx = st.w / 2;
    st.cy = st.h / 2;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // View rotation: around the Earth's axis (yaw), then tilting the pole towards the viewer (pitch).
  function view(v, r) {
    const cy = Math.cos(-st.yaw), sy = Math.sin(-st.yaw);
    const x1 = v[0] * cy - v[1] * sy, y1 = v[0] * sy + v[1] * cy, z1 = v[2];
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const x2 = x1 * cp + z1 * sp, z2 = -x1 * sp + z1 * cp;
    return { x: st.cx + y1 * st.R * r, y: st.cy - z2 * st.R * r, depth: x2 };
  }

  function aimAtPlayer(t) {
    if (!st.player) return;
    O.earthToInertial(st.player, t, tmp);
    st.yaw = Math.atan2(tmp[1], tmp[0]);
    st.pitch = Math.max(-0.9, Math.min(0.9, Math.asin(tmp[2]) * 0.8));
  }

  function drawOrbit(i, front, t) {
    const s = spirits[i], r = radii[i];
    const selected = i === st.selected;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = selected ? 2.4 : 1.1;
    ctx.globalAlpha = front ? (selected ? 0.95 : 0.55) : (selected ? 0.35 : 0.14);
    ctx.beginPath();
    const n = 144;
    let pen = false;
    for (let k = 0; k <= n; k++) {
      const p = view(O.orbitPointInertial(s, k / n * Math.PI * 2, tmp), r);
      const outside = Math.hypot(p.x - st.cx, p.y - st.cy) > st.R;
      const visible = front ? p.depth >= 0 || outside : p.depth < 0 && !outside;
      if (visible) {
        if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        pen = true;
      } else pen = false;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function spiritScreen(i, t) {
    const v = O.orbitPointInertial(spirits[i], O.orbitAngle(spirits[i], t), tmp2);
    const p = view(v, radii[i]);
    p.hidden = p.depth < 0 && Math.hypot(p.x - st.cx, p.y - st.cy) < st.R;
    return p;
  }

  function drawIcon(i, p) {
    const s = spirits[i];
    const selected = i === st.selected;
    const rad = selected ? 13 : 10;
    ctx.globalAlpha = p.hidden ? 0.25 : 1;
    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.fillStyle = luminance(s.color) > 0.6 ? '#1d1a26' : '#ffffff';
    ctx.font = `600 ${selected ? 13 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.animal[0], p.x, p.y + 0.5);
    ctx.globalAlpha = 1;
  }

  function drawGlobe(t) {
    const g = ctx.createRadialGradient(st.cx - st.R * 0.35, st.cy - st.R * 0.4, st.R * 0.1, st.cx, st.cy, st.R);
    g.addColorStop(0, '#5aa0f0');
    g.addColorStop(1, '#1d3f8f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(st.cx, st.cy, st.R, 0, Math.PI * 2);
    ctx.fill();

    // Earth-fixed grid: shows the Earth turning beneath the orbits
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    const line = (pts) => {
      ctx.beginPath();
      let pen = false;
      for (const [lat, lon] of pts) {
        const p = view(O.earthToInertial(O.latLonToVec(lat, lon, tmp), t, tmp), 1);
        if (p.depth >= 0) {
          if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
          pen = true;
        } else pen = false;
      }
      ctx.stroke();
    };
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, k) => [lat, -180 + k * 5]));
    for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 37 }, (_, k) => [-90 + k * 5, lon]));

    if (st.player) {
      const p = view(O.earthToInertial(st.player, t, tmp), 1);
      if (p.depth >= 0) {
        const pulse = (t / 1000) % 2 / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
  }

  function draw() {
    const t = now();
    if (!st.aimed && st.player) {
      aimAtPlayer(t);
      st.aimed = true;
    }
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.fillStyle = '#0d1222';
    ctx.fillRect(0, 0, st.w, st.h);
    for (const s of stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fillRect(s.x * st.w, s.y * st.h, 1.2, 1.2);
    }
    const icons = spirits.map((_, i) => spiritScreen(i, t));
    drawGlobe(t);
    // whatever is behind the globe shows faintly through it
    spirits.forEach((_, i) => drawOrbit(i, false, t));
    icons.forEach((p, i) => { if (p.hidden) drawIcon(i, p); });
    spirits.forEach((_, i) => drawOrbit(i, true, t));
    if (st.selected >= 0 && !icons[st.selected].hidden) {
      // line from the spirit down to the point beneath it
      const v = O.orbitPointInertial(spirits[st.selected], O.orbitAngle(spirits[st.selected], t), tmp);
      const ground = view(v, 1), sky = icons[st.selected];
      if (ground.depth >= 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(sky.x, sky.y);
        ctx.lineTo(ground.x, ground.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    const order = icons.map((p, i) => i).filter(i => !icons[i].hidden).sort((a, b) => icons[a].depth - icons[b].depth);
    for (const i of order) if (i !== st.selected) drawIcon(i, icons[i]);
    if (st.selected >= 0 && !icons[st.selected].hidden) drawIcon(st.selected, icons[st.selected]);
    st.icons = icons;
  }

  function loop() {
    if (!st.running) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  // drag to rotate, tap to select
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.offsetX, y: e.offsetY, moved: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    drag.moved += Math.hypot(dx, dy);
    drag.x = e.offsetX;
    drag.y = e.offsetY;
    st.yaw -= dx / st.R;
    st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch + dy / st.R));
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && drag.moved < 8 && st.icons) {
      let best = -1, bestD = 24;
      st.icons.forEach((p, i) => {
        const d = Math.hypot(p.x - e.offsetX, p.y - e.offsetY) + (p.hidden ? 12 : 0);
        if (d < bestD) { bestD = d; best = i; }
      });
      onSelect(best >= 0 ? best : null);
    }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  return {
    start() {
      if (st.running) return;
      st.running = true;
      loop();
    },
    stop() {
      st.running = false;
      cancelAnimationFrame(raf);
    },
    setPlayer(lat, lon) {
      const first = !st.player;
      st.player = O.latLonToVec(lat, lon);
      if (first) st.aimed = false;
    },
    select(i) { st.selected = i == null ? -1 : i; },
  };
}
