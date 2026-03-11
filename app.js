/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — app.js
   Navigation, réglages, style, toast, menu contextuel
   ═══════════════════════════════════════════════════════ */

/* ─── ÉTAT GLOBAL ─── */
const App = {
  currentTab:    'accueil',
  currentStyle:  'GAGNOTE',
  accentColor:   '#c084fc',
  accentDark:    '#7c3aed',
  isPlaying:     false,
  toastTimer:    null,
  historyStack:  [], // pour la touche retour
};

/* ─── INITIALISATION ─── */
document.addEventListener('DOMContentLoaded', () => {
  try {
    initGreeting();
    initTabs();
    initHeader();
    initPlayer();
    initMiniPlayer();
    initSettings();
    initStyle();
    initAccentColors();
    initContextMenu();
    initBackButton();
    loadSavedPreferences();

    // Initialiser les autres modules si disponibles
    if (typeof Player  !== 'undefined') Player.init();
    if (typeof Library !== 'undefined') Library.init();
    if (typeof Lyrics  !== 'undefined') Lyrics.init();
    if (typeof Stats   !== 'undefined') Stats.init();
    if (typeof Ensemble!== 'undefined') Ensemble.init();

    // Afficher mini lecteur si une chanson était en cours
    restoreLastSong();

    console.log('[App] Initialisé avec succès');
  } catch (e) {
    console.error('[App] Erreur init:', e);
  }
});

/* ═══════════════════════════════════════════════════════
   SALUTATION DYNAMIQUE
   ═══════════════════════════════════════════════════════ */
function initGreeting() {
  try {
    updateGreeting();
    // Mise à jour toutes les minutes
    setInterval(updateGreeting, 60000);
  } catch (e) {
    console.error('[App] Erreur greeting:', e);
  }
}

function updateGreeting() {
  try {
    const h = new Date().getHours();
    let greeting = '🌙 Bonne nuit';
    if      (h >= 6  && h < 12) greeting = '🌅 Bonjour';
    else if (h >= 12 && h < 18) greeting = '☀️ Bon après-midi';
    else if (h >= 18 && h < 21) greeting = '🌆 Bonsoir';
    const el = document.getElementById('greeting');
    if (el) el.textContent = greeting;
  } catch (e) {
    console.error('[App] Erreur updateGreeting:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   ONGLETS
   ═══════════════════════════════════════════════════════ */
function initTabs() {
  try {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        if (name) switchTab(name);
      });
    });
  } catch (e) {
    console.error('[App] Erreur initTabs:', e);
  }
}

function switchTab(name) {
  try {
    closeAllSubscreens();

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const tab    = document.querySelector(`.tab[data-tab="${name}"]`);
    const screen = document.getElementById('screen-' + name);

    if (tab)    tab.classList.add('active');
    if (screen) screen.classList.add('active');

    App.currentTab = name;
    App.historyStack.push({ type: 'tab', name });

    // Cacher le mini lecteur sur l'onglet Ensemble
    const mini = document.getElementById('mini-player');
    if (mini) {
      if (name === 'ensemble') {
        mini.style.display = 'none';
      } else {
        mini.style.display = '';
      }
    }

    console.log('[App] Onglet:', name);
  } catch (e) {
    console.error('[App] Erreur switchTab:', e);
  }
}

