// Animal spirits: glowing, translucent "ghosts" with a wavy tail, drawn procedurally in Canvas 2D.
// Each animal is the shared body plus a few characteristic parts (ears, spikes, horn, stripes…).
// Local coordinates: head of radius 1 at (0, 0), y axis pointing down, the tail reaches y ≈ 2.15.
(function (root) {
  'use strict';

  const INK = 'rgba(29, 26, 38, 0.78)';
  const WHITE = [255, 255, 255];
  const DARK = [29, 26, 38];

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, f) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * f));
  }
  function css(c, a) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  }

  // ---------- primitives ----------

  function ellipse(ctx, x, y, rx, ry, rot, style) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = style;
    ctx.fill();
  }
  function poly(ctx, pts, style) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }
  function line(ctx, pts, width, style) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style;
    ctx.stroke();
  }
  function quad(ctx, x0, y0, cx, cy, x1, y1, width, style) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = style;
    ctx.stroke();
  }
  // Spikes radiating from the head, angles in radians (0 = right, −π/2 = up).
  function spikes(ctx, from, to, count, inner, outer, halfWidth, style) {
    for (let k = 0; k < count; k++) {
      const a = count === 1 ? from : from + (to - from) * k / (count - 1);
      poly(ctx, [
        [Math.cos(a - halfWidth) * inner, Math.sin(a - halfWidth) * inner],
        [Math.cos(a) * outer, Math.sin(a) * outer],
        [Math.cos(a + halfWidth) * inner, Math.sin(a + halfWidth) * inner],
      ], style);
    }
  }

  // ---------- body ----------

  function tailTip(t) {
    return [Math.sin(t * 2.2) * 0.35, 2.15];
  }

  function ghostPath(ctx, t) {
    const [tip] = tailTip(t);
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.arc(0, 0, 1, 0, Math.PI, true);
    ctx.bezierCurveTo(-1, 0.85, tip - 0.55, 1.45, tip, 2.15);
    ctx.bezierCurveTo(tip + 0.65, 1.35, 1, 0.8, 1, 0);
    ctx.closePath();
  }

  // Jellyfish: a frilly bell instead of a tail.
  function jellyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(1, 0.1);
    ctx.arc(0, 0.1, 1, 0, Math.PI, true);
    for (let k = 0; k < 4; k++) {
      const x0 = -1 + k * 0.5;
      ctx.quadraticCurveTo(x0 + 0.25, 0.5, x0 + 0.5, 0.15);
    }
    ctx.closePath();
  }

  function jellyTentacles(ctx, t, style) {
    for (let k = 0; k < 5; k++) {
      const x = -0.6 + k * 0.3;
      const pts = [];
      for (let s = 0; s <= 10; s++) {
        const y = 0.3 + s * 0.17;
        pts.push([x + Math.sin(t * 2.4 + k * 1.3 + s * 0.6) * 0.1 * (s / 10 + 0.3), y]);
      }
      line(ctx, pts, 0.1 - k % 2 * 0.03, style);
    }
  }

  function flukes(ctx, t, style) {
    const [tip, y] = tailTip(t);
    ellipse(ctx, tip - 0.3, y + 0.02, 0.34, 0.13, -0.45, style);
    ellipse(ctx, tip + 0.3, y + 0.02, 0.34, 0.13, 0.45, style);
  }

  // ---------- face ----------

  function closedEyes(ctx, y = -0.02) {
    for (const x of [-0.35, 0.35]) quad(ctx, x - 0.16, y - 0.03, x, y + 0.11, x + 0.16, y - 0.03, 0.08, INK);
  }
  function dotEyes(ctx, y = -0.05, r = 0.1) {
    for (const x of [-0.35, 0.35]) {
      ellipse(ctx, x, y, r, r * 1.1, 0, INK);
      ellipse(ctx, x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.35, 0, 'rgba(255,255,255,0.9)');
    }
  }
  function smile(ctx, w = 0.11, y = 0.24) {
    quad(ctx, -w, y, 0, y + w * 0.8, w, y, 0.06, INK);
  }
  function blush(ctx, a = 0.35) {
    ellipse(ctx, -0.62, 0.2, 0.16, 0.09, 0, `rgba(255, 110, 150, ${a})`);
    ellipse(ctx, 0.62, 0.2, 0.16, 0.09, 0, `rgba(255, 110, 150, ${a})`);
  }
  function whiskers(ctx, y = 0.15) {
    for (const s of [-1, 1]) {
      for (const dy of [-0.12, 0, 0.12]) line(ctx, [[s * 0.45, y], [s * 1.18, y + dy * 1.6]], 0.035, 'rgba(29,26,38,0.45)');
    }
  }

  // ---------- animals ----------
  // back: parts behind the body (they glow with it), front: details on the body, face: eyes and mouth.
  // P = colours: part (light, nearly opaque), deep (a darker shade), light (translucent white).

  const ANIMALS = {
    Axolotl: {
      back(ctx, P) {
        for (const s of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const a = 0.95 - k * 0.45;
            const x0 = s * 0.8, y0 = -0.3 + k * 0.12;
            const x1 = x0 + s * Math.cos(a) * 0.62, y1 = y0 - Math.sin(a) * 0.62;
            line(ctx, [[x0, y0], [x1, y1]], 0.2, P.part);
            for (let f = 1; f <= 3; f++) {
              ellipse(ctx, x0 + (x1 - x0) * f / 3.2, y0 + (y1 - y0) * f / 3.2, 0.1, 0.1, 0, P.part);
            }
          }
        }
      },
      face(ctx) { dotEyes(ctx); smile(ctx, 0.2, 0.22); blush(ctx, 0.5); },
    },
    Bee: {
      back(ctx) {
        ellipse(ctx, -0.8, -0.8, 0.48, 0.3, 0.55, 'rgba(255,255,255,0.6)');
        ellipse(ctx, 0.8, -0.8, 0.48, 0.3, -0.55, 'rgba(255,255,255,0.6)');
      },
      front(ctx, P, t) {
        ctx.save();
        ghostPath(ctx, t);
        ctx.clip();
        ctx.fillStyle = 'rgba(29,26,38,0.5)';
        ctx.fillRect(-2, 0.45, 4, 0.24);
        ctx.fillRect(-2, 0.95, 4, 0.22);
        ctx.restore();
        for (const s of [-1, 1]) {
          quad(ctx, s * 0.3, -0.9, s * 0.35, -1.35, s * 0.65, -1.5, 0.06, INK);
          ellipse(ctx, s * 0.65, -1.5, 0.1, 0.1, 0, INK);
        }
      },
      face(ctx) { closedEyes(ctx); smile(ctx); blush(ctx); },
    },
    Cat: {
      back(ctx, P) {
        poly(ctx, [[-0.92, -0.3], [-0.78, -1.3], [-0.22, -0.88]], P.part);
        poly(ctx, [[0.92, -0.3], [0.78, -1.3], [0.22, -0.88]], P.part);
      },
      front(ctx) {
        poly(ctx, [[-0.72, -0.62], [-0.68, -1.05], [-0.42, -0.83]], 'rgba(255,140,170,0.45)');
        poly(ctx, [[0.72, -0.62], [0.68, -1.05], [0.42, -0.83]], 'rgba(255,140,170,0.45)');
        whiskers(ctx);
        poly(ctx, [[-0.07, 0.1], [0.07, 0.1], [0, 0.18]], 'rgba(255,120,150,0.8)');
      },
      face(ctx) { closedEyes(ctx); smile(ctx, 0.1, 0.25); blush(ctx); },
    },
    Dog: {
      front(ctx, P) {
        ellipse(ctx, -0.92, 0.05, 0.3, 0.62, 0.28, P.deep);
        ellipse(ctx, 0.92, 0.05, 0.3, 0.62, -0.28, P.deep);
        ellipse(ctx, 0, 0.17, 0.14, 0.1, 0, INK);
      },
      face(ctx) {
        dotEyes(ctx, -0.12);
        quad(ctx, -0.14, 0.3, 0, 0.42, 0.14, 0.3, 0.06, INK);
        ellipse(ctx, 0.04, 0.44, 0.08, 0.1, 0, 'rgba(255,120,150,0.8)');
      },
    },
    Elephant: {
      back(ctx, P) {
        ellipse(ctx, -1.0, 0.0, 0.62, 0.8, -0.2, P.part);
        ellipse(ctx, 1.0, 0.0, 0.62, 0.8, 0.2, P.part);
      },
      front(ctx, P, t) {
        const sway = Math.sin(t * 1.7) * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, 0.1);
        ctx.bezierCurveTo(0.05, 0.6, -0.05 + sway, 0.95, 0.3 + sway, 1.1);
        ctx.lineWidth = 0.3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = P.part;
        ctx.stroke();
      },
      face(ctx) { closedEyes(ctx, -0.12); blush(ctx); },
    },
    Frog: {
      back(ctx, P) {
        ellipse(ctx, -0.45, -0.82, 0.38, 0.36, 0, P.part);
        ellipse(ctx, 0.45, -0.82, 0.38, 0.36, 0, P.part);
      },
      face(ctx) {
        for (const x of [-0.45, 0.45]) {
          ellipse(ctx, x, -0.85, 0.17, 0.19, 0, INK);
          ellipse(ctx, x - 0.06, -0.92, 0.06, 0.06, 0, 'rgba(255,255,255,0.9)');
        }
        quad(ctx, -0.48, 0.15, 0, 0.48, 0.48, 0.15, 0.07, INK);
        blush(ctx, 0.4);
      },
    },
    Goose: {
      front(ctx) {
        poly(ctx, [[0.02, 0.06], [0.75, 0.24], [0.02, 0.36]], 'rgba(245,158,11,0.95)');
        ellipse(ctx, -0.92, 0.55, 0.36, 0.2, -0.6, 'rgba(255,255,255,0.7)');
      },
      face(ctx) { dotEyes(ctx, -0.18, 0.09); blush(ctx, 0.25); },
    },
    Hedgehog: {
      back(ctx, P) { spikes(ctx, -Math.PI + 0.15, -0.15, 13, 0.85, 1.45, 0.13, P.deep); },
      front(ctx) { ellipse(ctx, 0, 0.18, 0.1, 0.08, 0, INK); },
      face(ctx) { dotEyes(ctx, -0.08, 0.085); blush(ctx); },
    },
    Iguana: {
      back(ctx, P) { spikes(ctx, -2.5, -0.65, 7, 0.9, 1.38, 0.11, P.deep); },
      front(ctx) {
        for (const [x, y] of [[-0.55, 0.45], [-0.3, 0.6], [0.45, 0.5], [0.2, 0.68], [0.65, 0.25]]) {
          ellipse(ctx, x, y, 0.07, 0.07, 0, 'rgba(255,255,255,0.45)');
        }
      },
      face(ctx) { dotEyes(ctx, -0.1, 0.09); smile(ctx, 0.16, 0.22); },
    },
    Jellyfish: {
      body: 'jelly',
      front(ctx) {
        for (const [x, y, r] of [[-0.4, -0.55, 0.1], [0.25, -0.7, 0.08], [0.55, -0.3, 0.07]]) {
          ellipse(ctx, x, y, r, r, 0, 'rgba(255,255,255,0.5)');
        }
      },
      face(ctx) { closedEyes(ctx, -0.02); smile(ctx, 0.1, 0.2); blush(ctx); },
    },
    Koala: {
      back(ctx, P) {
        ellipse(ctx, -0.85, -0.62, 0.46, 0.46, 0, P.part);
        ellipse(ctx, 0.85, -0.62, 0.46, 0.46, 0, P.part);
      },
      front(ctx) {
        ellipse(ctx, -0.98, -0.72, 0.24, 0.24, 0, 'rgba(255,255,255,0.55)');
        ellipse(ctx, 0.98, -0.72, 0.24, 0.24, 0, 'rgba(255,255,255,0.55)');
        ellipse(ctx, 0, 0.17, 0.2, 0.26, 0, INK);
      },
      face(ctx) { dotEyes(ctx, -0.12, 0.08); blush(ctx, 0.3); },
    },
    Llama: {
      back(ctx, P) {
        ellipse(ctx, -0.42, -1.05, 0.14, 0.4, -0.25, P.part);
        ellipse(ctx, 0.42, -1.05, 0.14, 0.4, 0.25, P.part);
      },
      front(ctx) {
        for (const [x, y] of [[-0.24, -0.92], [0, -1.04], [0.24, -0.92], [-0.12, -0.78], [0.12, -0.78]]) {
          ellipse(ctx, x, y, 0.19, 0.17, 0, 'rgba(255,255,255,0.75)');
        }
      },
      face(ctx) { closedEyes(ctx, 0.0); smile(ctx, 0.09, 0.3); blush(ctx); },
    },
    Moth: {
      back(ctx, P) {
        for (const s of [-1, 1]) {
          ellipse(ctx, s * 1.1, -0.45, 0.78, 0.56, s * 0.5, P.wing);
          ellipse(ctx, s * 0.92, 0.48, 0.46, 0.38, -s * 0.3, P.wing);
          ellipse(ctx, s * 1.25, -0.55, 0.18, 0.18, 0, 'rgba(255,255,255,0.6)');
          line(ctx, [[s * 0.25, -0.9], [s * 0.72, -1.55]], 0.05, INK);
          for (let k = 1; k <= 4; k++) {
            const x = s * (0.25 + 0.47 * k / 5), y = -0.9 - 0.65 * k / 5;
            line(ctx, [[x, y], [x + s * 0.12, y + 0.06]], 0.035, INK);
          }
        }
      },
      face(ctx) { closedEyes(ctx); smile(ctx); blush(ctx); },
    },
    Narwhal: {
      back(ctx, P, t) {
        poly(ctx, [[-0.08, -0.85], [0.55, -2.05], [0.14, -0.82]], 'rgba(255,255,250,0.95)');
        for (let k = 1; k <= 5; k++) {
          const f = k / 6.2;
          const x = 0.03 + 0.52 * f, y = -0.84 - 1.21 * f, w = 0.11 * (1 - f);
          line(ctx, [[x - w, y + 0.03], [x + w, y - 0.05]], 0.03, 'rgba(120,130,150,0.6)');
        }
        flukes(ctx, t, P.solid);
      },
      face(ctx) { dotEyes(ctx, 0.05, 0.085); smile(ctx, 0.12, 0.3); blush(ctx); },
    },
    Owl: {
      back(ctx, P) {
        poly(ctx, [[-0.8, -0.5], [-0.68, -1.25], [-0.3, -0.86]], P.part);
        poly(ctx, [[0.8, -0.5], [0.68, -1.25], [0.3, -0.86]], P.part);
      },
      face(ctx) {
        for (const x of [-0.38, 0.38]) {
          ellipse(ctx, x, -0.08, 0.31, 0.31, 0, 'rgba(255,255,255,0.65)');
          ellipse(ctx, x, -0.08, 0.15, 0.15, 0, INK);
          ellipse(ctx, x - 0.05, -0.13, 0.05, 0.05, 0, 'rgba(255,255,255,0.9)');
        }
        poly(ctx, [[-0.09, 0.2], [0.09, 0.2], [0, 0.38]], 'rgba(245,158,11,0.95)');
      },
    },
    Pigeon: {
      front(ctx, P, t) {
        ctx.save();
        ghostPath(ctx, t);
        ctx.clip();
        const g = ctx.createLinearGradient(-1, 0, 1, 0);
        g.addColorStop(0, 'rgba(52,211,153,0.5)');
        g.addColorStop(1, 'rgba(167,139,250,0.5)');
        ctx.fillStyle = g;
        ctx.fillRect(-2, 0.52, 4, 0.26);
        ctx.restore();
        poly(ctx, [[0.04, 0.1], [0.42, 0.2], [0.04, 0.3]], 'rgba(90,90,100,0.85)');
      },
      face(ctx) { dotEyes(ctx, -0.12, 0.085); blush(ctx, 0.25); },
    },
    Quokka: {
      back(ctx, P) {
        ellipse(ctx, -0.62, -0.82, 0.26, 0.26, 0, P.part);
        ellipse(ctx, 0.62, -0.82, 0.26, 0.26, 0, P.part);
      },
      front(ctx) { ellipse(ctx, 0, 0.12, 0.09, 0.07, 0, INK); },
      face(ctx) { closedEyes(ctx, -0.08); quad(ctx, -0.32, 0.24, 0, 0.55, 0.32, 0.24, 0.07, INK); blush(ctx, 0.55); },
    },
    Rabbit: {
      back(ctx, P) {
        ellipse(ctx, -0.36, -1.3, 0.2, 0.62, -0.15, P.part);
        ellipse(ctx, 0.36, -1.3, 0.2, 0.62, 0.15, P.part);
      },
      front(ctx) {
        ellipse(ctx, -0.37, -1.3, 0.09, 0.42, -0.15, 'rgba(255,140,170,0.45)');
        ellipse(ctx, 0.37, -1.3, 0.09, 0.42, 0.15, 'rgba(255,140,170,0.45)');
        ellipse(ctx, 0, 0.14, 0.07, 0.05, 0, 'rgba(255,120,150,0.9)');
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(-0.075, 0.3, 0.07, 0.11);
        ctx.fillRect(0.005, 0.3, 0.07, 0.11);
      },
      face(ctx) { closedEyes(ctx); quad(ctx, -0.12, 0.25, 0, 0.32, 0.12, 0.25, 0.05, INK); blush(ctx); },
    },
    Snail: {
      back(ctx, P) {
        for (const s of [-1, 1]) {
          line(ctx, [[s * 0.3, -0.8], [s * 0.45, -1.5]], 0.09, P.part);
          ellipse(ctx, s * 0.45, -1.52, 0.11, 0.11, 0, P.part);
        }
      },
      front(ctx, P) {
        ellipse(ctx, 0.66, -0.72, 0.56, 0.56, 0, P.shell);
        ctx.beginPath();
        for (let k = 0; k <= 60; k++) {
          const a = k / 60 * Math.PI * 4.2, r = 0.04 + k / 60 * 0.46;
          const x = 0.66 + Math.cos(a) * r, y = -0.72 + Math.sin(a) * r;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = 'rgba(29,26,38,0.4)';
        ctx.stroke();
      },
      face(ctx) { dotEyes(ctx, 0.0, 0.08); smile(ctx); blush(ctx); },
    },
    Turtle: {
      front(ctx, P) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 1.01, 0, Math.PI * 2);
        ctx.clip();
        ellipse(ctx, 0, -0.62, 1.05, 0.62, 0, P.shellDark);
        ctx.strokeStyle = 'rgba(29,26,38,0.35)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        const hex = [[-0.28, -0.85], [0.28, -0.85], [0.42, -0.55], [0.28, -0.28], [-0.28, -0.28], [-0.42, -0.55]];
        hex.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        for (const [x, y] of hex) {
          ctx.moveTo(x, y);
          ctx.lineTo(x * 2.6, y + (y + 0.55) * 1.2);
        }
        ctx.stroke();
        ctx.restore();
      },
      face(ctx) { dotEyes(ctx, 0.05, 0.085); smile(ctx, 0.12, 0.3); blush(ctx); },
    },
    Urchin: {
      back(ctx, P) { spikes(ctx, -Math.PI, Math.PI * 0.85, 19, 0.85, 1.55, 0.07, P.deep); },
      face(ctx) { closedEyes(ctx); smile(ctx); blush(ctx, 0.45); },
    },
    Vole: {
      back(ctx, P) {
        ellipse(ctx, -0.6, -0.82, 0.28, 0.28, 0, P.part);
        ellipse(ctx, 0.6, -0.82, 0.28, 0.28, 0, P.part);
      },
      front(ctx) {
        ellipse(ctx, -0.6, -0.82, 0.14, 0.14, 0, 'rgba(255,140,170,0.45)');
        ellipse(ctx, 0.6, -0.82, 0.14, 0.14, 0, 'rgba(255,140,170,0.45)');
        whiskers(ctx, 0.2);
        ellipse(ctx, 0, 0.18, 0.08, 0.065, 0, 'rgba(255,120,150,0.9)');
      },
      face(ctx) { dotEyes(ctx, -0.06, 0.08); blush(ctx, 0.3); },
    },
    Whale: {
      back(ctx, P, t) {
        const puff = 0.5 + 0.5 * Math.sin(t * 2);
        for (const [x, y, r] of [[0, -1.3, 0.12], [-0.22, -1.5, 0.1], [0.22, -1.5, 0.1], [0, -1.68, 0.09]]) {
          ellipse(ctx, x, y - puff * 0.08, r, r * 1.2, 0, `rgba(220,240,255,${0.55 + puff * 0.35})`);
        }
        flukes(ctx, t, P.solid);
      },
      front(ctx) {
        for (let k = 0; k < 4; k++) line(ctx, [[-0.35 + k * 0.23, 0.5], [-0.35 + k * 0.23, 0.78]], 0.04, 'rgba(255,255,255,0.4)');
      },
      face(ctx) { dotEyes(ctx, 0.12, 0.08); smile(ctx, 0.12, 0.3); blush(ctx); },
    },
    Xerus: {
      back(ctx, P, t) {
        const sway = Math.sin(t * 1.5) * 0.08;
        ellipse(ctx, 1.05, 0.15 + sway, 0.42, 0.95, 0.45, P.part);
        for (let k = 0; k < 5; k++) line(ctx, [[0.85 + k * 0.08, -0.45 + k * 0.25 + sway], [1.35 + k * 0.06, -0.55 + k * 0.28 + sway]], 0.04, 'rgba(255,255,255,0.45)');
        ellipse(ctx, -0.52, -0.86, 0.18, 0.2, 0, P.part);
        ellipse(ctx, 0.52, -0.86, 0.18, 0.2, 0, P.part);
      },
      front(ctx) { line(ctx, [[-0.92, 0.3], [-0.55, 0.65], [-0.2, 0.8]], 0.08, 'rgba(255,255,255,0.6)'); },
      face(ctx) { dotEyes(ctx, -0.08, 0.085); smile(ctx); blush(ctx); },
    },
    Yak: {
      back(ctx) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 0.62, -0.62);
          ctx.quadraticCurveTo(s * 1.45, -0.7, s * 1.35, -1.3);
          ctx.lineWidth = 0.2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(250,245,230,0.95)';
          ctx.stroke();
        }
      },
      front(ctx, P) {
        ctx.beginPath();
        ctx.moveTo(-0.95, -0.35);
        ctx.quadraticCurveTo(0, -1.2, 0.95, -0.35);
        for (let k = 6; k >= 0; k--) {
          const x = -0.85 + k * 0.283;
          ctx.lineTo(x + 0.12, -0.32 + (k % 2) * 0.08);
          ctx.lineTo(x, -0.18 - (k % 2) * 0.05);
        }
        ctx.closePath();
        ctx.fillStyle = P.deep;
        ctx.fill();
      },
      face(ctx) { closedEyes(ctx, 0.08); smile(ctx, 0.1, 0.35); blush(ctx, 0.3); },
    },
    Zebra: {
      bodyColor: '#e2e6ee', // light body so the stripes show
      back(ctx) {
        ellipse(ctx, -0.5, -0.92, 0.15, 0.3, -0.3, 'rgba(240,240,245,0.95)');
        ellipse(ctx, 0.5, -0.92, 0.15, 0.3, 0.3, 'rgba(240,240,245,0.95)');
        spikes(ctx, -2.1, -1.05, 6, 0.9, 1.25, 0.12, 'rgba(29,26,38,0.75)');
      },
      front(ctx, P, t) {
        ctx.save();
        ghostPath(ctx, t);
        ctx.clip();
        for (const s of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const y = -0.55 + k * 0.38;
            quad(ctx, s * 1.05, y, s * 0.72, y + 0.12, s * 0.62, y + 0.3, 0.12, 'rgba(29,26,38,0.55)');
          }
        }
        ctx.restore();
      },
      face(ctx) { closedEyes(ctx); smile(ctx); blush(ctx); },
    },
  };

  function sparkles(ctx, t, color) {
    for (let k = 0; k < 5; k++) {
      const a = t * 0.7 + k * Math.PI * 2 / 5;
      const x = Math.cos(a) * 1.75, y = Math.sin(a) * 0.9 + 0.3;
      const s = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(t * 3 + k * 2));
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.9)' : css(color, 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 2);
      ctx.quadraticCurveTo(x, y, x + s * 2, y);
      ctx.quadraticCurveTo(x, y, x, y + s * 2);
      ctx.quadraticCurveTo(x, y, x - s * 2, y);
      ctx.quadraticCurveTo(x, y, x, y - s * 2);
      ctx.fill();
    }
  }

  // Draws a spirit. spirit: { animal, color }; opts: { x, y, r (head radius in px), alpha, glow (0–1, default 1) }.
  function draw(ctx, spirit, t, opts) {
    const spec = ANIMALS[spirit.animal] || {};
    const c = rgb(spec.bodyColor || spirit.color);
    const P = {
      part: css(mix(c, WHITE, 0.3), 0.92),
      deep: css(mix(c, DARK, 0.3), 0.9),
      solid: css(mix(c, WHITE, 0.15), 0.75),
      wing: css(mix(c, WHITE, 0.25), 0.7),
      shell: css(mix(mix(c, WHITE, 0.3), [196, 132, 72], 0.75), 0.97),
      shellDark: css(mix(c, DARK, 0.25), 0.75),
    };
    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.rotate(Math.sin(t * 1.1) * 0.06);
    ctx.scale(opts.r, opts.r);
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;

    const body = ctx.createRadialGradient(-0.25, -0.35, 0.1, 0, 0.1, 2.4);
    body.addColorStop(0, css(mix(c, WHITE, 0.85), 0.97));
    body.addColorStop(0.35, css(mix(c, WHITE, 0.3), 0.93));
    body.addColorStop(0.7, css(c, 0.7));
    body.addColorStop(1, css(c, 0));

    // Glow: a single soft radial halo behind the spirit. shadowBlur looked similar but is very slow
    // on phones, where it made petting Derpiku stutter whenever a spirit was overhead.
    const glow = opts.glow == null ? 1 : opts.glow;
    if (glow > 0) {
      const halo = ctx.createRadialGradient(0, 0.3, 0.4, 0, 0.3, 2.3);
      halo.addColorStop(0, css(c, 0.42 * glow));
      halo.addColorStop(0.5, css(c, 0.16 * glow));
      halo.addColorStop(1, css(c, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(-2.4, -2, 4.8, 4.6);
    }
    if (spec.back) spec.back(ctx, P, t);
    if (spec.body === 'jelly') {
      jellyTentacles(ctx, t, P.part);
      jellyPath(ctx);
    } else {
      ghostPath(ctx, t);
    }
    ctx.fillStyle = body;
    ctx.fill();

    // highlight
    ellipse(ctx, -0.38, -0.55, 0.32, 0.15, -0.5, 'rgba(255,255,255,0.55)');
    if (spec.front) spec.front(ctx, P, t);
    if (spec.face) spec.face(ctx, P, t); else { closedEyes(ctx); smile(ctx); blush(ctx); }
    sparkles(ctx, t, c);
    ctx.restore();
  }

  const api = { draw, animals: Object.keys(ANIMALS) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpiritArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
