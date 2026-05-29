class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;

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
   * Play a clean message notification beep (high pitch ping)
   */
  public playMessageNotification() {
    try {
      const context = this.getContext();
      const now = context.currentTime;
      
      const osc = context.createOscillator();
      const gain = context.createGain();
      
      osc.type = "sine";
      // Dual-frequency ping for a sweet notification pop
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.05); // A5
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(context.destination);
      
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // AudioContext blocked or not supported
    }
  }

  /**
   * Play outgoing call dialing sound (low double tone)
   */
  public startDialingTone() {
    try {
      const context = this.getContext();
      this.stopRingtone(); // Safety clear

      const playDialStep = () => {
        const now = context.currentTime;
        
        // standard US dial ringback tone is 440Hz + 480Hz combined
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
   * Play incoming call ringtone (Bengali/Standard telephone ring chime)
   */
  public startIncomingRingtone() {
    try {
      const context = this.getContext();
      this.stopRingtone();

      const playRingStep = () => {
        const now = context.currentTime;
        
        const playTone = (freq: number, startOffset: number, duration: number) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + startOffset);
          
          gain.gain.setValueAtTime(0, now + startOffset);
          gain.gain.linearRampToValueAtTime(0.05, now + startOffset + 0.05);
          gain.gain.setValueAtTime(0.05, now + startOffset + duration - 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
          
          osc.connect(gain);
          gain.connect(context.destination);
          
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration);
        };

        // Ring cycle: ring-ring -- gap
        playTone(659.25, 0, 0.45);   // E5
        playTone(783.99, 0.1, 0.45); // G5
        playTone(659.25, 0.6, 0.45);
        playTone(783.99, 0.7, 0.45);
      };

      playRingStep();
      this.ringtoneInterval = window.setInterval(playRingStep, 3000);
    } catch (e) {}
  }

  /**
   * Stop ringtones / dialings
   */
  public stopRingtone() {
    if (this.ringtoneInterval) {
      window.clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
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