function closeAllSubscreens() {
  try {
    document.querySelectorAll('.subscreen').forEach(s => {
      s.classList.remove('open');
    });
  } catch (e) {
    console.error('[App] Erreur closeAllSubscreens:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   HEADER (SCAN + RÉGLAGES)
   ═══════════════════════════════════════════════════════ */
function initHeader() {
  try {
    // Bouton scan
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        try {
          if (typeof Library !== 'undefined' && Library.scan) {
            Library.scan();
          } else {
            showToast('⟳ Scan en cours...');
          }
        } catch (e) {
          console.error('[App] Erreur scan:', e);
        }
      });
    }

    // Bouton réglages
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', openSettings);
    }
  } catch (e) {
    console.error('[App] Erreur initHeader:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   LECTEUR PLEIN ÉCRAN — CARROUSEL 3 VUES
   ═══════════════════════════════════════════════════════ */

let playerView    = 1; // 0=infos 1=main 2=paroles
let inactiveTimer = null;

function initPlayer() {
  try {
    // Fermer (toutes les vues)
    ['player-down','player-down-infos','player-down-paroles'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', closePlayer);
    });

    // Options ···
    ['player-menu-btn','player-menu-btn-infos'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => {
        showContextMenu([
          { icon:'▶', label:'Lire ensuite',       action: () => showToast('Ajouté après la chanson en cours') },
          { icon:'⊕', label:'Ajouter à la file',  action: () => showToast('Ajouté à la file') },
          { icon:'🎵',label:'Ajouter à playlist', action: () => showToast('Choisir une playlist...') },
          { icon:'👤',label:'Voir artiste',        action: () => { closePlayer(); switchTab('artistes'); } },
          { icon:'✎', label:'Modifier les infos', action: () => showToast('Modifier...') },
          { separator: true },
          { icon:'🗑', label:'Supprimer',          action: () => showToast('Supprimer ?'), danger: true },
        ]);
      });
    });

    // Like
    const btnLike = document.getElementById('btn-like');
    if (btnLike) {
      btnLike.addEventListener('click', () => {
        btnLike.classList.toggle('liked');
        const liked = btnLike.classList.contains('liked');
        btnLike.textContent = liked ? '♥' : '♡';
        showToast(liked ? '❤ Ajouté aux coups de cœur' : 'Retiré des coups de cœur');
      });
    }

    // Boutons contrôles
    document.getElementById('btn-queue')?.addEventListener('click', () => showToast('⊕ Ajouté à la file'));
    document.getElementById('btn-options')?.addEventListener('click', () => document.getElementById('player-menu-btn')?.click());
    document.getElementById('btn-play-main')?.addEventListener('click', togglePlay);
    document.getElementById('btn-prev')?.addEventListener('click', () => { if (typeof Player !== 'undefined' && Player.prev) Player.prev(); });
    document.getElementById('btn-next')?.addEventListener('click', () => { if (typeof Player !== 'undefined' && Player.next) Player.next(); });
    document.getElementById('btn-rewind')?.addEventListener('click',  () => { if (typeof Player !== 'undefined') Player.seekRelative(-10); });
    document.getElementById('btn-forward')?.addEventListener('click', () => { if (typeof Player !== 'undefined') Player.seekRelative(10); });
    document.getElementById('btn-queue-panel')?.addEventListener('click', openQueuePanel);

    // Shuffle
    const btnShuffle = document.getElementById('btn-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        if (typeof Player !== 'undefined') Player.toggleShuffle();
        btnShuffle.classList.toggle('active');
      });
    }

    // Boutons paroles (EQ, sync, traduction)
    initParolesButtons();

    // EQ presets
    document.querySelectorAll('.eq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.eq-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (typeof Lyrics !== 'undefined' && Lyrics.applyEQPreset) Lyrics.applyEQPreset(btn.dataset.preset);
      });
    });

    // Sync
    document.getElementById('sync-minus')?.addEventListener('click', () => { if (typeof Lyrics !== 'undefined') Lyrics.adjustSync(-0.5); });
    document.getElementById('sync-plus')?.addEventListener('click',  () => { if (typeof Lyrics !== 'undefined') Lyrics.adjustSync(0.5); });
    document.getElementById('sync-auto')?.addEventListener('click',  () => { if (typeof Lyrics !== 'undefined') Lyrics.resetSync(); });

    // Taille police
    document.querySelectorAll('.font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (typeof Lyrics !== 'undefined') Lyrics.setFontSize(btn.dataset.size);
      });
    });

    // Swipe carrousel + bas fermer
    initPlayerSwipe();

    // Mode inactif
    initInactiveMode();

  } catch (e) {
    console.error('[App] Erreur initPlayer:', e);
  }
}

function initParolesButtons() {
  try {
    const btnEQ     = document.getElementById('btn-eq');
    const btnSync   = document.getElementById('btn-sync');
    const btnTrad   = document.getElementById('btn-translate');
    const panelSon  = document.getElementById('panel-son');
    const panelSync = document.getElementById('panel-sync');

    btnEQ?.addEventListener('click', () => {
      const open = !panelSon?.classList.contains('hidden');
      panelSon?.classList.toggle('hidden', open);
      panelSync?.classList.add('hidden');
      btnEQ.classList.toggle('active', !open);
    });

    btnSync?.addEventListener('click', () => {
      const open = !panelSync?.classList.contains('hidden');
      panelSync?.classList.toggle('hidden', open);
      panelSon?.classList.add('hidden');
      btnSync?.classList.toggle('active', !open);
    });

    btnTrad?.addEventListener('click', () => {
      btnTrad.classList.toggle('active');
      if (typeof Lyrics !== 'undefined') Lyrics.translate();
    });

    // Clic ligne → seek
    document.getElementById('paroles-list')?.addEventListener('click', (e) => {
      const line = e.target.closest('.paroles-line');
      if (!line) return;
      const time = parseFloat(line.dataset.time || 0);
      if (typeof Player !== 'undefined' && Player.seek) Player.seek(time);
    });
  } catch (e) {
    console.error('[App] Erreur initParolesButtons:', e);
  }
}

function openPlayer() {
  try {
    const screen = document.getElementById('player-screen');
    if (screen) {
      screen.classList.add('open');
      App.historyStack.push({ type: 'player' });
      resetInactiveTimer();
    }
  } catch (e) {
    console.error('[App] Erreur openPlayer:', e);
  }
}

function closePlayer() {
  try {
    const screen = document.getElementById('player-screen');
    if (screen) {
      screen.classList.remove('open');
      screen.classList.remove('inactive');
    }
    clearTimeout(inactiveTimer);
    if (typeof Lyrics !== 'undefined' && Lyrics.releaseWakeLock) Lyrics.releaseWakeLock();
  } catch (e) {
    console.error('[App] Erreur closePlayer:', e);
  }
}

function togglePlay() {
  try {
    if (typeof Player !== 'undefined' && Player.togglePlay) {
      Player.togglePlay();
    } else {
      App.isPlaying = !App.isPlaying;
      const icon = App.isPlaying ? '⏸' : '▶';
      document.getElementById('btn-play-main')?.setAttribute('textContent', icon);
      document.getElementById('mini-play')?.setAttribute('textContent', icon);
    }
    resetInactiveTimer();
  } catch (e) {
    console.error('[App] Erreur togglePlay:', e);
  }
}

