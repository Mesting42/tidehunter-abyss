import type { Settings } from "../types";
/** 所有声响由本地 Web Audio 合成。首次手势创建音频上下文，后台挂起，不持续泄漏节点。 */
export class Audio {
  ctx: AudioContext | null = null;
  music: GainNode | null = null;
  effects: GainNode | null = null;
  oscillators: OscillatorNode[] = [];
  settings: Settings;
  pulse = 0;
  beat = 0;
  paused = false;
  constructor(s: Settings) {
    this.settings = s;
  }
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.music = this.ctx.createGain();
      this.effects = this.ctx.createGain();
      this.music.connect(this.ctx.destination);
      this.effects.connect(this.ctx.destination);
      for (const [f, v] of [
        [47, 0.15],
        [71, 0.07],
        [94.3, 0.03],
      ]) {
        const o = this.ctx.createOscillator(),
          g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.value = v;
        o.connect(g).connect(this.music);
        o.start();
        this.oscillators.push(o);
      }
      this.apply();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  apply() {
    if (this.music) this.music.gain.value = this.settings.music * 0.35;
    if (this.effects) this.effects.gain.value = this.settings.sfx * 0.34;
  }
  suspend() {
    this.paused = true;
    void this.ctx?.suspend();
  }
  resume() {
    this.paused = false;
    void this.ctx?.resume();
  }
  tone(
    f: number,
    duration: number,
    type: OscillatorType = "sine",
    vol = 0.25,
    end?: number,
    music = false,
  ) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, c.currentTime);
    if (end)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(15, end),
        c.currentTime + duration,
      );
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect((music ? this.music : this.effects)!);
    o.start();
    o.stop(c.currentTime + duration + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noise(duration: number, vol = 0.3, frequency = 700) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const b = c.createBuffer(1, c.sampleRate * duration, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = b;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.value = vol;
    source.connect(filter).connect(gain).connect(this.effects!);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  play(id: string) {
    switch (id) {
      case "eat":
        this.tone(155, 0.13, "triangle", 0.36, 64);
        this.noise(0.08, 0.12, 900);
        break;
      case "bite":
        this.noise(0.16, 0.2, 350);
        break;
      case "boost":
        this.noise(0.45, 0.2, 480);
        break;
      case "splash":
        this.noise(0.7, 0.5, 1700);
        this.tone(90, 0.35, "sine", 0.2, 40);
        break;
      case "hit":
        this.noise(0.18, 0.4, 290);
        this.tone(62, 0.3, "sawtooth", 0.12, 35);
        break;
      case "break":
        this.noise(0.45, 0.45, 1300);
        break;
      case "warning":
        this.tone(360, 0.19, "triangle", 0.2, 480);
        break;
      case "rage":
        this.tone(65, 1, "sawtooth", 0.16, 180);
        this.tone(290, 1.2, "sine", 0.22, 580);
        break;
      case "rageEnd":
        this.tone(220, 0.8, "triangle", 0.2, 65);
        break;
      case "boss":
        this.tone(35, 1.4, "sawtooth", 0.3, 60);
        this.noise(1, 0.3, 260);
        break;
      case "task":
      case "collect":
        this.tone(392, 0.25, "sine", 0.35);
        setTimeout(() => this.tone(587, 0.4, "sine", 0.25), 120);
        break;
      case "win":
        [196, 247, 294, 392, 494].forEach((f, i) =>
          setTimeout(() => this.tone(f, 1.3, "sine", 0.24), i * 140),
        );
        break;
      case "fail":
        this.tone(150, 1.5, "triangle", 0.22, 38);
        break;
      case "skill":
        this.tone(140, 0.7, "sine", 0.35, 620);
        break;
    }
  }
  update(dt: number, depth: number, rage: boolean) {
    this.pulse -= dt;
    if (this.pulse <= 0) {
      this.pulse = rage ? 0.26 : 1.1;
      const notes = rage
        ? [98, 147, 196, 174]
        : depth > 310
          ? [73.4, 110, 146.8, 98]
          : [130.8, 196, 164.8, 146.8];
      this.tone(
        notes[this.beat++ % 4],
        rage ? 0.2 : 1.5,
        "sine",
        rage ? 0.12 : 0.06,
        undefined,
        true,
      );
      if (rage) this.tone(48, 0.15, "triangle", 0.3, 30, true);
    }
  }
}
