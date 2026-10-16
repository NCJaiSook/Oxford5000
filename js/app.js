/**
 * Oxford 5000 Vocab Master - Main Application Orchestrator
 * Manages data loading, routing, live search, infinite scroll pagination,
 * word detail modal, and progress dashboard.
 */

class VocabApp {
  constructor() {
    this.rawWords = [];
    this.filteredWords = [];
    this.currentPage = 1;
    this.pageSize = 48;

    // Filters
    this.searchTerm = '';
    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterPos = 'all';
    this.filterStatus = 'all';
    this.sortBy = 'az'; // 'az' | 'za' | 'cefr-asc' | 'cefr-desc' | 'random'

    // UI elements
    this.gridContainer = null;
    this.searchCountEl = null;
    this.activeModalWord = null;

    this.debounceTimer = null;
  }

  async init() {
    this.applyTheme(window.storageMgr.settings.theme || 'dark');
    this.attachNavEvents();
    this.attachSearchFilterEvents();
    this.attachGridDelegation();
    this.attachModalEvents();
    this.attachGlobalShortcuts();

    await this.loadData();
    this.updateProgressBadge();
  }

  async loadData() {
    const loadingEl = document.getElementById('app-loading');
    try {
      if (loadingEl) loadingEl.style.display = 'flex';
      const response = await fetch('data/oxford5000.json');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      this.rawWords = await response.json();
      window.vocabData = this.rawWords;

      if (loadingEl) loadingEl.style.display = 'none';

      // Populate topics dropdown
      this.populateTopicOptions();

      // Initial filter & render
      this.applyFilters();
    } catch (err) {
      console.error('Failed to load Oxford 5000 data:', err);
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="loading-error">
            <h3>⚠️ ไม่สามารถโหลดข้อมูลคำศัพท์ได้</h3>
            <p>${err.message}</p>
            <p>กรุณารีเฟรชหน้าเว็บ หรือตรวจสอบว่าไฟล์ <code>data/oxford5000.json</code> มีอยู่จริง</p>
            <button class="btn btn-primary" onclick="location.reload()">ลองใหม่อีกครั้ง</button>
          </div>
        `;
      }
    }
  }

  populateTopicOptions() {
    const topics = Array.from(new Set(this.rawWords.map(w => w.topic))).filter(Boolean).sort();
    const selects = [
      document.getElementById('filter-topic'),
      document.getElementById('fc-filter-topic'),
      document.getElementById('quiz-topic'),
      document.getElementById('pl-topic')
    ];

    selects.forEach(sel => {
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = `<option value="all">ทุกหมวดหมู่การใช้งาน (${topics.length} หมวด)</option>` +
        topics.map(t => `<option value="${t}">${t}</option>`).join('');
      sel.value = currentVal;
    });
  }

  attachNavEvents() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = window.storageMgr.settings.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
      });
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${tabName}`);
    });

    // Pause audio player if leaving audio view
    if (tabName !== 'audio' && window.audioPlaylist && window.audioPlaylist.isPlaying) {
      window.audioPlaylist.pause();
    }

    // Remove quiz keyboard handler if leaving quiz view
    if (tabName !== 'quiz' && window.quizEngine && window.quizEngine._removeKeyHandler) {
      window.quizEngine._removeKeyHandler();
    }

    // Refresh views on activation
    if (tabName === 'flashcards' && window.flashcardCtrl) {
      window.flashcardCtrl.init(document.getElementById('flashcard-container'));
    } else if (tabName === 'quiz' && window.quizEngine) {
      window.quizEngine.init(document.getElementById('quiz-container'));
    } else if (tabName === 'audio' && window.audioPlaylist) {
      window.audioPlaylist.init(document.getElementById('audio-playlist-container'));
    } else if (tabName === 'progress') {
      this.renderProgressDashboard();
    }
  }

  applyTheme(theme) {
    window.storageMgr.updateSettings({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด';
      themeBtn.title = `เปลี่ยนเป็น${theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}`;
    }
  }

  attachSearchFilterEvents() {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.searchTerm = e.target.value.trim().toLowerCase();
          if (clearSearchBtn) {
            clearSearchBtn.style.display = this.searchTerm ? 'block' : 'none';
          }
          this.applyFilters();
        }, 160);
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchTerm = '';
        clearSearchBtn.style.display = 'none';
        this.applyFilters();
        searchInput.focus();
      });
    }

    // CEFR filter pills
    document.querySelectorAll('.cefr-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cefr-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.filterCefr = pill.dataset.cefr;
        this.applyFilters();
      });
    });

    // Dropdown filters
    const filterTopic = document.getElementById('filter-topic');
    if (filterTopic) {
      filterTopic.addEventListener('change', (e) => {
        this.filterTopic = e.target.value;
        this.applyFilters();
      });
    }

    const filterPos = document.getElementById('filter-pos');
    if (filterPos) {
      filterPos.addEventListener('change', (e) => {
        this.filterPos = e.target.value;
        this.applyFilters();
      });
    }

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.applyFilters();
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.applyFilters();
      });
    }
  }

  attachGridDelegation() {
    const grid = document.getElementById('word-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      // 1. Audio button click
      const audioBtn = e.target.closest('.phon-badge');
      if (audioBtn) {
        e.stopPropagation();
        const word = audioBtn.dataset.word;
        const accent = audioBtn.dataset.accent;
        window.audioEngine.playWord(word, accent, audioBtn);
        return;
      }

      // 2. Mastered checkmark button click
      const checkBtn = e.target.closest('.btn-check');
      if (checkBtn) {
        e.stopPropagation();
        const wordId = parseInt(checkBtn.dataset.id, 10);
        this.toggleCardMastered(wordId, checkBtn);
        return;
      }

      // 3. Star bookmark button click
      const starBtn = e.target.closest('.btn-star');
      if (starBtn) {
        e.stopPropagation();
        const wordId = parseInt(starBtn.dataset.id, 10);
        this.toggleCardBookmark(wordId, starBtn);
        return;
      }

      // 4. Card click -> open detail modal
      const card = e.target.closest('.word-card');
      if (card) {
        const wordId = parseInt(card.dataset.id, 10);
        this.openModal(wordId);
      }
    });
  }

  applyFilters() {
    let list = [...this.rawWords];

    // Search query match
    if (this.searchTerm) {
      const q = this.searchTerm;
      list = list.filter(w => {
        return w.word.toLowerCase().includes(q) ||
               (w.def_th && w.def_th.toLowerCase().includes(q)) ||
               (w.def_en && w.def_en.toLowerCase().includes(q)) ||
               (w.topic && w.topic.toLowerCase().includes(q)) ||
               (w.synonyms && w.synonyms.some(s => s.toLowerCase().includes(q)));
      });
    }

    // CEFR filter
    if (this.filterCefr !== 'all') {
      list = list.filter(w => w.cefr.toUpperCase() === this.filterCefr.toUpperCase());
    }

    // Topic filter
    if (this.filterTopic !== 'all') {
      list = list.filter(w => w.topic === this.filterTopic);
    }

    // Part of speech filter
    if (this.filterPos !== 'all') {
      list = list.filter(w => w.pos.toLowerCase().includes(this.filterPos.toLowerCase()));
    }

    // Learning status filter
    if (this.filterStatus === 'bookmarked') {
      list = list.filter(w => window.storageMgr.isBookmarked(w.id));
    } else if (this.filterStatus === 'learning') {
      list = list.filter(w => window.storageMgr.isLearning(w.id));
    } else if (this.filterStatus === 'mastered') {
      list = list.filter(w => window.storageMgr.isMastered(w.id));
    } else if (this.filterStatus === 'unread') {
      list = list.filter(w => !window.storageMgr.isMastered(w.id) && !window.storageMgr.isLearning(w.id));
    }

    // Sorting
    const cefrRank = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5 };
    if (this.sortBy === 'az') {
      list.sort((a, b) => a.word.localeCompare(b.word));
    } else if (this.sortBy === 'za') {
      list.sort((a, b) => b.word.localeCompare(a.word));
    } else if (this.sortBy === 'cefr-asc') {
      list.sort((a, b) => (cefrRank[a.cefr] || 3) - (cefrRank[b.cefr] || 3) || a.word.localeCompare(b.word));
    } else if (this.sortBy === 'cefr-desc') {
      list.sort((a, b) => (cefrRank[b.cefr] || 3) - (cefrRank[a.cefr] || 3) || a.word.localeCompare(b.word));
    } else if (this.sortBy === 'random') {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }

    this.filteredWords = list;
    this.currentPage = 1;
    this.renderWordGrid();
    this.updateSearchCount();
  }

  updateSearchCount() {
    const el = document.getElementById('search-count');
    if (el) {
      el.innerHTML = `พบ <strong>${this.filteredWords.length.toLocaleString()}</strong> คำ (จากทั้งหมด ${this.rawWords.length.toLocaleString()} คำ)`;
    }
  }

  renderWordGrid() {
    const grid = document.getElementById('word-grid');
    if (!grid) return;

    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (this.filteredWords.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">🔍</div>
          <h3>ไม่พบคำศัพท์ที่ตรงกับการค้นหา</h3>
          <p>ลองเปลี่ยนคำค้นหา หรือปรับตัวกรอง CEFR / หมวดหมู่การใช้งาน</p>
          <button class="btn btn-primary" onclick="window.app.resetFilters()">ล้างตัวกรองทั้งหมด</button>
        </div>
      `;
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    const itemsToShow = this.filteredWords.slice(0, this.currentPage * this.pageSize);
    grid.innerHTML = itemsToShow.map(word => this.createWordCardHtml(word)).join('');

    if (loadMoreContainer && loadMoreBtn) {
      if (itemsToShow.length < this.filteredWords.length) {
        loadMoreContainer.style.display = 'block';
        loadMoreBtn.innerHTML = `โหลดคำศัพท์เพิ่มเติม (${itemsToShow.length.toLocaleString()} / ${this.filteredWords.length.toLocaleString()})`;
      } else {
        loadMoreContainer.style.display = 'none';
      }
    }
  }

  loadMore() {
    this.currentPage++;
    this.renderWordGrid();
  }

  createWordCardHtml(word) {
    const isMastered = window.storageMgr.isMastered(word.id);
    const isLearning = window.storageMgr.isLearning(word.id);
    const isBookmarked = window.storageMgr.isBookmarked(word.id);
    const safeWordHtml = window.escapeHtml(word.word);

    return `
      <div class="word-card ${isMastered ? 'card-mastered' : isLearning ? 'card-learning' : ''}" data-id="${word.id}">
        <div class="card-top-row">
          <div class="card-badges-left">
            <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
            <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          </div>
          <div class="card-actions-right">
            <button class="btn-check ${isMastered ? 'active' : ''}" data-id="${word.id}" title="${isMastered ? 'จำได้แล้ว (คลิกเพื่อยกเลิก)' : 'ทำเครื่องหมายว่าจำได้แล้ว'}" aria-label="${isMastered ? 'จำได้แล้ว' : 'ทำเครื่องหมายว่าจำได้แล้ว'}">
              ✓
            </button>
            <button class="btn-star ${isBookmarked ? 'active' : ''}" data-id="${word.id}" title="${isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์ก'}" aria-label="${isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์ก'}">
              ${isBookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="card-word-title-row">
          <h3 class="card-word-title">${safeWordHtml}</h3>
        </div>

        <div class="card-phonetics">
          <button class="phon-badge" data-word="${safeWordHtml}" data-accent="us" title="ฟังสำเนียงอเมริกัน">
            🇺🇸 ${window.escapeHtml(word.phon_us || '-')} 🔊
          </button>
          <button class="phon-badge" data-word="${safeWordHtml}" data-accent="uk" title="ฟังสำเนียงอังกฤษ">
            🇬🇧 ${window.escapeHtml(word.phon_uk || '-')} 🔊
          </button>
        </div>

        <div class="card-def-th">
          <p>${window.escapeHtml(word.def_th)}</p>
        </div>

        <div class="card-footer-topic">
          <span class="topic-tag">🏷️ ${window.escapeHtml(word.topic)}</span>
          ${isMastered ? '<span class="status-pill status-pill-mastered">✅ จำได้แล้ว</span>' : ''}
          ${isLearning ? '<span class="status-pill status-pill-learning">⏳ กำลังจำ</span>' : ''}
        </div>
      </div>
    `;
  }

  toggleCardMastered(id, btnEl) {
    const isCurrentlyMastered = window.storageMgr.isMastered(id);
    const newState = !isCurrentlyMastered;
    window.storageMgr.setMastered(id, newState);

    if (this.filterStatus && this.filterStatus !== 'all') {
      this.applyFilters();
      this.updateProgressBadge();
      return;
    }

    btnEl.classList.toggle('active', newState);
    btnEl.setAttribute('title', newState ? 'จำได้แล้ว (คลิกเพื่อยกเลิก)' : 'ทำเครื่องหมายว่าจำได้แล้ว');
    btnEl.setAttribute('aria-label', newState ? 'จำได้แล้ว' : 'ทำเครื่องหมายว่าจำได้แล้ว');

    const card = btnEl.closest('.word-card');
    if (card) {
      card.classList.toggle('card-mastered', newState);
      card.classList.remove('card-learning');

      const footer = card.querySelector('.card-footer-topic');
      if (footer) {
        const oldPills = footer.querySelectorAll('.status-pill');
        oldPills.forEach(p => p.remove());

        if (newState) {
          const pill = document.createElement('span');
          pill.className = 'status-pill status-pill-mastered';
          pill.textContent = '✅ จำได้แล้ว';
          footer.appendChild(pill);
        }
      }
    }

    this.updateProgressBadge();
  }

  toggleCardBookmark(id, btnEl) {
    const isBookmarked = window.storageMgr.toggleBookmark(id);
    btnEl.classList.toggle('active', isBookmarked);
    btnEl.innerHTML = isBookmarked ? '★' : '☆';
    btnEl.setAttribute('title', isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์ก');
    btnEl.setAttribute('aria-label', isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์ก');

    if (this.filterStatus === 'bookmarked') {
      this.applyFilters();
    }
    this.updateProgressBadge();
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterPos = 'all';
    this.filterStatus = 'all';
    this.sortBy = 'az';

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';

    document.querySelectorAll('.cefr-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cefr === 'all');
    });

    ['filter-topic', 'filter-pos', 'filter-status', 'sort-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = (id === 'sort-select' ? 'az' : 'all');
    });

    this.applyFilters();
  }

  searchByTerm(term) {
    this.closeModal();
    this.switchTab('explore');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (searchInput) {
      searchInput.value = term;
      this.searchTerm = term.trim().toLowerCase();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = this.searchTerm ? 'block' : 'none';
      }
      this.applyFilters();
      if (term) searchInput.focus();
    }
  }

  handleTagClick(term) {
    if (!term) return;
    const match = this.rawWords.find(w => w.word.toLowerCase() === term.trim().toLowerCase());
    if (match) {
      this.openModal(match.id);
    } else {
      this.searchByTerm(term);
    }
  }

  // --- Modal Logic ---

  attachModalEvents() {
    const modalOverlay = document.getElementById('word-modal');
    const closeBtn = document.getElementById('modal-close-btn');

    if (closeBtn && modalOverlay) {
      closeBtn.addEventListener('click', () => this.closeModal());
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });
    }
  }

  openModal(wordId) {
    const word = this.rawWords.find(w => w.id === wordId);
    if (!word) return;

    this.activeModalWord = word;
    const modalOverlay = document.getElementById('word-modal');
    const modalBody = document.getElementById('modal-body');
    if (!modalOverlay || !modalBody) return;

    const isMastered = window.storageMgr.isMastered(word.id);
    const isLearning = window.storageMgr.isLearning(word.id);
    const isBookmarked = window.storageMgr.isBookmarked(word.id);
    const safeWordAttr = window.escapeAttr(word.word);

    // Find prev/next in filtered list for smooth modal navigation
    const currentIdx = this.filteredWords.findIndex(w => w.id === word.id);
    const prevWord = currentIdx > 0 ? this.filteredWords[currentIdx - 1] : null;
    const nextWord = (currentIdx !== -1 && currentIdx < this.filteredWords.length - 1) ? this.filteredWords[currentIdx + 1] : null;

    const synonymsHtml = word.synonyms && word.synonyms.length > 0
      ? word.synonyms.map(s => `<button class="tag-click" onclick="window.app.handleTagClick('${window.escapeAttr(s)}')">${window.escapeHtml(s)}</button>`).join('')
      : '<span class="text-muted">- ไม่มี -</span>';

    const antonymsHtml = word.antonyms && word.antonyms.length > 0
      ? word.antonyms.map(a => `<button class="tag-click" onclick="window.app.handleTagClick('${window.escapeAttr(a)}')">${window.escapeHtml(a)}</button>`).join('')
      : '<span class="text-muted">- ไม่มี -</span>';

    modalBody.innerHTML = `
      <div class="modal-word-header">
        <div class="modal-badge-group">
          <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
          <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          <span class="badge badge-topic">🏷️ ${window.escapeHtml(word.topic)}</span>
        </div>
        <button id="modal-star-btn" class="btn btn-icon ${isBookmarked ? 'active text-gold' : ''}" onclick="window.app.toggleModalBookmark()" title="${isBookmarked ? 'ยกเลิกบุ๊กมาร์ก' : 'บุ๊กมาร์ก'}">
          ${isBookmarked ? '★' : '☆'}
        </button>
      </div>

      <div class="modal-word-title-wrap">
        <h1 class="modal-word-title">${window.escapeHtml(word.word)}</h1>
      </div>

      <!-- Phonetics & Pronunciation -->
      <div class="modal-pronunciation-card">
        <div class="modal-phon-item">
          <div class="phon-meta">
            <span class="flag-icon">🇺🇸</span>
            <strong>อเมริกัน (US):</strong>
            <code>${window.escapeHtml(word.phon_us || '-')}</code>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">
            🔊 ฟังเสียง US
          </button>
        </div>

        <div class="modal-phon-item">
          <div class="phon-meta">
            <span class="flag-icon">🇬🇧</span>
            <strong>บริติช (UK):</strong>
            <code>${window.escapeHtml(word.phon_uk || '-')}</code>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'uk', this)">
            🔊 ฟังเสียง UK
          </button>
        </div>

        <div class="modal-phon-slow">
          <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this, 0.75)">
            🐢 ฟังช้าๆ (0.75x)
          </button>
        </div>
      </div>

      <!-- Definitions -->
      <div class="modal-section modal-thai-section">
        <h3>🇹🇭 ความหมายภาษาไทย:</h3>
        <p class="modal-th-text">${window.escapeHtml(word.def_th_full || word.def_th)}</p>
      </div>

      <div class="modal-section">
        <h3>📖 Oxford Definition (คำอธิบายภาษาอังกฤษ):</h3>
        <p class="modal-en-def">${window.escapeHtml(word.def_en)}</p>
      </div>

      ${word.example ? `
      <div class="modal-section modal-example-section">
        <div class="section-title-action">
          <h3>💬 ตัวอย่างประโยคการใช้งาน:</h3>
          <button class="btn-play-mini" id="modal-play-ex-btn">🔊 ฟังประโยค</button>
        </div>
        <blockquote class="modal-example-quote">"${window.escapeHtml(word.example)}"</blockquote>
      </div>
      ` : ''}

      <!-- Synonyms & Antonyms -->
      <div class="modal-meta-grid">
        <div class="meta-box">
          <h4>🔗 Synonyms (คำความหมายใกล้เคียง):</h4>
          <div class="tags-container">${synonymsHtml}</div>
        </div>
        <div class="meta-box">
          <h4>⚡ Antonyms (คำตรงกันข้าม):</h4>
          <div class="tags-container">${antonymsHtml}</div>
        </div>
      </div>

      <!-- External Links -->
      <div class="modal-ext-links">
        <span>📚 ค้นหาเพิ่มเติม:</span>
        <a href="https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.word)}" target="_blank" rel="noopener">Oxford Dictionary ↗</a>
        <a href="https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.word)}" target="_blank" rel="noopener">Cambridge ↗</a>
        <a href="https://dict.longdo.com/search/${encodeURIComponent(word.word)}" target="_blank" rel="noopener">Longdo Dict ↗</a>
      </div>

      <!-- Action Status & Navigation Buttons -->
      <div class="modal-actions-bar">
        <div class="modal-nav-prevnext">
          <button class="btn btn-secondary btn-sm" ${prevWord ? `onclick="window.app.openModal(${prevWord.id})"` : 'disabled'} title="คำก่อนหน้า (←)">
            ◀ ก่อนหน้า
          </button>
          <button class="btn btn-secondary btn-sm" ${nextWord ? `onclick="window.app.openModal(${nextWord.id})"` : 'disabled'} title="คำถัดไป (→)">
            ถัดไป ▶
          </button>
        </div>
        <div class="modal-status-btns">
          <button id="modal-btn-learning" class="btn ${isLearning ? 'btn-warning' : 'btn-outline'}" onclick="window.app.setModalStatus('learning')">
            ${isLearning ? '⏳ กำลังเรียนรู้อยู่' : '⏳ ตั้งเป็นกำลังจำ'}
          </button>
          <button id="modal-btn-mastered" class="btn ${isMastered ? 'btn-success' : 'btn-outline'}" onclick="window.app.setModalStatus('mastered')">
            ${isMastered ? '✅ จำคำนี้ได้แล้ว' : '✅ ทำเครื่องหมายว่าจำได้แล้ว'}
          </button>
        </div>
      </div>
    `;

    const exBtn = document.getElementById('modal-play-ex-btn');
    if (exBtn && word.example) {
      exBtn.addEventListener('click', () => {
        window.audioEngine.speakSentence(word.example, 'en-US', 0.95, exBtn);
      });
    }

    const wasAlreadyOpen = modalOverlay.classList.contains('open');
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Auto-play preferred accent sound on initial modal open
    if (!wasAlreadyOpen) {
      setTimeout(() => {
        if (this.activeModalWord && this.activeModalWord.id === word.id) {
          const prefAccent = (window.storageMgr && window.storageMgr.settings.preferredAccent) || 'us';
          window.audioEngine.playWord(word.word, prefAccent);
        }
      }, 200);
    }
  }

  closeModal() {
    const modalOverlay = document.getElementById('word-modal');
    if (modalOverlay) modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    this.activeModalWord = null;
  }

  toggleModalBookmark() {
    if (!this.activeModalWord) return;
    const isBookmarked = window.storageMgr.toggleBookmark(this.activeModalWord.id);
    const starBtn = document.getElementById('modal-star-btn');
    if (starBtn) {
      starBtn.classList.toggle('active', isBookmarked);
      starBtn.classList.toggle('text-gold', isBookmarked);
      starBtn.innerHTML = isBookmarked ? '★' : '☆';
    }
    this.updateProgressBadge();
    this.renderWordGrid();
  }

  setModalStatus(status) {
    if (!this.activeModalWord) return;
    const id = this.activeModalWord.id;

    if (status === 'mastered') {
      const current = window.storageMgr.isMastered(id);
      window.storageMgr.setMastered(id, !current);
    } else if (status === 'learning') {
      const current = window.storageMgr.isLearning(id);
      window.storageMgr.setLearning(id, !current);
    }

    this.updateProgressBadge();
    this.renderWordGrid();
    this.openModal(id);
  }

  attachGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        if (window.profileMgr) window.profileMgr.closeProfileModal();
      } else if (this.activeModalWord && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const currentIdx = this.filteredWords.findIndex(w => w.id === this.activeModalWord.id);
        if (e.key === 'ArrowLeft' && currentIdx > 0) {
          e.preventDefault();
          this.openModal(this.filteredWords[currentIdx - 1].id);
        } else if (e.key === 'ArrowRight' && currentIdx !== -1 && currentIdx < this.filteredWords.length - 1) {
          e.preventDefault();
          this.openModal(this.filteredWords[currentIdx + 1].id);
        }
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
    });
  }

  updateProgressBadge() {
    const stats = window.storageMgr.getStats(this.rawWords.length || 5943);
    const streakEl = document.getElementById('streak-count');
    const bookmarkEl = document.getElementById('bookmark-count');

    if (streakEl) streakEl.textContent = stats.streak;
    if (bookmarkEl) bookmarkEl.textContent = stats.bookmarkedCount;
  }

  // --- Progress Dashboard View ---

  renderProgressDashboard() {
    const container = document.getElementById('progress-dashboard-container');
    if (!container) return;

    const stats = window.storageMgr.getStats(this.rawWords.length || 5943);
    const progressDeg = Math.round((parseFloat(stats.progressPercent) / 100) * 360);

    // CEFR Breakdown
    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const cefrStats = cefrLevels.map(level => {
      const words = this.rawWords.filter(w => w.cefr.toUpperCase() === level);
      const mastered = words.filter(w => window.storageMgr.isMastered(w.id)).length;
      const learning = words.filter(w => window.storageMgr.isLearning(w.id)).length;
      const percent = words.length > 0 ? Math.round((mastered / words.length) * 100) : 0;
      return { level, total: words.length, mastered, learning, percent };
    });

    // Topic Breakdown
    const topics = Array.from(new Set(this.rawWords.map(w => w.topic))).filter(Boolean).sort();
    const topicStats = topics.map(topic => {
      const words = this.rawWords.filter(w => w.topic === topic);
      const mastered = words.filter(w => window.storageMgr.isMastered(w.id)).length;
      const percent = words.length > 0 ? Math.round((mastered / words.length) * 100) : 0;
      return { topic, total: words.length, mastered, percent };
    });

    container.innerHTML = `
      <div class="progress-view-wrap">
        <!-- Overview Cards -->
        <div class="progress-hero-card">
          <div class="hero-left">
            <h2>📊 สรุปความคืบหน้าการเรียนรู้คำศัพท์ Oxford 5,000</h2>
            <p>ฝึกฝนอย่างต่อเนื่องทุกวันเพื่อจำคำศัพท์ภาษาอังกฤษได้อย่างถาวร</p>
            <div class="hero-streak-badge">
              <span>🔥 ความต่อเนื่องในการเรียน (Streak): <strong>${stats.streak} วัน</strong></span>
              <span class="streak-sub">เป้าหมายวันนี้: <strong>${stats.todayCount} / ${stats.dailyGoal}</strong> คำ</span>
            </div>
          </div>
          <div class="hero-right">
            <div class="hero-progress-ring" style="--progress-deg: ${progressDeg}deg;">
              <div class="ring-inner">
                <span class="ring-val">${stats.progressPercent}%</span>
                <span class="ring-label">จำได้แล้ว</span>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-overview-grid">
          <div class="stat-card">
            <div class="sc-icon text-success">✅</div>
            <div class="sc-info">
              <span class="sc-val">${stats.masteredCount.toLocaleString()} คำ</span>
              <span class="sc-label">จำได้แม่นยำแล้ว (Mastered)</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="sc-icon text-warning">⏳</div>
            <div class="sc-info">
              <span class="sc-val">${stats.learningCount.toLocaleString()} คำ</span>
              <span class="sc-label">กำลังเรียนรู้ (Learning)</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="sc-icon text-gold">⭐</div>
            <div class="sc-info">
              <span class="sc-val">${stats.bookmarkedCount.toLocaleString()} คำ</span>
              <span class="sc-label">บุ๊กมาร์กไว้ทบทวน</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="sc-icon text-primary">🎯</div>
            <div class="sc-info">
              <span class="sc-val">${stats.quizAccuracy}%</span>
              <span class="sc-label">ความถูกต้องในแบบทดสอบ (${stats.quizStats.totalTaken} ครั้ง)</span>
            </div>
          </div>
        </div>

        <!-- CEFR Breakdown -->
        <div class="dashboard-section-card">
          <h3>📈 ความคืบหน้าตามระดับมาตรฐาน CEFR (A1 ถึง C1)</h3>
          <div class="cefr-bars-list">
            ${cefrStats.map(s => `
              <div class="cefr-bar-row">
                <div class="cbar-label">
                  <span class="badge badge-cefr badge-${s.level.toLowerCase()}">${s.level}</span>
                  <span class="cbar-name">${s.level === 'A1' ? 'Beginner' : s.level === 'A2' ? 'Elementary' : s.level === 'B1' ? 'Intermediate' : s.level === 'B2' ? 'Upper-Intermediate' : 'Advanced'}</span>
                </div>
                <div class="cbar-track">
                  <div class="cbar-fill fill-${s.level.toLowerCase()}" style="width: ${s.percent}%;"></div>
                </div>
                <div class="cbar-stats">
                  <strong>${s.percent}%</strong>
                  <span>(${s.mastered.toLocaleString()} / ${s.total.toLocaleString()} คำ)</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Topics Breakdown Grid -->
        <div class="dashboard-section-card">
          <h3>🏷️ ความคืบหน้าตามหมวดหมู่การใช้งาน (${topics.length} หมวด)</h3>
          <div class="topics-progress-grid">
            ${topicStats.map(t => `
              <div class="topic-stat-item">
                <div class="tstat-header">
                  <strong>${window.escapeHtml(t.topic)}</strong>
                  <span class="tstat-percent">${t.percent}%</span>
                </div>
                <div class="tstat-track">
                  <div class="tstat-fill" style="width: ${t.percent}%;"></div>
                </div>
                <div class="tstat-footer">
                  <span>จำได้ ${t.mastered.toLocaleString()} / ${t.total.toLocaleString()} คำ</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Data Backup & Reset Actions -->
        <div class="dashboard-section-card">
          <h3>💾 การจัดการและสำรองข้อมูลการเรียน</h3>
          <p class="text-muted">ข้อมูลความคืบหน้าจะถูกบันทึกในเบราว์เซอร์ของคุณ (LocalStorage) คุณสามารถส่งออกไฟล์สำรองเพื่อย้ายเครื่องหรือบันทึกเก็บไว้ได้</p>
          <div class="backup-actions-row">
            <button class="btn btn-primary" onclick="window.storageMgr.exportData()">
              📥 ส่งออกไฟล์สำรองข้อมูล (Export Backup)
            </button>
            <label class="btn btn-secondary btn-file-upload">
              📤 นำเข้าไฟล์สำรองข้อมูล (Import Backup)
              <input type="file" accept=".json" style="display:none;" onchange="window.app.handleImportFile(event)">
            </label>
            <button class="btn btn-outline text-danger" onclick="window.app.handleResetAll()">
              🗑️ รีเซ็ตข้อมูลความคืบหน้าทั้งหมด
            </button>
          </div>
        </div>
      </div>
    `;
  }

  handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = window.storageMgr.importData(evt.target.result);
      if (res.success) {
        alert('นำเข้าข้อมูลความคืบหน้าสำเร็จเรียบร้อยแล้ว!');
        this.updateProgressBadge();
        this.renderProgressDashboard();
        this.renderWordGrid();
      } else {
        alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + res.error);
      }
    };
    reader.readAsText(file);
  }

  handleResetAll() {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลความคืบหน้าทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      window.storageMgr.resetAll();
      alert('รีเซ็ตข้อมูลความคืบหน้าเรียบร้อยแล้ว');
      this.updateProgressBadge();
      this.renderProgressDashboard();
      this.renderWordGrid();
    }
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.app = new VocabApp();
  window.app.init();
});