/* ── Carrousel + swipe bas ── */
function initPlayerSwipe() {
  try {
    const screen = document.getElementById('player-screen');
    if (!screen) return;

    let startX = 0, startY = 0, startTime = 0;

    screen.addEventListener('touchstart', (e) => {
      startX    = e.touches[0].clientX;
      startY    = e.touches[0].clientY;
      startTime = Date.now();
      // Sortir du mode inactif
      screen.classList.remove('inactive');
      resetInactiveTimer();
    }, { passive: true });

    screen.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Date.now() - startTime;
      const vx = Math.abs(dx) / dt;
      const vy = dy / dt;
      const horizontal = Math.abs(dx) > Math.abs(dy);

      if (horizontal && (Math.abs(dx) > 50 || vx > 0.3)) {
        // Swipe horizontal → changer vue
        setPlayerView(dx < 0 ? Math.min(playerView + 1, 2) : Math.max(playerView - 1, 0));
      } else if (!horizontal && (dy > 80 || vy > 0.4) && playerView === 1) {
        // Swipe bas sur vue principale → fermer
        closePlayer();
      }
    }, { passive: true });

  } catch (e) {
    console.error('[App] Erreur initPlayerSwipe:', e);
  }
}

function setPlayerView(view) {
  try {
    playerView = view;
    const carousel = document.getElementById('player-carousel');
    if (carousel) {
      carousel.classList.remove('view-0','view-1','view-2');
      carousel.classList.add('view-' + view);
    }

    // Dots
    ['dot-infos','dot-main','dot-paroles'].forEach((id, i) => {
      document.getElementById(id)?.classList.toggle('active', i === view);
    });

    // Vue paroles → WakeLock + charger
    if (view === 2) {
      if (typeof Lyrics !== 'undefined' && Lyrics.requestWakeLock) Lyrics.requestWakeLock();
      renderParolesView();
    } else {
      if (typeof Lyrics !== 'undefined' && Lyrics.releaseWakeLock) Lyrics.releaseWakeLock();
    }

    // Vue infos → remplir
    if (view === 0) renderInfosView();

  } catch (e) {
    console.error('[App] Erreur setPlayerView:', e);
  }
}

function renderInfosView() {
  try {
    const song = (typeof Player !== 'undefined') ? Player.currentSong : null;
    if (!song) return;
    const stats = (typeof Library !== 'undefined') ? (Library.stats[song.id] || {}) : {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    set('info-title',    song.title);
    set('info-artist',   song.artist);
    set('info-album',    song.album);
    set('info-genre',    song.genre);
    set('info-duration', typeof formatTime === 'function' ? formatTime(song.duration) : '—');
    set('info-plays',    stats.plays || 0);
    set('info-added',    song.addedAt ? new Date(song.addedAt).toLocaleDateString('fr-FR') : '—');
    set('info-file',     song.fileName || '—');
  } catch (e) {
    console.error('[App] Erreur renderInfosView:', e);
  }
}

function renderParolesView() {
  try {
    const list = document.getElementById('paroles-list');
    if (!list) return;

    const song = (typeof Player !== 'undefined') ? Player.currentSong : null;
    if (song) {
      const titleEl = document.getElementById('paroles-song-title');
      if (titleEl) titleEl.textContent = song.title || 'PAROLES';
    }

    const lines = (typeof Lyrics !== 'undefined' && Lyrics.lines) ? Lyrics.lines : [];

    if (!lines.length) {
      list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px 0;">Paroles en cours de chargement...</div>';
      if (song && typeof Lyrics !== 'undefined') Lyrics.load(song);
      return;
    }

    list.innerHTML = '';
    lines.forEach((line) => {
      const el = document.createElement('div');
      el.className = 'paroles-line';
      el.dataset.time = line.time || 0;
      el.textContent  = line.text || '';
      list.appendChild(el);
    });
  } catch (e) {
    console.error('[App] Erreur renderParolesView:', e);
  }
}

/* Mise à jour ligne active paroles (appelé par Lyrics) */
function updateParolesActive(lineIndex) {
  try {
    if (playerView !== 2) return;
    const lines = document.querySelectorAll('.paroles-line');
    lines.forEach((el, i) => {
      el.classList.remove('active','next');
      if (i === lineIndex)     el.classList.add('active');
      if (i === lineIndex + 1) el.classList.add('next');
    });
    document.querySelector('.paroles-line.active')?.scrollIntoView({ behavior:'smooth', block:'center' });
  } catch (e) {}
}

/* ── Mode inactif 10s ── */
function initInactiveMode() {
  try {
    const screen = document.getElementById('player-screen');
    if (!screen) return;
    screen.addEventListener('touchstart', () => {
      screen.classList.remove('inactive');
      resetInactiveTimer();
    }, { passive: true });
  } catch (e) {}
}

function resetInactiveTimer() {
  try {
    clearTimeout(inactiveTimer);
    inactiveTimer = setTimeout(() => {
      const screen = document.getElementById('player-screen');
      if (screen?.classList.contains('open')) screen.classList.add('inactive');
    }, 10000);
  } catch (e) {}
}


/* ═══════════════════════════════════════════════════════
   MINI LECTEUR
   ═══════════════════════════════════════════════════════ */
function initMiniPlayer() {
  try {
    const mini = document.getElementById('mini-player');
    if (!mini) return;

    // Clic sur le mini lecteur → ouvrir lecteur plein écran
    const content = document.getElementById('mini-player-content');
    const info    = document.getElementById('mini-info');
    if (info) info.addEventListener('click', openPlayer);

    // Boutons mini
    const btnPrev = document.getElementById('mini-prev');
    const btnPlay = document.getElementById('mini-play');
    const btnNext = document.getElementById('mini-next');

    if (btnPrev) {
      btnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Player !== 'undefined' && Player.prev) Player.prev();
        else showToast('⏮ Précédent');
      });
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Player !== 'undefined' && Player.next) Player.next();
        else showToast('⏭ Suivant');
      });
    }

    // Clic sur vinyle → ouvrir lecteur
    const thumb = document.getElementById('mini-thumb');
    if (thumb) thumb.addEventListener('click', openPlayer);

  } catch (e) {
    console.error('[App] Erreur initMiniPlayer:', e);
  }
}

