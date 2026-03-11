/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — ensemble.js
   Écoute en groupe, Firebase, chat, vocal, émojis
   ═══════════════════════════════════════════════════════ */

const Ensemble = {

  /* ─── ÉTAT ─── */
  db:            null,   // Firebase Realtime DB
  sessionRef:    null,   // référence Firebase de la session
  sessionCode:   null,   // code de la session (ex: AB3X7K)
  sessionId:     null,   // ID complet Firebase
  isHost:        false,  // hôte ou participant
  userId:        null,   // ID local de l'utilisateur
  userName:      'Moi',  // nom affiché
  participants:  [],     // liste des participants
  messages:      [],     // historique chat
  isMicActive:   false,  // micro actif
  batteryWarned: false,

  /* Firebase config */
  FIREBASE_URL: 'https://gagmusic-5fa6f-default-rtdb.firebaseio.com',
  MAX_PARTICIPANTS: 5,

  /* ─── INIT ─── */
  init() {
    try {
      this.userId   = this.getOrCreateUserId();
      this.userName = this.getSavedName() || 'Moi';

      this.initButtons();
      this.initFirebase();

      console.log('[Ensemble] Initialisé — userId:', this.userId);
    } catch (e) {
      console.error('[Ensemble] Erreur init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     BOUTONS
     ═══════════════════════════════════════════════════════ */

  initButtons() {
    try {
      // Créer session
      const btnCreer = document.getElementById('btn-creer-session');
      if (btnCreer) {
        btnCreer.addEventListener('click', () => this.createSession());
      }

      // Rejoindre session
      const btnJoin = document.getElementById('btn-join');
      if (btnJoin) {
        btnJoin.addEventListener('click', () => {
          const input = document.getElementById('join-code');
          const code  = (input ? input.value : '').trim().toUpperCase();
          if (!code || code.length < 4) {
            if (typeof showToast === 'function') showToast('Entre un code valide');
            return;
          }
          this.joinSession(code);
        });
      }

      // Touche Entrée dans le champ code
      const joinCode = document.getElementById('join-code');
      if (joinCode) {
        joinCode.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const btnJoin = document.getElementById('btn-join');
            if (btnJoin) btnJoin.click();
          }
        });
      }

    } catch (e) {
      console.error('[Ensemble] Erreur initButtons:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     FIREBASE
     ═══════════════════════════════════════════════════════ */

  initFirebase() {
    try {
      // Firebase est chargé via AndroidBridge ou SDK web
      // En mode navigateur on simule
      if (typeof firebase !== 'undefined') {
        this.db = firebase.database();
        console.log('[Ensemble] Firebase connecté');
      } else {
        console.log('[Ensemble] Firebase non disponible — mode simulation');
      }
    } catch (e) {
      console.warn('[Ensemble] Firebase init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     CRÉER SESSION
     ═══════════════════════════════════════════════════════ */

  async createSession() {
    try {
      if (!navigator.onLine) {
        if (typeof showToast === 'function') showToast('❌ Connexion Internet requise');
        return;
      }

      const code      = this.generateCode();
      const sessionId = 'session_' + Date.now();

      const sessionData = {
        code,
        createdAt:   Date.now(),
        host:        this.userId,
        hostName:    this.userName,
        song:        null,
        position:    0,
        isPlaying:   false,
        participants: {
          [this.userId]: {
            id:       this.userId,
            name:     this.userName,
            isHost:   true,
            joinedAt: Date.now(),
          }
        },
        messages: {},
      };

      if (this.db) {
        await this.db.ref('sessions/' + sessionId).set(sessionData);
      }

      this.sessionCode = code;
      this.sessionId   = sessionId;
      this.isHost      = true;

      this.renderSessionScreen();
      this.listenSession(sessionId);

      if (typeof showToast === 'function') showToast('✓ Session créée : ' + code);

    } catch (e) {
      console.error('[Ensemble] Erreur createSession:', e);
      if (typeof showToast === 'function') showToast('❌ Impossible de créer la session');
    }
  },

  /* ═══════════════════════════════════════════════════════
     REJOINDRE SESSION
     ═══════════════════════════════════════════════════════ */

  async joinSession(code) {
    try {
      if (!navigator.onLine) {
        if (typeof showToast === 'function') showToast('❌ Connexion Internet requise');
        return;
      }

      if (typeof showToast === 'function') showToast('🔍 Recherche de la session...');

      let foundId   = null;
      let foundData = null;

      if (this.db) {
        // Chercher la session par code
        const snapshot = await this.db.ref('sessions')
          .orderByChild('code')
          .equalTo(code)
          .once('value');

        const sessions = snapshot.val();
        if (!sessions) {
          if (typeof showToast === 'function') showToast('❌ Session introuvable');
          return;
        }

        foundId   = Object.keys(sessions)[0];
        foundData = sessions[foundId];
      } else {
        // Simulation
        foundId   = 'session_sim';
        foundData = { code, participants: {}, host: 'host_sim' };
      }

      // Vérifier max participants
      const count = Object.keys(foundData.participants || {}).length;
      if (count >= this.MAX_PARTICIPANTS) {
        if (typeof showToast === 'function') showToast('❌ Session pleine (5 max)');
        return;
      }

      // Rejoindre
      if (this.db) {
        await this.db.ref(`sessions/${foundId}/participants/${this.userId}`).set({
          id:       this.userId,
          name:     this.userName,
          isHost:   false,
          joinedAt: Date.now(),
        });

        // Message système
        this.sendSystemMessage(foundId, this.userName + ' a rejoint la session');
      }

      this.sessionCode = code;
      this.sessionId   = foundId;
      this.isHost      = false;

      this.renderSessionScreen();
      this.listenSession(foundId);

      if (typeof showToast === 'function') showToast('✓ Rejoint la session !');

    } catch (e) {
      console.error('[Ensemble] Erreur joinSession:', e);
      if (typeof showToast === 'function') showToast('❌ Erreur lors de la connexion');
    }
  },

  /* ═══════════════════════════════════════════════════════
     ÉCOUTE TEMPS RÉEL (Firebase)
     ═══════════════════════════════════════════════════════ */

  listenSession(sessionId) {
    try {
      if (!this.db) return;

      this.sessionRef = this.db.ref('sessions/' + sessionId);

      // Participants
      this.sessionRef.child('participants').on('value', (snap) => {
        try {
          const data = snap.val() || {};
          this.participants = Object.values(data);
          this.renderParticipants();
        } catch (e) {}
      });

      // Chanson en cours (sync)
      this.sessionRef.child('song').on('value', (snap) => {
        try {
          const song = snap.val();
          if (song && !this.isHost) {
            this.syncSong(song);
          }
        } catch (e) {}
      });

      // Position (sync)
      this.sessionRef.child('position').on('value', (snap) => {
        try {
          const pos = snap.val();
          if (pos !== null && !this.isHost) {
            this.syncPosition(pos);
          }
        } catch (e) {}
      });

      // Messages chat
      this.sessionRef.child('messages').limitToLast(50).on('child_added', (snap) => {
        try {
          const msg = snap.val();
          if (msg) {
            this.messages.push(msg);
            this.renderNewMessage(msg);
          }
        } catch (e) {}
      });

      // Déconnexion propre
      this.sessionRef.child(`participants/${this.userId}`).onDisconnect().remove();

    } catch (e) {
      console.error('[Ensemble] Erreur listenSession:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     SYNC CHANSON
     ═══════════════════════════════════════════════════════ */

  async broadcastSong(song) {
    try {
      if (!this.isHost || !this.sessionRef || !song) return;

      await this.sessionRef.update({
        song: {
          id:       song.id,
          title:    song.title  || '',
          artist:   song.artist || '',
          album:    song.album  || '',
          duration: song.duration || 0,
          path:     song.path   || '',
        },
        position:  Player ? (Player.audio ? Player.audio.currentTime : 0) : 0,
        isPlaying: Player ? Player.isPlaying : false,
        updatedAt: Date.now(),
      });

    } catch (e) {
      console.error('[Ensemble] Erreur broadcastSong:', e);
    }
  },

  syncSong(songData) {
    try {
      if (!songData) return;

      // Vérifier si on a le fichier local
      const localSong = Library ? (Library.songs || []).find(s => s.id === songData.id) : null;

      if (localSong) {
        // On a le fichier → lire localement
        if (typeof Player !== 'undefined' && Player.play) {
          Player.play(localSong, [localSong], 0);
        }
      } else {
        // On n'a pas le fichier → streaming (non implémenté en mode navigateur)
        if (typeof showToast === 'function') {
          showToast('🎵 ' + (songData.title || '—') + ' — streaming...');
        }
      }

    } catch (e) {
      console.error('[Ensemble] Erreur syncSong:', e);
    }
  },

  syncPosition(pos) {
    try {
      if (Player && Player.audio && Math.abs(Player.audio.currentTime - pos) > 2) {
        Player.seek(pos);
      }
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     CHAT
     ═══════════════════════════════════════════════════════ */

  sendMessage(text) {
    try {
      if (!text || !text.trim() || !this.sessionRef) return;

      const msg = {
        id:        Date.now() + '_' + this.userId,
        userId:    this.userId,
        name:      this.userName,
        text:      text.trim(),
        ts:        Date.now(),
        type:      'text',
      };

      this.sessionRef.child('messages').push(msg);

    } catch (e) {
      console.error('[Ensemble] Erreur sendMessage:', e);
    }
  },

  sendEmoji(emoji) {
    try {
      if (!this.sessionRef) {
        // Mode simulation
        this.renderFloatingEmoji(emoji, this.userName);
        return;
      }

      const msg = {
        id:        Date.now() + '_' + this.userId,
        userId:    this.userId,
        name:      this.userName,
        text:      emoji,
        ts:        Date.now(),
        type:      'emoji',
      };

      this.sessionRef.child('messages').push(msg);
      this.renderFloatingEmoji(emoji, this.userName);

    } catch (e) {
      console.error('[Ensemble] Erreur sendEmoji:', e);
    }
  },

  sendSystemMessage(sessionId, text) {
    try {
      if (!this.db) return;
      this.db.ref(`sessions/${sessionId}/messages`).push({
        id:    Date.now() + '_sys',
        type:  'system',
        text,
        ts:    Date.now(),
      });
    } catch (e) {}
  },

  sendShareSong(song) {
    try {
      if (!this.sessionRef || !song) return;
      const msg = {
        id:      Date.now() + '_' + this.userId,
        userId:  this.userId,
        name:    this.userName,
        type:    'song',
        text:    song.title || '',
        artist:  song.artist || '',
        songId:  song.id,
        ts:      Date.now(),
      };
      this.sessionRef.child('messages').push(msg);
    } catch (e) {
      console.error('[Ensemble] Erreur sendShareSong:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     VOCAL
     ═══════════════════════════════════════════════════════ */

  async startMic() {
    try {
      if (this.isMicActive) {
        this.stopMic();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      this.isMicActive = true;

      // Baisser le volume musique de 20%
      if (Player && Player.audio) {
        Player.audio.volume = Math.max(0, (Player.audio.volume || 1) - 0.2);
      }

      // Signaler qu'on parle
      if (this.sessionRef) {
        this.sessionRef.child(`participants/${this.userId}/isSpeaking`).set(true);
      }

      if (typeof showToast === 'function') showToast('🎤 Micro activé');

    } catch (e) {
      console.warn('[Ensemble] Micro non disponible:', e);
      if (typeof showToast === 'function') showToast('❌ Micro non disponible');
    }
  },

  stopMic() {
    try {
      if (this.micStream) {
        this.micStream.getTracks().forEach(t => t.stop());
        this.micStream = null;
      }
      this.isMicActive = false;

      // Restaurer volume
      if (Player && Player.audio) {
        Player.audio.volume = Math.min(1, (Player.audio.volume || 0.8) + 0.2);
      }

      // Signaler qu'on ne parle plus
      if (this.sessionRef) {
        this.sessionRef.child(`participants/${this.userId}/isSpeaking`).set(false);
      }

    } catch (e) {
      console.error('[Ensemble] Erreur stopMic:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     RENDU ÉCRAN SESSION
     ═══════════════════════════════════════════════════════ */

  renderSessionScreen() {
    try {
      const screen = document.getElementById('screen-ensemble');
      if (!screen) return;

      screen.innerHTML = `
        <div id="ensemble-session">

          <!-- Header session -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 16px;">
            <button onclick="Ensemble.leaveSession()" style="color:var(--text2);font-size:22px;background:none;border:none;cursor:pointer;">‹</button>
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:0.1em;">SESSION EN COURS</div>
              <div style="font-size:18px;font-weight:800;color:var(--accent);letter-spacing:0.15em;">${this.sessionCode}</div>
            </div>
            <button onclick="Ensemble.copyCode()" style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius-pill);padding:6px 12px;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;">📋 Copier</button>
          </div>

          <!-- Participants -->
          <div id="ensemble-participants" style="margin-bottom:16px;"></div>

          <!-- Pochette + émojis flottants -->
          <div id="ensemble-art" style="position:relative;width:100%;aspect-ratio:1;border-radius:var(--radius);overflow:hidden;background:linear-gradient(135deg,#1a0d2e,#4c1d95);display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:16px;">
            🎵
            <div id="floating-emojis" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;"></div>
          </div>

          <!-- Réactions émojis -->
          <div style="display:flex;justify-content:space-around;margin-bottom:16px;">
            ${['😀','😍','🔥','💃','❤'].map(e => `
              <button onclick="Ensemble.sendEmoji('${e}')" style="font-size:28px;background:var(--card2);border:1px solid var(--border);border-radius:50%;width:52px;height:52px;cursor:pointer;">${e}</button>
            `).join('')}
          </div>

          <!-- Progression -->
          <div style="margin-bottom:16px;">
            <div style="height:3px;background:var(--bg3);border-radius:99px;">
              <div id="ensemble-bar" style="height:3px;width:0%;background:linear-gradient(90deg,var(--accent3),var(--accent));border-radius:99px;transition:width 0.5s linear;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-top:4px;font-family:'Space Mono',monospace;">
              <span id="ensemble-time-cur">0:00</span>
              <span id="ensemble-time-tot">0:00</span>
            </div>
          </div>

          <!-- Chat -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:var(--text3);letter-spacing:0.05em;">💬 CHAT</div>
            <button onpointerdown="Ensemble.startMic()" onpointerup="Ensemble.stopMic()" style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius-pill);padding:6px 14px;font-size:12px;font-weight:700;color:var(--text2);cursor:pointer;">🎤 Maintenir</button>
          </div>

          <!-- Messages -->
          <div id="ensemble-messages" style="background:var(--card);border-radius:var(--radius);border:1px solid var(--border);height:200px;overflow-y:auto;padding:10px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;scrollbar-width:none;"></div>

          <!-- Input chat -->
          <div style="display:flex;gap:8px;">
            <input id="ensemble-chat-input" placeholder="Envoie un message..." style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:var(--radius-pill);padding:10px 16px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;">
            <button onclick="Ensemble.sendFromInput()" style="background:linear-gradient(135deg,var(--accent3),var(--accent2));color:white;border-radius:50%;width:42px;height:42px;font-size:18px;cursor:pointer;flex-shrink:0;">➤</button>
          </div>

        </div>
      `;

      // Événement Entrée dans le chat
      const input = document.getElementById('ensemble-chat-input');
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.sendFromInput();
        });
      }

      // Masquer mini lecteur en session
      const mini = document.getElementById('mini-player');
      if (mini) mini.classList.add('hidden');

      this.renderParticipants();

    } catch (e) {
      console.error('[Ensemble] Erreur renderSessionScreen:', e);
    }
  },

  renderParticipants() {
    try {
      const el = document.getElementById('ensemble-participants');
      if (!el) return;

      const parts = this.participants.length > 0 ? this.participants : [
        { id: this.userId, name: this.userName, isHost: this.isHost }
      ];

      el.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${parts.map(p => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--accent3),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:22px;position:relative;${p.isSpeaking ? 'box-shadow:0 0 16px var(--accent);' : ''}">
                👤
                ${p.isHost ? '<div style="position:absolute;bottom:-2px;right:-2px;font-size:12px;">👑</div>' : ''}
              </div>
              <div style="font-size:10px;color:var(--text2);font-weight:600;max-width:56px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escape(p.name || 'Inconnu')}</div>
            </div>
          `).join('')}
          ${parts.length < this.MAX_PARTICIPANTS ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="width:48px;height:48px;border-radius:50%;background:var(--card2);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3);">+</div>
              <div style="font-size:10px;color:var(--text3);">Inviter</div>
            </div>
          ` : ''}
        </div>
      `;
    } catch (e) {
      console.error('[Ensemble] Erreur renderParticipants:', e);
    }
  },

  renderNewMessage(msg) {
    try {
      const container = document.getElementById('ensemble-messages');
      if (!container || !msg) return;

      const el = document.createElement('div');
      const isMe = msg.userId === this.userId;

      if (msg.type === 'system') {
        el.style.cssText = 'text-align:center;font-size:11px;color:var(--text3);padding:2px 0;';
        el.textContent = '── ' + (msg.text || '') + ' ──';
      } else if (msg.type === 'emoji') {
        el.style.cssText = `text-align:${isMe ? 'right' : 'left'};font-size:28px;`;
        el.textContent = msg.text || '';
      } else if (msg.type === 'song') {
        el.style.cssText = `display:flex;justify-content:${isMe ? 'flex-end' : 'flex-start'};`;
        el.innerHTML = `
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;max-width:80%;cursor:pointer;" onclick="Library && Library.playSong && Library.playSong({id:'${msg.songId}',title:'${this.escape(msg.text)}',artist:'${this.escape(msg.artist||'')}'},[],0)">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">🎵 ${this.escape(msg.name||'')} partage</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">${this.escape(msg.text||'')}</div>
            <div style="font-size:11px;color:var(--text3);">${this.escape(msg.artist||'')}</div>
            <div style="font-size:11px;color:var(--accent);margin-top:4px;">▶ Lire après</div>
          </div>
        `;
      } else {
        el.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};`;
        el.innerHTML = `
          ${!isMe ? `<div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${this.escape(msg.name||'')}</div>` : ''}
          <div style="background:${isMe ? 'linear-gradient(135deg,var(--accent3),var(--accent2))' : 'var(--card2)'};color:${isMe ? 'white' : 'var(--text)'};border-radius:var(--radius-sm);padding:8px 12px;max-width:80%;font-size:13px;">
            ${this.escape(msg.text||'')}
          </div>
        `;
      }

      container.appendChild(el);
      container.scrollTop = container.scrollHeight;

    } catch (e) {
      console.error('[Ensemble] Erreur renderNewMessage:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ÉMOJIS FLOTTANTS
     ═══════════════════════════════════════════════════════ */

  renderFloatingEmoji(emoji, name) {
    try {
      const container = document.getElementById('floating-emojis');
      if (!container) return;

      const el = document.createElement('div');
      const x  = 10 + Math.random() * 70;

      el.style.cssText = `
        position:absolute;
        left:${x}%;
        bottom:10%;
        font-size:32px;
        animation:floatUp 2.5s ease-out forwards;
        pointer-events:none;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
      `;
      el.innerHTML = `
        <span>${emoji}</span>
        <span style="font-size:10px;color:white;background:rgba(0,0,0,0.5);border-radius:99px;padding:1px 6px;">${this.escape(name||'')}</span>
      `;

      container.appendChild(el);
      setTimeout(() => el.remove(), 2600);

      // Ajouter animation CSS si pas encore là
      if (!document.getElementById('float-anim')) {
        const style = document.createElement('style');
        style.id = 'float-anim';
        style.textContent = `
          @keyframes floatUp {
            0%   { transform:translateY(0);   opacity:1; }
            100% { transform:translateY(-200px); opacity:0; }
          }
        `;
        document.head.appendChild(style);
      }

    } catch (e) {
      console.error('[Ensemble] Erreur renderFloatingEmoji:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     QUITTER SESSION
     ═══════════════════════════════════════════════════════ */

  async leaveSession() {
    try {
      if (this.sessionRef) {
        // Retirer participant
        await this.sessionRef.child(`participants/${this.userId}`).remove();

        // Si hôte → fermer la session
        if (this.isHost) {
          await this.sessionRef.update({ closed: true });
          this.sendSystemMessage(this.sessionId, 'Session fermée par l\'hôte');
        } else {
          this.sendSystemMessage(this.sessionId, this.userName + ' a quitté la session');
        }

        this.sessionRef.off(); // Désabonnement
      }

      this.sessionRef   = null;
      this.sessionCode  = null;
      this.sessionId    = null;
      this.isHost       = false;
      this.participants = [];
      this.messages     = [];

      // Restaurer mini lecteur
      const mini = document.getElementById('mini-player');
      if (mini && Player && Player.currentSong) mini.classList.remove('hidden');

      // Restaurer l'écran ensemble
      this.renderHomeScreen();

      if (typeof showToast === 'function') showToast('Session quittée');
      this.stopMic();

    } catch (e) {
      console.error('[Ensemble] Erreur leaveSession:', e);
    }
  },

  renderHomeScreen() {
    try {
      const screen = document.getElementById('screen-ensemble');
      if (!screen) return;

      screen.innerHTML = `
        <div class="ensemble-hero">
          <div class="ensemble-icon">🎧</div>
          <div class="ensemble-title">Écoute Ensemble</div>
          <div class="ensemble-sub">Écoute de la musique en temps réel<br>avec tes amis</div>
        </div>
        <div class="ensemble-btn" id="btn-creer-session">
          <div class="ensemble-btn-icon">✨</div>
          <div class="ensemble-btn-text">
            <div class="ensemble-btn-title">Créer une session</div>
            <div class="ensemble-btn-sub">Invite jusqu'à 4 amis</div>
          </div>
          <div class="ensemble-btn-arrow">›</div>
        </div>
        <div class="join-box">
          <div class="join-label">REJOINDRE UNE SESSION</div>
          <div class="join-input-row">
            <input class="join-input" id="join-code" placeholder="Code ex: AB3X7K" maxlength="6">
            <button class="btn-join" id="btn-join">Rejoindre</button>
          </div>
        </div>
      `;

      this.initButtons();

    } catch (e) {
      console.error('[Ensemble] Erreur renderHomeScreen:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     UTILITAIRES
     ═══════════════════════════════════════════════════════ */

  sendFromInput() {
    try {
      const input = document.getElementById('ensemble-chat-input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      this.sendMessage(text);
      input.value = '';
    } catch (e) {
      console.error('[Ensemble] Erreur sendFromInput:', e);
    }
  },

  copyCode() {
    try {
      if (!this.sessionCode) return;
      navigator.clipboard.writeText(this.sessionCode)
        .then(() => {
          if (typeof showToast === 'function') showToast('📋 Code copié : ' + this.sessionCode);
        })
        .catch(() => {
          if (typeof showToast === 'function') showToast('Code : ' + this.sessionCode);
        });
    } catch (e) {}
  },

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  getOrCreateUserId() {
    try {
      let id = localStorage.getItem('gag_user_id');
      if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        localStorage.setItem('gag_user_id', id);
      }
      return id;
    } catch (e) {
      return 'user_' + Date.now();
    }
  },

  getSavedName() {
    try {
      return localStorage.getItem('gag_user_name') || null;
    } catch (e) {
      return null;
    }
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  },
};

/* Exposer Ensemble globalement */
window.Ensemble = Ensemble;
