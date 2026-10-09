/**
 * Oxford 5000 Vocab Master - Audio Engine
 * Supports authentic native MP3 pronunciation, Web Speech API fallback/offline synthesis,
 * variable speed playback (0.75x - 1.25x), and Web Audio API synthesized sound effects.
 */

class AudioEngine {
  constructor() {
    this.currentAudio = null;
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.speed = 1.0;
    this.audioCtx = null;

    if (this.synth) {
      this._loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this._loadVoices();
      }
    }
  }

  _loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  _getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setSpeed(speedVal) {
    this.speed = parseFloat(speedVal) || 1.0;
  }

  /**
   * Play word pronunciation in British (uk) or American (us) accent
   * @param {string} word 
   * @param {'us'|'uk'} accent 
   * @param {HTMLElement} [buttonEl] - Optional button to show playing state
   * @param {number} [customRate] - Optional custom playback speed
   */
  async playWord(word, accent = 'us', buttonEl = null, customRate = null) {
    if (!word) return;
    const cleanWord = word.trim().toLowerCase();
    const rate = customRate || this.speed;

    if (buttonEl) {
      buttonEl.classList.add('playing');
    }

    const removePlaying = () => {
      if (buttonEl) buttonEl.classList.remove('playing');
    };

    // Stop existing audio
    this.stop();

    // Type 1 = UK, Type 2 = US
    const typeCode = accent.toLowerCase() === 'uk' ? '1' : '2';
    const primaryUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=${typeCode}`;

    try {
      const audio = new Audio(primaryUrl);
      this.currentAudio = audio;
      audio.playbackRate = rate;

      // Timeout for network fallback
      const playPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          audio.pause();
          reject(new Error('Audio load timeout'));
        }, 3500);

        audio.onended = () => {
          clearTimeout(timer);
          removePlaying();
          resolve();
        };

        audio.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Network audio error'));
        };

        audio.play().catch(reject);
      });

      await playPromise;
    } catch (err) {
      // Fallback to Web Speech API
      this._speakSpeechSynth(cleanWord, accent, rate, removePlaying);
    }
  }

  _speakSpeechSynth(text, accent, rate, onEndCallback) {
    if (!this.synth) {
      if (onEndCallback) onEndCallback();
      return;
    }

    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = accent.toLowerCase() === 'uk' ? 'en-GB' : 'en-US';
    utterance.lang = targetLang;
    utterance.rate = rate;

    // Pick best matching voice
    if (this.voices.length > 0) {
      const matchingVoice = this.voices.find(v => v.lang.replace('_', '-').startsWith(targetLang));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
    }

    utterance.onend = () => {
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      if (onEndCallback) onEndCallback();
    };

    this.synth.speak(utterance);
  }

  /**
   * Speak arbitrary text (e.g. example sentence or Thai explanation)
   */
  speakSentence(text, lang = 'en-US', rate = 0.95) {
    if (!this.synth || !text) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;

    if (this.voices.length > 0) {
      const match = this.voices.find(v => v.lang.replace('_', '-').startsWith(lang));
      if (match) utterance.voice = match;
    }

    this.synth.speak(utterance);
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
  }

  // --- Synthesized Sound Effects using Web Audio API ---

  playCorrectSound() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  playWrongSound() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.setValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playFlipSound() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }
}

// Global instance
window.audioEngine = new AudioEngine();
