// Derpiku (GDD 9): a metaball/SDF body in WebGL with fake "jelly" shading,
// face drawn in 2D on an overlay. Fully procedural, no assets.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
// mediump on phones is a 16-bit float: pixel coordinates and time lose so much precision that the
// body breaks up into blocks. Use highp wherever the GPU supports it.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uCenter;   // body centre in device pixels (y from the bottom)
uniform float uSize;    // body radius in device pixels
uniform vec2 uSquash;   // x / y scale, anchored at the feet
uniform float uLean;    // lean in radians
uniform float uTime;
uniform float uWobble;
uniform vec3 uColor;
uniform float uPale;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float body(vec2 p) {
  p.x += uWobble * 0.06 * sin(p.y * 5.0 + uTime * 14.0);
  p.y += uWobble * 0.04 * sin(p.x * 4.0 + uTime * 11.0);
  float d = length(p * vec2(1.0, 1.12)) - 1.0;
  d = smin(d, length(p - vec2(-0.48, -0.86)) - 0.27, 0.30);
  d = smin(d, length(p - vec2(0.50, -0.88)) - 0.25, 0.30);
  d = smin(d, length(p - vec2(-0.42, 0.84)) - 0.17, 0.25);
  d = smin(d, length(p - vec2(0.47, 0.78)) - 0.15, 0.25);
  return d;
}

vec2 toLocal(vec2 frag) {
  vec2 q = (frag - uCenter) / uSize;
  float c = cos(uLean), s = sin(uLean);
  vec2 p = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  p.x /= uSquash.x;
  p.y = (p.y + 1.0) / uSquash.y - 1.0;
  return p;
}

