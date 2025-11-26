// Simple sound effects utility
export class SoundEffects {
  private audioContext: AudioContext | null = null;

  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn("AudioContext not available");
    }
  }

  private playTone(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Failed to play sound:", error);
    }
  }

  messageReceived() {
    this.playTone(800, 0.1, 0.2);
  }

  userJoined() {
    this.playTone(600, 0.15, 0.2);
  }

  userLeft() {
    this.playTone(400, 0.15, 0.2);
  }

  notification() {
    this.playTone(1000, 0.1, 0.2);
  }

  emfPulse() {
    // Rapid beeping that gets faster
    this.playTone(1200, 0.05, 0.3);
    setTimeout(() => this.playTone(1200, 0.05, 0.3), 100);
    setTimeout(() => this.playTone(1200, 0.05, 0.3), 180);
  }

  spiritBoxStatic() {
    // Spooky white noise-like effect with sweeping tones
    this.playTone(300, 0.3, 0.2);
    setTimeout(() => this.playTone(600, 0.2, 0.15), 150);
    setTimeout(() => this.playTone(900, 0.2, 0.15), 300);
  }

  thermalCold() {
    // Low, ominous tone
    this.playTone(150, 0.4, 0.3);
  }

  thermalHot() {
    // High, alarming tone
    this.playTone(1400, 0.3, 0.3);
  }

  parabolicMic() {
    // Eerie scanning tone
    this.playTone(200, 0.1, 0.2);
    setTimeout(() => this.playTone(300, 0.1, 0.2), 80);
    setTimeout(() => this.playTone(400, 0.2, 0.2), 160);
  }
}

export const soundEffects = new SoundEffects();
