// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* 📈🕹️ APK GRAPH PUCK — the SpaceMouse flies whatever graph is under the mouse
   (owner 2026-11-11: "the spectrum analyzer and oscilloscope to subscribe to
   the space mouse.... in fact anything with a graph.... the pan left and right
   zoom in and out should all be mapped from the space mouse and it should be
   connected to the graph").

   ONE RECEIVER FOR EVERY GRAPH, not one per app. A graph registers a handle
   that says how to read and set its visible range, through its OWN range API
   (echarts min/max or dataZoom, a canvas view, …) — never a CSS transform:

       const detach = APKGraphPuck.attach({
           el,              // the element whose hover / focus makes this the graph
           getView() -> { x: [lo, hi], y: [lo, hi] | null }   the visible ranges
           setView({ x, y })                                    show these ranges
           reset()          // back to auto / full range (a puck button)
           plotRect?()      // the plot area in client px (default el's box)
           xLog?, yLog?     // bool or () => bool: zoom and pan in decades
           boundsX?, boundsY?  // [lo, hi] or () => [lo, hi]: never past these
           uniform?         // one zoom for both axes (a scatter with one k)
           anchorX?         // number or () => number|null: zoom x about this share
                            //   instead of the pointer (a LIVE strip zooms about now: 1)
           surface?         // true: driven by the shell's OS.puckSurfaces only
       });

   WHAT EACH MOTION DOES:
     · SLIDE left / right   — pans the x axis (the view goes the way the hand goes);
     · PUSH DOWN / PULL UP  — zooms x in / out, about the pointer's x when the
                              pointer is over the plot, else about the centre;
     · SLIDE forward / back — pans y, where the graph has a y range;
     · ROCK (tip forward / back) — zooms y in / out, about the pointer's y
                              (the SpaceMouse setting consumers.graphs_rock
                              'forward_out' turns that round: forward zooms out);
     · EITHER BUTTON        — reset to auto / full range.

   WHICH GRAPH. The one under the pointer; else the one holding keyboard focus;
   else none — a page of controls with a graph in it does not move the graph
   while the hand is on a fader.

   HOW IT ARRIVES. A framed page gets the shell's frames (SpaceMouse/route/
   route-puck.js) as { apkos: 'puck', action: 'move', pan: {dx, dy}, zoom, unit }
   once per animation frame and { apkos: 'puck', action: 'button' } on a press;
   this module listens for them. A window the shell draws itself registers
   APKGraphPuck.surface(handle) as OS.puckSurfaces[appId]; the shell hands
   that function each move frame and, for a press, { action: 'button', button }
   (route-puck.js OS.puckButtons). consumers.graphs false → ignored. The writes are buffered and flushed once per animation
   frame through setView, last value wins.

   The math is pure and exported for the tests (apk-graph-puck.test.js). */