float height(vec2 p) {
  float t = clamp(-body(p) / 0.55, 0.0, 1.0);
  return sqrt(1.0 - (1.0 - t) * (1.0 - t));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = toLocal(frag);
  float d = body(p);
  float aa = 1.5 / uSize;
  float alpha = smoothstep(aa, -aa, d);

  vec2 sp = (frag - uCenter) / uSize;
  float shadow = 0.2 * smoothstep(1.0, 0.0, length((sp - vec2(0.0, -1.1)) * vec2(1.05, 5.5)));

  vec3 base = mix(uColor, vec3(0.86, 0.88, 0.92), uPale * 0.4);
  float e = 0.004;
  vec2 g = vec2(height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0)),
                height(p + vec2(0.0, e)) - height(p - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-g * 0.35, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.65, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 60.0) * 0.85;
  float rim = pow(1.0 - n.z, 2.0);

  vec3 col = base * (0.58 + 0.48 * diff);
  col += rim * 0.28 * mix(base, vec3(1.0), 0.6);
  col += 0.1 * smoothstep(0.7, -0.5, length(p - vec2(0.12, -0.38))) * mix(base, vec3(1.0), 0.5);
  col += spec;

  float a = alpha * mix(0.95, 0.86, uPale);
  gl_FragColor = vec4(col * a, a + shadow * (1.0 - a));
}
`;

const PALE_COLOR = '#a9c6dc';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function initGl(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {};
    for (const name of ['uCenter', 'uSize', 'uSquash', 'uLean', 'uTime', 'uWobble', 'uColor', 'uPale']) {
      u[name] = gl.getUniformLocation(prog, name);
    }
    return { gl, u };
  } catch (e) {
    console.warn('Derpiku: WebGL unavailable, using 2D fallback', e);
    return null;
  }
}

export function createCreature(bodyCanvas, faceCanvas) {
  const gl = initGl(bodyCanvas);
  const face = faceCanvas.getContext('2d');
  const st = {
    w: 0, h: 0, dpr: 1, cx: 0, cy: 0, size: 0,
    color: hexToRgb(PALE_COLOR), colorTarget: hexToRgb(PALE_COLOR),
    pale: 1, paleTarget: 1,
    mood: 'hungry', walking: false, excitement: 0,
    lift: 0.56, liftTarget: 0.56, // vertical position of the centre as a fraction of height; lower when the bubble needs room
    squash: 0, squashVel: 0, lean: 0, shake: 0,
    wobble: 0, petting: false,
    look: { x: 0, y: 0 }, lookTarget: { x: 0, y: 0 }, pointer: null, gaze: null,
    blink: 1, nextBlink: 2, blinkStart: -1,
    expression: null, expressionUntil: 0,
    nextHop: 3, wanderAt: 0,
  };
  const handlers = { pet: () => {}, tap: () => {} };
  let t0 = performance.now(), last = t0, raf = 0;

  function resize() {
    const rect = faceCanvas.getBoundingClientRect();
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The jelly body is soft anyway, so it renders at a lower resolution than the crisp face —
    // far fewer pixels for the fragment shader on phones.
    st.glDpr = Math.min(st.dpr, 1.5);
    st.w = rect.width;
    st.h = rect.height;
    bodyCanvas.width = Math.round(st.w * st.glDpr);
    bodyCanvas.height = Math.round(st.h * st.glDpr);
    faceCanvas.width = Math.round(st.w * st.dpr);
    faceCanvas.height = Math.round(st.h * st.dpr);
    st.size = Math.min(st.w * 0.3, st.h * 0.28);
    st.cx = st.w / 2;
    st.cy = st.h * st.lift;
  }
  new ResizeObserver(resize).observe(faceCanvas);
  resize();

  // ---------- geometry: local body coordinates (y up, radius 1) ↔ screen ----------

  function squashScale() {
    const breath = Math.sin((performance.now() - t0) / 1000 * 2.1) * 0.022;
    return [1 + st.squash * 0.6 - breath * 0.6, 1 - st.squash + breath];
  }

  function localToScreen(x, y) {
    const [sx, sy] = squashScale();
    const px = x * sx, py = (y + 1) * sy - 1;
    const c = Math.cos(st.lean), s = Math.sin(st.lean);
    const qx = c * px - s * py, qy = s * px + c * py;
    return [st.cx + qx * st.size, st.cy - qy * st.size];
  }

  function screenToLocal(x, y) {
    const qx = (x - st.cx) / st.size, qy = -(y - st.cy) / st.size;
    const c = Math.cos(st.lean), s = Math.sin(st.lean);
    const [sx, sy] = squashScale();
    return [(c * qx + s * qy) / sx, (-s * qx + c * qy + 1) / sy - 1];
  }

  function insideBody(x, y) {
    const [lx, ly] = screenToLocal(x, y);
    return Math.hypot(lx, ly * 1.12) < 1.15 || (ly < -0.6 && Math.abs(lx) < 0.85 && ly > -1.2);
  }

  // ---------- touch: petting and tapping ----------

  let gesture = null;
  faceCanvas.addEventListener('pointerdown', e => {
    const x = e.offsetX, y = e.offsetY;
    if (!insideBody(x, y)) return;
    faceCanvas.setPointerCapture(e.pointerId);
    gesture = { x, y, startX: x, startY: y, path: 0, flips: 0, dirX: 0, dirY: 0, t: performance.now(), fired: false };
  });
  faceCanvas.addEventListener('pointermove', e => {
    st.pointer = { x: e.offsetX, y: e.offsetY };
    if (!gesture) return;
    const dx = e.offsetX - gesture.x, dy = e.offsetY - gesture.y;
    const step = Math.hypot(dx, dy);
    if (step < 2) return;
    gesture.path += step;
    const sx = Math.abs(dx) > 3 ? Math.sign(dx) : 0, sy = Math.abs(dy) > 3 ? Math.sign(dy) : 0;
    if (sx && gesture.dirX && sx !== gesture.dirX) gesture.flips++;
    if (sy && gesture.dirY && sy !== gesture.dirY) gesture.flips++;
    if (sx) gesture.dirX = sx;
    if (sy) gesture.dirY = sy;
    gesture.x = e.offsetX;
    gesture.y = e.offsetY;
    st.petting = gesture.path > 30;
    st.wobble = Math.min(1, st.wobble + step / 120);
    if (!gesture.fired && gesture.path > 420 && gesture.flips >= 3) {
      gesture.fired = true;
      handlers.pet();
    }
  });
  const endGesture = () => {
    if (gesture && !gesture.fired && gesture.path < 12 && performance.now() - gesture.t < 400) {
      poke(0.22);
      handlers.tap();
    }
    gesture = null;
    st.petting = false;
  };
  faceCanvas.addEventListener('pointerup', endGesture);
  faceCanvas.addEventListener('pointercancel', endGesture);
  faceCanvas.addEventListener('pointerleave', () => { st.pointer = null; });

  // ---------- animation ----------

  function poke(amount) {
    st.squashVel += amount * 9;
  }

  function update(dt, t) {
    // squash & stretch spring
    const k = 90, damping = 7;
    st.squashVel += (-k * st.squash - damping * st.squashVel) * dt;
    st.squash += st.squashVel * dt;
    st.squash = Math.max(-0.35, Math.min(0.35, st.squash));

    st.wobble = Math.max(0, st.wobble - dt * (st.petting ? 0.6 : 1.8));

    // colour and paleness ease towards their targets
    const f = 1 - Math.exp(-dt * 3);
    for (let i = 0; i < 3; i++) st.color[i] += (st.colorTarget[i] - st.color[i]) * f;
    st.pale += (st.paleTarget - st.pale) * f;
    st.lift += (st.liftTarget - st.lift) * (1 - Math.exp(-dt * 6));
    st.cy = st.h * st.lift;

    // swaying and head shaking
    st.shake = Math.max(0, st.shake - dt);
    st.lean = Math.sin(t * 0.7) * 0.035 + (st.shake > 0 ? Math.sin(st.shake * 30) * 0.12 * st.shake : 0);

    // hops on a walk, more frequent the closer to the target
    if (st.walking && t > st.nextHop) {
      poke(-0.08 - st.excitement * 0.1);
      st.nextHop = t + 2.6 - st.excitement * 1.6 + Math.random();
    }

    // blinking
    if (st.blinkStart < 0 && t > st.nextBlink) st.blinkStart = t;
    if (st.blinkStart >= 0) {
      const b = (t - st.blinkStart) / 0.14;
      st.blink = b < 1 ? Math.abs(1 - 2 * b) : 1;
      if (b >= 1) {
        st.blinkStart = -1;
        st.nextBlink = t + 2 + Math.random() * 4;
      }
    }

    // gaze: follows the finger, looks at the sky (or the spirit) on a walk, otherwise looks around and glances at the spirit
    const towards = p => {
      const [ex, ey] = localToScreen(0, 0.2);
      const dx = p.x - ex, dy = p.y - ey, len = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, len / (st.size * 1.5));
      return { x: dx / len * m, y: -dy / len * m };
    };
    if (st.pointer) {
      st.lookTarget = towards(st.pointer);
    } else if (st.walking) {
      const up = st.gaze ? towards(st.gaze) : { x: 0, y: 0.8 };
      st.lookTarget = { x: up.x + Math.sin(t * 0.9) * (st.gaze ? 0.25 : 0.6), y: up.y };
    } else if (t > st.wanderAt) {
      const r = Math.random();
      st.lookTarget = st.gaze && r < 0.5 ? towards(st.gaze)
        : r < 0.7 ? { x: 0, y: 0 } : { x: Math.random() * 1.6 - 0.8, y: Math.random() * 1.2 - 0.5 };
      st.wanderAt = t + 1.5 + Math.random() * 3;
    }
    const lf = 1 - Math.exp(-dt * 8);
    st.look.x += (st.lookTarget.x - st.look.x) * lf;
    st.look.y += (st.lookTarget.y - st.look.y) * lf;

    if (st.expression && t > st.expressionUntil) st.expression = null;
  }

  function currentFace() {
    if (st.expression) return st.expression;
    if (st.petting) return 'happy';
    if (st.walking) return 'sniff';
    return st.mood === 'fed' ? 'content' : 'hungry';
  }

  function drawBodyGl(t) {
    const { gl: g, u } = gl;
    const [sx, sy] = squashScale();
    g.viewport(0, 0, bodyCanvas.width, bodyCanvas.height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.uniform2f(u.uCenter, st.cx * st.glDpr, (st.h - st.cy) * st.glDpr);
    g.uniform1f(u.uSize, st.size * st.glDpr);
    g.uniform2f(u.uSquash, sx, sy);
    g.uniform1f(u.uLean, st.lean);
    // Wrap time every 20π s: the shader uses sin(t·14) and sin(t·11), both whole periods over 20π,
    // so there is no visible jump, and the value stays small enough for low-precision GPUs.
    g.uniform1f(u.uTime, t % (Math.PI * 20));
    g.uniform1f(u.uWobble, st.wobble);
    g.uniform3f(u.uColor, st.color[0], st.color[1], st.color[2]);
    g.uniform1f(u.uPale, st.pale);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  function drawBodyFallback() {
    const [x, y] = localToScreen(0, -0.05);
    const [sx, sy] = squashScale();
    const rgb = st.color.map((c, i) => Math.round(255 * (c + ([0.86, 0.88, 0.92][i] - c) * st.pale * 0.4)));
    const grad = face.createRadialGradient(x - st.size * 0.35, y - st.size * 0.45, st.size * 0.1, x, y, st.size * 1.1);
    grad.addColorStop(0, `rgb(${rgb.map(c => Math.min(255, c + 60)).join(',')})`);
    grad.addColorStop(1, `rgb(${rgb.join(',')})`);
    face.fillStyle = grad;
    face.beginPath();
    face.ellipse(x, y, st.size * sx, st.size * sy * 0.95, -st.lean, 0, Math.PI * 2);
    face.fill();
  }

  function ellipseAt(lx, ly, rx, ry, fill) {
    const [x, y] = localToScreen(lx, ly);
    const [sx, sy] = squashScale();
    face.beginPath();
    face.ellipse(x, y, Math.max(0.5, rx * st.size * sx), Math.max(0.5, ry * st.size * sy), -st.lean, 0, Math.PI * 2);
    face.fillStyle = fill;
    face.fill();
  }

  function pathThrough(points, width) {
    face.beginPath();
    points.forEach(([lx, ly], i) => {
      const [x, y] = localToScreen(lx, ly);
      if (i === 0) face.moveTo(x, y); else face.lineTo(x, y);
    });
    face.lineWidth = width * st.size;
    face.lineCap = 'round';
    face.lineJoin = 'round';
    face.strokeStyle = '#1d1a26';
    face.stroke();
  }

  function curve(x0, y0, cx, cy, x1, y1, n = 10) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      pts.push([(1 - s) ** 2 * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cy + s * s * y1]);
    }
    return pts;
  }

  function drawFace(t) {
    const expr = currentFace();
    const lx = st.look.x * 0.07, ly = st.look.y * 0.05;
    const eyes = [
      { x: -0.34 + lx, y: 0.17 + ly, rx: 0.12, ry: 0.15 },
      { x: 0.31 + lx, y: 0.21 + ly, rx: 0.105, ry: 0.13 },
    ];

    if (st.mood === 'fed' || expr === 'happy') {
      ellipseAt(-0.55 + lx * 0.5, -0.05, 0.13, 0.07, 'rgba(255, 120, 150, 0.35)');
      ellipseAt(0.55 + lx * 0.5, -0.02, 0.12, 0.065, 'rgba(255, 120, 150, 0.35)');
    }

    if (expr === 'happy') {
      for (const e of eyes) pathThrough(curve(e.x - e.rx, e.y - 0.02, e.x, e.y + e.ry * 0.9, e.x + e.rx, e.y - 0.02), 0.045);
    } else {
      const squint = expr === 'sniff' ? 0.75 : 1;
      for (const e of eyes) {
        const ry = e.ry * st.blink * squint;
        ellipseAt(e.x, e.y, e.rx, ry, '#1d1a26');
        if (st.blink > 0.5) {
          ellipseAt(e.x - e.rx * 0.35, e.y + ry * 0.4, e.rx * 0.32, e.rx * 0.32 * st.blink, 'rgba(255,255,255,0.95)');
          ellipseAt(e.x + e.rx * 0.3, e.y - ry * 0.35, e.rx * 0.14, e.rx * 0.14 * st.blink, 'rgba(255,255,255,0.8)');
        }
      }
    }

    const mx = -0.02 + lx * 0.6, my = -0.12 + ly * 0.5;
    switch (expr) {
      case 'content':
      case 'happy':
        pathThrough(curve(mx - 0.13, my + 0.03, mx, my - 0.14, mx + 0.12, my + 0.03), 0.04);
        break;
      case 'sniff': {
        const twitch = Math.sin(t * 18) * 0.012;
        ellipseAt(mx, my + twitch, 0.05, 0.04 + Math.abs(twitch), '#1d1a26');
        break;
      }
      case 'open':
        ellipseAt(mx, my - 0.03, 0.11, 0.1, '#1d1a26');
        ellipseAt(mx, my - 0.08, 0.06, 0.035, '#ff7a9a');
        break;
      case 'no':
      case 'full':
        pathThrough([[mx - 0.09, my - 0.02], [mx - 0.03, my + 0.02], [mx + 0.03, my - 0.02], [mx + 0.09, my + 0.02]], 0.035);
        break;
      default: // hungry: a calm, patient little line — never sad (GDD 9.2)
        pathThrough(curve(mx - 0.06, my, mx, my - 0.025, mx + 0.06, my), 0.035);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    update(dt, t);
    face.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    face.clearRect(0, 0, st.w, st.h);
    if (gl) drawBodyGl(t); else drawBodyFallback();
    drawFace(t);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setMood(mood, colorHex) {
      st.mood = mood;
      st.colorTarget = hexToRgb(mood === 'fed' && colorHex ? colorHex : PALE_COLOR);
      st.paleTarget = mood === 'fed' ? 0 : 1;
    },
    setWalking(walking) {
      st.walking = walking;
      if (!walking) st.excitement = 0;
    },
    setExcitement(v) { st.excitement = Math.max(0, Math.min(1, v)); },
    poke,
    express(name, ms = 1200) {
      st.expression = name;
      st.expressionUntil = (performance.now() - t0) / 1000 + ms / 1000;
    },
    shakeHead() { st.shake = 0.7; },
    onPet(fn) { handlers.pet = fn; },
    onTap(fn) { handlers.tap = fn; },
    // A point on screen Derpiku glances at now and then (e.g. the spirit above it), or null.
    setGaze(p) { st.gaze = p; },
    // Metrics in the target position: centre, radius, top of the head, canvas size.
    metrics() {
      const [, headY] = this.headTop();
      return { cx: st.cx, cy: st.h * st.liftTarget, size: st.size, headY, w: st.w, h: st.h };
    },
    // Vertical position of the centre as a fraction of height: larger = lower, more room above the head.
    setLift(v) { st.liftTarget = v; },
    // Top of the head on screen in the target position — used to place the speech bubble.
    headTop() {
      const cy = st.cy;
      st.cy = st.h * st.liftTarget;
      const p = localToScreen(0, 1.05);
      st.cy = cy;
      return p;
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
