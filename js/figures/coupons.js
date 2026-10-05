/**
 * Coupons: a stack of five offer tickets, fanned back so each shows its far
 * edge. Every ticket has a stub torn off along a perforation, with a notch at
 * each end, and a round % badge printed on the stub. The ticket under the
 * pointer slides out of the stack, stub first, and its badge takes the bright
 * stroke; its neighbours follow it a little, staggered outwards. The read-out
 * is the ticket's offer. The slider is how far the ticket slides out.
 *
 * The pattern: one of many, as Riffle. Tweens, a stagger by distance, and a
 * hit test on static bands along the resting tickets, so a ticket sliding
 * out from under the pointer cannot change the choice.
 */
const {
  Cam, circ, clamp, fillet, fit, proj, poly, seg, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, register,
} = HL;

const N = 5, W = 116, H = 46, G = 13, TK = 2.4, STUB = 34, NR = 3.6, BR = 9.5;
const PU = W - STUB, OFF = [10, 30, 15, 50, 20], JX = [5, -3, 3, -5, 0], REST = [0, 0, 0, 12, 0];
const FALL = [1, 0.16, 0.06, 0.03, 0.03], PULLMAX = 64;

/** A semicircle of n steps about (cu, cv), from angle a0 to a1 in degrees. */
const arc = (cu, cv, r, a0, a1, n) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    return [cu + r * Math.cos(a), cv + r * Math.sin(a)];
  });

/** The ticket's outline in its own (u, v) plane: rounded corners, and a notch at each end of the perforation. */
function outline() {
  const top = arc(PU, 0, NR, 180, 0, 6), bot = arc(PU, H, NR, 0, -180, 6);
  const pts = [[0, 0], ...top, [W, 0], [W, H], ...bot, [0, H]];
  const radii = pts.map((p, k) => (k === 0 || k === 8 || k === 9 || k === 17 ? 4 : k === 1 || k === 7 || k === 10 || k === 16 ? 1 : 0));
  return fillet(pts, radii, 4);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let pull = value;

  // fitted with the bottom ticket out at the slider's far end, so no pose leaves the frame
  const yAt = (i) => -(N - 1 - i) * G, zAt = (i) => i * TK;
  const C = Cam(45, 0.5, 1.72);
  fit(C, [[-6, yAt(0), 0], [W + PULLMAX + 6, yAt(0), 0], [W + PULLMAX + 6, H, 0], [-6, H, 0], [-6, yAt(0), N * TK]], 200, 166);
  const P = proj(C), shape = outline(), badge = circ(BR, 24), dot = circ(2, 10);

  const g = mk("g", {}, svg);

  // bottom to top, so each ticket covers the ones under it
  const tickets = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    const t = {
      back: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp),
      perf: mk("path", { class: "nf dash" }, grp), lines: mk("path", { class: "nf lo" }, grp),
      head: mk("path", { class: "nf" }, grp), ring: mk("path", { class: "nf" }, grp), pct: mk("path", { class: "nf" }, grp),
      x: tween(REST[i]), last: NaN,
    };
    tickets.push(t);
  }

  function draw(i, dx) {
    const t = tickets[i];
    if (dx === t.last) return;
    t.last = dx;
    const x0 = JX[i] + dx, y0 = yAt(i), z = zAt(i);
    const w = (u, v, zz = z + TK) => P(x0 + u, y0 + v, zz);
    const bu = PU + STUB / 2, bv = H / 2, onFace = (ring, r) => ring.map((q) => w(bu + q.u * r, bv + q.v * r));
    t.back.setAttribute("d", poly(shape.map(([u, v]) => w(u, v, z))));
    t.face.setAttribute("d", poly(shape.map(([u, v]) => w(u, v))));
    t.perf.setAttribute("d", seg(w(PU, NR + 1.5), w(PU, H - NR - 1.5)));
    t.head.setAttribute("d", seg(w(9, 12), w(PU - 30, 12)));
    t.lines.setAttribute("d", [22, 29, 36].map((v, k) => seg(w(9, v), w(PU - 12 - k * 14, v))).join(""));
    t.ring.setAttribute("d", poly(onFace(badge, 1)));
    // the % printed in the badge, laid out so it reads upright on screen: rings up-left and down-right, the stroke rising between
    const ring = (du, dv) => poly(dot.map((q) => w(bu + du + q.u, bv + dv + q.v)));
    t.pct.setAttribute("d", ring(-5.2, -1) + ring(5.2, 1) + seg(w(bu + 3.4, bv + 6.5), w(bu - 3.4, bv - 6.5)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    tickets.forEach((t, i) => { draw(i, tval(t.x, now)); if (!tdone(t.x, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  // hit bands on the RESTING tickets: the top one whole, each one under it by the strip it shows behind
  function hit([sx, sy]) {
    for (let i = N - 1; i >= 0; i--) {
      const [x, y] = unproj(C, sx, sy, zAt(i) + TK);
      const y0 = yAt(i) - (i === 0 ? 4 : 0), y1 = i === N - 1 ? H + 4 : yAt(i + 1);
      if (y >= y0 && y < y1 && x >= JX[i] - 4 && x <= JX[i] + W + pull + 4) return i;
    }
    return -1;
  }

  let act = -1;
  function setActive(a, force) {
    if (a === act && !force) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    tickets.forEach((t, i) => {
      const d = Math.abs(i - (from < 0 ? N - 1 : from));
      tset(t.x, a < 0 ? REST[i] : pull * FALL[Math.abs(i - a)], now, d * 45);
      const lit = a < 0 ? i === N - 1 : i === a;
      t.ring.classList.toggle("hi", lit); t.pct.classList.toggle("hi", lit);
    });
    read.textContent = a < 0 ? "rest" : OFF[a] + "%";
    B.wake();
  }
  setActive(-1, true);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { pull = clamp(v, 0, PULLMAX); setActive(act, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "coupons",
  means: "A stack of offer tickets: the one under the pointer slides out stub first, and its % badge lights up.",
  rules: [1, 2, 4, 5],
  range: [40, 52, 64],
  mount,
});