/* Mettre à jour le mini lecteur avec les infos de la chanson */
function updateMiniPlayer(song) {
  try {
    if (!song) return;
    const mini = document.getElementById('mini-player');
    if (mini) mini.classList.remove('hidden');

    const elTitle  = document.getElementById('mini-title');
    const elArtist = document.getElementById('mini-artist');
    const elAlbum  = document.getElementById('mini-album');

    if (elTitle)  elTitle.textContent  = song.title  || '—';
    if (elArtist) elArtist.textContent = song.artist || '—';
    if (elAlbum)  elAlbum.textContent  = song.album  || '—';

    // Mettre à jour le lecteur aussi
    const pTitle  = document.getElementById('player-title');
    const pArtist = document.getElementById('player-artist');
    if (pTitle)  pTitle.textContent  = song.title  || '—';
    if (pArtist) pArtist.textContent = song.artist || '—';

  } catch (e) {
    console.error('[App] Erreur updateMiniPlayer:', e);
  }
}

/* Mettre à jour la progression */
function updateProgress(current, total) {
  try {
    const pct = total > 0 ? (current / total) * 100 : 0;

    const miniBar    = document.getElementById('mini-bar');
    const playerBar  = document.getElementById('player-bar');
    const timeCurrent= document.getElementById('player-time-current');
    const timeTotal  = document.getElementById('player-time-total');

    if (miniBar)    miniBar.style.width    = pct + '%';
    if (playerBar)  playerBar.style.width  = pct + '%';
    if (timeCurrent) timeCurrent.textContent = formatTime(current);
    if (timeTotal)   timeTotal.textContent   = formatTime(total);

    // Barre continuer accueil
    const continueBar = document.getElementById('continue-bar');
    if (continueBar) continueBar.style.width = pct + '%';

  } catch (e) {
    console.error('[App] Erreur updateProgress:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   RÉGLAGES
   ═══════════════════════════════════════════════════════ */
function initSettings() {
  try {
    const btnBack   = document.getElementById('back-settings');
    const btnStyle  = document.getElementById('settings-style');
    const btnCompte = document.getElementById('settings-compte');
    const btnTheme  = document.getElementById('settings-theme');
    const btnQuality= document.getElementById('settings-quality');

    if (btnBack)    btnBack.addEventListener('click', closeSettings);
    if (btnStyle)   btnStyle.addEventListener('click', openStyle);
    if (btnCompte)  btnCompte.addEventListener('click', () => showToast('Connexion bientôt disponible'));

    // Thème clair / sombre
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        App.isDark = !App.isDark;
        applyTheme(App.isDark);
        savePreferences();
      });
    }

    // Qualité stream
    if (btnQuality) {
      const qualities = ['Auto', 'Haute', 'Basse'];
      btnQuality.addEventListener('click', () => {
        const valEl = document.getElementById('quality-value');
        const cur   = qualities.indexOf(valEl?.textContent || 'Auto');
        const next  = qualities[(cur + 1) % qualities.length];
        if (valEl) valEl.textContent = next;
        showToast('Stream : ' + next);
        savePreferences();
      });
    }

  } catch (e) {
    console.error('[App] Erreur initSettings:', e);
  }
}

function applyTheme(dark) {
  try {
    const iconEl  = document.getElementById('theme-icon');
    const valueEl = document.getElementById('theme-value');

    if (dark) {
      document.documentElement.style.setProperty('--bg',   '#0a0a0f');
      document.documentElement.style.setProperty('--bg2',  '#12121a');
      document.documentElement.style.setProperty('--bg3',  '#1a1a26');
      document.documentElement.style.setProperty('--text', '#ffffff');
      document.documentElement.style.setProperty('--text2','#c4c4d4');
      document.documentElement.style.setProperty('--text3','#6b6b8a');
      if (iconEl)  iconEl.textContent  = '🌙';
      if (valueEl) valueEl.textContent = 'Sombre';
    } else {
      document.documentElement.style.setProperty('--bg',   '#f0f0f8');
      document.documentElement.style.setProperty('--bg2',  '#e4e4f0');
      document.documentElement.style.setProperty('--bg3',  '#d8d8e8');
      document.documentElement.style.setProperty('--text', '#0a0a1a');
      document.documentElement.style.setProperty('--text2','#2a2a3a');
      document.documentElement.style.setProperty('--text3','#6a6a8a');
      if (iconEl)  iconEl.textContent  = '☀️';
      if (valueEl) valueEl.textContent = 'Clair';
    }
  } catch (e) {
    console.error('[App] Erreur applyTheme:', e);
  }
}

function openSettings() {
  try {
    const screen = document.getElementById('settings-screen');
    if (screen) {
      screen.classList.add('open');
      App.historyStack.push({ type: 'settings' });
    }
  } catch (e) {
    console.error('[App] Erreur openSettings:', e);
  }
}

