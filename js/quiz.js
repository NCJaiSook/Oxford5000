/**
 * Oxford 5000 Vocab Master - Comprehensive Quiz Engine
 * Supports 4 Quiz Modes: EN->TH, TH->EN, Listening Quiz, Spelling Challenge.
 * Features smart distractors, instant audio feedback, streak multiplier, and review.
 */

class QuizEngine {
  constructor() {
    this.container = null;
    this.mode = 'en-to-th'; // 'en-to-th' | 'th-to-en' | 'listening' | 'spelling'
    this.filterCefr = 'all';
    this.filterTopic = 'all';
    this.filterStatus = 'all';
    this.questionCount = 10;

    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.answers = []; // record of { word, selected, correct, isCorrect }
    this.isAnswered = false;
    this.accent = 'us';
    this._keyHandler = null;
  }

  init(containerEl) {
    this.container = containerEl;
    this._removeKeyHandler();
    this.renderConfig();
  }

  _removeKeyHandler() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  _attachQuestionShortcuts() {
    this._removeKeyHandler();
    this._keyHandler = (e) => {
      const activeTab = document.querySelector('.nav-tab.active');
      if (!activeTab || activeTab.dataset.tab !== 'quiz') return;
      if (document.querySelector('.modal-overlay.open')) return;

      if (this.isAnswered) {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.nextQuestion();
        }
        return;
      }

      // Multiple-choice keyboard shortcuts: 1-4 or A-D
      if (this.mode !== 'spelling' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
        const choiceIdx = keyMap[e.key.toLowerCase()];
        const currentQ = this.questions[this.currentIndex];
        if (choiceIdx !== undefined && currentQ && currentQ.choices[choiceIdx]) {
          e.preventDefault();
          this.submitChoice(currentQ.choices[choiceIdx]);
        }
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  startQuiz(customWordPool = null) {
    this._removeKeyHandler();
    let pool = customWordPool || window.vocabData;
    if (!pool || pool.length === 0) return;

    if (!customWordPool) {
      if (this.filterCefr !== 'all') {
        pool = pool.filter(w => w.cefr.toUpperCase() === this.filterCefr.toUpperCase());
      }
      if (this.filterTopic !== 'all') {
        pool = pool.filter(w => w.topic === this.filterTopic);
      }
      if (this.filterStatus === 'bookmarked') {
        pool = pool.filter(w => window.storageMgr.isBookmarked(w.id));
      } else if (this.filterStatus === 'learning') {
        pool = pool.filter(w => window.storageMgr.isLearning(w.id));
      } else if (this.filterStatus === 'unlearned') {
        pool = pool.filter(w => !window.storageMgr.isMastered(w.id));
      }
    }

    if (pool.length < 4 && (!customWordPool || pool.length === 0)) {
      alert('จำนวนคำศัพท์ในเงื่อนไขที่เลือกมีน้อยกว่า 4 คำ กรุณาเลือกเงื่อนไขอื่น');
      return;
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, Math.min(this.questionCount, shuffled.length));

    const distractorSource = (window.vocabData && window.vocabData.length >= 4) ? window.vocabData : pool;
    this.questions = selectedWords.map(word => this.generateQuestion(word, distractorSource));
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.answers = [];
    this.isAnswered = false;

    this.renderQuestion();
  }

  generateQuestion(targetWord, fullPool) {
    // Generate 3 distractors from same POS and preferably similar CEFR
    const samePos = fullPool.filter(w => w.id !== targetWord.id && w.pos === targetWord.pos);
    const candidatePool = samePos.length >= 3 ? samePos : fullPool.filter(w => w.id !== targetWord.id);

    const shuffledCandidates = [...candidatePool].sort(() => 0.5 - Math.random());
    const distractors = shuffledCandidates.slice(0, 3);

    const choices = [...distractors, targetWord].sort(() => 0.5 - Math.random());

    return {
      word: targetWord,
      choices: choices
    };
  }

  submitChoice(selectedChoice) {
    if (this.isAnswered) return;
    this.isAnswered = true;

    const q = this.questions[this.currentIndex];
    const isCorrect = selectedChoice.id === q.word.id;

    if (isCorrect) {
      this.score++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      window.audioEngine.playCorrectSound();
      window.storageMgr.setMastered(q.word.id, true);
    } else {
      this.streak = 0;
      window.audioEngine.playWrongSound();
      window.storageMgr.setLearning(q.word.id, true);
    }

    if (window.app) window.app.updateProgressBadge();

    this.answers.push({
      word: q.word,
      selected: selectedChoice,
      isCorrect: isCorrect
    });

    this.renderQuestionResult(isCorrect, selectedChoice);
  }

  submitSpelling(inputVal) {
    if (this.isAnswered) return;
    this.isAnswered = true;

    const q = this.questions[this.currentIndex];
    const cleanInput = inputVal.trim().toLowerCase();
    const cleanTarget = q.word.word.trim().toLowerCase();
    const isCorrect = cleanInput === cleanTarget;

    if (isCorrect) {
      this.score++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      window.audioEngine.playCorrectSound();
      window.storageMgr.setMastered(q.word.id, true);
    } else {
      this.streak = 0;
      window.audioEngine.playWrongSound();
      window.storageMgr.setLearning(q.word.id, true);
    }

    if (window.app) window.app.updateProgressBadge();

    this.answers.push({
      word: q.word,
      selectedWordText: inputVal.trim(),
      isCorrect: isCorrect
    });

    this.renderSpellingResult(isCorrect, cleanInput);
  }

  nextQuestion() {
    this._removeKeyHandler();
    this.currentIndex++;
    this.isAnswered = false;
    if (this.currentIndex < this.questions.length) {
      this.renderQuestion();
    } else {
      this.renderSummary();
    }
  }

  renderConfig() {
    if (!this.container) return;
    this._removeKeyHandler();

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
      <div class="quiz-config-card">
        <div class="quiz-config-header">
          <h2>🎯 แบบทดสอบประลองความจำคำศัพท์</h2>
          <p>เลือกโหมดการทดสอบ ระดับ CEFR และหมวดหมู่ที่ต้องการฝึกฝน</p>
        </div>

        <div class="quiz-modes-grid">
          <div class="quiz-mode-item ${this.mode === 'en-to-th' ? 'selected' : ''}" onclick="window.quizEngine.selectMode('en-to-th', this)">
            <div class="mode-icon">🇬🇧 ➔ 🇹🇭</div>
            <h4>อังกฤษ ➔ ไทย</h4>
            <p>ดูคำศัพท์ภาษาอังกฤษ เลือกคำแปลภาษาไทย</p>
          </div>

          <div class="quiz-mode-item ${this.mode === 'th-to-en' ? 'selected' : ''}" onclick="window.quizEngine.selectMode('th-to-en', this)">
            <div class="mode-icon">🇹🇭 ➔ 🇬🇧</div>
            <h4>ไทย ➔ อังกฤษ</h4>
            <p>ดูคำแปลภาษาไทย เลือกคำศัพท์ภาษาอังกฤษ</p>
          </div>

          <div class="quiz-mode-item ${this.mode === 'listening' ? 'selected' : ''}" onclick="window.quizEngine.selectMode('listening', this)">
            <div class="mode-icon">🎧 ➔ 📝</div>
            <h4>แบบทดสอบการฟัง (Listening)</h4>
            <p>ฟังเสียงออกเสียงภาษาอังกฤษ แล้วเลือกคำศัพท์</p>
          </div>

          <div class="quiz-mode-item ${this.mode === 'spelling' ? 'selected' : ''}" onclick="window.quizEngine.selectMode('spelling', this)">
            <div class="mode-icon">⌨️ ➔ ✍️</div>
            <h4>สะกดคำศัพท์ (Spelling)</h4>
            <p>ฟังเสียงและดูคำแปล แล้วพิมพ์สะกดคำให้ถูกต้อง</p>
          </div>
        </div>

        <div class="quiz-filters-row">
          <div class="filter-group">
            <label for="quiz-cefr">ระดับ CEFR:</label>
            <select id="quiz-cefr" class="form-select" onchange="window.quizEngine.filterCefr = this.value">
              <option value="all" ${this.filterCefr === 'all' ? 'selected' : ''}>ทุกระดับ (A1 - C1)</option>
              <option value="A1" ${this.filterCefr === 'A1' ? 'selected' : ''}>A1 (Beginner)</option>
              <option value="A2" ${this.filterCefr === 'A2' ? 'selected' : ''}>A2 (Elementary)</option>
              <option value="B1" ${this.filterCefr === 'B1' ? 'selected' : ''}>B1 (Intermediate)</option>
              <option value="B2" ${this.filterCefr === 'B2' ? 'selected' : ''}>B2 (Upper-Intermediate)</option>
              <option value="C1" ${this.filterCefr === 'C1' ? 'selected' : ''}>C1 (Advanced)</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="quiz-topic">หมวดหมู่การใช้งาน:</label>
            <select id="quiz-topic" class="form-select" onchange="window.quizEngine.filterTopic = this.value">
              <option value="all" ${this.filterTopic === 'all' ? 'selected' : ''}>ทุกหมวดหมู่การใช้งาน (${topics.length} หมวด)</option>
              ${topics.map(t => `<option value="${window.escapeHtml(t)}" ${this.filterTopic === t ? 'selected' : ''}>${window.escapeHtml(t)}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label for="quiz-status">สถานะคำศัพท์:</label>
            <select id="quiz-status" class="form-select" onchange="window.quizEngine.filterStatus = this.value">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>คำศัพท์ทั้งหมด</option>
              <option value="unlearned" ${this.filterStatus === 'unlearned' ? 'selected' : ''}>🆕 ยังจำไม่ได้ / กำลังเรียน</option>
              <option value="learning" ${this.filterStatus === 'learning' ? 'selected' : ''}>⏳ กำลังเรียนรู้เท่านั้น</option>
              <option value="bookmarked" ${this.filterStatus === 'bookmarked' ? 'selected' : ''}>⭐ บุ๊กมาร์กไว้เท่านั้น</option>
            </select>
          </div>

          <div class="filter-group">
            <label>จำนวนข้อ:</label>
            <div class="btn-group-segmented">
              <button class="btn btn-sm ${this.questionCount === 10 ? 'btn-primary' : 'btn-outline'}" onclick="window.quizEngine.setCount(10, this)">10 ข้อ</button>
              <button class="btn btn-sm ${this.questionCount === 20 ? 'btn-primary' : 'btn-outline'}" onclick="window.quizEngine.setCount(20, this)">20 ข้อ</button>
              <button class="btn btn-sm ${this.questionCount === 50 ? 'btn-primary' : 'btn-outline'}" onclick="window.quizEngine.setCount(50, this)">50 ข้อ</button>
            </div>
          </div>
        </div>

        <div class="quiz-start-action">
          <button class="btn btn-primary btn-lg" onclick="window.quizEngine.startQuiz()">
            🚀 เริ่มทำแบบทดสอบเลย
          </button>
        </div>
      </div>
    `;
  }

  selectMode(m, el) {
    this.mode = m;
    this.container.querySelectorAll('.quiz-mode-item').forEach(i => i.classList.remove('selected'));
    if (el) el.classList.add('selected');
  }

  setCount(c, el) {
    this.questionCount = c;
    el.parentElement.querySelectorAll('button').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-outline');
    });
    el.classList.add('btn-primary');
    el.classList.remove('btn-outline');
  }

  renderQuestion() {
    if (!this.container) return;
    const q = this.questions[this.currentIndex];
    const word = q.word;
    const safeWordAttr = window.escapeAttr(word.word);
    const safeWordHtml = window.escapeHtml(word.word);

    const percent = Math.round(((this.currentIndex + 1) / this.questions.length) * 100);

    this._attachQuestionShortcuts();

    // Auto-play audio on listening mode
    if (this.mode === 'listening') {
      setTimeout(() => {
        window.audioEngine.playWord(word.word, this.accent);
      }, 250);
    }

    let promptHtml = '';
    if (this.mode === 'en-to-th') {
      promptHtml = `
        <div class="quiz-prompt">
          <div class="quiz-prompt-badges">
            <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
            <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          </div>
          <h1 class="quiz-word-title">${safeWordHtml}</h1>
          <div class="quiz-audio-row">
            <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">🔊 US [${window.escapeHtml(word.phon_us || '-')}]</button>
            <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'uk', this)">🔊 UK [${window.escapeHtml(word.phon_uk || '-')}]</button>
          </div>
          <p class="quiz-instruction">คำศัพท์นี้มีความหมายตรงกับข้อใด? <span class="text-muted">(กดปุ่ม 1-4 หรือ A-D)</span></p>
        </div>
      `;
    } else if (this.mode === 'th-to-en') {
      promptHtml = `
        <div class="quiz-prompt">
          <div class="quiz-prompt-badges">
            <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
            <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          </div>
          <h2 class="quiz-thai-title">${window.escapeHtml(word.def_th)}</h2>
          <p class="quiz-instruction">ตรงกับคำศัพท์ภาษาอังกฤษข้อใด? <span class="text-muted">(กดปุ่ม 1-4 หรือ A-D)</span></p>
        </div>
      `;
    } else if (this.mode === 'listening') {
      promptHtml = `
        <div class="quiz-prompt">
          <div class="quiz-prompt-badges">
            <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
            <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          </div>
          <div class="quiz-listening-audio-box">
            <button class="btn btn-primary btn-pulse-audio" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">
              🔊 คลิกเพื่อฟังเสียงซ้ำ (US)
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'uk', this)">
              🔊 ฟังสำเนียงอังกฤษ (UK)
            </button>
          </div>
          <p class="quiz-instruction">คุณได้ยินคำศัพท์ภาษาอังกฤษคำใด? <span class="text-muted">(กดปุ่ม 1-4 หรือ A-D)</span></p>
        </div>
      `;
    } else if (this.mode === 'spelling') {
      promptHtml = `
        <div class="quiz-prompt">
          <div class="quiz-prompt-badges">
            <span class="badge badge-cefr badge-${word.cefr.toLowerCase()}">${window.escapeHtml(word.cefr)}</span>
            <span class="badge badge-pos">${window.escapeHtml(word.pos)}</span>
          </div>
          <h2 class="quiz-thai-title">${window.escapeHtml(word.def_th)}</h2>
          <p class="text-muted" style="margin-top: 6px;"><em>${window.escapeHtml(word.def_en)}</em></p>
          <div class="quiz-audio-row" style="margin-top: 12px;">
            <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">🔊 ฟังเสียง (US)</button>
            <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'uk', this)">🔊 ฟังเสียง (UK)</button>
          </div>
        </div>
      `;
    }

    let choicesHtml = '';
    if (this.mode === 'spelling') {
      choicesHtml = `
        <div class="spelling-input-wrap">
          <input type="text" id="spelling-input" class="spelling-input" placeholder="พิมพ์ตัวสะกดคำภาษาอังกฤษที่นี่..." autocomplete="off" autofocus onkeydown="if(event.key === 'Enter'){ event.stopPropagation(); window.quizEngine.submitSpelling(this.value); }">
          <button class="btn btn-primary" onclick="window.quizEngine.submitSpelling(document.getElementById('spelling-input').value)">
            ส่งคำตอบ (Enter)
          </button>
        </div>
      `;
    } else {
      choicesHtml = `
        <div class="quiz-choices-grid">
          ${q.choices.map((c, idx) => {
            const label = this.mode === 'en-to-th' ? c.def_th : c.word;
            return `
              <button class="choice-btn" data-id="${c.id}" onclick="window.quizEngine.submitChoice(window.quizEngine.questions[${this.currentIndex}].choices[${idx}])">
                <span class="choice-num">${['A', 'B', 'C', 'D'][idx]}</span>
                <span class="choice-text">${window.escapeHtml(label)}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="quiz-active-wrap">
        <div class="quiz-header-status">
          <div class="quiz-progress-info">
            <span>ข้อที่ <strong>${this.currentIndex + 1}</strong> / ${this.questions.length}</span>
            <span class="quiz-score-badge">คะแนน: <strong>${this.score}</strong></span>
            ${this.streak > 1 ? `<span class="quiz-streak-badge">🔥 Streak x${this.streak}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="if(confirm('ต้องการออกจากการทดสอบใช่หรือไม่?')) window.quizEngine.renderConfig()">
            ออกจากการทดสอบ
          </button>
        </div>

        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width: ${percent}%;"></div>
        </div>

        <div class="quiz-card-content">
          ${promptHtml}
          ${choicesHtml}
          <div id="quiz-feedback-box" class="quiz-feedback-box hidden"></div>
        </div>
      </div>
    `;

    if (this.mode === 'spelling') {
      setTimeout(() => {
        const inp = document.getElementById('spelling-input');
        if (inp) inp.focus();
      }, 80);
    }
  }

  renderQuestionResult(isCorrect, selectedChoice) {
    const q = this.questions[this.currentIndex];
    const word = q.word;
    const feedbackBox = document.getElementById('quiz-feedback-box');
    if (!feedbackBox) return;

    // Highlight buttons
    const buttons = this.container.querySelectorAll('.choice-btn');
    buttons.forEach(btn => {
      btn.disabled = true;
      const id = parseInt(btn.dataset.id, 10);
      if (id === word.id) {
        btn.classList.add('correct');
      } else if (id === selectedChoice.id && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    feedbackBox.className = `quiz-feedback-box visible ${isCorrect ? 'fb-correct' : 'fb-wrong'}`;
    feedbackBox.innerHTML = `
      <div class="fb-header">
        <span class="fb-icon">${isCorrect ? '✅ ถูกต้องยอดเยี่ยม!' : '❌ ยังไม่ถูกต้อง'}</span>
      </div>
      <div class="fb-details">
        <p><strong>คำศัพท์:</strong> <span class="text-primary">${window.escapeHtml(word.word)}</span> [${window.escapeHtml(word.phon_us || '-')}]</p>
        <p><strong>คำแปล:</strong> ${window.escapeHtml(word.def_th)}</p>
        <p><strong>ความหมายอังกฤษ:</strong> <em>${window.escapeHtml(word.def_en)}</em></p>
        ${word.example ? `<p><strong>ตัวอย่าง:</strong> "${window.escapeHtml(word.example)}"</p>` : ''}
      </div>
      <div class="fb-action">
        <button class="btn btn-primary btn-next-q" onclick="window.quizEngine.nextQuestion()" autofocus>
          ${this.currentIndex < this.questions.length - 1 ? 'ข้อถัดไป ➔ (กด Enter)' : 'ดูผลสรุปคะแนน ➔ (กด Enter)'}
        </button>
      </div>
    `;
  }

  renderSpellingResult(isCorrect, userInput) {
    const q = this.questions[this.currentIndex];
    const word = q.word;
    const feedbackBox = document.getElementById('quiz-feedback-box');
    if (!feedbackBox) return;

    const inp = document.getElementById('spelling-input');
    if (inp) {
      inp.disabled = true;
      inp.classList.add(isCorrect ? 'input-correct' : 'input-wrong');
    }

    const safeWordAttr = window.escapeAttr(word.word);

    feedbackBox.className = `quiz-feedback-box visible ${isCorrect ? 'fb-correct' : 'fb-wrong'}`;
    feedbackBox.innerHTML = `
      <div class="fb-header">
        <span class="fb-icon">${isCorrect ? '✅ สะกดถูกต้องยอดเยี่ยม!' : '❌ ยังไม่ถูกต้อง'}</span>
      </div>
      <div class="fb-details">
        <p><strong>คำตอบที่ถูกต้อง:</strong> <strong class="text-success">${window.escapeHtml(word.word)}</strong></p>
        ${!isCorrect ? `<p><strong>คำตอบของคุณ:</strong> <span class="text-danger">${window.escapeHtml(userInput || '(ว่าง)')}</span></p>` : ''}
        <p><strong>คำแปล:</strong> ${window.escapeHtml(word.def_th)}</p>
        <p><strong>ความหมาย:</strong> <em>${window.escapeHtml(word.def_en)}</em></p>
        <div style="margin-top: 8px;">
          <button class="btn btn-outline btn-sm" onclick="window.audioEngine.playWord('${safeWordAttr}', 'us', this)">🔊 ฟังการออกเสียงอีกครั้ง</button>
        </div>
      </div>
      <div class="fb-action">
        <button class="btn btn-primary btn-next-q" onclick="window.quizEngine.nextQuestion()" autofocus>
          ${this.currentIndex < this.questions.length - 1 ? 'ข้อถัดไป ➔ (กด Enter)' : 'ดูผลสรุปคะแนน ➔ (กด Enter)'}
        </button>
      </div>
    `;
  }

  renderSummary() {
    this._removeKeyHandler();
    if (!this.container) return;

    // Record stats
    window.storageMgr.recordQuiz(this.score, this.questions.length);
    if (window.app) window.app.updateProgressBadge();

    const percent = Math.round((this.score / this.questions.length) * 100);
    const deg = Math.round((percent / 100) * 360);
    let message = '';
    let emoji = '🏆';
    if (percent >= 90) {
      message = 'ยอดเยี่ยมที่สุด! ความจำคำศัพท์แม่นยำมาก!';
      emoji = '🌟';
    } else if (percent >= 70) {
      message = 'ทำได้ดีมาก! มีความเข้าใจคำศัพท์ในเกณฑ์ดีเยี่ยม';
      emoji = '🎉';
    } else if (percent >= 50) {
      message = 'ผ่านเกณฑ์! ทบทวนอีกนิดจะจำได้แม่นยำยิ่งขึ้น';
      emoji = '👍';
    } else {
      message = 'พยายามอีกนิด! แนะนำให้ทบทวนด้วยบัตรคำศัพท์เพิ่มเติม';
      emoji = '💪';
    }

    const wrongAnswers = this.answers.filter(a => !a.isCorrect);

    this.container.innerHTML = `
      <div class="quiz-summary-card">
        <div class="summary-emoji">${emoji}</div>
        <h2>ผลคะแนนแบบทดสอบ</h2>
        <p class="summary-msg">${message}</p>

        <div class="summary-score-circle" style="--progress-deg: ${deg}deg;">
          <div class="score-circle-inner">
            <div class="score-number">${this.score} / ${this.questions.length}</div>
            <div class="score-percent">${percent}%</div>
          </div>
        </div>

        <div class="summary-stats-row">
          <div class="stat-box">
            <span class="stat-label">ตอบถูก</span>
            <span class="stat-val text-success">${this.score} ข้อ</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">ตอบผิด</span>
            <span class="stat-val text-danger">${this.questions.length - this.score} ข้อ</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Streak สูงสุด</span>
            <span class="stat-val text-gold">🔥 ${this.bestStreak}</span>
          </div>
        </div>

        <div class="summary-actions">
          ${wrongAnswers.length > 0 ? `
          <button class="btn btn-warning" onclick="window.quizEngine.retryWrongWords()">
            🔁 ทบทวนเฉพาะข้อที่ตอบผิด (${wrongAnswers.length} คำ)
          </button>
          ` : ''}
          <button class="btn btn-primary" onclick="window.quizEngine.startQuiz()">
            🚀 ทำแบบทดสอบชุดใหม่
          </button>
          <button class="btn btn-secondary" onclick="window.quizEngine.renderConfig()">
            ⚙️ เปลี่ยนการตั้งค่าแบบทดสอบ
          </button>
        </div>

        <!-- Answers Review Table -->
        <div class="summary-answers-list">
          <h3>📋 รายละเอียดคำตอบทั้งหมด</h3>
          <div class="answers-table">
            ${this.answers.map((ans, idx) => {
              const safeWAttr = window.escapeAttr(ans.word.word);
              const wrongChoiceLabel = ans.selected ? (ans.selected.def_th || ans.selected.word) : (ans.selectedWordText || '(ว่าง)');
              return `
                <div class="ans-row ${ans.isCorrect ? 'row-correct' : 'row-wrong'}">
                  <div class="ans-col-q">
                    <span class="ans-num">#${idx + 1}</span>
                    <strong>${window.escapeHtml(ans.word.word)}</strong>
                    <span class="badge badge-sm badge-${ans.word.cefr.toLowerCase()}">${window.escapeHtml(ans.word.cefr)}</span>
                  </div>
                  <div class="ans-col-meaning">${window.escapeHtml(ans.word.def_th)}</div>
                  <div class="ans-col-status">
                    ${ans.isCorrect 
                      ? '<span class="status-correct">✅ ถูกต้อง</span>' 
                      : `<span class="status-wrong">❌ ผิด (เลือก: ${window.escapeHtml(wrongChoiceLabel)})</span>`}
                  </div>
                  <div class="ans-col-audio">
                    <button class="btn-play-mini" onclick="window.audioEngine.playWord('${safeWAttr}', 'us', this)" title="ฟังเสียงคำศัพท์">🔊</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  retryWrongWords() {
    const wrongWords = this.answers.filter(a => !a.isCorrect).map(a => a.word);
    if (wrongWords.length > 0) {
      this.startQuiz(wrongWords);
    }
  }
}

// Global instance
window.quizEngine = new QuizEngine();
