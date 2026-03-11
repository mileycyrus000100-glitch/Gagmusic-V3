/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — player.js
   Lecteur audio Web (HTML5 Audio API)
   Formats : MP3, M4A
   Fonctions : lecture, pause, suivant/précédent,
               barre de progression, volume, skip ±10s,
               shuffle, repeat, import de fichiers
═══════════════════════════════════════════════════════ */

'use strict';

// ─── ÉTAT DU LECTEUR ───────────────────────────────────
const PlayerState = {
  audio: new Audio(),
  library: [],          // [{ id, title, artist, album, duration, src, cover }]
  queue: [],            // indices dans library
  queueIndex: -1,       // position actuelle dans la queue
  isPlaying: false,
  isShuffle: false,
  repeatMode: 'none',   // 'none' | 'one' | 'all'
  volume: 0.7,          // 0.0 → 1.0 (→ 400% = 4.0 via gain node)
  gainValue: 0.7,
  listenCount: 0,       // secondes écoutées sur le titre en cours
  LISTEN_THRESHOLD: 30, // secondes avant de comptabiliser une écoute
};

// Web Audio API pour le volume > 100%
let audioCtx, gainNode, sourceNode;

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAudioEngine();
  injectImportButton();
  bindControls();
  bindProgressBar();
  bindVolumeBar();
  bindAudioEvents();
  restoreLibrary();
  updateUI();
});

// ═══════════════════════════════════════════════════════
// MOTEUR AUDIO (Web Audio API pour gain > 1.0)
// ═══════════════════════════════════════════════════════
function initAudioEngine() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(PlayerState.audio);
  gainNode = audioCtx.createGain();
  gainNode.gain.value = PlayerState.gainValue;
  sourceNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Reprendre le contexte audio si suspendu (politique navigateur)
  document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, { once: true });
}

// ═══════════════════════════════════════════════════════
// IMPORT DE FICHIERS
// ═══════════════════════════════════════════════════════
function injectImportButton() {
  // Bouton SCAN dans le header → ouvre l'input file
  const btnScan = document.getElementById('btn-scan');
  if (!btnScan) return;

  // Créer l'input file caché
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'file-input';
  input.accept = '.mp3,.m4a,audio/mpeg,audio/mp4';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);

  btnScan.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    input.click();
  });

  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    importFiles(files);
    input.value = ''; // reset pour permettre re-import du même fichier
  });
}

async function importFiles(files) {
  showToast(`Import de ${files.length} fichier(s)...`);

  for (const file of files) {
    if (!isValidAudio(file)) continue;
    await processFile(file);
  }

  saveLibrary();
  renderLibrary();
  updateHomeScreen();
  showToast(`✓ ${files.length} titre(s) importé(s)`);
}

function isValidAudio(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  return ['mp3', 'm4a'].includes(ext);
}

async function processFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target.result;
      const meta = await extractMetadata(file, src);

      // Éviter les doublons (même nom de fichier)
      const exists = PlayerState.library.find(t => t.filename === file.name);
      if (exists) { resolve(); return; }

      const track = {
        id: Date.now() + Math.random(),
        filename: file.name,
        title: meta.title || cleanTitle(file.name),
        artist: meta.artist || 'Artiste inconnu',
        album: meta.album || 'Album inconnu',
        year: meta.year || '',
        genre: meta.genre || '',
        duration: 0,      // rempli à la lecture
        cover: meta.cover || null,
        src,
        listenCount: 0,
        liked: false,
        addedAt: Date.now(),
        lastPlayed: null,
      };

      PlayerState.library.push(track);
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

// ─── Extraction métadonnées ID3 basique ───────────────
async function extractMetadata(file, src) {
  // On utilise jsmediatags via CDN si disponible, sinon fallback
  return new Promise((resolve) => {
    if (window.jsmediatags) {
      window.jsmediatags.read(file, {
        onSuccess: (tag) => {
          const t = tag.tags;
          let cover = null;

          if (t.picture) {
            const { data, format } = t.picture;
            const bytes = new Uint8Array(data);
            const blob = new Blob([bytes], { type: format });
            cover = URL.createObjectURL(blob);
          }

          resolve({
            title: t.title || '',
            artist: t.artist || '',
            album: t.album || '',
            year: t.year || '',
            genre: t.genre || '',
            cover,
          });
        },
        onError: () => resolve({}),
      });
    } else {
      // Fallback : pas de métadonnées ID3
      resolve({});
    }
  });
}