function closeSettings() {
  try {
    const screen = document.getElementById('settings-screen');
    if (screen) screen.classList.remove('open');
  } catch (e) {
    console.error('[App] Erreur closeSettings:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   COULEURS ACCENT
   ═══════════════════════════════════════════════════════ */
function initAccentColors() {
  try {
    const dots = document.querySelectorAll('.accent-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const accent = dot.dataset.accent;
        const dark   = dot.dataset.dark;
        if (!accent || !dark) return;

        // Désélectionner tous
        dots.forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');

        // Appliquer
        applyAccent(accent, dark);
        savePreferences();
        showToast('Couleur mise à jour');
      });
    });
  } catch (e) {
    console.error('[App] Erreur initAccentColors:', e);
  }
}

function applyAccent(accent, dark) {
  try {
    document.documentElement.style.setProperty('--accent',  accent);
    document.documentElement.style.setProperty('--accent2', accent);
    document.documentElement.style.setProperty('--accent3', dark);
    document.documentElement.style.setProperty('--glow',    hexToRgba(accent, 0.25));
    App.accentColor = accent;
    App.accentDark  = dark;
  } catch (e) {
    console.error('[App] Erreur applyAccent:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   CENTRE DE STYLE
   ═══════════════════════════════════════════════════════ */
function initStyle() {
  try {
    const btnBack = document.getElementById('back-style');
    if (btnBack) btnBack.addEventListener('click', closeStyle);

    const cards = document.querySelectorAll('.style-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const style  = card.dataset.style;
        const bg     = card.dataset.bg;
        const accent = card.dataset.accent;
        const dark   = card.dataset.dark;
        if (!style) return;

        // Désélectionner tous
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Appliquer le style
        applyStyle(style, bg, accent, dark);
        savePreferences();
        showToast('Style : ' + style);

        // Fermer après 800ms
        setTimeout(closeStyle, 800);
      });
    });
  } catch (e) {
    console.error('[App] Erreur initStyle:', e);
  }
}

function applyStyle(style, bg, accent, dark) {
  try {
    // ── Fond
    if (bg) {
      document.documentElement.style.setProperty('--bg',  bg);
      document.documentElement.style.setProperty('--bg2', adjustBrightness(bg, 8));
      document.documentElement.style.setProperty('--bg3', adjustBrightness(bg, 16));
    }

    // ── Accent
    if (accent && dark) {
      applyAccent(accent, dark);
      const dots = document.querySelectorAll('.accent-dot');
      dots.forEach(d => {
        d.classList.remove('selected');
        if (d.dataset.accent === accent) d.classList.add('selected');
      });
    }

    // ── Supprimer ancien style dynamique
    const old = document.getElementById('dynamic-style');
    if (old) old.remove();

    // ── CSS par style (typo + formes + icônes)
    const STYLES = {
      'GAGNOTE': `
        :root { --radius:20px; --radius-sm:12px; --radius-pill:99px; }
        .header-title { font-style:normal; letter-spacing:0; }
        .btn-scan { border-radius:99px; }
      `,
      'CHAOS BORN': `
        :root { --radius:6px; --radius-sm:4px; --radius-pill:6px; }
        body, .song-name, .tab-label, .header-title, .section-title { font-family:'Arial Black',sans-serif !important; }
        .song-name, .header-title { font-style:italic; }
        .tab-label { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; }
        .header-title { letter-spacing:0.05em; }
        .btn-scan { border-radius:4px; text-transform:uppercase; letter-spacing:0.1em; }
        .card, .song-row, .artist-row, .mini-player, .song-thumb, .album-thumb, .tab { border-radius:4px !important; }
      `,
      'VIPER SHOW': `
        :root { --radius:16px; --radius-sm:10px; --radius-pill:99px; }
        body, .song-name, .tab-label, .header-title, .section-title { font-family:'Georgia',serif !important; }
        .song-name, .tab-label, .header-title { font-style:italic; }
        .btn-scan { border-radius:99px; font-style:italic; }
        .section-title { font-style:italic; }
      `,
      'CRIMSON REIGN': `
        :root { --radius:0px; --radius-sm:0px; --radius-pill:0px; }
        body, .song-name, .tab-label, .header-title { font-family:'Trebuchet MS',sans-serif !important; }
        .tab-label { font-size:8px; text-transform:uppercase; letter-spacing:0.15em; }
        .song-name { text-transform:uppercase; letter-spacing:0.05em; }
        .header-title { text-transform:uppercase; letter-spacing:0.2em; }
        .btn-scan { border-radius:0; text-transform:uppercase; letter-spacing:0.1em; }
        .card, .song-row, .artist-row, .mini-player { border-radius:0 !important; border-left:3px solid var(--accent) !important; }
        .song-thumb, .album-thumb { border-radius:0 !important; }
      `,
      'CYBER NOVA': `
        :root { --radius:4px; --radius-sm:2px; --radius-pill:4px; }
        body, .song-name, .tab-label, .header-title { font-family:'Courier New',monospace !important; }
        .header-title { letter-spacing:0.1em; }
        .btn-scan { border-radius:4px; border:1px solid var(--accent) !important; }
        .card { border:1px solid var(--accent) !important; background:rgba(0,0,0,0.8) !important; }
        .song-row { border-bottom:1px solid rgba(255,255,255,0.05) !important; }
        .mini-player { border-radius:4px !important; border:1px solid var(--accent) !important; }
      `,
      'PINK CRUSH': `
        :root { --radius:24px; --radius-sm:16px; --radius-pill:99px; }
        .tab-label { font-weight:800; }
        .song-name { font-weight:800; }
        .header-title { font-weight:900; letter-spacing:-0.02em; }
        .btn-scan { border-radius:99px; font-weight:800; background:linear-gradient(135deg,#ec4899,#f472b6) !important; }
        .card { border-radius:24px !important; }
        .song-thumb, .album-thumb { border-radius:16px !important; }
        .mini-player { border-radius:24px !important; }
      `,
      'VELVET CLOUD': `
        :root { --radius:28px; --radius-sm:18px; --radius-pill:99px; }
        body, .song-name, .tab-label, .header-title { font-family:'Georgia',serif !important; }
        .song-name, .tab-label, .header-title { font-style:italic; }
        .tab-label { font-size:10px; }
        .btn-scan { border-radius:99px; font-style:italic; }
        .card { border-radius:28px !important; backdrop-filter:blur(20px); background:rgba(255,255,255,0.04) !important; border:1px solid rgba(255,255,255,0.08) !important; }
        .mini-player { border-radius:28px !important; }
        .song-thumb, .album-thumb { border-radius:18px !important; }
      `,
      'RED VELVET': `
        :root { --radius:12px; --radius-sm:8px; --radius-pill:99px; }
        .tab-label { font-weight:700; font-size:9px; letter-spacing:0.08em; text-transform:uppercase; }
        .song-name { font-weight:700; }
        .header-title { font-weight:900; letter-spacing:-0.01em; }
        .btn-scan { border-radius:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
        .card { border-radius:12px !important; border-left:3px solid var(--accent) !important; }
      `,
      'SLAY BITCH': `
        :root { --radius:8px; --radius-sm:4px; --radius-pill:8px; }
        body, .song-name, .tab-label, .header-title, .section-title { font-family:'Impact',sans-serif !important; }
        .tab-label { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
        .song-name { font-size:15px; text-transform:uppercase; letter-spacing:0.03em; }
        .header-title { text-transform:uppercase; letter-spacing:0.1em; font-size:20px; }
        .btn-scan { border-radius:4px; text-transform:uppercase; letter-spacing:0.1em; font-size:14px; }
        .section-title { text-transform:uppercase; letter-spacing:0.1em; font-size:15px; }
        .card { border-radius:4px !important; border:2px solid var(--accent) !important; }
      `,
      'SOLAR CROWN': `
        :root { --radius:20px; --radius-sm:12px; --radius-pill:99px; }
        .tab-label { font-weight:700; text-transform:uppercase; font-size:9px; letter-spacing:0.12em; }
        .song-name { font-weight:800; }
        .header-title { font-weight:900; text-transform:uppercase; letter-spacing:0.05em; }
        .btn-scan { border-radius:99px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; }
        .card { border-radius:20px !important; background:linear-gradient(135deg,rgba(251,191,36,0.05),rgba(245,158,11,0.02)) !important; border:1px solid rgba(251,191,36,0.15) !important; }
        .song-row { border-bottom:1px solid rgba(251,191,36,0.06) !important; }
        .mini-player { border-radius:20px !important; }
      `,
      'SOLARA': `
        :root { --radius:18px; --radius-sm:12px; --radius-pill:99px; }
        .tab-label { font-weight:600; }
        .song-name { font-weight:700; }
        .header-title { font-weight:800; letter-spacing:0.02em; }
        .btn-scan { border-radius:99px; font-weight:700; }
        .card { border-radius:18px !important; }
        .song-thumb, .album-thumb { border-radius:12px !important; }
        .mini-player { border-radius:18px !important; }
      `,
    };

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-style';
    styleEl.textContent = STYLES[style] || STYLES['GAGNOTE'];
    document.head.appendChild(styleEl);

    // Nom du style dans réglages
    const nameEl = document.getElementById('current-style-name');
    if (nameEl) nameEl.textContent = style;

    App.currentStyle = style;

  } catch (e) {
    console.error('[App] Erreur applyStyle:', e);
  }
}

