/**
 * Oxford 5000 Vocab Master - Continuous Hands-Free Audio Player
 * Auto-plays vocabulary words in sequence for passive listening and pronunciation practice.
 */

class AudioPlaylistPlayer {
  constructor() {
    this.container = null;
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.timer = null;

    // Settings
    this.accentMode = 'both'; // 'us' | 'uk' | 'both'
    this.speakMeaning = true;
    this.delaySeconds = 2.0;
    this.speed = 1.0;
    this.isShuffled = false;
    this.isLooping = true;

    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterStatus = 'all';
  }

  init(containerEl) {
    this.container = containerEl;
    this.buildPlaylist();
    this.render();
  }

  buildPlaylist() {
    if (!window.vocabData || window.vocabData.length === 0) {
      this.playlist = [];
      return;
    }

    let list = window.vocabData.filter(item => {
      if (this.filterCefr !== 'all' && item.cefr.toUpperCase() !== this.filterCefr.toUpperCase()) {
        return false;
      }
      if (this.filterTopic !== 'all' && item.topic !== this.filterTopic) {
        return false;
      }
      if (this.filterStatus === 'bookmarked' && !window.storageMgr.isBookmarked(item.id)) {
        return false;
      }
      if (this.filterStatus === 'learning' && !window.storageMgr.isLearning(item.id)) {
        return false;
      }
      if (this.filterStatus === 'unlearned' && window.storageMgr.isMastered(item.id)) {
        return false;
      }
      return true;
    });

    if (this.isShuffled) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }

    this.playlist = list;
    this.currentIndex = 0;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.playlist.length === 0) return;
    this.isPlaying = true;
    this._updatePlayButtonState();
    this._playStep();
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.timer);
    window.audioEngine.stop();
    this._updatePlayButtonState();
  }

  next() {
    if (this.playlist.length === 0) return;
    clearTimeout(this.timer);
    window.audioEngine.stop();
    if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
    } else if (this.isLooping) {
      this.currentIndex = 0;
    }
    this.renderCurrentWordCard();
    if (this.isPlaying) {
      this._playStep();
    }
  }

  prev() {
    if (this.playlist.length === 0) return;
    clearTimeout(this.timer);
    window.audioEngine.stop();
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
    this.renderCurrentWordCard();
    if (this.isPlaying) {
      this._playStep();
    }
  }

  async _playStep() {
    if (!this.isPlaying) return;
    const word = this.playlist[this.currentIndex];
    if (!word) {
      this.pause();
      return;
    }

    this.renderCurrentWordCard();

    try {
      // 1. Play first accent
      if (this.accentMode === 'us' || this.accentMode === 'both') {
        await window.audioEngine.playWord(word.word, 'us', null, this.speed);
      }

      if (!this.isPlaying) return;

      // If 'both', slight pause then play UK
      if (this.accentMode === 'both') {
        await new Promise(r => setTimeout(r, 550));
        if (!this.isPlaying) return;
        await window.audioEngine.playWord(word.word, 'uk', null, this.speed);
      } else if (this.accentMode === 'uk') {
        await window.audioEngine.playWord(word.word, 'uk', null, this.speed);
      }

      if (!this.isPlaying) return;

      // 2. Optional: Speak Thai meaning using SpeechSynthesis (awaiting full completion)
      if (this.speakMeaning && word.def_th) {
        await new Promise(r => setTimeout(r, 450));
        if (!this.isPlaying) return;
        await window.audioEngine.speakSentence(word.def_th, 'th-TH', this.speed);
      }

      if (!this.isPlaying) return;

      // 3. Wait user-defined delay, then next
      this.timer = setTimeout(() => {
        if (!this.isPlaying) return;
        if (this.currentIndex < this.playlist.length - 1) {
          this.currentIndex++;
          this._playStep();
        } else if (this.isLooping) {
          this.currentIndex = 0;
          this._playStep();
        } else {
          this.pause();
        }
      }, this.delaySeconds * 1000);

    } catch (e) {
      console.warn("Audio step error:", e);
      if (this.isPlaying) {
        this.timer = setTimeout(() => this.next(), 2000);
      }
    }
  }

  _updatePlayButtonState() {
    const playBtn = document.getElementById('playlist-play-btn');
    const visualizer = document.getElementById('audio-visualizer');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying ? '⏸️ หยุดชั่วคราว' : '▶️ เล่นต่อเนื่อง';
      playBtn.className = `btn ${this.isPlaying ? 'btn-warning' : 'btn-primary'} btn-lg`;
      playBtn.disabled = this.playlist.length === 0;
    }
    if (visualizer) {
      visualizer.classList.toggle('active', this.isPlaying);
    }
  }

  render() {
    if (!this.container) return;

    const topics = window.vocabData
      ? Array.from(new Set(window.vocabData.map(w => w.topic))).filter(Boolean).sort()
      : [
          'Arts, Media & Entertainment',
          'Business & Work',
          'Daily Life & Home',
          'Education & Academic',
          'Emotions & Personality',
          'Food & Dining',
          'Health & Medicine',
          'Law, Society & Politics',
          'Nature & Environment',
          'Science & Technology',
          'Travel & Transportation'
        ];

    this.container.innerHTML = `
      <div class="playlist-player-wrap">
        <!-- Player Controls Bar -->
        <div class="playlist-settings-card">
          <div class="pl-settings-row">
            <div class="filter-group">
              <label for="pl-cefr">ระดับ CEFR:</label>
              <select id="pl-cefr" class="form-select" onchange="window.audioPlaylist.setFilterCefr(this.value)">
                <option value="all" ${this.filterCefr === 'all' ? 'selected' : ''}>ทุกระดับ (A1 - C1)</option>
                <option value="A1" ${this.filterCefr === 'A1' ? 'selected' : ''}>A1 (Beginner)</option>
                <option value="A2" ${this.filterCefr === 'A2' ? 'selected' : ''}>A2 (Elementary)</option>
                <option value="B1" ${this.filterCefr === 'B1' ? 'selected' : ''}>B1 (Intermediate)</option>
                <option value="B2" ${this.filterCefr === 'B2' ? 'selected' : ''}>B2 (Upper-Intermediate)</option>
                <option value="C1" ${this.filterCefr === 'C1' ? 'selected' : ''}>C1 (Advanced)</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="pl-topic">หมวดหมู่:</label>
              <select id="pl-topic" class="form-select" onchange="window.audioPlaylist.setFilterTopic(this.value)">
                <option value="all" ${this.filterTopic === 'all' ? 'selected' : ''}>ทุกหมวดหมู่การใช้งาน (${topics.length} หมวด)</option>
                ${topics.map(t => `<option value="${window.escapeHtml(t)}" ${this.filterTopic === t ? 'selected' : ''}>${window.escapeHtml(t)}</option>`).join('')}
              </select>
            </div>

            <div class="filter-group">
              <label for="pl-status">สถานะคำศัพท์:</label>
              <select id="pl-status" class="form-select" onchange="window.audioPlaylist.setFilterStatus(this.value)">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>คำศัพท์ทั้งหมด</option>
                <option value="bookmarked" ${this.filterStatus === 'bookmarked' ? 'selected' : ''}>⭐ บุ๊กมาร์กไว้เท่านั้น</option>
                <option value="learning" ${this.filterStatus === 'learning' ? 'selected' : ''}>⏳ กำลังเรียนรู้</option>
                <option value="unlearned" ${this.filterStatus === 'unlearned' ? 'selected' : ''}>🆕 ยังจำไม่ได้</option>
              </select>
            </div>

            <div class="filter-group">
              <label>สำเนียงที่เล่น:</label>
              <select class="form-select" onchange="window.audioPlaylist.accentMode = this.value">
                <option value="both" ${this.accentMode === 'both' ? 'selected' : ''}>🇺🇸 US แล้วตามด้วย 🇬🇧 UK</option>
                <option value="us" ${this.accentMode === 'us' ? 'selected' : ''}>🇺🇸 US (American เท่านั้น)</option>
                <option value="uk" ${this.accentMode === 'uk' ? 'selected' : ''}>🇬🇧 UK (British เท่านั้น)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>ความเร็วเสียง:</label>
              <select class="form-select" onchange="window.audioPlaylist.speed = parseFloat(this.value)">
                <option value="0.75" ${this.speed === 0.75 ? 'selected' : ''}>0.75x (ช้าชัด)</option>
                <option value="1" ${this.speed === 1.0 ? 'selected' : ''}>1.0x (ปกติ)</option>
                <option value="1.2" ${this.speed === 1.2 ? 'selected' : ''}>1.2x (เร็ว)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>หน่วงเวลาระหว่างคำ:</label>
              <select class="form-select" onchange="window.audioPlaylist.delaySeconds = parseFloat(this.value)">
                <option value="1.5" ${this.delaySeconds === 1.5 ? 'selected' : ''}>1.5 วินาที (เร็ว)</option>
                <option value="2" ${this.delaySeconds === 2.0 ? 'selected' : ''}>2.0 วินาที (มาตรฐาน)</option>
                <option value="3.5" ${this.delaySeconds === 3.5 ? 'selected' : ''}>3.5 วินาที (สบายๆ)</option>
                <option value="5" ${this.delaySeconds === 5.0 ? 'selected' : ''}>5.0 วินาที (ฝึกคิดตาม)</option>
              </select>
            </div>
          </div>

          <div class="pl-toggle-row">
            <label class="toggle-label">
              <input type="checkbox" ${this.speakMeaning ? 'checked' : ''} onchange="window.audioPlaylist.speakMeaning = this.checked">
              <span>🔊 อ่านคำแปลภาษาไทยต่อท้ายด้วย</span>
            </label>
            <label class="toggle-label">
              <input type="checkbox" ${this.isShuffled ? 'checked' : ''} onchange="window.audioPlaylist.toggleShuffle(this.checked)">
              <span>🔀 สลับลำดับคำศัพท์ (Shuffle)</span>
            </label>
            <label class="toggle-label">
              <input type="checkbox" ${this.isLooping ? 'checked' : ''} onchange="window.audioPlaylist.isLooping = this.checked">
              <span>🔁 เล่นวนซ้ำเมื่อจบชุด (Loop)</span>
            </label>
          </div>
        </div>

        <!-- Main Audio Card -->
        <div id="playlist-current-word-wrap"></div>

        <!-- Audio Visualizer Waves -->
        <div id="audio-visualizer" class="audio-visualizer-bars ${this.isPlaying ? 'active' : ''}">
          <div class="bar bar-1"></div>
          <div class="bar bar-2"></div>
          <div class="bar bar-3"></div>
          <div class="bar bar-4"></div>
          <div class="bar bar-5"></div>
          <div class="bar bar-6"></div>
          <div class="bar bar-7"></div>
          <div class="bar bar-8"></div>
        </div>

        <!-- Big Playback Controls -->
        <div class="pl-playback-controls">
          <button class="btn btn-secondary btn-icon-round" onclick="window.audioPlaylist.prev()" title="คำก่อนหน้า" ${this.playlist.length === 0 ? 'disabled' : ''}>
            ⏮️
          </button>
          <button id="playlist-play-btn" class="btn ${this.isPlaying ? 'btn-warning' : 'btn-primary'} btn-lg" onclick="window.audioPlaylist.togglePlay()" ${this.playlist.length === 0 ? 'disabled' : ''}>
            ${this.isPlaying ? '⏸️ หยุดชั่วคราว' : '▶️ เล่นต่อเนื่อง'}
          </button>
          <button class="btn btn-secondary btn-icon-round" onclick="window.audioPlaylist.next()" title="คำถัดไป" ${this.playlist.length === 0 ? 'disabled' : ''}>
            ⏭️
          </button>
        </div>

        <!-- Queue Preview -->
        <div class="pl-queue-card">
          <div class="pl-queue-header">
            <h4>📋 คิวคำศัพท์ที่กำลังเล่น (${this.playlist.length.toLocaleString()} คำ)</h4>
          </div>
          <div class="pl-queue-list" id="pl-queue-list"></div>
        </div>
      </div>
    `;

    this.renderCurrentWordCard();
    this.renderQueueList();
  }

  renderCurrentWordCard() {
    const wrap = document.getElementById('playlist-current-word-wrap');
    if (!wrap) return;

    const word = this.playlist[this.currentIndex];
    if (!word) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎧</div>
          <h3>ไม่พบคำศัพท์ในคิวที่เลือก</h3>
          <p>ลองเปลี่ยนตัวกรองระดับ CEFR หมวดหมู่ หรือสถานะคำศัพท์</p>
        </div>
      `;
      return;
    }

    const safeWordAttr = window.escapeAttr(word.word);
    const safeExAttr = word.example ? window.escapeAttr(word.example) : '';

    wrap.innerHTML = `
      <div class="pl-showcase-card">
        <div class="pl-card-top">
          <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
          <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          <span class="badge badge-topic">${window.escapeHtml(word.topic)}</span>
          <span class="pl-index-counter">ลำดับที่ ${this.currentIndex + 1} / ${this.playlist.length}</span>
        </div>

        <h1 class="pl-word-title">${window.escapeHtml(word.word)}</h1>

        <div class="pl-phonetics-row">
          <button class="pl-phon-item" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">
            🇺🇸 US: <strong>${window.escapeHtml(word.phon_us || '-')}</strong> 🔊
          </button>
          <button class="pl-phon-item" onclick="window.audioEngine.playWord('${safeWordAttr}', 'uk', this)">
            🇬🇧 UK: <strong>${window.escapeHtml(word.phon_uk || '-')}</strong> 🔊
          </button>
        </div>

        <div class="pl-thai-box">
          <h2>${window.escapeHtml(word.def_th)}</h2>
          <p class="pl-en-def">${window.escapeHtml(word.def_en)}</p>
        </div>

        ${word.example ? `
        <div class="pl-example-box" onclick="window.audioEngine.speakSentence('${safeExAttr}', 'en-US', 0.95, this)">
          <span class="pl-example-label">ตัวอย่างประโยค (คลิกเพื่อฟัง):</span>
          <p class="pl-example-text">"${window.escapeHtml(word.example)}" 🔊</p>
        </div>
        ` : ''}
      </div>
    `;

    this.renderQueueList();
  }

  renderQueueList() {
    const listEl = document.getElementById('pl-queue-list');
    if (!listEl) return;

    if (this.playlist.length === 0) {
      listEl.innerHTML = `<div class="text-muted" style="text-align:center; padding: 16px;">ไม่มีรายการคำศัพท์ในคิว</div>`;
      return;
    }

    // Show window around current index
    const start = Math.max(0, this.currentIndex - 2);
    const end = Math.min(this.playlist.length, this.currentIndex + 8);
    const slice = this.playlist.slice(start, end);

    listEl.innerHTML = slice.map((item, idx) => {
      const actualIdx = start + idx;
      const isCurrent = actualIdx === this.currentIndex;
      return `
        <div class="pl-queue-item ${isCurrent ? 'active' : ''}" onclick="window.audioPlaylist.jumpTo(${actualIdx})">
          <span class="q-idx">#${actualIdx + 1}</span>
          <strong class="q-word">${window.escapeHtml(item.word)}</strong>
          <span class="badge badge-sm badge-${item.cefr.toLowerCase()}">${window.escapeHtml(item.cefr)}</span>
          <span class="q-th">${window.escapeHtml(item.def_th)}</span>
          ${isCurrent ? '<span class="q-playing-badge">▶ กำลังเล่น</span>' : ''}
        </div>
      `;
    }).join('');
  }

  jumpTo(index) {
    clearTimeout(this.timer);
    window.audioEngine.stop();
    this.currentIndex = index;
    this.renderCurrentWordCard();
    if (this.isPlaying) {
      this._playStep();
    }
  }

  _rebuildAndRefresh() {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.buildPlaylist();
    this.render();
  }

  setFilterCefr(val) {
    this.filterCefr = val;
    this._rebuildAndRefresh();
  }

  setFilterTopic(val) {
    this.filterTopic = val;
    this._rebuildAndRefresh();
  }

  setFilterStatus(val) {
    this.filterStatus = val;
    this._rebuildAndRefresh();
  }

  toggleShuffle(val) {
    this.isShuffled = val;
    this._rebuildAndRefresh();
  }
}

// Global instance
window.audioPlaylist = new AudioPlaylistPlayer();