// ─── Nettoyage du titre (spec GagMusic) ───────────────
function cleanTitle(filename) {
  let name = filename.replace(/\.[^.]+$/, ''); // enlever extension

  // Mots bruités à supprimer
  const noise = [
    'official audio', 'official video', 'official mv', 'official clip',
    'music video', 'lyric video', 'lyrics', 'paroles', 'visualizer',
    'clean', 'radio edit', 'explicit', 'remastered', 'hd', 'hq', '4k',
    'audio', 'video', '256k', '320k', '320kbps', 'flac', 'mp3',
  ];

  // Supprimer contenu entre () ou [] si c'est du bruit
  name = name.replace(/\(([^)]+)\)/g, (match, inner) => {
    const low = inner.toLowerCase();
    if (noise.some(n => low.includes(n))) return '';
    if (/^\d+k(bps)?$/i.test(inner.trim())) return '';
    return match; // garder (feat. xxx)
  });
  name = name.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const low = inner.toLowerCase();
    if (noise.some(n => low.includes(n))) return '';
    return match;
  });

  // Supprimer les mots bruités restants
  noise.forEach(n => {
    const re = new RegExp(`\\b${n.replace(/ /g, '\\s+')}\\b`, 'gi');
    name = name.replace(re, '');
  });

  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || filename;
}

// ═══════════════════════════════════════════════════════
// LECTURE
// ═══════════════════════════════════════════════════════
function playTrack(indexInLibrary) {
  if (indexInLibrary < 0 || indexInLibrary >= PlayerState.library.length) return;

  const track = PlayerState.library[indexInLibrary];
  PlayerState.queueIndex = indexInLibrary;
  PlayerState.listenCount = 0;

  // Charger la source
  PlayerState.audio.src = track.src;
  PlayerState.audio.load();
  PlayerState.audio.play().then(() => {
    PlayerState.isPlaying = true;
    track.lastPlayed = Date.now();
    updateUI();
    updateMiniPlayer(track);
    updateFullPlayer(track);
    saveLibrary();
  }).catch(err => {
    console.error('Erreur lecture :', err);
    showToast('❌ Impossible de lire ce fichier');
  });
}

function togglePlayPause() {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (PlayerState.library.length === 0) {
    showToast('📂 Importez des fichiers d\'abord');
    return;
  }

  if (PlayerState.queueIndex === -1) {
    playTrack(0);
    return;
  }

  if (PlayerState.isPlaying) {
    PlayerState.audio.pause();
    PlayerState.isPlaying = false;
  } else {
    PlayerState.audio.play();
    PlayerState.isPlaying = true;
  }
  updatePlayPauseButtons();
}

function playNext() {
  const lib = PlayerState.library;
  if (!lib.length) return;

  let next;
  if (PlayerState.isShuffle) {
    next = Math.floor(Math.random() * lib.length);
  } else {
    next = (PlayerState.queueIndex + 1) % lib.length;
  }
  playTrack(next);
}

function playPrev() {
  const lib = PlayerState.library;
  if (!lib.length) return;

  // Si > 3s écoutées → retour au début du titre
  if (PlayerState.audio.currentTime > 3) {
    PlayerState.audio.currentTime = 0;
    return;
  }

  let prev;
  if (PlayerState.isShuffle) {
    prev = Math.floor(Math.random() * lib.length);
  } else {
    prev = (PlayerState.queueIndex - 1 + lib.length) % lib.length;
  }
  playTrack(prev);
}

function skipForward() {
  PlayerState.audio.currentTime = Math.min(
    PlayerState.audio.currentTime + 10,
    PlayerState.audio.duration || 0
  );
}

function skipBackward() {
  PlayerState.audio.currentTime = Math.max(
    PlayerState.audio.currentTime - 10, 0
  );
}

