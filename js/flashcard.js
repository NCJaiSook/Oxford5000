/**
 * Oxford 5000 Vocab Master - Interactive 3D Flashcards Controller
 * Provides spaced review, keyboard shortcuts, flip animation, and progress tracking.
 */

class FlashcardController {
  constructor() {
    this.deck = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.autoPronounce = false;
    this.container = null;
    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterStatus = 'all';
    this.keyboardListenerAttached = false;
  }

  init(containerEl) {
    this.container = containerEl;
    this.attachEventListeners();
    this.buildDeck();
    this.render();
  }

  buildDeck() {
    if (!window.vocabData || window.vocabData.length === 0) {
      this.deck = [];
      return;
    }

    let list = window.vocabData.filter(item => {
      // CEFR Filter
      if (this.filterCefr !== 'all' && item.cefr.toUpperCase() !== this.filterCefr.toUpperCase()) {
        return false;
      }
      // Topic Filter
      if (this.filterTopic !== 'all' && item.topic !== this.filterTopic) {
        return false;
      }
      // Status Filter
      if (this.filterStatus === 'bookmarked' && !window.storageMgr.isBookmarked(item.id)) {
        return false;
      }
      if (this.filterStatus === 'learning' && !window.storageMgr.isLearning(item.id)) {
        return false;
      }
      if (this.filterStatus === 'mastered' && !window.storageMgr.isMastered(item.id)) {
        return false;
      }
      if (this.filterStatus === 'unlearned' && (window.storageMgr.isMastered(item.id) || window.storageMgr.isLearning(item.id))) {
        return false;
      }
      return true;
    });

    this.deck = list;
    this.currentIndex = 0;
    this.isFlipped = false;
  }

  shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.currentIndex = 0;
    this.isFlipped = false;
    this.render();
  }

  getCurrentWord() {
    if (this.deck.length === 0 || this.currentIndex >= this.deck.length) return null;
    return this.deck[this.currentIndex];
  }

  flip() {
    this.isFlipped = !this.isFlipped;
    window.audioEngine.playFlipSound();
    const cardEl = this.container.querySelector('.fc-card');
    if (cardEl) {
      cardEl.classList.toggle('flipped', this.isFlipped);
    }
  }

  next() {
    if (this.currentIndex < this.deck.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      this.render();
      this.triggerAutoPronounce();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      this.render();
      this.triggerAutoPronounce();
    }
  }

  rateWord(level) {
    const word = this.getCurrentWord();
    if (!word) return;

    if (level === 'easy') {
      window.storageMgr.setMastered(word.id, true);
    } else if (level === 'good') {
      window.storageMgr.setLearning(word.id, true);
    } else if (level === 'hard') {
      // Stay in review pool
      window.storageMgr.setLearning(word.id, true);
    }

    if (window.app) window.app.updateProgressBadge();
    this.next();
  }

  triggerAutoPronounce() {
    const word = this.getCurrentWord();
    if (!word) return;
    if (this.autoPronounce || window.storageMgr.settings.autoPronounce) {
      const pref = window.storageMgr.settings.preferredAccent || 'us';
      window.audioEngine.playWord(word.word, pref);
    }
  }

  attachEventListeners() {
    if (this.keyboardListenerAttached) return;
    this.keyboardListenerAttached = true;

    window.addEventListener('keydown', (e) => {
      // Only process when flashcard view is active and no modal/input is active
      const activeTab = document.querySelector('.nav-tab.active');
      if (!activeTab || activeTab.dataset.tab !== 'flashcards') return;
      if (document.querySelector('.modal-overlay.open') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.flip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      } else if (e.key === '1') {
        this.rateWord('hard');
      } else if (e.key === '2') {
        this.rateWord('good');
      } else if (e.key === '3') {
        this.rateWord('easy');
      } else if (e.key.toLowerCase() === 'u') {
        const word = this.getCurrentWord();
        if (word) window.audioEngine.playWord(word.word, 'us');
      } else if (e.key.toLowerCase() === 'b') {
        const word = this.getCurrentWord();
        if (word) window.audioEngine.playWord(word.word, 'uk');
      }
    });
  }

  render() {
    if (!this.container) return;
    const word = this.getCurrentWord();

    if (!word) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗂️</div>
          <h3>ไม่พบคำศัพท์ในเงื่อนไขที่เลือก</h3>
          <p>ลองปรับตัวกรองระดับ CEFR หมวดหมู่ หรือสถานะคำศัพท์เพื่อเริ่มเรียน</p>
          <button class="btn btn-primary" onclick="window.flashcardCtrl.resetFilters()">รีเซ็ตตัวกรองทั้งหมด</button>
        </div>
      `;
      return;
    }

    const isMastered = window.storageMgr.isMastered(word.id);
    const isLearning = window.storageMgr.isLearning(word.id);
    const isBookmarked = window.storageMgr.isBookmarked(word.id);

    const percent = Math.round(((this.currentIndex + 1) / this.deck.length) * 100);

    const synonymsHtml = word.synonyms && word.synonyms.length > 0
      ? word.synonyms.map(s => `<span class="tag tag-syn">${s}</span>`).join('')
      : '<span class="text-muted">-</span>';

    const antonymsHtml = word.antonyms && word.antonyms.length > 0
      ? word.antonyms.map(a => `<span class="tag tag-ant">${a}</span>`).join('')
      : '<span class="text-muted">-</span>';

    this.container.innerHTML = `
      <div class="flashcard-wrapper">
        <!-- Deck Controls & Progress -->
        <div class="fc-top-bar">
          <div class="fc-deck-info">
            <span class="fc-counter">คำที่ <strong>${this.currentIndex + 1}</strong> จาก <strong>${this.deck.length}</strong></span>
            <div class="fc-progress-bar">
              <div class="fc-progress-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
          <div class="fc-actions-top">
            <button class="btn btn-icon ${isBookmarked ? 'active text-gold' : ''}" title="บันทึกคำศัพท์" onclick="window.flashcardCtrl.toggleBookmark()">
              ${isBookmarked ? '★' : '☆'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.flashcardCtrl.shuffle()" title="สลับลำดับคำศัพท์">
              🔀 สลับ
            </button>
          </div>
        </div>

        <!-- 3D Card Container -->
        <div class="fc-scene" onclick="window.flashcardCtrl.flip()">
          <div class="fc-card ${this.isFlipped ? 'flipped' : ''}">
            <!-- Front -->
            <div class="fc-face fc-front">
              <div class="fc-badge-row">
                <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${word.cefr}</span>
                <span class="badge badge-pos">${word.pos}</span>
                <span class="badge badge-topic">${word.topic}</span>
              </div>

              <div class="fc-word-main">
                <h2 class="fc-word-text">${word.word}</h2>
              </div>

              <div class="fc-phonetics">
                <div class="phon-item" onclick="event.stopPropagation(); window.audioEngine.playWord('${word.word}', 'us', this)">
                  <span class="flag-icon">🇺🇸</span>
                  <span class="phon-text">${word.phon_us || '-'}</span>
                  <button class="btn-play-mini" title="ฟังสำเนียงอเมริกัน">🔊 US</button>
                </div>
                <div class="phon-item" onclick="event.stopPropagation(); window.audioEngine.playWord('${word.word}', 'uk', this)">
                  <span class="flag-icon">🇬🇧</span>
                  <span class="phon-text">${word.phon_uk || '-'}</span>
                  <button class="btn-play-mini" title="ฟังสำเนียงอังกฤษ">🔊 UK</button>
                </div>
              </div>

              <div class="fc-hint-action">
                <span class="fc-flip-hint">💡 คลิกการ์ด หรือกด <code>Space</code> เพื่อดูคำแปล</span>
              </div>
            </div>

            <!-- Back -->
            <div class="fc-face fc-back">
              <div class="fc-badge-row">
                <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${word.cefr}</span>
                <span class="badge badge-pos">${word.pos}</span>
                <span class="fc-word-small">${word.word}</span>
              </div>

              <div class="fc-thai-meaning">
                <h3>${word.def_th}</h3>
              </div>

              <div class="fc-en-def">
                <p><strong>Oxford Definition:</strong> ${word.def_en}</p>
              </div>

              ${word.example ? `
              <div class="fc-example" onclick="event.stopPropagation(); window.audioEngine.speakSentence('${word.example.replace(/'/g, "\\'")}', 'en-US')">
                <div class="fc-example-header">
                  <span>💬 ตัวอย่างประโยค</span>
                  <button class="btn-play-mini" title="ฟังประโยคตัวอย่าง">🔊 ฟัง</button>
                </div>
                <p class="fc-example-text">"${word.example}"</p>
              </div>
              ` : ''}

              <div class="fc-meta-tags">
                <div class="fc-meta-col">
                  <span class="fc-meta-label">🔗 Synonyms (คำความหมายเหมือน):</span>
                  <div class="tags-wrap">${synonymsHtml}</div>
                </div>
                <div class="fc-meta-col">
                  <span class="fc-meta-label">⚡ Antonyms (คำตรงกันข้าม):</span>
                  <div class="tags-wrap">${antonymsHtml}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rating & Navigation Buttons -->
        <div class="fc-controls">
          <div class="fc-nav-btns">
            <button class="btn btn-secondary" onclick="window.flashcardCtrl.prev()" ${this.currentIndex === 0 ? 'disabled' : ''}>
              ◀ ย้อนกลับ (←)
            </button>
            <button class="btn btn-outline" onclick="window.flashcardCtrl.flip()">
              🔁 พลิกการ์ด (Space)
            </button>
            <button class="btn btn-secondary" onclick="window.flashcardCtrl.next()" ${this.currentIndex === this.deck.length - 1 ? 'disabled' : ''}>
              ถัดไป (→) ▶
            </button>
          </div>

          <div class="fc-rating-btns">
            <button class="btn btn-rating btn-hard" onclick="window.flashcardCtrl.rateWord('hard')" title="กดปุ่ม 1">
              <span class="rating-icon">🔴</span>
              <span class="rating-text">ยาก (ทบทวนซ้ำ) [1]</span>
            </button>
            <button class="btn btn-rating btn-good" onclick="window.flashcardCtrl.rateWord('good')" title="กดปุ่ม 2">
              <span class="rating-icon">🟡</span>
              <span class="rating-text">พอจำได้ [2]</span>
            </button>
            <button class="btn btn-rating btn-easy" onclick="window.flashcardCtrl.rateWord('easy')" title="กดปุ่ม 3">
              <span class="rating-icon">🟢</span>
              <span class="rating-text">จำได้แม่นยำ [3]</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  toggleBookmark() {
    const word = this.getCurrentWord();
    if (!word) return;
    window.storageMgr.toggleBookmark(word.id);
    if (window.app) window.app.updateProgressBadge();
    this.render();
  }

  resetFilters() {
    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterStatus = 'all';
    const cefrSelect = document.getElementById('fc-filter-cefr');
    const topicSelect = document.getElementById('fc-filter-topic');
    const statusSelect = document.getElementById('fc-filter-status');
    if (cefrSelect) cefrSelect.value = 'all';
    if (topicSelect) topicSelect.value = 'all';
    if (statusSelect) statusSelect.value = 'all';
    this.buildDeck();
    this.render();
  }
}

// Global instance
window.flashcardCtrl = new FlashcardController();