(function (root) {
    'use strict';

    const RATE = {
        ZOOM_E_S: 1.6,   /* full rock zooms y by e^1.6 a second, as the shell's push does x */
        DEAD: 0.08,      /* rock under this is the hand sliding, not rocking */
        DT_MAX: 0.05,
        MIN_REL: 1e-6    /* the narrowest view: this share of the full (or first) width */
    };

    const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const valOf = (v) => (typeof v === 'function' ? v() : v);
    const okRange = (r) => Array.isArray(r) && r.length === 2 && isFinite(r[0]) && isFinite(r[1]) && r[1] > r[0];
    /* A log axis is worked in decades; one that reaches zero or below cannot be. */
    const canLog = (r) => okRange(r) && r[0] > 0;
    const to = (r, log) => (log ? [Math.log10(r[0]), Math.log10(r[1])] : [r[0], r[1]]);
    const from = (r, log) => (log ? [Math.pow(10, r[0]), Math.pow(10, r[1])] : r);

    /* Slide a range by `frac` of its own width (+ = towards higher values). */
    function pan(range, frac, log) {
        if (!okRange(range) || !frac) return range;
        const L = log && canLog(range);
        const t = to(range, L), w = t[1] - t[0];
        return from([t[0] + frac * w, t[1] + frac * w], L);
    }

    /* Zoom a range by `factor` (> 1 = in, narrower) keeping the point at `at`
       (0 = low end, 1 = high end, 0.5 = middle) where it is. */
    function zoom(range, factor, at, log) {
        if (!okRange(range) || !(factor > 0) || factor === 1) return range;
        const a = typeof at === 'number' && isFinite(at) ? Math.max(0, Math.min(1, at)) : 0.5;
        const L = log && canLog(range);
        const t = to(range, L), w = t[1] - t[0];
        const anchor = t[0] + a * w, nw = w / factor;
        return from([anchor - a * nw, anchor - a * nw + nw], L);
    }

    /* Keep a range inside `bounds` (never wider, never past either end) and no
       narrower than `minW` (in the axis's own terms: decades on a log axis). */
    function clamp(range, bounds, minW, log) {
        if (!okRange(range)) return range;
        const L = log && canLog(range) && (!bounds || canLog(bounds));
        let t = to(range, L);
        if (minW > 0 && t[1] - t[0] < minW) {
            const c = (t[0] + t[1]) / 2;
            t = [c - minW / 2, c + minW / 2];
        }
        if (okRange(bounds)) {
            const b = to(bounds, L), bw = b[1] - b[0], w = t[1] - t[0];
            if (w >= bw) t = [b[0], b[1]];
            else if (t[0] < b[0]) t = [b[0], b[0] + w];
            else if (t[1] > b[1]) t = [b[1] - w, b[1]];
        }
        return from(t, L);
    }

    /* The narrowest the view may get: a share of the full width if there is
       one, else of the width the graph had when the puck first touched it. */
    function minWidth(bounds, first, log) {
        const ref = okRange(bounds) ? bounds : first;
        if (!okRange(ref)) return 0;
        const L = log && canLog(ref);
        const t = to(ref, L);
        return (t[1] - t[0]) * RATE.MIN_REL;
    }

    /* One puck frame applied to a view. Pure.
         view    { x: [lo, hi], y: [lo, hi] | null }
         motion  { pan: {dx, dy} (CSS px, + right / up), zoom (factor, > 1 in), unit: {pitch, …} }
         ctx     { plotW, plotH, ax, ay (anchor shares, 0..1, ay from the bottom), dt,
                   xLog, yLog, boundsX, boundsY, firstX, firstY, uniform,
                   rock (+1: rock forward zooms y in — the default; −1: out) }
       → the next view. */
    function step(view, motion, ctx) {
        const c = ctx || {};
        const m = motion || {};
        const p = m.pan || {};
        const u = m.unit || {};
        const pitch = Math.abs(num(u.pitch)) < RATE.DEAD ? 0 : Math.max(-1, Math.min(1, num(u.pitch)));
        const dt = Math.min(RATE.DT_MAX, num(c.dt) > 0 ? c.dt : 1 / 60);
        const zx = num(m.zoom) > 0 ? m.zoom : 1;
        /* Rock forward (+pitch) zooms y in, back zooms it out — unless the
           SpaceMouse setting turns the rock round (ctx.rock = −1). */
        const rock = num(c.rock) < 0 ? -1 : 1;
        const zy = Math.exp(rock * pitch * RATE.ZOOM_E_S * dt);
        const fx = c.uniform ? zx * zy : zx;
        const fy = c.uniform ? zx * zy : zy;
        const out = { x: view.x, y: view.y || null };
        if (okRange(view.x)) {
            let x = zoom(view.x, fx, c.ax, c.xLog);
            if (num(c.plotW) > 0 && num(p.dx)) x = pan(x, p.dx / c.plotW, c.xLog);
            out.x = clamp(x, c.boundsX, minWidth(c.boundsX, c.firstX || view.x, c.xLog), c.xLog);
        }
        if (okRange(view.y)) {
            let y = zoom(view.y, fy, c.ay, c.yLog);
            if (num(c.plotH) > 0 && num(p.dy)) y = pan(y, p.dy / c.plotH, c.yLog);
            out.y = clamp(y, c.boundsY, minWidth(c.boundsY, c.firstY || view.y, c.yLog), c.yLog);
        }
        return out;
    }

    /* Where the pointer is inside a rect, as shares: ax from the left, ay from
       the bottom. Null when it is outside. Pure. */
    function anchorIn(rect, pt) {
        if (!rect || !pt || !(rect.width > 0) || !(rect.height > 0)) return null;
        const ax = (pt.x - rect.left) / rect.width;
        const ay = 1 - (pt.y - rect.top) / rect.height;
        if (ax < 0 || ax > 1 || ay < 0 || ay > 1) return null;
        return { ax, ay };
    }

    /* The rock's sign off the SpaceMouse window's consumers (all its switches
       ride every puck frame): 'forward_out' → −1, anything else → +1. Pure. */
    const rockSign = (consumers) => (consumers && consumers.graphs_rock === 'forward_out' ? -1 : 1);

    const api = { RATE, pan, zoom, clamp, step, anchorIn, minWidth, rockSign };
    root.APKGraphPuck = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    /* ---- the page ------------------------------------------------------ */
    const handles = new Set();
    let pointer = null;   /* { x, y, target } in this document's client px */

    const track = (e) => { pointer = { x: e.clientX, y: e.clientY, target: e.target }; };
    document.addEventListener('pointermove', track, true);
    document.addEventListener('pointerover', track, true);
    document.documentElement.addEventListener('pointerleave', () => { pointer = null; });

    const rectOf = (h) => {
        try {
            const r = typeof h.plotRect === 'function' ? h.plotRect() : null;
            return r || h.el.getBoundingClientRect();
        } catch (_) { return h.el.getBoundingClientRect(); }
    };
    /* Under the pointer: the graph holding the element the pointer is on (the
       innermost, if graphs nest), else one whose box the pointer is inside. */
    const holds = (h) => !!(pointer && pointer.target && h.el.contains(pointer.target));
    const inside = (h) => {
        if (!pointer) return false;
        const r = h.el.getBoundingClientRect();
        return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    };

    /* The graph the puck holds: under the pointer, else focused, else none. */
    function pick(onlySurface) {
        const list = [...handles].filter((h) => h.el && h.el.isConnected && (onlySurface ? h.surface : !h.surface));
        const holding = list.filter(holds).sort((a, b) => (a.el.contains(b.el) ? 1 : b.el.contains(a.el) ? -1 : 0));
        const hovered = holding[0] || list.find(inside);
        if (hovered) return hovered;
        const a = document.activeElement;
        if (a && a !== document.body) return list.find((h) => h.el.contains(a)) || null;
        return null;
    }

    function flush(h) {
        h._raf = 0;
        const v = h._pending;
        h._pending = null;
        if (!v) return;
        try { h.setView(v); } catch (err) { console.warn('[APKGraphPuck] setView', h.name || '', err && err.message); }
    }

    /* One move frame for one graph. Returns true when the view changed. */
    function drive(h, motion, consumers) {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const dt = h._lastAt && now - h._lastAt < 500 ? (now - h._lastAt) / 1000 : 1 / 60;
        h._lastAt = now;
        let view = h._pending;
        if (!view) {
            try { view = h.getView(); } catch (_) { view = null; }
        }
        if (!view || !okRange(view.x)) return false;
        if (!h._first) h._first = { x: view.x, y: view.y };
        const rect = rectOf(h);
        const at = anchorIn(rect, pointer) || { ax: 0.5, ay: 0.5 };
        const fixed = valOf(h.anchorX);
        if (typeof fixed === 'number' && isFinite(fixed)) at.ax = fixed;
        const next = step(view, motion, {
            plotW: rect.width, plotH: rect.height, ax: at.ax, ay: at.ay, dt,
            xLog: !!valOf(h.xLog), yLog: !!valOf(h.yLog),
            boundsX: valOf(h.boundsX), boundsY: valOf(h.boundsY),
            firstX: h._first.x, firstY: h._first.y, uniform: !!h.uniform,
            rock: rockSign(consumers || (motion && motion.consumers))
        });
        const same = (a, b) => (!a && !b) || (a && b && a[0] === b[0] && a[1] === b[1]);
        if (same(next.x, view.x) && same(next.y, view.y)) return false;
        h._pending = next;
        if (!h._raf) h._raf = requestAnimationFrame(() => flush(h));
        return true;
    }

    function reset(h) {
        h._pending = null;
        h._first = null;
        if (h._raf) { cancelAnimationFrame(h._raf); h._raf = 0; }
        try { h.reset(); } catch (err) { console.warn('[APKGraphPuck] reset', h.name || '', err && err.message); }
    }

    function attach(handle) {
        if (!handle || !handle.el || typeof handle.getView !== 'function' || typeof handle.setView !== 'function') {
            throw new Error('APKGraphPuck.attach needs { el, getView, setView, reset }');
        }
        handles.add(handle);
        handle.el.setAttribute && handle.el.setAttribute('data-graph-puck', handle.name || '');
        return () => { handles.delete(handle); if (handle._raf) cancelAnimationFrame(handle._raf); };
    }

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.apkos !== 'puck') return;
        if (d.consumers && d.consumers.graphs === false) return;
        const h = pick(false);
        if (!h) return;
        if (d.action === 'move') drive(h, d, d.consumers);
        else if (d.action === 'button') reset(h);
    });

    /* For a window the shell draws (no iframe): OS.puckSurfaces[appId] =
       APKGraphPuck.surface(handle). Off, or the pointer elsewhere in the window,
       returns false and the shell's own fallback has the window. */
    function surface(handle) {
        handle.surface = true;
        attach(handle);
        return (motion, win, consumers) => {
            if (consumers && consumers.graphs === false) return false;
            if (!handle.el.isConnected) { handles.delete(handle); return false; }
            /* A press (route-puck.js OS.puckButtons): either button resets. */
            if (motion && motion.action === 'button') { reset(handle); return true; }
            drive(handle, motion, consumers);
            return true;
        };
    }

    Object.assign(api, { attach, drive, reset, surface, pick, handles });
})(typeof globalThis !== 'undefined' ? globalThis : this);