function toggleShuffle() {
  PlayerState.isShuffle = !PlayerState.isShuffle;
  const btn = document.querySelector('.ctrl-btn--shuffle');
  if (btn) btn.style.color = PlayerState.isShuffle
    ? 'var(--accent)' : 'var(--text2)';
}

function toggleRepeat() {
  const modes = ['none', 'all', 'one'];
  const idx = modes.indexOf(PlayerState.repeatMode);
  PlayerState.repeatMode = modes[(idx + 1) % modes.length];

  // Appliquer sur l'audio
  PlayerState.audio.loop = (PlayerState.repeatMode === 'one');

  const btn = document.querySelector('.ctrl-btn--repeat');
  if (btn) {
    const icons = { none: '↻', all: '🔁', one: '🔂' };
    btn.textContent = icons[PlayerState.repeatMode];
    btn.style.color = PlayerState.repeatMode !== 'none'
      ? 'var(--accent)' : 'var(--text2)';
  }
}

// ═══════════════════════════════════════════════════════
// ÉVÉNEMENTS AUDIO
// ═══════════════════════════════════════════════════════
function bindAudioEvents() {
  const audio = PlayerState.audio;

  // Mise à jour de la progression
  audio.addEventListener('timeupdate', () => {
    updateProgressBars();
    trackListenTime();
  });

  // Durée connue
  audio.addEventListener('loadedmetadata', () => {
    const track = currentTrack();
    if (track) track.duration = audio.duration;
    updateTimeCodes();
  });

  // Fin de piste
  audio.addEventListener('ended', () => {
    PlayerState.isPlaying = false;
    if (PlayerState.repeatMode === 'one') {
      audio.play();
      PlayerState.isPlaying = true;
    } else if (PlayerState.repeatMode === 'all' || PlayerState.isShuffle) {
      playNext();
    } else if (PlayerState.queueIndex < PlayerState.library.length - 1) {
      playNext();
    } else {
      updatePlayPauseButtons();
    }
  });

  // Erreur
  audio.addEventListener('error', () => {
    showToast('❌ Erreur de lecture');
    PlayerState.isPlaying = false;
    updatePlayPauseButtons();
  });

  // Play / Pause natifs
  audio.addEventListener('play',  () => { PlayerState.isPlaying = true;  updatePlayPauseButtons(); });
  audio.addEventListener('pause', () => { PlayerState.isPlaying = false; updatePlayPauseButtons(); });
}

