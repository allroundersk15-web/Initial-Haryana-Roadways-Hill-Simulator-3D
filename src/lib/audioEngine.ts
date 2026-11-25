/**
 * 100% Procedural Web Audio Synthesizer for Haryana Roadways BS6 Bus Acoustics:
 * - Dynamic diesel engine thrum + turbo whine linked to RPM & load
 * - Iconic Indian Multi-Tone Melody Pressure Horn ("Dhoom / Punjabi Roadways Melody")
 * - Heavy Dual-Trumpet Mountain Air Horn (blind hairpin warning)
 * - Pneumatic door air hiss + air brake psshh + conductor double brass bell + indicator relay
 */
export class IndianBusAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private turboGain: GainNode | null = null;

  private airHornOsc1: OscillatorNode | null = null;
  private airHornOsc2: OscillatorNode | null = null;
  private airHornGain: GainNode | null = null;

  private melodyTimer: number | null = null;
  private melodyStep = 0;
  private melodyActive = false;
  private muted = false;
  private started = false;

  // Classic Indian highway multi-tone musical pressure horn sequence (Hz)
  private readonly melodyNotes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33];

  public init(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.48;
      this.masterGain.connect(this.ctx.destination);

      // Diesel engine synth (BS6 inline-6 low-end chug + harmonic growl)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;
      this.engineFilter.Q.value = 2.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 42;

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 84.5;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      // Turbocharger subtle whine
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 950;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);

      // Twin-trumpet Air Pressure Horn
      const airHornFilter = this.ctx.createBiquadFilter();
      airHornFilter.type = 'bandpass';
      airHornFilter.frequency.value = 780;
      airHornFilter.Q.value = 1.6;

      this.airHornGain = this.ctx.createGain();
      this.airHornGain.gain.value = 0;

      this.airHornOsc1 = this.ctx.createOscillator();
      this.airHornOsc1.type = 'sawtooth';
      this.airHornOsc1.frequency.value = 311.13; // Eb4

      this.airHornOsc2 = this.ctx.createOscillator();
      this.airHornOsc2.type = 'sawtooth';
      this.airHornOsc2.frequency.value = 392.0; // G4 (classic Indian truck/bus interval)

      this.airHornOsc1.connect(airHornFilter);
      this.airHornOsc2.connect(airHornFilter);
      airHornFilter.connect(this.airHornGain);
      this.airHornGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.turboOsc.start();
      this.airHornOsc1.start();
      this.airHornOsc2.start();

      this.started = true;
    } catch {
      // AudioContext unavailable in restricted environments
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.48, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateEngine(rpm: number, throttle: number, active: boolean): void {
    if (!this.started || !this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.turboOsc || !this.turboGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const normRpm = Math.max(0, Math.min(1, (rpm - 650) / 2150));
    const baseFreq = 36 + normRpm * 78;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(140 + normRpm * 420 + throttle * 180, now, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.14 + throttle * 0.12 : 0.02, now, 0.1);

    this.turboOsc.frequency.setTargetAtTime(880 + normRpm * 1450, now, 0.12);
    this.turboGain.gain.setTargetAtTime(active ? Math.max(0, normRpm - 0.35) * 0.028 * throttle : 0, now, 0.15);
  }

  public setAirHorn(on: boolean): void {
    if (on) this.init();
    if (!this.ctx || !this.airHornGain) return;
    const now = this.ctx.currentTime;
    this.airHornGain.gain.setTargetAtTime(on ? 0.34 : 0, now, on ? 0.025 : 0.06);
  }

  public setMelodyHorn(on: boolean): void {
    if (on) this.init();
    if (on === this.melodyActive) return;
    this.melodyActive = on;
    if (on) {
      this.playMelodyNote();
      this.melodyTimer = window.setInterval(() => {
        if (this.melodyActive) {
          this.playMelodyNote();
        }
      }, 145);
    } else if (this.melodyTimer !== null) {
      window.clearInterval(this.melodyTimer);
      this.melodyTimer = null;
    }
  }

  private playMelodyNote(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freq = this.melodyNotes[this.melodyStep % this.melodyNotes.length];
    this.melodyStep++;

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'square';
    oscA.frequency.setValueAtTime(freq, now);
    oscB.frequency.setValueAtTime(freq * 1.006, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2.1, now);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.135);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.145);
    oscB.stop(now + 0.145);
  }

  public playPneumaticHiss(durationSec = 0.55): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const sampleCount = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  public playConductorBell(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const playDing = (offsetSec: number) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + offsetSec;
      const osc = this.ctx.createOscillator();
      const harmonic = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      harmonic.type = 'triangle';
      osc.frequency.setValueAtTime(2280, now);
      harmonic.frequency.setValueAtTime(4560, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      harmonic.start(now);
      osc.stop(now + 0.38);
      harmonic.stop(now + 0.38);
    };
    playDing(0);
    playDing(0.17);
  }

  public playIndicatorClick(): void {
    if (!this.started || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playBump(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playGearShift(isReverse = false): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Mechanical synchromesh detent clunk
    const clunk = this.ctx.createOscillator();
    const clunkGain = this.ctx.createGain();
    clunk.type = 'triangle';
    clunk.frequency.setValueAtTime(isReverse ? 210 : 280, now);
    clunk.frequency.exponentialRampToValueAtTime(88, now + 0.065);
    clunkGain.gain.setValueAtTime(0.22, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    clunk.connect(clunkGain);
    clunkGain.connect(this.masterGain);
    clunk.start(now);
    clunk.stop(now + 0.08);

    // Metallic latch tick
    const tick = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    tick.type = 'square';
    tick.frequency.setValueAtTime(isReverse ? 640 : 860, now + 0.025);
    tickGain.gain.setValueAtTime(0.06, now + 0.025);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    tick.connect(tickGain);
    tickGain.connect(this.masterGain);
    tick.start(now + 0.025);
    tick.stop(now + 0.06);
  }

  public dispose(): void {
    this.setMelodyHorn(false);
    this.setAirHorn(false);
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }
}
