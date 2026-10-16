/**
 * Oxford 5000 Vocab Master - Profile & Registration Controller
 * 100% Client-Side Privacy: Manages user registration, avatars, target goals,
 * and multi-profile switching locally in browser localStorage.
 */

const AVATAR_OPTIONS = ['🦊', '🦉', '🦁', '🐼', '🚀', '🎓', '⚡', '🌟', '🐱', '🐶', '🏆', '☕'];

class ProfileManager {
  constructor() {
    this.selectedAvatar = '🦊';
    this.modalEl = null;

    // Listen to profile changes
    window.addEventListener('profileChanged', () => {
      this.updateHeaderProfilePill();
      if (window.app) {
        window.app.updateProgressBadge();
        window.app.renderWordGrid();
        // If on progress view, refresh it
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab && activeTab.dataset.tab === 'progress') {
          window.app.renderProgressDashboard();
        }
      }
    });
  }

  init() {
    this.updateHeaderProfilePill();
    this._attachModalBackdropClose();
    this._checkFirstVisit();
  }

  _attachModalBackdropClose() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeProfileModal();
        }
      });
    }
  }

  _checkFirstVisit() {
    const hasSeenWelcome = localStorage.getItem('oxford5000_has_registered');
    if (!hasSeenWelcome) {
      // Delay slightly for smooth initial animation
      setTimeout(() => {
        this.openRegisterModal(true);
      }, 700);
    }
  }

  updateHeaderProfilePill() {
    const pill = document.getElementById('profile-pill-btn');
    if (!pill) return;

    const profile = window.storageMgr.getActiveProfile();
    if (profile) {
      const safeName = window.escapeHtml(profile.name || 'ผู้เรียน');
      pill.innerHTML = `
        <span class="p-avatar">${window.escapeHtml(profile.avatar || '🦊')}</span>
        <span class="p-name">${safeName}</span>
      `;
      pill.title = `โปรไฟล์: ${profile.name} (คลิกเพื่อจัดการโปรไฟล์)`;
    }
  }

  /**
   * Open Registration / Create Profile Modal
   */
  openRegisterModal(isFirstTime = false) {
    this.selectedAvatar = '🦊';
    const modal = document.getElementById('profile-modal');
    const modalBody = document.getElementById('profile-modal-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
      <div class="profile-modal-content">
        <div class="profile-header-center">
          <div class="profile-header-icon">${isFirstTime ? '🎉' : '👤'}</div>
          <h2>${isFirstTime ? 'ยินดีต้อนรับสู่ Oxford 5,000 Vocab Master' : 'สร้างโปรไฟล์ผู้เรียนใหม่'}</h2>
          <p class="text-muted">
            สร้างโปรไฟล์เพื่อบันทึกคำศัพท์ที่คุณจำได้และสถิติการเรียนรู้<br>
            <span class="privacy-note">🔒 ข้อมูล 100% บันทึกในเครื่องของคุณ ไม่มีการส่งข้อมูลใด ๆ ออกนอกอุปกรณ์</span>
          </p>
        </div>

        <form id="register-profile-form" onsubmit="event.preventDefault(); window.profileMgr.submitCreateProfile(${isFirstTime});">
          <div class="form-group-p">
            <label for="reg-name">ชื่อ หรือ ชื่อเล่นของคุณ:</label>
            <input type="text" id="reg-name" class="form-input-p" placeholder="เช่น Alex, Somchai, สมชาย..." required maxlength="30" autofocus>
          </div>

          <div class="form-group-p">
            <label>เลือกรูปตัวแทน (Avatar):</label>
            <div class="avatar-picker-grid">
              ${AVATAR_OPTIONS.map((av, idx) => `
                <button type="button" class="avatar-option ${idx === 0 ? 'selected' : ''}" data-avatar="${av}" onclick="window.profileMgr.selectAvatar('${av}', this)">
                  ${av}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group-p">
              <label for="reg-cefr">ระดับเป้าหมาย (CEFR Goal):</label>
              <select id="reg-cefr" class="form-select-p">
                <option value="A1">A1 - ผู้เริ่มต้น (Beginner)</option>
                <option value="A2">A2 - พื้นฐาน (Elementary)</option>
                <option value="B1">B1 - ปานกลาง (Intermediate)</option>
                <option value="B2" selected>B2 - ปานกลางสูง (Upper-Int)</option>
                <option value="C1">C1 - ขั้นสูง (Advanced)</option>
              </select>
            </div>

            <div class="form-group-p">
              <label for="reg-daily">เป้าหมายคำศัพท์ต่อวัน:</label>
              <select id="reg-daily" class="form-select-p">
                <option value="10">10 คำ / วัน (สบายๆ)</option>
                <option value="20" selected>20 คำ / วัน (มาตรฐาน)</option>
                <option value="30">30 คำ / วัน (เข้มข้น)</option>
                <option value="50">50 คำ / วัน (ท้าทาย)</option>
              </select>
            </div>
          </div>

          <div class="profile-modal-actions">
            ${isFirstTime ? `
            <button type="button" class="btn btn-secondary" onclick="window.profileMgr.skipRegistration()">
              ข้าม (ใช้โปรไฟล์ทั่วไป)
            </button>
            ` : `
            <button type="button" class="btn btn-secondary" onclick="window.profileMgr.openProfileModal()">
              ย้อนกลับ
            </button>
            `}
            <button type="submit" class="btn btn-primary btn-lg">
              🚀 เริ่มต้นใช้งานโปรไฟล์นี้
            </button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  selectAvatar(avatar, el) {
    this.selectedAvatar = avatar;
    const grid = el.parentElement;
    if (grid) {
      grid.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
    }
  }

  submitCreateProfile(isFirstTime) {
    const nameInput = document.getElementById('reg-name');
    const cefrSelect = document.getElementById('reg-cefr');
    const dailySelect = document.getElementById('reg-daily');

    const name = nameInput ? nameInput.value.trim() : 'ผู้เรียน';
    const cefr = cefrSelect ? cefrSelect.value : 'B2';
    const daily = dailySelect ? parseInt(dailySelect.value, 10) : 20;

    if (!name) {
      alert('กรุณากรอกชื่อโปรไฟล์ของคุณ');
      return;
    }

    if (isFirstTime) {
      // Update the first default profile
      const activeP = window.storageMgr.getActiveProfile();
      if (activeP) {
        window.storageMgr.updateProfile(activeP.id, {
          name,
          avatar: this.selectedAvatar,
          targetCefr: cefr,
          dailyGoal: daily
        });
      } else {
        window.storageMgr.createProfile(name, this.selectedAvatar, cefr, daily);
      }
      localStorage.setItem('oxford5000_has_registered', 'true');
    } else {
      window.storageMgr.createProfile(name, this.selectedAvatar, cefr, daily);
    }

    this.closeProfileModal();
    this.updateHeaderProfilePill();
  }

  skipRegistration() {
    localStorage.setItem('oxford5000_has_registered', 'true');
    this.closeProfileModal();
  }

  /**
   * Open Main Profile Management & Switcher Modal
   */
  openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const modalBody = document.getElementById('profile-modal-body');
    if (!modal || !modalBody) return;

    const currentProfile = window.storageMgr.getActiveProfile();
    const allProfiles = window.storageMgr.getProfiles();
    const stats = window.storageMgr.getStats(window.vocabData ? window.vocabData.length : 5943);
    const safeCurrentName = window.escapeHtml(currentProfile.name);

    modalBody.innerHTML = `
      <div class="profile-modal-content">
        <!-- Current Profile Card -->
        <div class="current-profile-card">
          <div class="cp-avatar-box">${window.escapeHtml(currentProfile.avatar || '🦊')}</div>
          <div class="cp-info">
            <div class="cp-title-row">
              <h3>${safeCurrentName}</h3>
              <span class="badge badge-cefr badge-${(currentProfile.targetCefr || 'B2').toLowerCase()}">เป้าหมาย: ${window.escapeHtml(currentProfile.targetCefr || 'B2')}</span>
            </div>
            <p class="cp-sub">เป้าหมายประจำวัน: <strong>${currentProfile.dailyGoal || 20} คำ/วัน</strong> | สมาชิกตั้งแต่: ${new Date(currentProfile.createdAt).toLocaleDateString('th-TH')}</p>
            <div class="cp-stats-pills">
              <span class="cp-pill">✅ จำได้แล้ว: <strong>${stats.masteredCount} คำ</strong></span>
              <span class="cp-pill">⏳ กำลังเรียน: <strong>${stats.learningCount} คำ</strong></span>
              <span class="cp-pill">🔥 Streak: <strong>${stats.streak} วัน</strong></span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm cp-edit-btn" onclick="window.profileMgr.openEditProfileModal('${window.escapeAttr(currentProfile.id)}')" title="แก้ไขโปรไฟล์">
            ✏️ แก้ไข
          </button>
        </div>

        <!-- Multi-Profiles Switcher Section -->
        <div class="profiles-section-box">
          <div class="ps-header">
            <h4>👥 สลับโปรไฟล์บนเครื่องนี้ (${allProfiles.length} บัญชี)</h4>
            <button class="btn btn-primary btn-sm" onclick="window.profileMgr.openRegisterModal(false)">
              + เพิ่มโปรไฟล์ใหม่
            </button>
          </div>

          <div class="profiles-list-scroll">
            ${allProfiles.map(p => {
              const isCurrent = p.id === currentProfile.id;
              return `
                <div class="profile-list-item ${isCurrent ? 'active' : ''}" onclick="window.profileMgr.switchProfile('${window.escapeAttr(p.id)}')">
                  <span class="pli-avatar">${window.escapeHtml(p.avatar)}</span>
                  <div class="pli-info">
                    <strong>${window.escapeHtml(p.name)}</strong>
                    <span class="text-muted" style="font-size: 0.8rem;">เป้าหมาย: ${window.escapeHtml(p.targetCefr)} (${p.dailyGoal} คำ/วัน)</span>
                  </div>
                  ${isCurrent 
                    ? '<span class="pli-badge-active">กำลังใช้งาน</span>' 
                    : '<button class="btn btn-secondary btn-sm pli-switch-btn">สลับใช้</button>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Privacy & Storage Disclaimer -->
        <div class="privacy-disclaimer-box">
          <p>
            🛡️ <strong>ความเป็นส่วนตัว 100%:</strong> โปรไฟล์และข้อมูลการเรียนทั้งหมดจะถูกบันทึกไว้ในเบราว์เซอร์ของคุณ (LocalStorage) เท่านั้น ไม่มีการจัดเก็บข้อมูลส่วนบุคคลบนเซิร์ฟเวอร์ภายนอกใด ๆ
          </p>
        </div>

        <!-- Actions -->
        <div class="profile-modal-footer">
          <button class="btn btn-outline btn-sm" onclick="window.storageMgr.exportData()">
            📥 สำรองข้อมูลโปรไฟล์ (Export JSON)
          </button>
          ${allProfiles.length > 1 ? `
          <button class="btn btn-outline btn-sm text-danger" onclick="window.profileMgr.confirmDeleteProfile('${window.escapeAttr(currentProfile.id)}')">
            🗑️ ลบโปรไฟล์นี้
          </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="window.profileMgr.closeProfileModal()">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  switchProfile(profileId) {
    window.storageMgr.switchProfile(profileId);
    this.updateHeaderProfilePill();
    this.openProfileModal(); // Refresh modal view
  }

  confirmDeleteProfile(profileId) {
    const profile = window.storageMgr.getProfiles().find(p => p.id === profileId);
    const profileName = profile ? profile.name : 'โปรไฟล์นี้';
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบโปรไฟล์ "${profileName}"? ข้อมูลคำศัพท์ที่บันทึกไว้ในโปรไฟล์นี้จะถูกลบออกจากเครื่องอย่างถาวร`)) {
      window.storageMgr.deleteProfile(profileId);
      this.updateHeaderProfilePill();
      this.openProfileModal();
    }
  }

  /**
   * Edit Profile Modal
   */
  openEditProfileModal(profileId) {
    const profile = window.storageMgr.getProfiles().find(p => p.id === profileId);
    if (!profile) return;

    this.selectedAvatar = profile.avatar || '🦊';
    const modal = document.getElementById('profile-modal');
    const modalBody = document.getElementById('profile-modal-body');
    if (!modal || !modalBody) return;
    const safeName = window.escapeHtml(profile.name);

    modalBody.innerHTML = `
      <div class="profile-modal-content">
        <div class="profile-header-center">
          <div class="profile-header-icon">${window.escapeHtml(this.selectedAvatar)}</div>
          <h2>แก้ไขข้อมูลโปรไฟล์: ${safeName}</h2>
          <p class="text-muted">ปรับเปลี่ยนชื่อ รูปตัวแทน หรือเป้าหมายการเรียนของคุณ</p>
        </div>

        <form id="edit-profile-form" onsubmit="event.preventDefault(); window.profileMgr.submitEditProfile('${window.escapeAttr(profile.id)}');">
          <div class="form-group-p">
            <label for="edit-name">ชื่อ หรือ ชื่อเล่น:</label>
            <input type="text" id="edit-name" class="form-input-p" value="${safeName}" required maxlength="30">
          </div>

          <div class="form-group-p">
            <label>เปลี่ยนรูปตัวแทน (Avatar):</label>
            <div class="avatar-picker-grid">
              ${AVATAR_OPTIONS.map(av => `
                <button type="button" class="avatar-option ${av === this.selectedAvatar ? 'selected' : ''}" data-avatar="${av}" onclick="window.profileMgr.selectAvatar('${av}', this)">
                  ${av}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group-p">
              <label for="edit-cefr">ระดับเป้าหมาย (CEFR Goal):</label>
              <select id="edit-cefr" class="form-select-p">
                <option value="A1" ${profile.targetCefr === 'A1' ? 'selected' : ''}>A1 - Beginner</option>
                <option value="A2" ${profile.targetCefr === 'A2' ? 'selected' : ''}>A2 - Elementary</option>
                <option value="B1" ${profile.targetCefr === 'B1' ? 'selected' : ''}>B1 - Intermediate</option>
                <option value="B2" ${profile.targetCefr === 'B2' ? 'selected' : ''}>B2 - Upper-Int</option>
                <option value="C1" ${profile.targetCefr === 'C1' ? 'selected' : ''}>C1 - Advanced</option>
              </select>
            </div>

            <div class="form-group-p">
              <label for="edit-daily">เป้าหมายคำศัพท์ต่อวัน:</label>
              <select id="edit-daily" class="form-select-p">
                <option value="10" ${profile.dailyGoal === 10 ? 'selected' : ''}>10 คำ / วัน</option>
                <option value="20" ${profile.dailyGoal === 20 ? 'selected' : ''}>20 คำ / วัน</option>
                <option value="30" ${profile.dailyGoal === 30 ? 'selected' : ''}>30 คำ / วัน</option>
                <option value="50" ${profile.dailyGoal === 50 ? 'selected' : ''}>50 คำ / วัน</option>
              </select>
            </div>
          </div>

          <div class="profile-modal-actions">
            <button type="button" class="btn btn-secondary" onclick="window.profileMgr.openProfileModal()">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary">
              💾 บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    `;
  }

  submitEditProfile(profileId) {
    const nameInput = document.getElementById('edit-name');
    const cefrSelect = document.getElementById('edit-cefr');
    const dailySelect = document.getElementById('edit-daily');

    const name = nameInput ? nameInput.value.trim() : '';
    const cefr = cefrSelect ? cefrSelect.value : 'B2';
    const daily = dailySelect ? parseInt(dailySelect.value, 10) : 20;

    if (!name) {
      alert('กรุณากรอกชื่อโปรไฟล์');
      return;
    }

    window.storageMgr.updateProfile(profileId, {
      name,
      avatar: this.selectedAvatar,
      targetCefr: cefr,
      dailyGoal: daily
    });

    this.updateHeaderProfilePill();
    this.openProfileModal();
  }

  closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Global instance
window.profileMgr = new ProfileManager();
window.addEventListener('DOMContentLoaded', () => {
  window.profileMgr.init();
});