function trackListenTime() {
  // Comptabiliser une écoute après 30s
  if (PlayerState.isPlaying) {
    PlayerState.listenCount += 0.25; // timeupdate ≈ toutes les 250ms
    if (PlayerState.listenCount >= PlayerState.LISTEN_THRESHOLD) {
      const track = currentTrack();
      if (track && PlayerState.listenCount < PlayerState.LISTEN_THRESHOLD + 0.5) {
        track.listenCount = (track.listenCount || 0) + 1;
        saveLibrary();
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// CONTRÔLES UI
// ═══════════════════════════════════════════════════════
function bindControls() {
  // Mini-lecteur boutons (ne pas propager le click au conteneur)
  safeClick('.mini-controls .ctrl-btn:nth-child(1)', (e) => { e.stopPropagation(); playPrev(); });
  safeClick('.mini-controls .ctrl-btn--play',        (e) => { e.stopPropagation(); togglePlayPause(); });
  safeClick('.mini-controls .ctrl-btn:nth-child(3)', (e) => { e.stopPropagation(); playNext(); });

  // Lecteur plein écran
  safeClick('.ctrl-skip:first-of-type', () => skipBackward());
  safeClick('.ctrl-skip:last-of-type',  () => skipForward());
  safeClick('.ctrl-btn--shuffle',       () => toggleShuffle());
  safeClick('.ctrl-btn--play-lg',       () => togglePlayPause());

  // Précédent / Suivant dans le lecteur plein écran
  const fullControls = document.querySelector('.player-controls');
  if (fullControls) {
    const btns = fullControls.querySelectorAll('.ctrl-btn:not(.ctrl-btn--shuffle):not(.ctrl-btn--play-lg):not(.ctrl-btn--queue)');
    if (btns[0]) btns[0].addEventListener('click', playPrev);
    if (btns[1]) btns[1].addEventListener('click', playNext);
  }
}

function safeClick(selector, handler) {
  const el = document.querySelector(selector);
  if (el) el.addEventListener('click', handler);
}

// ═══════════════════════════════════════════════════════
// BARRE DE PROGRESSION
// ═══════════════════════════════════════════════════════
function bindProgressBar() {
  const progressEl = document.querySelector('.player-progress');
  if (!progressEl) return;

  let isDragging = false;

  function seek(e) {
    const rect = progressEl.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    if (PlayerState.audio.duration) {
      PlayerState.audio.currentTime = ratio * PlayerState.audio.duration;
    }
  }

  progressEl.addEventListener('click', seek);
  progressEl.addEventListener('mousedown', () => isDragging = true);
  document.addEventListener('mousemove', (e) => { if (isDragging) seek(e); });
  document.addEventListener('mouseup',   () => isDragging = false);

  // Touch
  progressEl.addEventListener('touchstart', seek, { passive: true });
  progressEl.addEventListener('touchmove',  seek, { passive: true });
}

function updateProgressBars() {
  const audio = PlayerState.audio;
  if (!audio.duration) return;

  const pct = (audio.currentTime / audio.duration) * 100;

  // Barre lecteur plein écran
  const bar = document.querySelector('.player-progress-bar');
  if (bar) bar.style.width = `${pct}%`;

  // Mini-lecteur
  const miniBar = document.querySelector('.mini-progress-bar');
  if (miniBar) miniBar.style.width = `${pct}%`;

  updateTimeCodes();
}

function updateTimeCodes() {
  const audio = PlayerState.audio;
  const cur  = formatTime(audio.currentTime || 0);
  const dur  = formatTime(audio.duration   || 0);

  const times = document.querySelectorAll('.player-times span');
  if (times[0]) times[0].textContent = cur;
  if (times[1]) times[1].textContent = dur;
}

// ═══════════════════════════════════════════════════════
// VOLUME
// ═══════════════════════════════════════════════════════
function bindVolumeBar() {
  const volBar = document.querySelector('.volume-bar');
  if (!volBar) return;

  function setVolume(e) {
    const rect = volBar.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    // Volume de 0 à 400% (gain 0.0 → 4.0)
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const gain = ratio * 4.0;
    applyVolume(gain);
  }

  volBar.addEventListener('click', setVolume);
  volBar.addEventListener('touchstart', setVolume, { passive: true });
  volBar.addEventListener('touchmove',  setVolume, { passive: true });
}

function applyVolume(gain) {
  PlayerState.gainValue = gain;
  if (gainNode) gainNode.gain.value = gain;

  // Couleur selon les paliers (spec GagMusic)
  const pct = (gain / 4.0) * 100;
  const fill = document.querySelector('.volume-fill');
  if (fill) {
    fill.style.width = `${pct}%`;
    if (gain <= 1.0)      fill.style.background = 'linear-gradient(to right, white, var(--text))';
    else if (gain <= 2.0) fill.style.background = 'linear-gradient(to right, white, gold)';
    else if (gain <= 3.0) fill.style.background = 'linear-gradient(to right, gold, orange)';
    else                  fill.style.background = 'linear-gradient(to right, orange, red)';
  }
}

// ═══════════════════════════════════════════════════════
// MISE À JOUR DE L'INTERFACE
// ═══════════════════════════════════════════════════════
function updateUI() {
  updatePlayPauseButtons();
  updateMiniPlayer(currentTrack());
  updateFullPlayer(currentTrack());
  renderLibrary();
  updateHomeScreen();
}

function updatePlayPauseButtons() {
  const icon = PlayerState.isPlaying ? '⏸' : '▶';

  const miniPlay = document.querySelector('.mini-controls .ctrl-btn--play');
  if (miniPlay) miniPlay.textContent = icon;

  const fullPlay = document.querySelector('.ctrl-btn--play-lg');
  if (fullPlay) fullPlay.textContent = icon;
}

function updateMiniPlayer(track) {
  if (!track) return;

  // Nom & artiste
  const nameEl   = document.querySelector('.mini-info .track-name');
  const artistEl = document.querySelector('.mini-info .track-artist');
  if (nameEl)   nameEl.textContent   = track.title;
  if (artistEl) artistEl.textContent = track.artist;

  // Pochette
  const cover = document.querySelector('.mini-content .cover-thumb');
  if (cover) {
    if (track.cover) {
      cover.style.backgroundImage = `url(${track.cover})`;
      cover.style.backgroundSize  = 'cover';
      cover.textContent = '';
    } else {
      cover.style.backgroundImage = '';
      cover.textContent = '🎵';
    }
  }
}

function updateFullPlayer(track) {
  if (!track) return;

  // Titres dans toutes les vues
  document.querySelectorAll('.player-track').forEach(el => el.textContent = track.title);
  document.querySelectorAll('.player-artist').forEach(el => el.textContent = track.artist);

  // Pochette
  const cover = document.querySelector('.player-cover');
  if (cover) {
    if (track.cover) {
      cover.style.backgroundImage = `url(${track.cover})`;
      cover.style.backgroundSize  = 'cover';
      cover.style.backgroundPosition = 'center';
      cover.textContent = '';
    } else {
      cover.style.backgroundImage = '';
      cover.textContent = '🎵';
    }
  }

  // Fond flou du lecteur
  const bg = document.querySelector('.player-bg-cover');
  if (bg) {
    if (track.cover) {
      bg.style.backgroundImage = `url(${track.cover})`;
      bg.style.backgroundSize  = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.style.filter = 'blur(30px) brightness(0.4)';
      bg.textContent = '';
    } else {
      bg.style.backgroundImage = '';
      bg.style.filter = '';
      bg.textContent = '🎵';
    }
  }

  // Infos vue INFOS
  setInfoVal('Album',   track.album);
  setInfoVal('Année',   track.year || '—');
  setInfoVal('Genre',   track.genre || '—');
  setInfoVal('Écoutes', track.listenCount || 0);
}

function setInfoVal(label, value) {
  const rows = document.querySelectorAll('.info-row');
  rows.forEach(row => {
    if (row.querySelector('.info-label')?.textContent === label) {
      const val = row.querySelector('.info-val');
      if (val) val.textContent = value;
    }
  });
}

// ═══════════════════════════════════════════════════════
// RENDU BIBLIOTHÈQUE
// ═══════════════════════════════════════════════════════
function renderLibrary() {
  const list = document.querySelector('.track-list--library');
  if (!list) return;

  const lib = PlayerState.library;

  if (lib.length === 0) {
    list.innerHTML = `
      <li class="empty-library">
        <div class="empty-icon">🎵</div>
        <p>Aucun titre importé</p>
        <span>Appuyez sur SCAN pour importer des fichiers MP3 / M4A</span>
      </li>`;
    return;
  }

  // Tri alphabétique
  const sorted = [...lib].sort((a, b) => a.title.localeCompare(b.title));

  let html = '';
  let currentLetter = '';

  sorted.forEach((track, idx) => {
    const letter = (track.title[0] || '#').toUpperCase();
    if (letter !== currentLetter) {
      currentLetter = letter;
      html += `<li class="alpha-separator">${letter}</li>`;
    }

    const realIdx = lib.indexOf(track);
    const isPlaying = realIdx === PlayerState.queueIndex && PlayerState.isPlaying;
    const coverStyle = track.cover
      ? `style="background-image:url(${track.cover});background-size:cover;background-position:center"`
      : '';

    html += `
      <li class="track-item ${isPlaying ? 'track-item--playing' : ''}"
          data-index="${realIdx}">
        <div class="cover-thumb ${isPlaying ? 'cover-thumb--eq' : ''}" ${coverStyle}>
          ${isPlaying
            ? '<span class="eq-bars"><span></span><span></span><span></span><span></span><span></span></span>'
            : track.cover ? '' : '🎵'}
        </div>
        <div class="track-meta">
          <span class="track-name">${escHtml(track.title)}</span>
          <span class="track-artist">${escHtml(track.artist)} · ${formatTime(track.duration)}</span>
        </div>
        <button class="btn-like ${track.liked ? 'liked' : ''}" data-index="${realIdx}">
          ${track.liked ? '♥' : '♡'}
        </button>
        <button class="btn-more" data-index="${realIdx}">···</button>
      </li>`;
  });

  list.innerHTML = html;

  // Événements sur les items
  list.querySelectorAll('.track-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-like') || e.target.closest('.btn-more')) return;
      const idx = parseInt(item.dataset.index);
      playTrack(idx);
    });
  });

  list.querySelectorAll('.btn-like').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      toggleLike(idx);
    });
  });
}

