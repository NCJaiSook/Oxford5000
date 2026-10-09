/**
 * Oxford 5000 Vocab Master - LocalStorage State & Profile Manager
 * 100% Client-Side Privacy: All profile data and learning progress remain strictly
 * within the user's browser localStorage. No user data is ever transmitted or stored externally.
 */

const STORAGE_KEYS = {
  PROFILES: 'oxford5000_profiles',
  ACTIVE_PROFILE_ID: 'oxford5000_active_profile_id',
  // Legacy keys for backward compatibility / migration
  LEGACY_MASTERED: 'oxford5000_mastered',
  LEGACY_LEARNING: 'oxford5000_learning',
  LEGACY_BOOKMARKED: 'oxford5000_bookmarked',
  LEGACY_STREAK: 'oxford5000_streak',
  LEGACY_SETTINGS: 'oxford5000_settings',
  LEGACY_QUIZ_STATS: 'oxford5000_quiz_stats'
};

class StorageManager {
  constructor() {
    this.profiles = this._load(STORAGE_KEYS.PROFILES, []);
    this.activeProfileId = this._load(STORAGE_KEYS.ACTIVE_PROFILE_ID, null);

    this._initializeProfiles();
    this._loadActiveProfileData();
  }

  _load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn(`Error loading ${key} from localStorage:`, e);
      return fallback;
    }
  }

  _save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error(`Error saving ${key} to localStorage:`, e);
    }
  }

  _getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  _profileKey(keySuffix) {
    return `oxford5000_${this.activeProfileId}_${keySuffix}`;
  }

  _initializeProfiles() {
    // Check if profiles already exist
    if (!Array.isArray(this.profiles) || this.profiles.length === 0) {
      // Check if legacy data exists to migrate
      const legacyMastered = this._load(STORAGE_KEYS.LEGACY_MASTERED, null);
      const initialId = 'profile_' + Date.now();
      const defaultProfile = {
        id: initialId,
        name: 'ผู้เรียน (Learner)',
        avatar: '🦊',
        targetCefr: 'B2',
        dailyGoal: 20,
        createdAt: new Date().toISOString()
      };

      this.profiles = [defaultProfile];
      this.activeProfileId = initialId;
      this._save(STORAGE_KEYS.PROFILES, this.profiles);
      this._save(STORAGE_KEYS.ACTIVE_PROFILE_ID, this.activeProfileId);

      // Migrate legacy data if present
      if (legacyMastered) {
        this._save(`oxford5000_${initialId}_mastered`, legacyMastered);
        this._save(`oxford5000_${initialId}_learning`, this._load(STORAGE_KEYS.LEGACY_LEARNING, []));
        this._save(`oxford5000_${initialId}_bookmarked`, this._load(STORAGE_KEYS.LEGACY_BOOKMARKED, []));
        this._save(`oxford5000_${initialId}_streak`, this._load(STORAGE_KEYS.LEGACY_STREAK, null));
        this._save(`oxford5000_${initialId}_settings`, this._load(STORAGE_KEYS.LEGACY_SETTINGS, null));
        this._save(`oxford5000_${initialId}_quiz_stats`, this._load(STORAGE_KEYS.LEGACY_QUIZ_STATS, null));
      }
    } else {
      // Ensure valid activeProfileId
      if (!this.activeProfileId || !this.profiles.some(p => p.id === this.activeProfileId)) {
        this.activeProfileId = this.profiles[0].id;
        this._save(STORAGE_KEYS.ACTIVE_PROFILE_ID, this.activeProfileId);
      }
    }
  }

  _loadActiveProfileData() {
    const pId = this.activeProfileId;
    this.mastered = new Set(this._load(`oxford5000_${pId}_mastered`, []));
    this.learning = new Set(this._load(`oxford5000_${pId}_learning`, []));
    this.bookmarked = new Set(this._load(`oxford5000_${pId}_bookmarked`, []));

    const activeProfile = this.getActiveProfile();
    const defaultGoal = activeProfile ? activeProfile.dailyGoal : 20;

    this.streakData = this._load(`oxford5000_${pId}_streak`, {
      count: 0,
      lastDate: '',
      todayCount: 0,
      dailyGoal: defaultGoal,
      history: {}
    });

    this.settings = this._load(`oxford5000_${pId}_settings`, {
      theme: 'dark',
      preferredAccent: 'us',
      playbackSpeed: 1.0,
      autoPronounce: false,
      dailyGoal: defaultGoal
    });

    this.quizStats = this._load(`oxford5000_${pId}_quiz_stats`, {
      totalTaken: 0,
      totalCorrect: 0,
      totalQuestions: 0
    });

    this._updateStreakOnLoad();
  }

  _updateStreakOnLoad() {
    const today = this._getTodayString();
    if (this.streakData.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      
      if (this.streakData.lastDate && this.streakData.lastDate !== yesterdayStr) {
        this.streakData.count = 0;
      }
      this.streakData.todayCount = 0;
      this._save(this._profileKey('streak'), this.streakData);
    }
  }

  // --- Profile Management APIs ---

  getProfiles() {
    return this.profiles;
  }

  getActiveProfile() {
    return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0];
  }

  createProfile(name, avatar = '🦊', targetCefr = 'B2', dailyGoal = 20) {
    const id = 'profile_' + Date.now();
    const newProfile = {
      id,
      name: name.trim() || 'ผู้เรียน',
      avatar: avatar || '🦊',
      targetCefr: targetCefr || 'B2',
      dailyGoal: parseInt(dailyGoal, 10) || 20,
      createdAt: new Date().toISOString()
    };

    this.profiles.push(newProfile);
    this._save(STORAGE_KEYS.PROFILES, this.profiles);

    // Initialize clean data for new profile
    this._save(`oxford5000_${id}_mastered`, []);
    this._save(`oxford5000_${id}_learning`, []);
    this._save(`oxford5000_${id}_bookmarked`, []);
    this._save(`oxford5000_${id}_streak`, {
      count: 0,
      lastDate: '',
      todayCount: 0,
      dailyGoal: newProfile.dailyGoal,
      history: {}
    });
    this._save(`oxford5000_${id}_settings`, {
      theme: this.settings ? this.settings.theme : 'dark',
      preferredAccent: 'us',
      playbackSpeed: 1.0,
      autoPronounce: false,
      dailyGoal: newProfile.dailyGoal
    });
    this._save(`oxford5000_${id}_quiz_stats`, {
      totalTaken: 0,
      totalCorrect: 0,
      totalQuestions: 0
    });

    this.switchProfile(id);
    return newProfile;
  }

  switchProfile(profileId) {
    if (!this.profiles.some(p => p.id === profileId)) return false;
    this.activeProfileId = profileId;
    this._save(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);
    this._loadActiveProfileData();

    // Notify application to re-render
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }));
    }
    return true;
  }

  updateProfile(profileId, updates) {
    const idx = this.profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return false;

    this.profiles[idx] = { ...this.profiles[idx], ...updates };
    this._save(STORAGE_KEYS.PROFILES, this.profiles);

    if (profileId === this.activeProfileId) {
      if (updates.dailyGoal) {
        this.streakData.dailyGoal = updates.dailyGoal;
        this.settings.dailyGoal = updates.dailyGoal;
        this._save(this._profileKey('streak'), this.streakData);
        this._save(this._profileKey('settings'), this.settings);
      }
    }

    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }));
    }
    return true;
  }

  deleteProfile(profileId) {
    if (this.profiles.length <= 1) {
      alert('ไม่สามารถลบโปรไฟล์สุดท้ายได้ ต้องมีอย่างน้อย 1 โปรไฟล์เสมอ');
      return false;
    }

    // Remove keys for this profile
    ['mastered', 'learning', 'bookmarked', 'streak', 'settings', 'quiz_stats'].forEach(k => {
      localStorage.removeItem(`oxford5000_${profileId}_${k}`);
    });

    this.profiles = this.profiles.filter(p => p.id !== profileId);
    this._save(STORAGE_KEYS.PROFILES, this.profiles);

    // If deleted active profile, switch to the first available
    if (this.activeProfileId === profileId) {
      this.activeProfileId = this.profiles[0].id;
      this._save(STORAGE_KEYS.ACTIVE_PROFILE_ID, this.activeProfileId);
      this._loadActiveProfileData();
    }

    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: this.activeProfileId } }));
    }
    return true;
  }

  // --- Vocabulary Progress APIs ---

  recordWordStudied(id) {
    const today = this._getTodayString();
    if (this.streakData.lastDate !== today) {
      this.streakData.lastDate = today;
      this.streakData.count = (this.streakData.count || 0) + 1;
      this.streakData.todayCount = 1;
    } else {
      this.streakData.todayCount = (this.streakData.todayCount || 0) + 1;
    }
    this.streakData.history[today] = (this.streakData.history[today] || 0) + 1;
    this._save(this._profileKey('streak'), this.streakData);
  }

  isMastered(id) {
    return this.mastered.has(id);
  }

  setMastered(id, status = true) {
    if (status) {
      this.mastered.add(id);
      this.learning.delete(id);
    } else {
      this.mastered.delete(id);
    }
    this.recordWordStudied(id);
    this._save(this._profileKey('mastered'), Array.from(this.mastered));
    this._save(this._profileKey('learning'), Array.from(this.learning));
  }

  isLearning(id) {
    return this.learning.has(id);
  }

  setLearning(id, status = true) {
    if (status) {
      this.learning.add(id);
      this.mastered.delete(id);
    } else {
      this.learning.delete(id);
    }
    this.recordWordStudied(id);
    this._save(this._profileKey('learning'), Array.from(this.learning));
    this._save(this._profileKey('mastered'), Array.from(this.mastered));
  }

  isBookmarked(id) {
    return this.bookmarked.has(id);
  }

  toggleBookmark(id) {
    if (this.bookmarked.has(id)) {
      this.bookmarked.delete(id);
    } else {
      this.bookmarked.add(id);
    }
    this._save(this._profileKey('bookmarked'), Array.from(this.bookmarked));
    return this.bookmarked.has(id);
  }

  recordQuiz(correct, total) {
    this.quizStats.totalTaken += 1;
    this.quizStats.totalCorrect += correct;
    this.quizStats.totalQuestions += total;
    this._save(this._profileKey('quiz_stats'), this.quizStats);
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this._save(this._profileKey('settings'), this.settings);
  }

  getStats(totalWords = 5943) {
    const masteredCount = this.mastered.size;
    const learningCount = this.learning.size;
    const bookmarkedCount = this.bookmarked.size;
    const unreadCount = Math.max(0, totalWords - masteredCount - learningCount);
    const progressPercent = totalWords > 0 ? ((masteredCount / totalWords) * 100).toFixed(1) : 0;
    const quizAccuracy = this.quizStats.totalQuestions > 0 
      ? ((this.quizStats.totalCorrect / this.quizStats.totalQuestions) * 100).toFixed(1) 
      : 0;

    const activeProfile = this.getActiveProfile();

    return {
      profile: activeProfile,
      masteredCount,
      learningCount,
      bookmarkedCount,
      unreadCount,
      progressPercent,
      streak: this.streakData.count,
      todayCount: this.streakData.todayCount || 0,
      dailyGoal: this.streakData.dailyGoal || (activeProfile ? activeProfile.dailyGoal : 20),
      quizStats: this.quizStats,
      quizAccuracy
    };
  }

  exportData() {
    const activeProfile = this.getActiveProfile();
    const data = {
      version: 2,
      exportDate: new Date().toISOString(),
      profile: activeProfile,
      profiles: this.profiles,
      mastered: Array.from(this.mastered),
      learning: Array.from(this.learning),
      bookmarked: Array.from(this.bookmarked),
      streakData: this.streakData,
      settings: this.settings,
      quizStats: this.quizStats
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (activeProfile ? activeProfile.name : 'user').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
    a.download = `oxford5000_profile_${safeName}_${this._getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.mastered)) this.mastered = new Set(data.mastered);
      if (Array.isArray(data.learning)) this.learning = new Set(data.learning);
      if (Array.isArray(data.bookmarked)) this.bookmarked = new Set(data.bookmarked);
      if (data.streakData) this.streakData = data.streakData;
      if (data.settings) this.settings = data.settings;
      if (data.quizStats) this.quizStats = data.quizStats;

      if (data.profile) {
        const idx = this.profiles.findIndex(p => p.id === this.activeProfileId);
        if (idx !== -1) {
          this.profiles[idx] = { ...this.profiles[idx], ...data.profile, id: this.activeProfileId };
          this._save(STORAGE_KEYS.PROFILES, this.profiles);
        }
      }

      this._save(this._profileKey('mastered'), Array.from(this.mastered));
      this._save(this._profileKey('learning'), Array.from(this.learning));
      this._save(this._profileKey('bookmarked'), Array.from(this.bookmarked));
      this._save(this._profileKey('streak'), this.streakData);
      this._save(this._profileKey('settings'), this.settings);
      this._save(this._profileKey('quiz_stats'), this.quizStats);

      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: this.activeProfileId } }));
      }
      return { success: true };
    } catch (e) {
      console.error("Import failed:", e);
      return { success: false, error: e.message };
    }
  }

  resetAll() {
    this.mastered.clear();
    this.learning.clear();
    this.bookmarked.clear();
    const activeProfile = this.getActiveProfile();
    const defaultGoal = activeProfile ? activeProfile.dailyGoal : 20;
    this.streakData = { count: 0, lastDate: '', todayCount: 0, dailyGoal: defaultGoal, history: {} };
    this.quizStats = { totalTaken: 0, totalCorrect: 0, totalQuestions: 0 };
    
    this._save(this._profileKey('mastered'), []);
    this._save(this._profileKey('learning'), []);
    this._save(this._profileKey('bookmarked'), []);
    this._save(this._profileKey('streak'), this.streakData);
    this._save(this._profileKey('quiz_stats'), this.quizStats);
  }
}

// Global instance
window.storageMgr = new StorageManager();
