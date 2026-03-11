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
    // Fermer les sous-écrans ouverts
    closeAllSubscreens();

    // Désactiver tous les onglets
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Activer le bon onglet
    const tab    = document.querySelector(`.tab[data-tab="${name}"]`);
    const screen = document.getElementById('screen-' + name);

    if (tab)    tab.classList.add('active');
    if (screen) screen.classList.add('active');

    App.currentTab = name;

    // Mettre à jour la pile historique
    App.historyStack.push({ type: 'tab', name });

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
   LECTEUR PLEIN ÉCRAN
   ═══════════════════════════════════════════════════════ */
function initPlayer() {
  try {
    // Bouton fermer
    const btnDown = document.getElementById('player-down');
    if (btnDown) btnDown.addEventListener('click', closePlayer);

    // Bouton options ···
    const btnMenu = document.getElementById('player-menu-btn');
    if (btnMenu) {
      btnMenu.addEventListener('click', () => {
        showContextMenu([
          { icon: '▶', label: 'Lire ensuite',        action: () => showToast('Ajouté après la chanson en cours') },
          { icon: '⊕', label: 'Ajouter à la file',   action: () => showToast('Ajouté à la file') },
          { icon: '🎵', label: 'Ajouter à playlist',  action: () => showToast('Choisir une playlist...') },
          { icon: '👤', label: 'Voir artiste',         action: () => { closePlayer(); switchTab('artistes'); } },
          { icon: '💿', label: 'Voir album',           action: () => showToast('Album...') },
          { icon: '✎',  label: 'Modifier les infos',  action: () => showToast('Modifier...') },
          { icon: '🔗', label: 'Partager → Ensemble', action: () => showToast('Partage en cours...') },
          { separator: true },
          { icon: '🗑', label: 'Supprimer',            action: () => showToast('Supprimer ?'), danger: true },
        ]);
      });
    }

    // Bouton like
    const btnLike = document.getElementById('btn-like');
    if (btnLike) {
      btnLike.addEventListener('click', () => {
        btnLike.classList.toggle('liked');
        const liked = btnLike.classList.contains('liked');
        btnLike.textContent = liked ? '♥' : '♡';
        showToast(liked ? '❤ Ajouté aux coups de cœur' : 'Retiré des coups de cœur');
      });
    }

    // Bouton file d'attente
    const btnQueue = document.getElementById('btn-queue');
    if (btnQueue) {
      btnQueue.addEventListener('click', () => showToast('⊕ Ajouté à la file'));
    }

    // Bouton options du bas
    const btnOptions = document.getElementById('btn-options');
    if (btnOptions) {
      btnOptions.addEventListener('click', () => {
        if (document.getElementById('player-menu-btn')) {
          document.getElementById('player-menu-btn').click();
        }
      });
    }

    // Bouton play principal
    const btnPlayMain = document.getElementById('btn-play-main');
    if (btnPlayMain) {
      btnPlayMain.addEventListener('click', togglePlay);
    }

    // Boutons prev/next
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.addEventListener('click', () => {
      if (typeof Player !== 'undefined' && Player.prev) Player.prev();
      else showToast('⏮ Précédent');
    });
    if (btnNext) btnNext.addEventListener('click', () => {
      if (typeof Player !== 'undefined' && Player.next) Player.next();
      else showToast('⏭ Suivant');
    });

    // Boutons skip
    const btnRewind  = document.getElementById('btn-rewind');
    const btnForward = document.getElementById('btn-forward');
    if (btnRewind)  btnRewind.addEventListener('click',  () => showToast('⏪ -10s'));
    if (btnForward) btnForward.addEventListener('click', () => showToast('⏩ +10s'));

    // Bouton shuffle
    const btnShuffle = document.getElementById('btn-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        btnShuffle.classList.toggle('active');
        showToast(btnShuffle.classList.contains('active') ? '🔀 Aléatoire activé' : 'Aléatoire désactivé');
      });
    }

    // Bouton file panneau
    const btnQueuePanel = document.getElementById('btn-queue-panel');
    if (btnQueuePanel) btnQueuePanel.addEventListener('click', () => showToast('≋ File d\'attente'));

    // Swipe pour fermer (glisser vers le bas)
    initPlayerSwipe();

  } catch (e) {
    console.error('[App] Erreur initPlayer:', e);
  }
}

function openPlayer() {
  try {
    const screen = document.getElementById('player-screen');
    if (screen) {
      screen.classList.add('open');
      App.historyStack.push({ type: 'player' });
    }
  } catch (e) {
    console.error('[App] Erreur openPlayer:', e);
  }
}

function closePlayer() {
  try {
    const screen = document.getElementById('player-screen');
    if (screen) screen.classList.remove('open');
  } catch (e) {
    console.error('[App] Erreur closePlayer:', e);
  }
}

function togglePlay() {
  try {
    App.isPlaying = !App.isPlaying;
    const btnMain  = document.getElementById('btn-play-main');
    const btnMini  = document.getElementById('mini-play');
    const vinyl    = document.getElementById('vinyl');
    const icon     = App.isPlaying ? '⏸' : '▶';

    if (btnMain) btnMain.textContent = icon;
    if (btnMini) btnMini.textContent = icon;

    // Pause/reprise animation vinyle
    if (vinyl) {
      vinyl.style.animationPlayState = App.isPlaying ? 'running' : 'paused';
    }

    if (typeof Player !== 'undefined' && Player.togglePlay) {
      Player.togglePlay();
    }
  } catch (e) {
    console.error('[App] Erreur togglePlay:', e);
  }
}

/* Swipe bas pour fermer le lecteur */
function initPlayerSwipe() {
  try {
    const screen = document.getElementById('player-screen');
    if (!screen) return;

    let startY = 0;
    let startTime = 0;

    screen.addEventListener('touchstart', (e) => {
      startY    = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    screen.addEventListener('touchend', (e) => {
      const dy       = e.changedTouches[0].clientY - startY;
      const dt       = Date.now() - startTime;
      const velocity = dy / dt;
      // Swipe bas rapide ou grand déplacement → fermer
      if (dy > 80 || velocity > 0.5) {
        closePlayer();
      }
    }, { passive: true });

  } catch (e) {
    console.error('[App] Erreur initPlayerSwipe:', e);
  }
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
    const screen     = document.getElementById('settings-screen');
    const btnBack    = document.getElementById('back-settings');
    const btnStyle   = document.getElementById('settings-style');
    const btnCompte  = document.getElementById('settings-compte');

    if (btnBack)   btnBack.addEventListener('click',  closeSettings);
    if (btnStyle)  btnStyle.addEventListener('click', openStyle);
    if (btnCompte) btnCompte.addEventListener('click', () => showToast('Connexion bientôt disponible'));

  } catch (e) {
    console.error('[App] Erreur initSettings:', e);
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
