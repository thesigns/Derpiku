// The spirit floating above Derpiku: the one whose haiku you'd hear right now (same rule as for the haiku).
// When the spirit changes, the old one drifts up and away and the new one floats down in its place.
const FADE_S = 0.8;

export function createSpiritView(canvas, label, { spirits, anchor }) {
  const ctx = canvas.getContext('2d');
  const st = { w: 0, h: 0, dpr: 1, entries: [], visible: 1, hidden: false, endingSoon: false, current: null };

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

  let last = performance.now();
  function frame(now) {
    const t = now / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st.visible += ((st.hidden ? 0 : 1) - st.visible) * (1 - Math.exp(-dt * 6));
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.clearRect(0, 0, st.w, st.h);
    const a = anchor();
    st.entries = st.entries.filter(e => !e.leaving || t - e.leaving < FADE_S);
    let labelAlpha = 0;
    for (const e of st.entries) {
      const fadeIn = Math.min(1, (t - e.born) / FADE_S);
      const fadeOut = e.leaving ? 1 - (t - e.leaving) / FADE_S : 1;
      const ease = x => x * x * (3 - 2 * x);
      let alpha = ease(fadeIn) * ease(Math.max(0, fadeOut)) * st.visible;
      if (!e.leaving && st.endingSoon) alpha *= 0.72 + 0.28 * Math.sin(t * 7);
      const dy = -(1 - ease(fadeIn)) * a.r * 1.2 - (e.leaving ? (1 - fadeOut) * a.r * 1.6 : 0);
      const bob = Math.sin(t * 1.6) * a.r * 0.1;
      if (alpha > 0.01) globalThis.SpiritArt.draw(ctx, spirits[e.index], t, { x: a.x, y: a.y + dy + bob, r: a.r, alpha });
      if (!e.leaving) labelAlpha = ease(fadeIn) * st.visible;
    }
    label.style.opacity = labelAlpha.toFixed(3);
    label.style.transform = `translate(${a.x}px, ${a.y - a.r * 1.75}px) translate(-50%, -100%)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    // spirit index, or null (no good GPS fix)
    show(index) {
      if (index === st.current) return;
      const t = performance.now() / 1000;
      for (const e of st.entries) if (!e.leaving) e.leaving = t;
      if (index != null) st.entries.push({ index, born: t, leaving: 0 });
      st.current = index;
    },
    setHidden(hidden) { st.hidden = hidden; },
    setEndingSoon(v) { st.endingSoon = v; },
    // the spirit's position on screen — Derpiku glances at it
    position() { return st.current == null || st.hidden ? null : anchor(); },
  };
}
