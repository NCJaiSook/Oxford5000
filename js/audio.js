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
    this._playId = 0;
    this._currentTimer = null;
    this._activeResolve = null;

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

    // Stop existing audio and increment playback token
    this.stop();
    const playId = ++this._playId;

    if (buttonEl) {
      buttonEl.classList.add('playing');
    }

    const removePlaying = () => {
      if (buttonEl) buttonEl.classList.remove('playing');
    };

    // Type 1 = UK, Type 2 = US
    const typeCode = accent.toLowerCase() === 'uk' ? '1' : '2';
    const primaryUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=${typeCode}`;

    try {
      const audio = new Audio(primaryUrl);
      this.currentAudio = audio;
      audio.playbackRate = rate;

      await new Promise((resolve, reject) => {
        this._activeResolve = () => {
          removePlaying();
          resolve();
        };

        this._currentTimer = setTimeout(() => {
          audio.pause();
          reject(new Error('Audio load timeout'));
        }, 3500);

        audio.onended = () => {
          clearTimeout(this._currentTimer);
          this._activeResolve = null;
          removePlaying();
          resolve();
        };

        audio.onerror = () => {
          clearTimeout(this._currentTimer);
          this._activeResolve = null;
          reject(new Error('Network audio error'));
        };

        audio.play().catch(err => {
          clearTimeout(this._currentTimer);
          this._activeResolve = null;
          reject(err);
        });
      });
    } catch (err) {
      // Only fallback to Web Speech API if this playback wasn't cancelled by stop()
      if (playId === this._playId) {
        await this._speakSpeechSynth(cleanWord, accent, rate, removePlaying, playId);
      } else {
        removePlaying();
      }
    }
  }

  _speakSpeechSynth(text, accent, rate, onEndCallback, playId) {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(this._currentTimer);
        this._activeResolve = null;
        if (onEndCallback) onEndCallback();
        resolve();
      };

      if (!this.synth || (playId && playId !== this._playId)) {
        finish();
        return;
      }

      this._activeResolve = finish;
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = accent.toLowerCase() === 'uk' ? 'en-GB' : 'en-US';
      utterance.lang = targetLang;
      utterance.rate = rate;

      if (this.voices.length === 0) this._loadVoices();
      if (this.voices.length > 0) {
        const matchingVoice = this.voices.find(v => v.lang.replace('_', '-').startsWith(targetLang));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onend = finish;
      utterance.onerror = finish;

      // Safety timeout in case SpeechSynthesis onend fails to fire
      this._currentTimer = setTimeout(finish, 4500);
      this.synth.speak(utterance);
    });
  }

  /**
   * Speak arbitrary text (e.g. example sentence or Thai explanation)
   * Returns a Promise that resolves when speech finishes or is stopped.
   */
  speakSentence(text, lang = 'en-US', rate = 0.95, buttonEl = null) {
    this.stop();
    const playId = ++this._playId;

    return new Promise((resolve) => {
      if (!this.synth || !text) {
        resolve();
        return;
      }

      if (buttonEl) buttonEl.classList.add('playing');

      const finish = () => {
        clearTimeout(this._currentTimer);
        this._activeResolve = null;
        if (buttonEl) buttonEl.classList.remove('playing');
        resolve();
      };

      this._activeResolve = finish;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      if (this.voices.length === 0) this._loadVoices();
      if (this.voices.length > 0) {
        const match = this.voices.find(v => v.lang.replace('_', '-').startsWith(lang));
        if (match) utterance.voice = match;
      }

      utterance.onend = finish;
      utterance.onerror = finish;

      // Dynamic safety timeout based on text length
      const maxWaitMs = Math.min(12000, Math.max(3500, text.length * 140));
      this._currentTimer = setTimeout(finish, maxWaitMs);

      if (playId === this._playId) {
        this.synth.speak(utterance);
      } else {
        finish();
      }
    });
  }

  stop() {
    this._playId++;
    if (this._currentTimer) {
      clearTimeout(this._currentTimer);
      this._currentTimer = null;
    }
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    if (this._activeResolve) {
      const res = this._activeResolve;
      this._activeResolve = null;
      res();
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
