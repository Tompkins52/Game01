// Three ways to steer: tilt the phone, drag a thumb, or use the keyboard.
// read() always returns { x, y, zoom } with x and y between -1 and 1 (y is forward).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function dead(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

export class Input {
  constructor(touchEl, stickEl, nubEl) {
    this.touchEl = touchEl;
    this.stickEl = stickEl;
    this.nubEl = nubEl;
    this.mode = 'pad';
    this.enabled = false;
    this.sens = 22; // degrees of tilt for full speed
    this.keys = {};
    this.zoomQueued = false;
    this.tilt = { listening: false, have: false, beta: 45, gamma: 0, b0: 45, g0: 0, last: 0, first: true };
    this.pad = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.onOrient = this.onOrient.bind(this);

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
      if (k === ' ' && !e.repeat) this.zoomQueued = true;
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.endPad();
    });

    const el = touchEl;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (this.mode === 'tilt') {
        this.zoomQueued = true;
        return;
      }
      if (this.pad.id !== null) return;
      const r = el.getBoundingClientRect();
      this.pad.id = e.pointerId;
      this.pad.ox = e.clientX - r.left;
      this.pad.oy = e.clientY - r.top;
      this.pad.x = this.pad.y = 0;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) { /* older browsers */ }
      this.showStick(0, 0);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pad.id) return;
      const r = el.getBoundingClientRect();
      const R = 54;
      let dx = (e.clientX - r.left - this.pad.ox) / R, dy = (e.clientY - r.top - this.pad.oy) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) {
        dx /= m;
        dy /= m;
      }
      this.pad.x = dx;
      this.pad.y = -dy;
      this.showStick(dx * R, dy * R);
    });
    const up = (e) => {
      if (e.pointerId === this.pad.id) this.endPad();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  showStick(nx, ny) {
    const s = this.stickEl;
    s.hidden = false;
    s.style.transform = `translate(${this.pad.ox}px, ${this.pad.oy}px)`;
    this.nubEl.style.transform = `translate(${nx}px, ${ny}px)`;
  }
  endPad() {
    this.pad.id = null;
    this.pad.x = this.pad.y = 0;
    this.stickEl.hidden = true;
  }

  onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const T = this.tilt;
    let b = e.beta, g = e.gamma;
    // If the screen is turned sideways, swap the axes so "forward" still means away from you.
    const ang = (window.screen && window.screen.orientation && window.screen.orientation.angle) || 0;
    if (ang === 90) {
      const tb = b;
      b = -g;
      g = tb;
    } else if (ang === 270 || ang === -90) {
      const tb = b;
      b = g;
      g = -tb;
    }
    if (T.first) {
      T.beta = b;
      T.gamma = g;
      T.first = false;
    } else {
      T.beta += (b - T.beta) * 0.35;
      T.gamma += (g - T.gamma) * 0.35;
    }
    T.have = true;
    T.last = performance.now();
  }

  // Ask for the motion sensors. Must be called from a tap (iPhone shows a permission box).
  // Resolves to 'ok', 'denied' or 'none'.
  async enableTilt() {
    const T = this.tilt;
    try {
      const D = window.DeviceOrientationEvent;
      if (!D) return 'none';
      if (typeof D.requestPermission === 'function') {
        const res = await D.requestPermission();
        if (res !== 'granted') return 'denied';
      }
      if (!T.listening) {
        window.addEventListener('deviceorientation', this.onOrient);
        T.listening = true;
      }
      const start = performance.now();
      while (!T.have && performance.now() - start < 1200) await new Promise((r) => setTimeout(r, 60));
      return T.have ? 'ok' : 'none';
    } catch (err) {
      return 'denied';
    }
  }

  // "However you are holding it right now is your stay position."
  calibrate() {
    const T = this.tilt;
    T.b0 = T.beta;
    T.g0 = T.gamma;
  }

  tiltStale() {
    return this.mode === 'tilt' && (!this.tilt.have || performance.now() - this.tilt.last > 2000);
  }

  // Raw tilt for the on-screen indicator, before the dead zone.
  tiltRaw() {
    const T = this.tilt;
    return { x: clamp((T.gamma - T.g0) / this.sens, -1, 1), y: clamp((T.b0 - T.beta) / this.sens, -1, 1) };
  }

  read() {
    let x = 0, y = 0;
    const k = this.keys;
    const kx = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
    const ky = (k.arrowup || k.w ? 1 : 0) - (k.arrowdown || k.s ? 1 : 0);
    if (kx || ky) {
      x = kx;
      y = ky;
    } else if (this.mode === 'tilt' && this.tilt.have) {
      const r = this.tiltRaw();
      x = dead(r.x, 0.14);
      y = dead(r.y, 0.14);
    } else {
      x = dead(this.pad.x, 0.1);
      y = dead(this.pad.y, 0.1);
    }
    const zoom = this.zoomQueued;
    this.zoomQueued = false;
    return { x, y, zoom };
  }
}