function toggleLike(idx) {
  const track = PlayerState.library[idx];
  if (!track) return;
  track.liked = !track.liked;
  saveLibrary();
  renderLibrary();
}

// ═══════════════════════════════════════════════════════
// ÉCRAN ACCUEIL — mise à jour dynamique
// ═══════════════════════════════════════════════════════
function updateHomeScreen() {
  const lib = PlayerState.library;

  // Stats du jour
  const totalMin = Math.round(lib.reduce((s, t) => s + (t.duration || 0), 0) / 60);
  const statEl = document.querySelector('.today-stats');
  if (statEl) {
    statEl.innerHTML = `
      <span class="stat-item">♪ <strong>${lib.length}</strong> titres</span>
      <span class="stat-sep">·</span>
      <span class="stat-item"><strong>${totalMin}</strong> min</span>`;
  }

  // Section "Continuer l'écoute"
  const track = currentTrack();
  if (track) {
    const cont = document.querySelector('.continue-card .track-name');
    const contA = document.querySelector('.continue-card .track-artist');
    if (cont)  cont.textContent  = track.title;
    if (contA) contA.innerHTML   = `${escHtml(track.artist)}`;
  }
}

// ═══════════════════════════════════════════════════════
// PERSISTANCE (localStorage)
// ═══════════════════════════════════════════════════════
function saveLibrary() {
  // On ne sauvegarde pas les src (base64 trop lourds) — seulement les métadonnées
  const meta = PlayerState.library.map(t => ({
    id: t.id, filename: t.filename, title: t.title, artist: t.artist,
    album: t.album, year: t.year, genre: t.genre, duration: t.duration,
    listenCount: t.listenCount, liked: t.liked, addedAt: t.addedAt, lastPlayed: t.lastPlayed,
    // cover : URL.createObjectURL ne survit pas aux rechargements → on ignore
  }));
  try {
    localStorage.setItem('gag_library_meta', JSON.stringify(meta));
    localStorage.setItem('gag_queue_index', PlayerState.queueIndex);
  } catch(e) { /* quota dépassé */ }
}

