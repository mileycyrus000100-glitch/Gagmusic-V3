/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — player.js
   Lecture audio, file d'attente, progression, contrôles
   ═══════════════════════════════════════════════════════ */

const Player = {

  /* ─── ÉTAT ─── */
  audio:        null,   // HTMLAudioElement
  currentSong:  null,   // chanson en cours
  queue:        [],     // file d'attente
  queueIndex:   0,      // position dans la file
  isPlaying:    false,
  isShuffle:    false,
  isRepeat:     false,  // false | 'one' | 'all'
  playTimer:    null,   // timer comptage 30s
  playSeconds:  0,      // secondes écoutées (pour comptage)
  progressTimer: null,  // timer mise à jour progression
  inactiveTimer: null,  // timer mode inactif lecteur
  isInactive:   false,  // mode inactif (contrôles cachés)
  volumeBoost:  1.0,    // multiplicateur volume (1–4)

  /* ─── INIT ─── */
  init() {
    try {
      this.audio = new Audio();
      this.audio.preload = 'metadata';

      this.bindAudioEvents();
      this.initProgressBar();
      this.initInactiveMode();
      this.initVolumeBar();

      console.log('[Player] Initialisé');
    } catch (e) {
      console.error('[Player] Erreur init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ÉVÉNEMENTS AUDIO
     ═══════════════════════════════════════════════════════ */

  bindAudioEvents() {
    try {
      if (!this.audio) return;

      // Mise à jour progression
      this.audio.addEventListener('timeupdate', () => {
        try {
          this.onTimeUpdate();
        } catch (e) {}
      });

      // Chanson terminée
      this.audio.addEventListener('ended', () => {
        try {
          this.onEnded();
        } catch (e) {}
      });

      // Prêt à lire
      this.audio.addEventListener('canplay', () => {
        try {
          this.onCanPlay();
        } catch (e) {}
      });

      // Erreur audio
      this.audio.addEventListener('error', (e) => {
        try {
          this.onError(e);
        } catch (err) {}
      });

      // Mise en mémoire tampon
      this.audio.addEventListener('waiting', () => {
        try {
          if (typeof showToast === 'function') showToast('⏳ Chargement...');
        } catch (e) {}
      });

    } catch (e) {
      console.error('[Player] Erreur bindAudioEvents:', e);
    }
  },

  onTimeUpdate() {
    try {
      if (!this.audio || !this.currentSong) return;

      const current = this.audio.currentTime;
      const total   = this.audio.duration || this.currentSong.duration || 0;

      // Mise à jour UI
      if (typeof updateProgress === 'function') {
        updateProgress(current, total);
      }

      // Comptage écoute (30 secondes)
      this.playSeconds++;
      if (this.playSeconds === 30) {
        this.countPlay();
      }

      // Sauvegarder position pour "continuer"
      if (Math.floor(current) % 5 === 0) {
        this.savePosition(current, total);
      }

    } catch (e) {
      console.error('[Player] Erreur onTimeUpdate:', e);
    }
  },

  onEnded() {
    try {
      this.playSeconds = 0;

      if (this.isRepeat === 'one') {
        // Répéter la même chanson
        this.audio.currentTime = 0;
        this.audio.play().catch(e => console.warn('[Player] Erreur repeat:', e));
        return;
      }

      // Passer à la suivante
      this.next();

    } catch (e) {
      console.error('[Player] Erreur onEnded:', e);
    }
  },

  onCanPlay() {
    try {
      // Mettre à jour durée totale si inconnue
      if (this.currentSong && !this.currentSong.duration && this.audio.duration) {
        this.currentSong.duration = this.audio.duration;
      }
    } catch (e) {}
  },

  onError(e) {
    try {
      console.warn('[Player] Erreur audio:', e);
      if (typeof showToast === 'function') showToast('❌ Impossible de lire ce fichier');
      // Essayer la suivante
      setTimeout(() => this.next(), 1000);
    } catch (err) {
      console.error('[Player] Erreur onError:', err);
    }
  },

  /* ═══════════════════════════════════════════════════════
     LECTURE
     ═══════════════════════════════════════════════════════ */

  play(song, queue, index) {
    try {
      if (!song) return;

      this.currentSong = song;
      this.queue       = queue || [song];
      this.queueIndex  = index || 0;
      this.playSeconds = 0;

      // Source audio
      if (this.audio) {
        this.audio.src  = song.path || '';
        this.audio.load();

        // Restaurer position si "continuer"
        const saved = this.getSavedPosition(song.id);
        if (saved && saved.current > 5 && saved.current < (song.duration || 9999) - 5) {
          this.audio.currentTime = saved.current;
        }

        this.audio.play()
          .then(() => {
            this.isPlaying = true;
            this.updatePlayUI();
          })
          .catch(e => {
            console.warn('[Player] Erreur play:', e);
            // Mode navigateur sans fichier audio réel
            this.isPlaying = true;
            this.updatePlayUI();
            this.simulateProgress(song.duration || 180);
          });
      } else {
        // Pas d'audio disponible (mode aperçu)
        this.isPlaying = true;
        this.updatePlayUI();
      }

      // Mettre à jour l'interface
      this.updateSongUI(song);

      // Sauvegarder comme dernière chanson
      try {
        localStorage.setItem('gag_last_song', JSON.stringify({
          id:       song.id,
          title:    song.title,
          artist:   song.artist,
          album:    song.album,
          cover:    song.cover,
          duration: song.duration,
          progress: 0,
        }));
      } catch (e) {}

      // Réinitialiser le timer inactif
      this.resetInactiveTimer();

      // Mettre à jour paroles si module disponible
      if (typeof Lyrics !== 'undefined' && Lyrics.load) {
        Lyrics.load(song);
      }

      console.log('[Player] Lecture:', song.title || '—');

    } catch (e) {
      console.error('[Player] Erreur play:', e);
    }
  },

  togglePlay() {
    try {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.resume();
      }
    } catch (e) {
      console.error('[Player] Erreur togglePlay:', e);
    }
  },

  pause() {
    try {
      if (this.audio) this.audio.pause();
      this.isPlaying = false;
      this.updatePlayUI();
      clearInterval(this.progressTimer);
      const vinyl = document.getElementById('vinyl');
      if (vinyl) vinyl.style.animationPlayState = 'paused';
    } catch (e) {
      console.error('[Player] Erreur pause:', e);
    }
  },

  resume() {
    try {
      if (this.audio && this.audio.src) {
        this.audio.play().catch(e => console.warn('[Player] Erreur resume:', e));
      }
      this.isPlaying = true;
      this.updatePlayUI();
      const vinyl = document.getElementById('vinyl');
      if (vinyl) vinyl.style.animationPlayState = 'running';
    } catch (e) {
      console.error('[Player] Erreur resume:', e);
    }
  },

  prev() {
    try {
      // Si plus de 3 secondes écoulées → revenir au début
      if (this.audio && this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        this.playSeconds = 0;
        return;
      }

      if (this.queue.length === 0) return;

      if (this.isShuffle) {
        this.queueIndex = Math.floor(Math.random() * this.queue.length);
      } else {
        this.queueIndex = this.queueIndex > 0
          ? this.queueIndex - 1
          : (this.isRepeat === 'all' ? this.queue.length - 1 : 0);
      }

      this.play(this.queue[this.queueIndex], this.queue, this.queueIndex);

    } catch (e) {
      console.error('[Player] Erreur prev:', e);
    }
  },

  next() {
    try {
      if (this.queue.length === 0) return;

      if (this.isShuffle) {
        // Aléatoire mais pas la même chanson
        let newIdx;
        do {
          newIdx = Math.floor(Math.random() * this.queue.length);
        } while (newIdx === this.queueIndex && this.queue.length > 1);
        this.queueIndex = newIdx;
      } else {
        this.queueIndex++;
        if (this.queueIndex >= this.queue.length) {
          if (this.isRepeat === 'all') {
            this.queueIndex = 0;
          } else {
            // Fin de la file
            this.queueIndex = this.queue.length - 1;
            this.pause();
            return;
          }
        }
      }

      this.play(this.queue[this.queueIndex], this.queue, this.queueIndex);

    } catch (e) {
      console.error('[Player] Erreur next:', e);
    }
  },

  seek(seconds) {
    try {
      if (this.audio) {
        this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 0));
      }
    } catch (e) {
      console.error('[Player] Erreur seek:', e);
    }
  },

  seekRelative(delta) {
    try {
      if (this.audio) {
        this.seek(this.audio.currentTime + delta);
      }
    } catch (e) {
      console.error('[Player] Erreur seekRelative:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     BARRE DE PROGRESSION (clic)
     ═══════════════════════════════════════════════════════ */

  initProgressBar() {
    try {
      const bar = document.getElementById('player-progress');
      if (!bar) return;

      bar.addEventListener('click', (e) => {
        try {
          const rect = bar.getBoundingClientRect();
          const pct  = (e.clientX - rect.left) / rect.width;
          const total = (this.audio && this.audio.duration) || (this.currentSong && this.currentSong.duration) || 0;
          if (total > 0) this.seek(pct * total);
        } catch (err) {
          console.warn('[Player] Erreur seek click:', err);
        }
      });

      // Boutons skip ±10s
      const btnRewind  = document.getElementById('btn-rewind');
      const btnForward = document.getElementById('btn-forward');
      if (btnRewind)  btnRewind.addEventListener('click',  () => this.seekRelative(-10));
      if (btnForward) btnForward.addEventListener('click', () => this.seekRelative(10));

    } catch (e) {
      console.error('[Player] Erreur initProgressBar:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     MODE INACTIF (10s sans interaction)
     ═══════════════════════════════════════════════════════ */

  initInactiveMode() {
    try {
      const screen = document.getElementById('player-screen');
      if (!screen) return;

      // Toute interaction → réactiver
      ['touchstart', 'click'].forEach(evt => {
        screen.addEventListener(evt, () => {
          try {
            if (this.isInactive) this.setActive();
            this.resetInactiveTimer();
          } catch (e) {}
        }, { passive: true });
      });

    } catch (e) {
      console.error('[Player] Erreur initInactiveMode:', e);
    }
  },

  resetInactiveTimer() {
    try {
      clearTimeout(this.inactiveTimer);
      this.inactiveTimer = setTimeout(() => {
        this.setInactive();
      }, 10000);
    } catch (e) {}
  },

  setInactive() {
    try {
      this.isInactive = true;
      const content = document.getElementById('player-content');
      if (content) content.style.opacity = '0';
      // Afficher seulement titre + paroles en bas
      const header = document.getElementById('player-header');
      if (header) header.style.opacity = '0.6';
    } catch (e) {}
  },

  setActive() {
    try {
      this.isInactive = false;
      const content = document.getElementById('player-content');
      if (content) content.style.opacity = '1';
      const header = document.getElementById('player-header');
      if (header) header.style.opacity = '1';
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     BARRE VOLUME
     ═══════════════════════════════════════════════════════ */

  initVolumeBar() {
    try {
      // Intercepter les touches volume Android via AndroidBridge
      // La barre est affichée côté Android (MusicService)
      // Ici on gère juste le boost software
    } catch (e) {}
  },

  setVolumeBoost(multiplier) {
    try {
      // Clamp entre 1 et 4 (100% à 400%)
      this.volumeBoost = Math.max(1, Math.min(4, multiplier));

      if (this.audio) {
        // WebAudio pour boost > 1.0
        if (this.volumeBoost > 1 && !this.audioContext) {
          this.setupAudioContext();
        }
        if (this.gainNode) {
          this.gainNode.gain.value = this.volumeBoost;
        }
      }

      // Avertissement à >100%
      if (this.volumeBoost > 1 && !this._warnedBoost) {
        this._warnedBoost = true;
        if (typeof showToast === 'function') {
          showToast('⚠️ Volume amplifié — risque pour l\'audition');
        }
      }

    } catch (e) {
      console.error('[Player] Erreur setVolumeBoost:', e);
    }
  },

  setupAudioContext() {
    try {
      if (!this.audio) return;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source      = this.audioContext.createMediaElementSource(this.audio);
      this.gainNode     = this.audioContext.createGain();
      source.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = this.volumeBoost;
    } catch (e) {
      console.warn('[Player] WebAudio non disponible:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     SHUFFLE + REPEAT
     ═══════════════════════════════════════════════════════ */

  toggleShuffle() {
    try {
      this.isShuffle = !this.isShuffle;
      const btn = document.getElementById('btn-shuffle');
      if (btn) btn.classList.toggle('active', this.isShuffle);
      if (typeof showToast === 'function') {
        showToast(this.isShuffle ? '🔀 Aléatoire activé' : 'Aléatoire désactivé');
      }
    } catch (e) {
      console.error('[Player] Erreur toggleShuffle:', e);
    }
  },

  toggleRepeat() {
    try {
      if (!this.isRepeat)       this.isRepeat = 'all';
      else if (this.isRepeat === 'all') this.isRepeat = 'one';
      else                      this.isRepeat = false;

      const btn = document.getElementById('btn-repeat');
      if (btn) {
        btn.classList.toggle('active', !!this.isRepeat);
        btn.textContent = this.isRepeat === 'one' ? '🔂' : '🔁';
      }

      const labels = { all: '🔁 Répéter tout', one: '🔂 Répéter une fois', false: 'Répétition désactivée' };
      if (typeof showToast === 'function') showToast(labels[String(this.isRepeat)]);
    } catch (e) {
      console.error('[Player] Erreur toggleRepeat:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     COMPTAGE ÉCOUTES
     ═══════════════════════════════════════════════════════ */

  countPlay() {
    try {
      if (!this.currentSong || !this.currentSong.id) return;

      const id  = this.currentSong.id;
      const now = Date.now();

      if (!Library || !Library.stats) return;
      if (!Library.stats[id]) Library.stats[id] = { plays:0, history:[], weekPlays:0 };

      Library.stats[id].plays++;
      Library.stats[id].lastPlayed = now;
      Library.stats[id].history    = Library.stats[id].history || [];
      Library.stats[id].history.push({ ts: now });

      // Garder max 1000 entrées historique par chanson
      if (Library.stats[id].history.length > 1000) {
        Library.stats[id].history = Library.stats[id].history.slice(-1000);
      }

      Library.saveToStorage();

      console.log('[Player] Écoute comptée:', this.currentSong.title, '—', Library.stats[id].plays, 'fois');

    } catch (e) {
      console.error('[Player] Erreur countPlay:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     POSITION (continuer)
     ═══════════════════════════════════════════════════════ */

  savePosition(current, total) {
    try {
      if (!this.currentSong) return;
      const data = {
        id:       this.currentSong.id,
        title:    this.currentSong.title,
        artist:   this.currentSong.artist,
        album:    this.currentSong.album,
        cover:    this.currentSong.cover,
        duration: total,
        progress: current,
      };
      localStorage.setItem('gag_last_song', JSON.stringify(data));
    } catch (e) {}
  },

  getSavedPosition(songId) {
    try {
      const raw = localStorage.getItem('gag_last_song');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.id === songId) return data;
      return null;
    } catch (e) {
      return null;
    }
  },

  /* ═══════════════════════════════════════════════════════
     SIMULATION PROGRESSION (mode navigateur sans audio)
     ═══════════════════════════════════════════════════════ */

  simulateProgress(duration) {
    try {
      clearInterval(this.progressTimer);
      let current = this.audio ? this.audio.currentTime : 0;
      const total = duration || 180;

      this.progressTimer = setInterval(() => {
        try {
          if (!this.isPlaying) return;
          current += 1;
          if (current >= total) {
            clearInterval(this.progressTimer);
            this.onEnded();
            return;
          }
          if (typeof updateProgress === 'function') updateProgress(current, total);

          // Comptage 30s
          this.playSeconds++;
          if (this.playSeconds === 30) this.countPlay();

        } catch (e) {}
      }, 1000);

    } catch (e) {
      console.error('[Player] Erreur simulateProgress:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     MISE À JOUR UI
     ═══════════════════════════════════════════════════════ */

  updateSongUI(song) {
    try {
      if (!song) return;

      // Mini lecteur
      if (typeof updateMiniPlayer === 'function') updateMiniPlayer(song);

      // Mini lecteur : afficher
      const mini = document.getElementById('mini-player');
      if (mini) mini.classList.remove('hidden');

      // Lecteur plein écran
      const titleEl  = document.getElementById('player-title');
      const artistEl = document.getElementById('player-artist');
      const artEl    = document.getElementById('player-art');

      if (titleEl)  titleEl.textContent  = song.title  || '—';
      if (artistEl) artistEl.textContent = song.artist || '—';

      // Pochette
      if (artEl) {
        if (song.cover) {
          artEl.innerHTML = `<img src="${song.cover}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
          artEl.innerHTML = '🎵';
        }
      }

      // Accueil : carte continuer
      if (typeof Library !== 'undefined' && Library.updateContinueCard) {
        Library.updateContinueCard(song);
      }

      // Mise à jour biblio (animation EQ)
      if (typeof Library !== 'undefined' && Library.renderBiblio) {
        Library.renderBiblio();
      }

    } catch (e) {
      console.error('[Player] Erreur updateSongUI:', e);
    }
  },

  updatePlayUI() {
    try {
      const icon     = this.isPlaying ? '⏸' : '▶';
      const btnMain  = document.getElementById('btn-play-main');
      const btnMini  = document.getElementById('mini-play');
      const vinyl    = document.getElementById('vinyl');

      if (btnMain) btnMain.textContent = icon;
      if (btnMini) btnMini.textContent = icon;

      if (vinyl) {
        vinyl.style.animationPlayState = this.isPlaying ? 'running' : 'paused';
      }

      // Sync App.isPlaying
      if (typeof App !== 'undefined') App.isPlaying = this.isPlaying;

    } catch (e) {
      console.error('[Player] Erreur updatePlayUI:', e);
    }
  },

};

/* Exposer Player globalement */
window.Player = Player;
