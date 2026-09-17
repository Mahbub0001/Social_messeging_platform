export interface RingtoneOption {
  id: string;
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
}

export const RINGTONE_OPTIONS: RingtoneOption[] = [
  {
    id: "classic",
    nameEn: "Classic Bell",
    nameBn: "ক্লাসিক বেল",
    descriptionEn: "Traditional telephone dual-tone ring",
    descriptionBn: "ঐতিহ্যবাহী টেলিফোন রিংটোন",
  },
  {
    id: "marimba",
    nameEn: "Marimba Pop",
    nameBn: "মারিম্বা পপ",
    descriptionEn: "Lively, modern wooden marimba melody",
    descriptionBn: "আনন্দময় মারিম্বা সুর",
  },
  {
    id: "cyber",
    nameEn: "Cyber Wave",
    nameBn: "সাইবার ওয়েভ",
    descriptionEn: "Futuristic crystal electronic chime",
    descriptionBn: "আধুনিক ডিজিটাল সাইবার রিং",
  },
  {
    id: "flute",
    nameEn: "Bengal Flute",
    nameBn: "বাঁশির সুর",
    descriptionEn: "Soothing melodious flute tune",
    descriptionBn: "মনোরম মিষ্টি বাঁশির সুর",
  },
  {
    id: "gentle",
    nameEn: "Gentle Music Box",
    nameBn: "মিউজিক বক্স",
    descriptionEn: "Calm and relaxing twilight lullaby",
    descriptionBn: "শান্ত ও মিষ্টি মিউজিক বক্স",
  },
];

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;
  private previewTimeout: number | null = null;
  private currentlyPlayingId: string | null = null;

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Helper to synthesize an individual note
   */
  private playNote(
    context: AudioContext,
    freq: number,
    type: OscillatorType,
    startOffset: number,
    duration: number,
    gainLevel: number = 0.06
  ) {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.linearRampToValueAtTime(gainLevel, now + startOffset + 0.03);
    gain.gain.setValueAtTime(gainLevel, now + startOffset + duration - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration);
  }

  /**
   * Play a clean message notification beep (high pitch ping)
   */
  public playMessageNotification() {
    try {
      const context = this.getContext();
      const now = context.currentTime;
      
      const osc = context.createOscillator();
      const gain = context.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.05); // A5
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(context.destination);
      
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  /**
   * Play outgoing call dialing sound (low double tone)
   */
  public startDialingTone() {
    try {
      const context = this.getContext();
      this.stopRingtone();

      const playDialStep = () => {
        const now = context.currentTime;
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const gain = context.createGain();
        
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gain.gain.setValueAtTime(0.04, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(context.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      };

      playDialStep();
      this.ringtoneInterval = window.setInterval(playDialStep, 4000);
    } catch (e) {}
  }

  /**
   * Play one musical cycle of the given ringtone preset
   */
  private playRingtoneStep(context: AudioContext, ringtoneId: string) {
    switch (ringtoneId) {
      case "marimba": {
        // Modern warm wooden marimba sequence: C5, E5, G5, A5, C6, A5
        this.playNote(context, 523.25, "sine", 0.0, 0.22, 0.07);
        this.playNote(context, 659.25, "sine", 0.16, 0.22, 0.07);
        this.playNote(context, 783.99, "triangle", 0.32, 0.22, 0.08);
        this.playNote(context, 880.00, "triangle", 0.48, 0.24, 0.08);
        this.playNote(context, 1046.50, "sine", 0.68, 0.28, 0.09);
        this.playNote(context, 880.00, "sine", 0.92, 0.35, 0.07);
        break;
      }
      case "cyber": {
        // Crystal electronic chime: A4, E5, B5, E6
        this.playNote(context, 440.00, "sawtooth", 0.0, 0.25, 0.04);
        this.playNote(context, 659.25, "sine", 0.15, 0.25, 0.06);
        this.playNote(context, 987.77, "triangle", 0.32, 0.30, 0.07);
        this.playNote(context, 1318.51, "sine", 0.52, 0.45, 0.08);
        this.playNote(context, 987.77, "triangle", 0.85, 0.35, 0.06);
        break;
      }
      case "flute": {
        // Bengali melodic bansuri/flute arpeggio: D5, F#5, A5, B5, D6
        this.playNote(context, 587.33, "sine", 0.0, 0.35, 0.06);
        this.playNote(context, 739.99, "sine", 0.22, 0.35, 0.065);
        this.playNote(context, 880.00, "sine", 0.45, 0.38, 0.07);
        this.playNote(context, 987.77, "triangle", 0.70, 0.42, 0.075);
        this.playNote(context, 1174.66, "sine", 1.00, 0.55, 0.08);
        this.playNote(context, 880.00, "sine", 1.35, 0.45, 0.06);
        break;
      }
      case "gentle": {
        // Gentle Twilight music box: G4, B4, D5, G5, E5, D5
        this.playNote(context, 392.00, "triangle", 0.0, 0.35, 0.06);
        this.playNote(context, 493.88, "triangle", 0.25, 0.35, 0.065);
        this.playNote(context, 587.33, "sine", 0.50, 0.38, 0.07);
        this.playNote(context, 783.99, "sine", 0.75, 0.42, 0.075);
        this.playNote(context, 659.25, "triangle", 1.05, 0.45, 0.07);
        this.playNote(context, 587.33, "sine", 1.38, 0.50, 0.06);
        break;
      }
      case "classic":
      default: {
        // Classic telephone dual-tone ring
        this.playNote(context, 659.25, "triangle", 0.0, 0.45, 0.06);
        this.playNote(context, 783.99, "triangle", 0.1, 0.45, 0.06);
        this.playNote(context, 659.25, "triangle", 0.6, 0.45, 0.06);
        this.playNote(context, 783.99, "triangle", 0.7, 0.45, 0.06);
        break;
      }
    }
  }

  /**
   * Play incoming call ringtone continuously using the selected or saved ringtone
   */
  public startIncomingRingtone(customRingtoneId?: string) {
    try {
      const context = this.getContext();
      this.stopRingtone();

      const ringtoneId = customRingtoneId || localStorage.getItem("kb_ringtone") || "classic";
      this.currentlyPlayingId = ringtoneId;

      const intervalMs = ringtoneId === "marimba" ? 2400 : ringtoneId === "flute" || ringtoneId === "gentle" ? 3200 : 2800;

      this.playRingtoneStep(context, ringtoneId);
      this.ringtoneInterval = window.setInterval(() => {
        this.playRingtoneStep(context, ringtoneId);
      }, intervalMs);
    } catch (e) {}
  }

  /**
   * Preview a ringtone once in Settings
   */
  public previewRingtone(ringtoneId: string, onFinish?: () => void) {
    try {
      const context = this.getContext();
      this.stopRingtone();

      this.currentlyPlayingId = ringtoneId;
      this.playRingtoneStep(context, ringtoneId);

      const durationMs = ringtoneId === "flute" || ringtoneId === "gentle" ? 2200 : 1600;
      this.previewTimeout = window.setTimeout(() => {
        this.currentlyPlayingId = null;
        if (onFinish) onFinish();
      }, durationMs);
    } catch (e) {
      if (onFinish) onFinish();
    }
  }

  /**
   * Get currently playing ringtone ID (or null)
   */
  public getPlayingId(): string | null {
    return this.currentlyPlayingId;
  }

  /**
   * Stop ringtones / preview / dialings
   */
  public stopRingtone() {
    if (this.ringtoneInterval) {
      window.clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.previewTimeout) {
      window.clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.currentlyPlayingId = null;
  }

  /**
   * Play simple chime when call is connected
   */
  public playConnectChime() {
    try {
      const context = this.getContext();
      const now = context.currentTime;
      
      const playTone = (freq: number, start: number) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.04, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.2);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.2);
      };

      playTone(523.25, 0);   // C5
      playTone(659.25, 0.1); // E5
      playTone(783.99, 0.2); // G5
    } catch (e) {}
  }

  /**
   * Play simple downward chime when call disconnects
   */
  public playDisconnectChime() {
    try {
      const context = this.getContext();
      const now = context.currentTime;
      
      const playTone = (freq: number, start: number) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.04, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.2);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.2);
      };

      playTone(783.99, 0);   // G5
      playTone(659.25, 0.1); // E5
      playTone(523.25, 0.2); // C5
    } catch (e) {}
  }
}

export const audioSynthesizer = new AudioSynthesizer();
export default audioSynthesizer;