function openStyle() {
  try {
    const screen = document.getElementById('style-screen');
    if (screen) {
      screen.classList.add('open');
      App.historyStack.push({ type: 'style' });
    }
  } catch (e) {
    console.error('[App] Erreur openStyle:', e);
  }
}

function closeStyle() {
  try {
    const screen = document.getElementById('style-screen');
    if (screen) screen.classList.remove('open');
  } catch (e) {
    console.error('[App] Erreur closeStyle:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   MENU CONTEXTUEL ···
   ═══════════════════════════════════════════════════════ */
function initContextMenu() {
  try {
    const overlay = document.getElementById('overlay-bg');
    if (overlay) {
      overlay.addEventListener('click', closeContextMenu);
    }
  } catch (e) {
    console.error('[App] Erreur initContextMenu:', e);
  }
}

/*
  items = [
    { icon, label, action, danger }
    { separator: true }
  ]
*/
function showContextMenu(items) {
  try {
    const menu    = document.getElementById('context-menu');
    const list    = document.getElementById('context-menu-list');
    const overlay = document.getElementById('overlay-bg');

    if (!menu || !list || !overlay) return;

    // Vider
    list.innerHTML = '';

    // Construire les items
    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-separator';
        list.appendChild(sep);
        return;
      }

      const el = document.createElement('div');
      el.className = 'context-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `
        <span class="context-item-icon">${item.icon || ''}</span>
        <span>${item.label || ''}</span>
      `;
      el.addEventListener('click', () => {
        closeContextMenu();
        if (typeof item.action === 'function') {
          setTimeout(item.action, 150);
        }
      });
      list.appendChild(el);
    });

    // Afficher
    menu.classList.remove('hidden');
    overlay.classList.remove('hidden');
    App.historyStack.push({ type: 'contextMenu' });

  } catch (e) {
    console.error('[App] Erreur showContextMenu:', e);
  }
}

function closeContextMenu() {
  try {
    const menu    = document.getElementById('context-menu');
    const overlay = document.getElementById('overlay-bg');
    if (menu)    menu.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  } catch (e) {
    console.error('[App] Erreur closeContextMenu:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════ */
function showToast(msg, duration) {
  try {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('show');

    clearTimeout(App.toastTimer);
    App.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration || 2200);

  } catch (e) {
    console.error('[App] Erreur showToast:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   TOUCHE RETOUR (Android WebView + navigateur)
   ═══════════════════════════════════════════════════════ */
function initBackButton() {
  try {
    // Android WebView appelle cette fonction via AndroidBridge
    window.onBackPressed = handleBack;

    // Navigateur web (popstate)
    window.addEventListener('popstate', () => {
      handleBack();
      // Repousser l'état pour garder le contrôle
      history.pushState(null, '');
    });

    // État initial
    history.pushState(null, '');

  } catch (e) {
    console.error('[App] Erreur initBackButton:', e);
  }
}

function handleBack() {
  try {
    // 1. Menu contextuel ouvert → fermer
    const menu = document.getElementById('context-menu');
    if (menu && !menu.classList.contains('hidden')) {
      closeContextMenu();
      return;
    }

    // 2. Centre de style ouvert → fermer
    const styleScreen = document.getElementById('style-screen');
    if (styleScreen && styleScreen.classList.contains('open')) {
      closeStyle();
      return;
    }

    // 3. Réglages ouverts → fermer
    const settingsScreen = document.getElementById('settings-screen');
    if (settingsScreen && settingsScreen.classList.contains('open')) {
      closeSettings();
      return;
    }

    // 4. Lecteur plein écran ouvert → fermer
    const playerScreen = document.getElementById('player-screen');
    if (playerScreen && playerScreen.classList.contains('open')) {
      closePlayer();
      return;
    }

    // 5. Sous-écran ouvert (détail artiste, playlist...) → fermer
    const openSub = document.querySelector('.subscreen.open');
    if (openSub) {
      openSub.classList.remove('open');
      return;
    }

    // 6. Pas sur l'accueil → revenir à l'accueil
    if (App.currentTab !== 'accueil') {
      switchTab('accueil');
      return;
    }

    // 7. Sur l'accueil → quitter l'app (Android)
    if (typeof Android !== 'undefined' && Android.exitApp) {
      Android.exitApp();
    }

  } catch (e) {
    console.error('[App] Erreur handleBack:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   SOUS-ÉCRANS (artiste, playlist)
   ═══════════════════════════════════════════════════════ */
function openSubscreen(id) {
  try {
    const screen = document.getElementById(id);
    if (screen) {
      screen.classList.remove('hidden');
      // Petit délai pour que la transition CSS fonctionne
      requestAnimationFrame(() => screen.classList.add('open'));
      App.historyStack.push({ type: 'subscreen', id });
    }
  } catch (e) {
    console.error('[App] Erreur openSubscreen:', e);
  }
}

function closeSubscreen(id) {
  try {
    const screen = document.getElementById(id);
    if (screen) screen.classList.remove('open');
  } catch (e) {
    console.error('[App] Erreur closeSubscreen:', e);
  }
}

// Initialiser les boutons retour des sous-écrans
document.addEventListener('DOMContentLoaded', () => {
  try {
    const backArtiste  = document.getElementById('back-artiste');
    const backPlaylist = document.getElementById('back-playlist');

    if (backArtiste) {
      backArtiste.addEventListener('click', () => closeSubscreen('screen-artiste-detail'));
    }
    if (backPlaylist) {
      backPlaylist.addEventListener('click', () => closeSubscreen('screen-playlist-detail'));
    }
  } catch (e) {
    console.error('[App] Erreur back buttons:', e);
  }
});

/* ═══════════════════════════════════════════════════════
   PRÉFÉRENCES (sauvegarde locale)
   ═══════════════════════════════════════════════════════ */
function savePreferences() {
  try {
    const prefs = {
      style:       App.currentStyle,
      accentColor: App.accentColor,
      accentDark:  App.accentDark,
    };
    localStorage.setItem('gag_prefs', JSON.stringify(prefs));
  } catch (e) {
    // localStorage peut être indisponible
    console.warn('[App] Impossible de sauvegarder les préférences:', e);
  }
}

function loadSavedPreferences() {
  try {
    const raw = localStorage.getItem('gag_prefs');
    if (!raw) return;

    const prefs = JSON.parse(raw);

    // Restaurer couleur accent
    if (prefs.accentColor && prefs.accentDark) {
      applyAccent(prefs.accentColor, prefs.accentDark);

      // Marquer le bon dot
      const dots = document.querySelectorAll('.accent-dot');
      dots.forEach(d => {
        d.classList.remove('selected');
        if (d.dataset.accent === prefs.accentColor) d.classList.add('selected');
      });
    }

    // Restaurer style
    if (prefs.style) {
      const card = document.querySelector(`.style-card[data-style="${prefs.style}"]`);
      if (card) {
        document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        applyStyle(prefs.style, card.dataset.bg, card.dataset.accent, card.dataset.dark);
      }
    }

  } catch (e) {
    console.warn('[App] Impossible de charger les préférences:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   RESTAURER DERNIÈRE CHANSON
   ═══════════════════════════════════════════════════════ */
function restoreLastSong() {
  try {
    const raw = localStorage.getItem('gag_last_song');
    if (!raw) return;

    const song = JSON.parse(raw);
    if (!song || !song.title) return;

    updateMiniPlayer(song);

    // Accueil : carte "continuer"
    const card = document.getElementById('continue-card');
    if (card) card.classList.remove('hidden');

    const titleEl  = document.getElementById('continue-title');
    const artistEl = document.getElementById('continue-artist');
    if (titleEl)  titleEl.textContent  = song.title  || '—';
    if (artistEl) artistEl.textContent = (song.artist || '—') + ' • ' + (song.album || '');

    if (song.progress && song.duration) {
      updateProgress(song.progress, song.duration);
    }

  } catch (e) {
    console.warn('[App] Impossible de restaurer la dernière chanson:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   UTILITAIRES
   ═══════════════════════════════════════════════════════ */

/* Formater les secondes en mm:ss */
function formatTime(seconds) {
  try {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  } catch (e) {
    return '0:00';
  }
}

/* Convertir hex en rgba */
function hexToRgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch (e) {
    return `rgba(192,132,252,${alpha})`;
  }
}

/* Éclaircir légèrement une couleur hex */
function adjustBrightness(hex, amount) {
  try {
    let r = parseInt(hex.slice(1,3), 16);
    let g = parseInt(hex.slice(3,5), 16);
    let b = parseInt(hex.slice(5,7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch (e) {
    return hex;
  }
}

/* Tronquer un texte */
function truncate(str, max) {
  try {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  } catch (e) {
    return str || '';
  }
}

/* Exposer les fonctions utiles aux autres modules */
window.App          = App;
window.showToast    = showToast;
window.openPlayer   = openPlayer;
window.closePlayer  = closePlayer;
window.updateMiniPlayer = updateMiniPlayer;
window.updateProgress   = updateProgress;
window.showContextMenu  = showContextMenu;
window.openSubscreen    = openSubscreen;
window.closeSubscreen   = closeSubscreen;
window.formatTime       = formatTime;
window.switchTab        = switchTab;

/* ═══════════════════════════════════════════════════════
   FILE D'ATTENTE
   ═══════════════════════════════════════════════════════ */

function openQueuePanel() {
  try {
    const panel   = document.getElementById('queue-panel');
    const overlay = document.getElementById('queue-overlay');
    if (!panel) return;

    panel.classList.remove('hidden');
    overlay?.classList.remove('hidden');

    // Légère pause pour déclencher la transition CSS
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add('open');
      });
    });

    renderQueueList();

    // Fermer via overlay
    overlay?.addEventListener('click', closeQueuePanel, { once: true });

    // Fermer via bouton
    document.getElementById('queue-close')?.addEventListener('click', closeQueuePanel, { once: true });

  } catch (e) {
    console.error('[App] Erreur openQueuePanel:', e);
  }
}

function closeQueuePanel() {
  try {
    const panel   = document.getElementById('queue-panel');
    const overlay = document.getElementById('queue-overlay');
    panel?.classList.remove('open');
    setTimeout(() => {
      panel?.classList.add('hidden');
      overlay?.classList.add('hidden');
    }, 300);
  } catch (e) {}
}

function renderQueueList() {
  try {
    const list = document.getElementById('queue-list');
    if (!list) return;

    const queue   = (typeof Player !== 'undefined') ? (Player.queue || []) : [];
    const current = (typeof Player !== 'undefined') ? Player.currentIndex : 0;

    if (queue.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:30px;font-size:13px;">File d\'attente vide</div>';
      return;
    }

    list.innerHTML = '';

    queue.forEach((song, i) => {
      if (!song) return;
      const isCurrent = i === current;
      const el = document.createElement('div');
      el.className = 'queue-item' + (isCurrent ? ' current' : '');
      el.innerHTML = `
        <div class="queue-item-num">${isCurrent ? '▶' : i + 1}</div>
        <div class="queue-item-thumb">
          ${song.cover ? `<img src="${song.cover}">` : '🎵'}
        </div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHTML(song.title || '—')}</div>
          <div class="queue-item-artist">${escapeHTML(song.artist || '—')}</div>
        </div>
        <button class="queue-item-remove" data-index="${i}" title="Retirer">✕</button>
      `;

      // Clic → lire cette chanson
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('queue-item-remove')) return;
        if (typeof Player !== 'undefined') {
          Player.playIndex(i);
          closeQueuePanel();
        }
      });

      // Retirer de la file
      el.querySelector('.queue-item-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Player !== 'undefined' && Player.removeFromQueue) {
          Player.removeFromQueue(i);
          renderQueueList(); // rafraîchir
        }
      });

      list.appendChild(el);
    });

    // Scroller jusqu'à la chanson actuelle
    const currentEl = list.querySelector('.current');
    if (currentEl) currentEl.scrollIntoView({ block: 'center' });

  } catch (e) {
    console.error('[App] Erreur renderQueueList:', e);
  }
}

function escapeHTML(str) {
  try {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  } catch (e) { return str || ''; }
}

/* Mettre à jour la file après changement de chanson */
function refreshQueuePanel() {
  try {
    const panel = document.getElementById('queue-panel');
    if (panel && !panel.classList.contains('hidden')) {
      renderQueueList();
    }
  } catch (e) {}
}

window.openQueuePanel    = openQueuePanel;
window.closeQueuePanel   = closeQueuePanel;
window.refreshQueuePanel = refreshQueuePanel;
window.updateParolesActive = updateParolesActive;
window.renderParolesView   = renderParolesView;
window.setPlayerView       = setPlayerView;
