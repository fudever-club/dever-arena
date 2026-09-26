/**
 * @deprecated FROZEN 2026-09 — SFX removed from core CF loop.
 * Giữ file để legacy vanilla (js/app.js) không gãy import.
 * React SPA mới KHÔNG dùng module này (xóa khỏi Navbar/Landing/Standings/Hack).
 * DEVER-Forces Sound Synthesizer (Web Audio API)
 * Tạo âm thanh thi đấu eSports trực tiếp bằng thuật toán dao động sóng âm.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playBeep(freq, duration, type = 'sine') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Ignored
    }
  }

  // Âm thanh Accepted (AC) - 3 nốt cao tươi sáng
  playAccepted() {
    this.playBeep(523.25, 0.12, 'triangle'); // C5
    setTimeout(() => this.playBeep(659.25, 0.12, 'triangle'), 100); // E5
    setTimeout(() => this.playBeep(783.99, 0.25, 'triangle'), 200); // G5
  }

  // Âm thanh Hack thành công (+100đ) - Fanfare hào hùng
  playHackSuccess() {
    this.playBeep(440, 0.1, 'sawtooth');
    setTimeout(() => this.playBeep(554.37, 0.1, 'sawtooth'), 80);
    setTimeout(() => this.playBeep(659.25, 0.15, 'sawtooth'), 160);
    setTimeout(() => this.playBeep(880, 0.35, 'sawtooth'), 260);
  }

  // Âm thanh Hack xịt / Wrong Answer - Tiếng còi trầm cảnh báo
  playHackFailed() {
    this.playBeep(220, 0.18, 'sawtooth');
    setTimeout(() => this.playBeep(164.81, 0.28, 'sawtooth'), 150);
  }

  // Âm thanh Wrong Answer (WA) cho Sample Runner
  playWrongAnswer() {
    this.playHackFailed();
  }

  // Tiếng tích tắc đếm ngược
  playTick() {
    this.playBeep(800, 0.03, 'sine');
  }

  // Âm thanh Đóng băng bảng điểm (Freeze)
  playFreeze() {
    this.playBeep(987.77, 0.4, 'sine');
    setTimeout(() => this.playBeep(1318.51, 0.6, 'sine'), 120);
  }

  // Âm thanh Giải mã nhảy hạng (Dramatic Unfreeze Step)
  playUnfreezeStep() {
    this.playBeep(587.33, 0.1, 'triangle');
    setTimeout(() => this.playBeep(880.00, 0.2, 'triangle'), 80);
  }
}

export const sound = new SoundEngine();

