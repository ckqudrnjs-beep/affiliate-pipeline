// 효과음: 음원 파일 없이 Web Audio로 합성(저작권 걱정 없음, 용량 0).
export class Sfx {
  constructor() { this.ctx = null; this.on = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.55;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 잔향
    const ir = c.createBuffer(2, c.sampleRate * 1.8, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2); }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.32;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
  }
  _n(t0, dur, f, q, gain, type = 'bandpass', send = 0) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master); if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.verb); }
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }
  _o(t0, dur, f0, f1, gain, type = 'sine') {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  ok() { return this.ctx && this.on; }
  shot(kind) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    if (kind === 'sniper') {
      this._n(t, 0.08, 3200, 0.6, 1.1, 'bandpass', 0.6);
      this._n(t, 0.55, 700, 0.5, 1.2, 'lowpass', 0.9);
      this._o(t, 0.35, 120, 38, 1.0);
    } else {
      this._n(t, 0.05, 2600 + Math.random() * 600, 0.7, 0.75, 'bandpass', 0.25);
      this._n(t, 0.16, 900, 0.6, 0.6, 'lowpass', 0.35);
      this._o(t, 0.12, 150, 50, 0.55);
    }
  }
  click() { if (!this.ok()) return; const t = this.ctx.currentTime; this._n(t, 0.03, 4000, 3, 0.4, 'highpass'); }
  bolt() { if (!this.ok()) return; const t = this.ctx.currentTime; this._n(t + 0.1, 0.05, 2500, 4, 0.5); this._n(t + 0.32, 0.06, 1800, 4, 0.55); this._n(t + 0.58, 0.04, 3000, 5, 0.45); }
  reload(dur) { if (!this.ok()) return; const t = this.ctx.currentTime; this._n(t + 0.15, 0.05, 1500, 4, 0.5); this._n(t + dur * 0.55, 0.06, 2200, 4, 0.55); this._n(t + dur * 0.85, 0.05, 3000, 5, 0.5); }
  ding(delay = 0, hi = false) { if (!this.ok()) return; const t = this.ctx.currentTime + delay; const f = hi ? 1650 : 1250; this._o(t, 0.4, f, f * 0.98, 0.32); this._o(t, 0.25, f * 1.5, f * 1.5, 0.12); }
  boom(delay = 0) { if (!this.ok()) return; const t = this.ctx.currentTime + delay; this._n(t, 0.4, 500, 0.6, 0.9, 'lowpass', 0.5); this._o(t, 0.3, 90, 30, 0.6); this._o(t, 0.25, 900, 300, 0.15, 'square'); }
  coin() { if (!this.ok()) return; const t = this.ctx.currentTime; this._o(t, 0.09, 988, 988, 0.22, 'square'); this._o(t + 0.08, 0.3, 1319, 1319, 0.22, 'square'); }
  beep(hi) { if (!this.ok()) return; const t = this.ctx.currentTime; this._o(t, 0.12, hi ? 1320 : 660, hi ? 1320 : 660, 0.22, 'square'); }
}