function restoreLibrary() {
  try {
    const raw = localStorage.getItem('gag_library_meta');
    if (raw) {
      const meta = JSON.parse(raw);
      // On restaure les métadonnées mais pas les src (fichiers à réimporter)
      PlayerState.library = meta.map(m => ({ ...m, src: null, cover: null }));
      renderLibrary();
      updateHomeScreen();
    }
  } catch(e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════
function currentTrack() {
  return PlayerState.library[PlayerState.queueIndex] || null;
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Toast de notification ────────────────────────────
let toastTimeout;
function showToast(msg) {
  let toast = document.getElementById('gag-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gag-toast';
    toast.style.cssText = `
      position:fixed; bottom:140px; left:50%; transform:translateX(-50%);
      background:var(--card2); border:1px solid var(--border); color:var(--text);
      padding:10px 20px; border-radius:20px; font-size:0.85rem; z-index:999;
      opacity:0; transition:opacity 0.25s; white-space:nowrap;
      box-shadow:0 4px 20px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.style.opacity = '0', 2500);
}

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════
window.GagPlayer = {
  state: PlayerState,
  playTrack,
  togglePlayPause,
  playNext,
  playPrev,
  skipForward,
  skipBackward,
  toggleShuffle,
  toggleRepeat,
  applyVolume,
  currentTrack,
  formatTime,
  showToast,
};
