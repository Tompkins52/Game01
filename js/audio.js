// All sound is made in code with the Web Audio API. No audio files to download.

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfx = true;
    this.music = true;
    this.timer = null;
    this.step = 0;
    this.nextT = 0;
  }

  // Browsers only allow sound after a tap, so call this from a tap handler.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.9;
        this.out.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* no sound on this device */ }
  }

  tone(f, dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    const v = o.vol == null ? 0.12 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest || this.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = o.filter || 'lowpass';
    flt.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = c.createGain();
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.out);
    src.start(t0);
  }

  bark(delay = 0, pitch = 1) {
    this.tone(520 * pitch, 0.09, { to: 280 * pitch, type: 'sawtooth', vol: 0.16, delay });
    this.noise(0.07, { f: 1800, vol: 0.1, delay });
  }

  play(name, mine = true) {
    if (!this.sfx || !this.ctx) return;
    const q = mine ? 1 : 0.45;
    switch (name) {
      case 'click': this.tone(660, 0.05, { vol: 0.08 }); break;
      case 'count': this.tone(440, 0.14, { vol: 0.14 }); break;
      case 'go': this.tone(880, 0.35, { vol: 0.16 }); this.bark(0.05); this.bark(0.2, 1.1); break;
      case 'bone': this.tone(988, 0.06, { vol: 0.09 * q }); this.tone(1319, 0.09, { vol: 0.09 * q, delay: 0.06 }); break;
      case 'splash': this.noise(0.3, { f: 1400, to: 300, vol: 0.2 * q }); break;
      case 'hugstart': this.tone(523, 0.12, { type: 'triangle', vol: 0.1 * q }); break;
      case 'hug': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.13 * q, delay: i * 0.07 })); break;
      case 'chomp':
        this.noise(0.07, { f: 900, filter: 'bandpass', vol: 0.35 * q });
        this.tone(170, 0.16, { to: 60, vol: 0.2 * q });
        this.tone(300, 0.12, { to: 140, type: 'sine', vol: 0.2 * q, delay: 0.14 });
        this.tone(140, 0.12, { to: 280, type: 'sine', vol: 0.16 * q, delay: 0.26 });
        break;
      case 'bosshit':
        this.play('chomp', mine);
        this.tone(110, 0.3, { to: 50, type: 'sawtooth', vol: 0.2 });
        break;
      case 'bossdown':
        this.play('chomp', mine);
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { vol: 0.14, delay: 0.2 + i * 0.1 }));
        break;
      case 'hit': this.tone(240, 0.22, { to: 90, type: 'sawtooth', vol: 0.18 * q }); this.noise(0.12, { f: 700, vol: 0.14 * q }); break;
      case 'free': this.tone(500, 0.1, { to: 900, type: 'triangle', vol: 0.12 * q }); break;
      case 'bonk': this.tone(160, 0.1, { to: 80, type: 'triangle', vol: 0.2 * q }); break;
      case 'knock': this.noise(0.06, { f: 2200, vol: 0.14 * q }); this.tone(320, 0.06, { to: 200, vol: 0.07 * q }); break;
      case 'zoom': this.bark(0, 1); this.bark(0.12, 1.15); this.noise(0.4, { f: 400, to: 3000, filter: 'bandpass', vol: 0.14 * q, delay: 0.05 }); break;
      case 'yell': this.tone(620, 0.28, { to: 300, type: 'sawtooth', vol: 0.12 }); break;
      case 'windup': this.tone(1200, 0.07, { vol: 0.08 }); break;
      case 'swing': this.noise(0.18, { f: 3000, to: 600, filter: 'highpass', vol: 0.12 }); break;
      case 'throw': this.tone(700, 0.1, { to: 1000, type: 'triangle', vol: 0.07 }); break;
      case 'pop': this.noise(0.14, { f: 3000, vol: 0.4 }); this.tone(120, 0.12, { to: 50, vol: 0.2 }); break;
      case 'tag':
      case 'meow': this.tone(700, 0.16, { to: 1150, type: 'sine', vol: 0.14 }); this.tone(1150, 0.22, { to: 560, type: 'sine', vol: 0.14, delay: 0.16 }); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, { vol: 0.14, delay: i * 0.11 })); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.26, { type: 'triangle', vol: 0.14, delay: i * 0.16 })); break;
      case 'levelup': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
      case 'star': this.tone(1319, 0.18, { type: 'triangle', vol: 0.12 }); break;
    }
  }

  // A small looping chase tune.
  startMusic(tempo = 132) {
    if (!this.music || !this.ctx || this.timer) return;
    this.step = 0;
    this.tempo = tempo;
    this.nextT = this.ctx.currentTime + 0.08;
    if (!this.mus) {
      this.mus = this.ctx.createGain();
      this.mus.gain.value = 0.5;
      this.mus.connect(this.out);
    }
    this.timer = setInterval(() => this.schedule(), 70);
  }
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const bass = [65, 0, 131, 0, 98, 0, 98, 131, 55, 0, 110, 0, 87, 0, 98, 98];
    const lead = [523, 0, 659, 784, 0, 659, 523, 0, 587, 0, 784, 880, 0, 784, 659, 0, 523, 0, 659, 784, 0, 1047, 880, 0, 784, 659, 587, 0, 523, 0, 0, 0];
    const beat = 60 / this.tempo / 2;
    while (this.nextT < c.currentTime + 0.22) {
      const d = this.nextT - c.currentTime;
      const b = bass[this.step % bass.length], l = lead[this.step % lead.length];
      if (b) this.tone(b, beat * 0.9, { type: 'triangle', vol: 0.11, delay: d, dest: this.mus });
      if (l) this.tone(l, beat * 0.8, { type: 'square', vol: 0.035, delay: d, dest: this.mus });
      if (this.step % 2 === 0) this.tickHat(d);
      this.nextT += beat;
      this.step++;
    }
  }
  tickHat(delay) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 6000;
    g.gain.setValueAtTime(0.012, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    osc.connect(g);
    g.connect(this.mus);
    osc.start(t0);
    osc.stop(t0 + 0.04);
  }
}
