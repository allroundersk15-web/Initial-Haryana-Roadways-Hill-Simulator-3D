/**
 * 100% Procedural Web Audio Synthesizer + Authentic Hindi Crowd Voices for Indian Roadways Bus:
 * - Dynamic diesel engine thrum + turbo whine linked to RPM & load
 * - Iconic Indian Multi-Tone Melody Pressure Horn & Heavy Dual-Trumpet Air Horn
 * - Pneumatic door air hiss + conductor double brass bell + gear clunk + indicator relay
 * - Warm bus-cabin & bus-stop crowd chatter murmur + natural spoken Hindi passenger/conductor voices
 * - Landslide rock-clearing excavator rumble SFX
 */
export type CrowdChatterContext = 'bus_stop' | 'onboard' | 'landslide' | 'dhaba';

const HINDI_CROWD_LINES: Record<CrowdChatterContext, string[]> = {
  bus_stop: [
    'अरे भैया, बस आ गई, जल्दी चढ़ो!',
    'टिकट ले लो, टिकट ले लो, आगे आ जाओ!',
    'थोड़ा अंदर खिसको भाई साहब, पीछे जगह दो!',
    'ड्राइवर साहब, दो मिनट रुकना, सामान रख रहे हैं!',
    'अरे आराम से चढ़ो, सबको सीट मिल जाएगी!',
    'कंडक्टर भैया, दो टिकट आगे के देना!',
    'चलो भैया चलो, दरवाजा बंद होने वाला है!',
  ],
  onboard: [
    'भाई साहब, थोड़ी खिड़की खोल देना, पहाड़ की हवा आने दो!',
    'वाह, हिमाचल के पहाड़ कितने सुंदर लग रहे हैं!',
    'अगला स्टॉप ढाबा आएगा ना? गरमा-गरम चाय पीनी है!',
    'आराम से बैठो, आगे पहाड़ी मोड़ आ रहा है!',
    'बहुत बढ़िया बस चला रहे हैं ड्राइवर साहब!',
    'कंडक्टर साहब, अगला बस अड्डा कितनी दूर है?',
  ],
  landslide: [
    'अरे आगे पहाड़ से पत्थर गिरे हैं, एक तरफ से धीरे निकालो!',
    'भाई साहब, आगे लैंडस्लाइड है, रास्ता साफ करवा कर चलो!',
    'ट्रैफिक धीरे-धीरे निकल रहा है, ध्यान से चलाना!',
  ],
  dhaba: [
    'अरे छोटू, दो गरमा-गरम चाय और आलू परांठे जल्दी लाना!',
    'भाई साहब, बस यहीं पार्किंग में लगा दो, खाना खाकर चलेंगे!',
    'ताजा दाल तड़का और तंदूरी रोटी तैयार है, आ जाओ भाई साहब!',
    'अरे बाइक साइड में पार्क करो, बस आ रही है ढाबे पर!',
  ],
};

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

  // Continuous low-level crowd chatter murmur bed (vocal formant filtered noise)
  private crowdSource: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter1: BiquadFilterNode | null = null;
  private crowdFilter2: BiquadFilterNode | null = null;

  private melodyTimer: number | null = null;
  private melodyStep = 0;
  private melodyActive = false;
  private muted = false;
  private started = false;

  private lastSpeechAtMs = 0;
  private lastConductorSpeechAtMs = 0;
  private speechLineCursor: Record<CrowdChatterContext, number> = {
    bus_stop: 0,
    onboard: 0,
    landslide: 0,
    dhaba: 0,
  };
  private lastAirBrakeAtMs = 0;
  private cachedHindiVoice: SpeechSynthesisVoice | null = null;

  // Classic Indian highway multi-tone musical pressure horn sequence (Hz)
  private readonly melodyNotes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33];

  private pickHindiVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    if (this.cachedHindiVoice) return this.cachedHindiVoice;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    const hiVoice =
      voices.find((v) => /hi[-_]?IN/i.test(v.lang)) ||
      voices.find((v) => /hindi/i.test(v.name)) ||
      voices.find((v) => /en[-_]?IN/i.test(v.lang)) ||
      null;
    this.cachedHindiVoice = hiVoice;
    return hiVoice;
  }

  public init(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      this.airHornOsc1.frequency.value = 311.13;

      this.airHornOsc2 = this.ctx.createOscillator();
      this.airHornOsc2.type = 'sawtooth';
      this.airHornOsc2.frequency.value = 392.0;

      this.airHornOsc1.connect(airHornFilter);
      this.airHornOsc2.connect(airHornFilter);
      airHornFilter.connect(this.airHornGain);
      this.airHornGain.connect(this.masterGain);

      // Warm Procedural Crowd Chatter Murmur Loop (bandpass vocal formants + organic syllable modulation)
      const crowdLen = Math.floor(this.ctx.sampleRate * 3.0);
      const crowdBuf = this.ctx.createBuffer(1, crowdLen, this.ctx.sampleRate);
      const cData = crowdBuf.getChannelData(0);
      for (let i = 0; i < crowdLen; i++) {
        const t = i / this.ctx.sampleRate;
        // Organic multi-speaker syllable envelope modulation
        const mod =
          0.45 +
          0.25 * Math.sin(t * 21.0) +
          0.18 * Math.sin(t * 37.3 + 1.2) +
          0.12 * Math.cos(t * 13.7);
        cData[i] = (Math.random() * 2 - 1) * mod;
      }
      this.crowdSource = this.ctx.createBufferSource();
      this.crowdSource.buffer = crowdBuf;
      this.crowdSource.loop = true;

      this.crowdFilter1 = this.ctx.createBiquadFilter();
      this.crowdFilter1.type = 'bandpass';
      this.crowdFilter1.frequency.value = 520;
      this.crowdFilter1.Q.value = 2.2;

      this.crowdFilter2 = this.ctx.createBiquadFilter();
      this.crowdFilter2.type = 'bandpass';
      this.crowdFilter2.frequency.value = 1180;
      this.crowdFilter2.Q.value = 2.6;

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = 0;

      this.crowdSource.connect(this.crowdFilter1);
      this.crowdSource.connect(this.crowdFilter2);
      this.crowdFilter1.connect(this.crowdGain);
      this.crowdFilter2.connect(this.crowdGain);
      this.crowdGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.turboOsc.start();
      this.airHornOsc1.start();
      this.airHornOsc2.start();
      this.crowdSource.start();

      // Warm up Hindi voice discovery
      this.pickHindiVoice();
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
    if (mute && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Scales warm ambient passenger / bus-stop crowd murmur dynamically (0..1).
   */
  public updateCrowdAmbience(intensity: number, elapsedSec: number): void {
    if (!this.started || !this.ctx || !this.crowdGain || !this.crowdFilter1) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const now = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(this.muted ? 0 : clamped * 0.16, now, 0.25);
    // Gently shift vocal formant so crowd chatter sounds organic and alive
    this.crowdFilter1.frequency.setTargetAtTime(480 + Math.sin(elapsedSec * 1.9) * 95, now, 0.2);
  }

  /**
   * Speaks an authentic Hindi passenger/conductor crowd line when near people at a bus stand,
   * onboard with passengers, or encountering a mountain landslide jam (cooldown-throttled).
   */
  public triggerHindiCrowdVoice(context: CrowdChatterContext, minIntervalMs = 11500): void {
    if (this.muted || !this.started) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const now = Date.now();
    if (now - this.lastSpeechAtMs < minIntervalMs) return;
    if (window.speechSynthesis.speaking) return;

    const lines = HINDI_CROWD_LINES[context];
    const idx = this.speechLineCursor[context] % lines.length;
    this.speechLineCursor[context] = idx + 1;
    const phrase = lines[idx];

    try {
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'hi-IN';
      const voice = this.pickHindiVoice();
      if (voice) {
        utter.voice = voice;
      }
      utter.volume = context === 'bus_stop' ? 0.62 : 0.46;
      utter.rate = 0.96 + (idx % 3) * 0.06;
      utter.pitch = 0.88 + (idx % 4) * 0.1;
      this.lastSpeechAtMs = now;
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis blocked or unavailable — murmur bed still plays cleanly
    }
  }

  /**
   * Speaks a dynamic Hindi conductor announcement (e.g., "आ जाओ भाई आ जाओ! कालका से शिमला...")
   * or reverse-guiding instruction ("आने दो ड्राइवर साहब, आने दो!").
   */
  public speakConductorHindi(
    phrase: string,
    minIntervalMs = 5800,
    forceInterrupt = false
  ): boolean {
    if (this.muted || !this.started) return false;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const now = Date.now();
    if (now - this.lastConductorSpeechAtMs < minIntervalMs) return false;
    if (window.speechSynthesis.speaking) {
      if (!forceInterrupt) return false;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }

    try {
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'hi-IN';
      const voice = this.pickHindiVoice();
      if (voice) {
        utter.voice = voice;
      }
      utter.volume = 0.78;
      utter.rate = 1.02;
      utter.pitch = 0.94;
      this.lastConductorSpeechAtMs = now;
      this.lastSpeechAtMs = now;
      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      return false;
    }
  }

  public updateEngine(rpm: number, throttle: number, active: boolean): void {
    if (
      !this.started ||
      !this.ctx ||
      !this.engineOsc1 ||
      !this.engineOsc2 ||
      !this.engineFilter ||
      !this.engineGain ||
      !this.turboOsc ||
      !this.turboGain
    ) {
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
    this.turboGain.gain.setTargetAtTime(
      active ? Math.max(0, normRpm - 0.35) * 0.028 * throttle : 0,
      now,
      0.15
    );
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

  /**
   * Authentic Indian Heavy Bus Pneumatic Air-Brake Release Sound ("CHSSSSSSS!")
   * Synthesizes a pressurized exhaust valve pop + crisp layered compressed-air jet hiss with realistic decay tail.
   */
  public playAirBrakeRelease(intensity = 1.0): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastAirBrakeAtMs < 420) return;
    this.lastAirBrakeAtMs = nowMs;

    const clamped = Math.max(0.35, Math.min(1.25, intensity));
    const durationSec = 0.62 + clamped * 0.42;
    const now = this.ctx.currentTime;

    // 1. Sharp metallic air-valve exhaust pop ("CH-")
    const valveOsc = this.ctx.createOscillator();
    const valveGain = this.ctx.createGain();
    valveOsc.type = 'triangle';
    valveOsc.frequency.setValueAtTime(520, now);
    valveOsc.frequency.exponentialRampToValueAtTime(115, now + 0.048);
    valveGain.gain.setValueAtTime(0.22 * clamped, now);
    valveGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    valveOsc.connect(valveGain);
    valveGain.connect(this.masterGain);
    valveOsc.start(now);
    valveOsc.stop(now + 0.06);

    // 2. Pressurized compressed-air hiss ("-SSSSSSS") with dual resonant exhaust formants
    const sampleCount = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const p = i / sampleCount;
      // Fast attack, brief pressure sustain, then natural pneumatic decay tail
      const attack = Math.min(1, p * 36);
      const decay = Math.exp(-p * 3.15);
      const flutter = 0.88 + 0.12 * Math.sin(p * 42);
      data[i] = (Math.random() * 2 - 1) * attack * decay * flutter;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Core crisp air jet bandpass (sweeps downward slightly as chamber pressure drops)
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3400, now);
    bp.frequency.exponentialRampToValueAtTime(1450, now + durationSec);
    bp.Q.value = 1.45;

    // Bright upper sizzle highpass
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, now);

    const bpGain = this.ctx.createGain();
    bpGain.gain.setValueAtTime(0.42 * clamped, now);
    bpGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    const hpGain = this.ctx.createGain();
    hpGain.gain.setValueAtTime(0.24 * clamped, now);
    hpGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noise.connect(bp);
    noise.connect(hp);
    bp.connect(bpGain);
    hp.connect(hpGain);
    bpGain.connect(this.masterGain);
    hpGain.connect(this.masterGain);
    noise.start(now);
  }

  /**
   * Deep gravel/boulder rumble & hydraulic scoop sound when manually clearing a road landslide.
   */
  public playRockClear(durationSec = 0.95): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const sampleCount = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const env = Math.sin((i / sampleCount) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
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

  /**
   * Authentic Indian Bus Conductor Pea-Whistle (सीटी) synthesizer for guiding reverse maneuvers.
   * Uses high-frequency carrier + 36Hz pea-trill FM/AM warble + breath air hiss.
   */
  public playConductorWhistle(style: 'guide' | 'urgent' | 'double' = 'guide'): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;

    const blowBlast = (offsetSec: number, durationSec: number, baseFreq: number) => {
      if (!this.ctx || !this.masterGain) return;
      const start = this.ctx.currentTime + offsetSec;
      const end = start + durationSec;

      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(baseFreq * 0.94, start);
      carrier.frequency.linearRampToValueAtTime(baseFreq, start + 0.035);
      carrier.frequency.setValueAtTime(baseFreq, end - 0.04);
      carrier.frequency.linearRampToValueAtTime(baseFreq * 0.92, end);

      const overtone = this.ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(baseFreq * 2.02, start);

      // Classic pea-whistle warble LFO (~36 Hz FM modulation)
      const peaLfo = this.ctx.createOscillator();
      peaLfo.type = 'sine';
      peaLfo.frequency.setValueAtTime(style === 'urgent' ? 42 : 35, start);

      const peaDepth = this.ctx.createGain();
      peaDepth.gain.setValueAtTime(115, start);
      peaLfo.connect(peaDepth);
      peaDepth.connect(carrier.frequency);

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0.001, start);
      envGain.gain.linearRampToValueAtTime(0.24, start + 0.025);
      envGain.gain.setValueAtTime(0.22, Math.max(start + 0.03, end - 0.045));
      envGain.gain.exponentialRampToValueAtTime(0.001, end);

      const overGain = this.ctx.createGain();
      overGain.gain.value = 0.08;

      // Soft airy whistle breath hiss
      const breathLen = Math.max(128, Math.floor(this.ctx.sampleRate * durationSec));
      const breathBuf = this.ctx.createBuffer(1, breathLen, this.ctx.sampleRate);
      const bData = breathBuf.getChannelData(0);
      for (let i = 0; i < breathLen; i++) {
        bData[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const breathSrc = this.ctx.createBufferSource();
      breathSrc.buffer = breathBuf;
      const breathFilter = this.ctx.createBiquadFilter();
      breathFilter.type = 'bandpass';
      breathFilter.frequency.setValueAtTime(baseFreq, start);
      breathFilter.Q.value = 4.5;

      carrier.connect(envGain);
      overtone.connect(overGain);
      overGain.connect(envGain);
      breathSrc.connect(breathFilter);
      breathFilter.connect(envGain);
      envGain.connect(this.masterGain);

      carrier.start(start);
      overtone.start(start);
      peaLfo.start(start);
      breathSrc.start(start);

      carrier.stop(end + 0.02);
      overtone.stop(end + 0.02);
      peaLfo.stop(end + 0.02);
      breathSrc.stop(end + 0.02);
    };

    if (style === 'urgent') {
      blowBlast(0, 0.16, 3020);
      blowBlast(0.21, 0.16, 3080);
      blowBlast(0.42, 0.22, 3140);
    } else if (style === 'double') {
      blowBlast(0, 0.22, 2860);
      blowBlast(0.28, 0.28, 2940);
    } else {
      blowBlast(0, 0.44, 2820);
    }
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }
}
