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
      return true;
    });

    if (this.isShuffled) {
      list = [...list].sort(() => 0.5 - Math.random());
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
        await new Promise(r => setTimeout(r, 600));
        if (!this.isPlaying) return;
        await window.audioEngine.playWord(word.word, 'uk', null, this.speed);
      } else if (this.accentMode === 'uk') {
        await window.audioEngine.playWord(word.word, 'uk', null, this.speed);
      }

      if (!this.isPlaying) return;

      // 2. Optional: Speak Thai meaning using SpeechSynthesis
      if (this.speakMeaning && word.def_th) {
        await new Promise(r => setTimeout(r, 500));
        if (!this.isPlaying) return;
        window.audioEngine.speakSentence(word.def_th, 'th-TH', 1.0);
        await new Promise(r => setTimeout(r, 1200));
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
    }
    if (visualizer) {
      visualizer.classList.toggle('active', this.isPlaying);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="playlist-player-wrap">
        <!-- Player Controls Bar -->
        <div class="playlist-settings-card">
          <div class="pl-settings-row">
            <div class="filter-group">
              <label>ระดับ CEFR:</label>
              <select id="pl-cefr" class="form-select" onchange="window.audioPlaylist.setFilterCefr(this.value)">
                <option value="all">ทุกระดับ (A1 - C1)</option>
                <option value="A1">A1 (Beginner)</option>
                <option value="A2">A2 (Elementary)</option>
                <option value="B1">B1 (Intermediate)</option>
                <option value="B2">B2 (Upper-Intermediate)</option>
                <option value="C1">C1 (Advanced)</option>
              </select>
            </div>

            <div class="filter-group">
              <label>หมวดหมู่:</label>
              <select id="pl-topic" class="form-select" onchange="window.audioPlaylist.setFilterTopic(this.value)">
                <option value="all">ทุกหมวดหมู่การใช้งาน</option>
                <option value="Daily Life & Home">ชีวิตประจำวัน & บ้าน (Daily Life)</option>
                <option value="Business & Work">การทำงาน & ธุรกิจ (Business)</option>
                <option value="Science & Technology">วิทยาศาสตร์ & เทคโนโลยี (Tech)</option>
                <option value="Education & Academic">การศึกษา & วิชาการ (Education)</option>
                <option value="Food & Dining">อาหาร & เครื่องดื่ม (Food)</option>
                <option value="Travel & Transportation">การเดินทาง & ท่องเที่ยว (Travel)</option>
                <option value="Health & Medicine">สุขภาพ & การแพทย์ (Health)</option>
                <option value="Emotions & Personality">อารมณ์ & นิสัย (Emotions)</option>
                <option value="Nature & Environment">ธรรมชาติ & สิ่งแวดล้อม (Nature)</option>
                <option value="Law, Society & Politics">กฎหมาย & สังคม (Law & Society)</option>
                <option value="Arts, Media & Entertainment">ศิลปะ บันเทิง & สื่อ (Arts & Media)</option>
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
              <label>หน่วงเวลาระหว่างคำ:</label>
              <select class="form-select" onchange="window.audioPlaylist.delaySeconds = parseFloat(this.value)">
                <option value="1.5">1.5 วินาที (เร็ว)</option>
                <option value="2.0" selected>2.0 วินาที (มาตรฐาน)</option>
                <option value="3.5">3.5 วินาที (สบายๆ)</option>
                <option value="5.0">5.0 วินาที (ฝึกคิดตาม)</option>
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
          <button class="btn btn-secondary btn-icon-round" onclick="window.audioPlaylist.prev()" title="คำก่อนหน้า">
            ⏮️
          </button>
          <button id="playlist-play-btn" class="btn ${this.isPlaying ? 'btn-warning' : 'btn-primary'} btn-lg" onclick="window.audioPlaylist.togglePlay()">
            ${this.isPlaying ? '⏸️ หยุดชั่วคราว' : '▶️ เล่นต่อเนื่อง'}
          </button>
          <button class="btn btn-secondary btn-icon-round" onclick="window.audioPlaylist.next()" title="คำถัดไป">
            ⏭️
          </button>
        </div>

        <!-- Queue Preview -->
        <div class="pl-queue-card">
          <div class="pl-queue-header">
            <h4>📋 คิวคำศัพท์ที่กำลังเล่น (${this.playlist.length} คำ)</h4>
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
      wrap.innerHTML = `<div class="empty-state">ไม่พบคำศัพท์ในคิว</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="pl-showcase-card">
        <div class="pl-card-top">
          <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${word.cefr}</span>
          <span class="badge badge-pos">${word.pos}</span>
          <span class="badge badge-topic">${word.topic}</span>
          <span class="pl-index-counter">ลำดับที่ ${this.currentIndex + 1} / ${this.playlist.length}</span>
        </div>

        <h1 class="pl-word-title">${word.word}</h1>

        <div class="pl-phonetics-row">
          <span class="pl-phon-item" onclick="window.audioEngine.playWord('${word.word}', 'us')">
            🇺🇸 US: <strong>${word.phon_us || '-'}</strong> 🔊
          </span>
          <span class="pl-phon-item" onclick="window.audioEngine.playWord('${word.word}', 'uk')">
            🇬🇧 UK: <strong>${word.phon_uk || '-'}</strong> 🔊
          </span>
        </div>

        <div class="pl-thai-box">
          <h2>${word.def_th}</h2>
          <p class="pl-en-def">${word.def_en}</p>
        </div>

        ${word.example ? `
        <div class="pl-example-box" onclick="window.audioEngine.speakSentence('${word.example.replace(/'/g, "\\'")}', 'en-US')">
          <span class="pl-example-label">ตัวอย่างประโยค:</span>
          <p class="pl-example-text">"${word.example}" 🔊</p>
        </div>
        ` : ''}
      </div>
    `;

    this.renderQueueList();
  }

  renderQueueList() {
    const listEl = document.getElementById('pl-queue-list');
    if (!listEl) return;

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
          <strong class="q-word">${item.word}</strong>
          <span class="badge badge-sm badge-${item.cefr.toLowerCase()}">${item.cefr}</span>
          <span class="q-th">${item.def_th}</span>
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

  setFilterCefr(val) {
    this.filterCefr = val;
    this.buildPlaylist();
    this.render();
  }

  setFilterTopic(val) {
    this.filterTopic = val;
    this.buildPlaylist();
    this.render();
  }

  toggleShuffle(val) {
    this.isShuffled = val;
    this.buildPlaylist();
    this.render();
  }
}

// Global instance
window.audioPlaylist = new AudioPlaylistPlayer();
