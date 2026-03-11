/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — library.js
   Bibliothèque, scan, artistes, playlists, accueil
   ═══════════════════════════════════════════════════════ */

const Library = {

  /* ─── DONNÉES ─── */
  songs:     [], // toutes les chansons
  artists:   {}, // { nomArtiste: { songs:[], info:{} } }
  albums:    {}, // { nomAlbum: { songs:[], artist, cover } }
  playlists: [], // playlists manuelles
  stats:     {}, // { songId: { plays, lastPlayed, addedAt } }
  currentSort: 'az',
  searchQuery: '',

  /* ─── INIT ─── */
  init() {
    try {
      this.loadFromStorage();
      this.renderAll();
      this.initBiblio();
      this.initArtistes();
      this.initPlaylists();
      this.initAccueil();
      this.initImport();
      this.checkAutoScan();
      console.log('[Library] Initialisé —', this.songs.length, 'titres');
    } catch (e) {
      console.error('[Library] Erreur init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     STOCKAGE LOCAL
     ═══════════════════════════════════════════════════════ */

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('gag_songs');
      if (raw) this.songs = JSON.parse(raw) || [];

      const rawPlaylists = localStorage.getItem('gag_playlists');
      if (rawPlaylists) this.playlists = JSON.parse(rawPlaylists) || [];

      const rawStats = localStorage.getItem('gag_stats');
      if (rawStats) this.stats = JSON.parse(rawStats) || {};

      this.buildIndex();
      // Restaurer les URLs blob depuis IndexedDB
      this.restoreURLs();
    } catch (e) {
      console.warn('[Library] Erreur chargement storage:', e);
      this.songs     = [];
      this.playlists = [];
      this.stats     = {};
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem('gag_songs',     JSON.stringify(this.songs));
      localStorage.setItem('gag_playlists', JSON.stringify(this.playlists));
      localStorage.setItem('gag_stats',     JSON.stringify(this.stats));
    } catch (e) {
      console.warn('[Library] Erreur sauvegarde storage:', e);
    }
  },

  /* Construire index artistes + albums depuis songs */
  buildIndex() {
    try {
      this.artists = {};
      this.albums  = {};

      this.songs.forEach(song => {
        if (!song || !song.id) return;

        // Index artistes
        const artistKey = (song.artist || 'Inconnu').toLowerCase();
        if (!this.artists[artistKey]) {
          this.artists[artistKey] = {
            name:  song.artist || 'Inconnu',
            songs: [],
            info:  {},
          };
        }
        this.artists[artistKey].songs.push(song);

        // Index albums
        const albumKey = ((song.album || 'Sans album') + '|' + (song.artist || '')).toLowerCase();
        if (!this.albums[albumKey]) {
          this.albums[albumKey] = {
            name:   song.album  || 'Sans album',
            artist: song.artist || 'Inconnu',
            songs:  [],
            cover:  song.cover  || null,
          };
        }
        this.albums[albumKey].songs.push(song);
      });

    } catch (e) {
      console.error('[Library] Erreur buildIndex:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     INDEXEDDB — stockage fichiers audio
     ═══════════════════════════════════════════════════════ */

  openDB() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('gagmusic', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files', { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
      } catch (e) { reject(e); }
    });
  },

  async saveFileDB(id, file) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.put({ id, file });
        tx.oncomplete = () => resolve();
        tx.onerror    = (e) => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[Library] Erreur saveFileDB:', e);
    }
  },

  async getFileDB(id) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req   = store.get(id);
        req.onsuccess = (e) => resolve(e.target.result ? e.target.result.file : null);
        req.onerror   = (e) => reject(e.target.error);
      });
    } catch (e) {
      return null;
    }
  },

  /* Recharger les URLs blob après refresh */
  async restoreURLs() {
    try {
      for (const song of this.songs) {
        if (song.fileName && !song.path.startsWith('http')) {
          const file = await this.getFileDB(song.id);
          if (file) {
            song.path = URL.createObjectURL(file);
          }
        }
      }
    } catch (e) {
      console.warn('[Library] Erreur restoreURLs:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     IMPORT FICHIERS (bouton 🎵)
     ═══════════════════════════════════════════════════════ */

  initImport() {
    try {
      const btnImport   = document.getElementById('btn-import');
      const importInput = document.getElementById('import-input');
      if (!btnImport || !importInput) return;

      btnImport.addEventListener('click', () => importInput.click());

      importInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        this.importFiles(files);
        importInput.value = '';
      });

    } catch (e) {
      console.error('[Library] Erreur initImport:', e);
    }
  },

  importFiles(files) {
    try {
      if (!files || files.length === 0) return;

      if (typeof showToast === 'function') {
        showToast('🎵 Import de ' + files.length + ' fichier' + (files.length > 1 ? 's' : '') + '...');
      }

      let added   = 0;
      let pending = files.length;

      files.forEach(file => {
        try {
          if (!file || !file.type.startsWith('audio/')) {
            pending--;
            if (pending === 0) this.onImportDone(added);
            return;
          }

          const info = this.parseFileName(file.name);
          const id   = this.generateId();
          const url  = URL.createObjectURL(file);

          const song = {
            id,
            title:    info.title,
            artist:   info.artist,
            album:    info.album || '',
            genre:    '',
            duration: 0,
            path:     url,
            cover:    null,
            addedAt:  Date.now(),
            hasLyrics: false,
            fileSize:  file.size,
            fileName:  file.name,
          };

          // Vérifier doublon
          const exists = this.songs.find(s => s.fileName === file.name);
          if (exists) {
            pending--;
            if (pending === 0) this.onImportDone(added);
            return;
          }

          // Lire durée
          const audio = new Audio();
          audio.preload = 'metadata';
          audio.src = url;
          audio.addEventListener('loadedmetadata', () => {
            song.duration = audio.duration || 0;
            audio.src = '';
          });

          // Sauvegarder fichier dans IndexedDB
          this.saveFileDB(id, file).catch(e => console.warn('[Library] IndexedDB:', e));

          this.songs.push(song);
          added++;

          // Chercher métadonnées en arrière-plan
          this.fetchMetadata(song);

          pending--;
          if (pending === 0) this.onImportDone(added);

        } catch (e) {
          console.warn('[Library] Erreur import fichier:', e);
          pending--;
          if (pending === 0) this.onImportDone(added);
        }
      });

    } catch (e) {
      console.error('[Library] Erreur importFiles:', e);
    }
  },

  /* Chercher métadonnées via Last.fm */
  async fetchMetadata(song) {
    try {
      if (!song || !navigator.onLine) return;

      const API_KEY = '40bc3f6da0ab7f2cf73ec36834d75262';
      const title   = encodeURIComponent(song.title  || '');
      const artist  = encodeURIComponent(song.artist || '');

      if (!title || artist === 'Inconnu') return;

      const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${API_KEY}&artist=${artist}&track=${title}&format=json`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (!data || !data.track) return;

      const track = data.track;

      // Mettre à jour les infos
      if (track.album) {
        song.album = track.album.title || song.album;

        // Pochette
        const images = track.album.image || [];
        const large  = images.find(img => img.size === 'extralarge' || img.size === 'large');
        if (large && large['#text']) {
          song.cover = large['#text'];
        }
      }

      // Genre
      if (track.toptags && track.toptags.tag && track.toptags.tag[0]) {
        song.genre = track.toptags.tag[0].name || '';
      }

      // Durée (en ms dans Last.fm)
      if (track.duration && !song.duration) {
        song.duration = parseInt(track.duration) / 1000;
      }

      // Sauvegarder et rafraîchir
      this.saveToStorage();
      this.renderBiblio();

      console.log('[Library] Métadonnées récupérées:', song.title);

    } catch (e) {
      console.warn('[Library] Erreur fetchMetadata:', e.message);
    }
  },



  onImportDone(added) {
    try {
      if (added === 0) {
        if (typeof showToast === 'function') showToast('Aucun nouveau fichier ajouté');
        return;
      }

      this.buildIndex();
      this.saveToStorage();
      this.renderAll();

      if (typeof showToast === 'function') {
        showToast('✓ ' + added + ' titre' + (added > 1 ? 's' : '') + ' ajouté' + (added > 1 ? 's' : '') + ' !');
      }

      // Afficher mini lecteur si premier import
      const mini = document.getElementById('mini-player');
      if (mini && this.songs.length > 0) {
        // Proposer de lire le premier titre
        const first = this.songs[this.songs.length - 1];
        if (first) this.updateContinueCard(first);
      }

    } catch (e) {
      console.error('[Library] Erreur onImportDone:', e);
    }
  },

  /* Extraire titre/artiste depuis le nom du fichier */
  parseFileName(fileName) {
    try {
      // Retirer extension
      let name = fileName.replace(/\.[^.]+$/, '');

      // Formats courants :
      // "Artiste - Titre"
      // "Titre"
      // "01. Artiste - Titre"
      // "Artiste_Titre"

      // Retirer numéro de piste au début
      name = name.replace(/^\d+[\.\-\s]+/, '');

      // Remplacer underscores par espaces
      name = name.replace(/_/g, ' ').trim();

      // Séparation Artiste - Titre
      const dashIdx = name.indexOf(' - ');
      if (dashIdx > 0) {
        return {
          artist: name.slice(0, dashIdx).trim(),
          title:  name.slice(dashIdx + 3).trim(),
          album:  '',
        };
      }

      // Pas de séparateur → tout est le titre
      return {
        artist: 'Inconnu',
        title:  name || fileName,
        album:  '',
      };

    } catch (e) {
      return { artist: 'Inconnu', title: fileName || '—', album: '' };
    }
  },

  

  scan() {
    try {
      if (typeof Android !== 'undefined' && Android.scanMusic) {
        Android.scanMusic();
        if (typeof showToast === 'function') showToast('⟳ Scan en cours...');
      } else {
        // Mode navigateur : simulation
        if (typeof showToast === 'function') showToast('⟳ Scan en cours...');
        console.log('[Library] Scan simulé (mode navigateur)');
      }
      localStorage.setItem('gag_last_scan', Date.now().toString());
    } catch (e) {
      console.error('[Library] Erreur scan:', e);
    }
  },

  /* Appelé par Android après le scan */
  onScanComplete(songsJson) {
    try {
      const newSongs = typeof songsJson === 'string'
        ? JSON.parse(songsJson)
        : songsJson;

      if (!Array.isArray(newSongs)) return;

      let added = 0;
      newSongs.forEach(song => {
        if (!song || !song.path) return;
        // Éviter les doublons (par chemin)
        const exists = this.songs.find(s => s.path === song.path);
        if (!exists) {
          song.id      = song.id || this.generateId();
          song.addedAt = song.addedAt || Date.now();
          this.songs.push(song);
          added++;
        }
      });

      if (added > 0) {
        this.buildIndex();
        this.saveToStorage();
        this.renderAll();
        if (typeof showToast === 'function') {
          showToast('✓ ' + added + ' nouveau' + (added > 1 ? 'x' : '') + ' titre' + (added > 1 ? 's' : '') + ' ajouté' + (added > 1 ? 's' : ''));
        }
      } else {
        if (typeof showToast === 'function') showToast('✓ Bibliothèque à jour');
      }

    } catch (e) {
      console.error('[Library] Erreur onScanComplete:', e);
    }
  },

  /* Vérifier si scan auto nécessaire (>1h depuis dernier scan) */
  checkAutoScan() {
    try {
      const lastScan = parseInt(localStorage.getItem('gag_last_scan') || '0');
      const elapsed  = Date.now() - lastScan;
      const oneHour  = 3600000;
      if (elapsed > oneHour) {
        this.scan();
      }
    } catch (e) {
      console.warn('[Library] Erreur checkAutoScan:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     RENDU GLOBAL
     ═══════════════════════════════════════════════════════ */

  renderAll() {
    try {
      this.renderBiblio();
      this.renderArtistes();
      this.renderPlaylists();
      this.renderAccueil();
    } catch (e) {
      console.error('[Library] Erreur renderAll:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     BIBLIOTHÈQUE
     ═══════════════════════════════════════════════════════ */

  initBiblio() {
    try {
      // Recherche
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          this.searchQuery = searchInput.value.trim().toLowerCase();
          this.renderBiblio();
        });
      }

      // Menu tri
      const sortBtn  = document.getElementById('sort-btn');
      const sortMenu = document.getElementById('sort-menu');
      if (sortBtn && sortMenu) {
        sortBtn.addEventListener('click', () => {
          sortMenu.classList.toggle('hidden');
        });
      }

      const sortOptions = document.querySelectorAll('.sort-option');
      sortOptions.forEach(opt => {
        opt.addEventListener('click', () => {
          const sort = opt.dataset.sort;
          if (!sort) return;

          this.currentSort = sort;
          sortOptions.forEach(o => o.classList.remove('active'));
          opt.classList.add('active');

          const labels = { az:'A–Z', za:'Z–A', recent:'Récent', plays:'Écoutes', duration:'Durée' };
          if (sortBtn) sortBtn.textContent = '⇅ ' + (labels[sort] || sort);
          if (sortMenu) sortMenu.classList.add('hidden');

          this.renderBiblio();
        });
      });

    } catch (e) {
      console.error('[Library] Erreur initBiblio:', e);
    }
  },

  renderBiblio() {
    try {
      const list     = document.getElementById('biblio-list');
      const countEl  = document.getElementById('biblio-count');
      if (!list) return;

      // Filtrer
      let songs = this.songs.filter(s => {
        if (!this.searchQuery) return true;
        const q = this.searchQuery;
        return (
          (s.title  || '').toLowerCase().includes(q) ||
          (s.artist || '').toLowerCase().includes(q) ||
          (s.album  || '').toLowerCase().includes(q)
        );
      });

      // Trier
      songs = this.sortSongs(songs, this.currentSort);

      // Compteur
      if (countEl) countEl.textContent = songs.length + ' titre' + (songs.length > 1 ? 's' : '');

      // Rendu
      if (songs.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px 0;font-size:13px;">' +
          (this.songs.length === 0 ? '📂 Aucun titre — Lance un scan !' : '🔍 Aucun résultat') +
          '</div>';
        return;
      }

      list.innerHTML = '';
      songs.forEach((song, idx) => {
        if (!song) return;
        const isPlaying = this.isCurrentSong(song);
        const el = this.createSongRow(song, idx + 1, isPlaying, [
          { icon:'▶',  label:'Lire',                action: () => this.playSong(song, songs, idx) },
          { icon:'⏭',  label:'Lire ensuite',         action: () => showToast('Ajouté après la chanson en cours') },
          { icon:'⊕',  label:'Ajouter à la file',    action: () => showToast('Ajouté à la file') },
          { icon:'🎵', label:'Ajouter à playlist',   action: () => this.showAddToPlaylist(song) },
          { icon:'✎',  label:'Modifier les infos',   action: () => showToast('Modifier...') },
          { icon:'📊', label:'Stats du titre',        action: () => showToast('Stats...') },
          { separator: true },
          { icon:'🗑',  label:'Supprimer',             action: () => this.deleteSong(song), danger: true },
        ]);
        list.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderBiblio:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ARTISTES
     ═══════════════════════════════════════════════════════ */

  initArtistes() {
    try {
      const backBtn = document.getElementById('back-artiste');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (typeof closeSubscreen === 'function') closeSubscreen('screen-artiste-detail');
        });
      }
    } catch (e) {
      console.error('[Library] Erreur initArtistes:', e);
    }
  },

  renderArtistes() {
    try {
      const list = document.getElementById('artistes-list');
      if (!list) return;

      const artistKeys = Object.keys(this.artists).sort();

      if (artistKeys.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px 0;font-size:13px;">👤 Aucun artiste</div>';
        return;
      }

      list.innerHTML = '';
      artistKeys.forEach(key => {
        const artist = this.artists[key];
        if (!artist) return;

        const albumCount = this.countAlbumsForArtist(artist.name);

        const el = document.createElement('div');
        el.className = 'artist-row';
        el.innerHTML = `
          <div class="artist-photo">${artist.info.photo ? `<img src="${artist.info.photo}" alt="">` : '👤'}</div>
          <div class="artist-info">
            <div class="artist-name">${this.escape(artist.name)}</div>
            <div class="artist-meta">${artist.songs.length} titre${artist.songs.length > 1 ? 's' : ''} • ${albumCount} album${albumCount > 1 ? 's' : ''}</div>
          </div>
          <div class="artist-arrow">›</div>
        `;
        el.addEventListener('click', () => this.openArtisteDetail(artist));
        list.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderArtistes:', e);
    }
  },

  openArtisteDetail(artist) {
    try {
      if (!artist) return;

      const nomEl     = document.getElementById('artiste-detail-nom');
      const contentEl = document.getElementById('artiste-detail-content');
      if (!nomEl || !contentEl) return;

      nomEl.textContent = artist.name || '—';

      // Trier chansons par écoutes décroissantes
      const songs = [...(artist.songs || [])].sort((a, b) => {
        const pa = (this.stats[a.id] || {}).plays || 0;
        const pb = (this.stats[b.id] || {}).plays || 0;
        return pb - pa;
      });

      const totalPlays = songs.reduce((acc, s) => acc + ((this.stats[s.id] || {}).plays || 0), 0);
      const albumCount = this.countAlbumsForArtist(artist.name);

      contentEl.innerHTML = `
        <div class="artiste-hero">
          <div class="artiste-hero-bg">${artist.info.photo ? `<img src="${artist.info.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : '👤'}</div>
          <div class="artiste-hero-overlay"></div>
          <div class="artiste-hero-info">
            <div class="artiste-hero-name">${this.escape(artist.name)}</div>
            <div class="artiste-hero-meta">${songs.length} titre${songs.length>1?'s':''} • ${albumCount} album${albumCount>1?'s':''}</div>
          </div>
        </div>
        <div class="artiste-section">
          ${artist.info.bio ? `
            <div class="section-title">À propos</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:4px;">${this.escape(artist.info.bio)}</div>
          ` : ''}
          <div class="section-title">🏆 Stats artiste</div>
          <div class="card" style="display:flex;gap:20px;padding:12px 16px;">
            <div class="stat-item"><div class="stat-num">${totalPlays}</div><div class="stat-label">ÉCOUTES</div></div>
            <div class="stat-item"><div class="stat-num">${songs.length}</div><div class="stat-label">TITRES</div></div>
            <div class="stat-item"><div class="stat-num">${albumCount}</div><div class="stat-label">ALBUMS</div></div>
          </div>
          <div class="section-title">🎵 Titres populaires</div>
          <div id="artiste-songs-list"></div>
        </div>
      `;

      // Rendre les chansons
      const songsListEl = contentEl.querySelector('#artiste-songs-list');
      if (songsListEl) {
        const top = songs.slice(0, 5);
        top.forEach((song, idx) => {
          const isPlaying = this.isCurrentSong(song);
          const el = this.createSongRow(song, idx + 1, isPlaying, [
            { icon:'▶',  label:'Lire',              action: () => this.playSong(song, songs, idx) },
            { icon:'⏭',  label:'Lire ensuite',       action: () => showToast('Ajouté après la chanson en cours') },
            { icon:'⊕',  label:'Ajouter à la file',  action: () => showToast('Ajouté à la file') },
            { icon:'🎵', label:'Ajouter à playlist', action: () => this.showAddToPlaylist(song) },
          ]);
          songsListEl.appendChild(el);
        });

        // Bouton "Voir plus" si plus de 5
        if (songs.length > 5) {
          const btnMore = document.createElement('div');
          btnMore.style.cssText = 'text-align:center;padding:12px;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;';
          btnMore.textContent = 'Voir les ' + songs.length + ' titres ›';
          btnMore.addEventListener('click', () => {
            songsListEl.innerHTML = '';
            songs.forEach((song, idx) => {
              const isPlaying = this.isCurrentSong(song);
              const el = this.createSongRow(song, idx + 1, isPlaying, [
                { icon:'▶', label:'Lire', action: () => this.playSong(song, songs, idx) },
              ]);
              songsListEl.appendChild(el);
            });
            btnMore.remove();
          });
          songsListEl.after(btnMore);
        }
      }

      if (typeof openSubscreen === 'function') openSubscreen('screen-artiste-detail');

    } catch (e) {
      console.error('[Library] Erreur openArtisteDetail:', e);
    }
  },

  countAlbumsForArtist(artistName) {
    try {
      return Object.values(this.albums).filter(a =>
        (a.artist || '').toLowerCase() === (artistName || '').toLowerCase()
      ).length || 0;
    } catch (e) {
      return 0;
    }
  },

  /* ═══════════════════════════════════════════════════════
     PLAYLISTS
     ═══════════════════════════════════════════════════════ */

  initPlaylists() {
    try {
      const btnCreate = document.getElementById('btn-create-playlist');
      if (btnCreate) {
        btnCreate.addEventListener('click', () => this.createPlaylist());
      }

      const backBtn = document.getElementById('back-playlist');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (typeof closeSubscreen === 'function') closeSubscreen('screen-playlist-detail');
        });
      }

      // Smart playlists
      const smartCards = document.querySelectorAll('.smart-card');
      smartCards.forEach(card => {
        card.addEventListener('click', () => {
          const type = card.dataset.smart;
          if (type) this.openSmartPlaylist(type);
        });
      });

    } catch (e) {
      console.error('[Library] Erreur initPlaylists:', e);
    }
  },

  renderPlaylists() {
    try {
      const list = document.getElementById('playlists-list');
      if (!list) return;

      list.innerHTML = '';

      if (this.playlists.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;color:var(--text3);padding:30px 0;font-size:13px;';
        empty.textContent = '🎵 Aucune playlist — Crée-en une !';
        list.appendChild(empty);
        return;
      }

      this.playlists.forEach(pl => {
        if (!pl) return;
        const el = document.createElement('div');
        el.className = 'playlist-row';

        // Mosaïque 4 pochettes
        const covers = (pl.songs || []).slice(0, 4);
        const mosaicHTML = `
          <div class="playlist-mosaic">
            ${[0,1,2,3].map(i => `<div class="mosaic-cell">${covers[i] && covers[i].cover ? `<img src="${covers[i].cover}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}</div>`).join('')}
          </div>
        `;

        el.innerHTML = `
          ${mosaicHTML}
          <div class="playlist-info">
            <div class="playlist-name">${this.escape(pl.name || 'Playlist')}</div>
            <div class="playlist-meta">${(pl.songs || []).length} titre${(pl.songs||[]).length>1?'s':''}</div>
          </div>
          <div class="artist-arrow">›</div>
        `;
        el.addEventListener('click', () => this.openPlaylistDetail(pl));
        list.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderPlaylists:', e);
    }
  },

  createPlaylist() {
    try {
      const name = prompt('Nom de la playlist :');
      if (!name || !name.trim()) return;

      const pl = {
        id:        this.generateId(),
        name:      name.trim(),
        songs:     [],
        createdAt: Date.now(),
      };
      this.playlists.push(pl);
      this.saveToStorage();
      this.renderPlaylists();
      if (typeof showToast === 'function') showToast('✓ Playlist créée : ' + pl.name);
    } catch (e) {
      console.error('[Library] Erreur createPlaylist:', e);
    }
  },

  openPlaylistDetail(pl) {
    try {
      if (!pl) return;

      const nomEl     = document.getElementById('playlist-detail-nom');
      const contentEl = document.getElementById('playlist-detail-content');
      if (!nomEl || !contentEl) return;

      nomEl.textContent = pl.name || 'Playlist';
      const songs = pl.songs || [];

      contentEl.innerHTML = `
        <div style="padding:16px;">
          <div style="display:flex;gap:12px;margin-bottom:16px;">
            <button style="flex:1;background:linear-gradient(135deg,var(--accent3),var(--accent2));color:white;border-radius:var(--radius-pill);padding:10px;font-weight:700;font-size:14px;" onclick="Library.playPlaylist('${pl.id}')">◉ Lire</button>
            <button style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-pill);padding:10px;font-weight:600;font-size:14px;" onclick="Library.shufflePlaylist('${pl.id}')">⇄ Aléatoire</button>
          </div>
          <div id="playlist-songs-list"></div>
        </div>
      `;

      const songsListEl = contentEl.querySelector('#playlist-songs-list');
      if (songsListEl) {
        if (songs.length === 0) {
          songsListEl.innerHTML = '<div style="text-align:center;color:var(--text3);padding:30px 0;font-size:13px;">Playlist vide — Ajoute des titres !</div>';
        } else {
          songs.forEach((song, idx) => {
            const isPlaying = this.isCurrentSong(song);
            const el = this.createSongRow(song, idx + 1, isPlaying, [
              { icon:'▶',  label:'Lire',                action: () => this.playPlaylist(pl.id, idx) },
              { icon:'⏭',  label:'Lire ensuite',         action: () => showToast('Ajouté après la chanson en cours') },
              { icon:'🎵', label:'Autre playlist',        action: () => this.showAddToPlaylist(song) },
              { icon:'👤', label:'Voir artiste',          action: () => showToast('Artiste...') },
              { separator: true },
              { icon:'🗑',  label:'Retirer de la playlist', action: () => this.removeSongFromPlaylist(pl, song), danger: true },
            ]);
            songsListEl.appendChild(el);
          });
        }
      }

      if (typeof openSubscreen === 'function') openSubscreen('screen-playlist-detail');

    } catch (e) {
      console.error('[Library] Erreur openPlaylistDetail:', e);
    }
  },

  openSmartPlaylist(type) {
    try {
      let songs = [];
      let name  = '';

      switch (type) {
        case 'top':
          name  = '🔥 Top';
          songs = [...this.songs].sort((a,b) => ((this.stats[b.id]||{}).plays||0) - ((this.stats[a.id]||{}).plays||0)).slice(0,50);
          break;
        case 'recent':
          name  = '🕐 Récents';
          songs = [...this.songs].sort((a,b) => ((this.stats[b.id]||{}).lastPlayed||0) - ((this.stats[a.id]||{}).lastPlayed||0)).slice(0,50);
          break;
        case 'coeur':
          name  = '❤ Coups de cœur';
          songs = this.getCoeursThisWeek();
          break;
        case 'lyrics':
          name  = '🎤 Avec paroles';
          songs = this.songs.filter(s => s.hasLyrics);
          break;
        case 'night':
          name  = '🌙 Nuit';
          songs = [...this.songs].sort(() => Math.random() - 0.5).slice(0,30);
          break;
        case 'energy':
          name  = '⚡ Énergie';
          songs = this.songs.filter(s => (s.bpm || 0) > 120);
          break;
        case 'genre':
          name  = '🎸 Genre';
          songs = [...this.songs];
          break;
        case 'albums':
          name  = '💿 Albums complets';
          songs = this.songs.filter(s => {
            const key = ((s.album||'')+'|'+(s.artist||'')).toLowerCase();
            const album = this.albums[key];
            return album && album.songs.length >= 5;
          });
          break;
        default:
          name  = '🎵 Playlist';
          songs = [...this.songs];
      }

      // Ouvrir comme une playlist normale
      const fakePl = { id: 'smart_' + type, name, songs };
      this.openPlaylistDetail(fakePl);

    } catch (e) {
      console.error('[Library] Erreur openSmartPlaylist:', e);
    }
  },

  showAddToPlaylist(song) {
    try {
      if (this.playlists.length === 0) {
        if (typeof showToast === 'function') showToast('Crée d\'abord une playlist !');
        return;
      }
      const items = this.playlists.map(pl => ({
        icon: '🎵',
        label: pl.name + ' (' + (pl.songs||[]).length + ')',
        action: () => this.addSongToPlaylist(song, pl),
      }));
      if (typeof showContextMenu === 'function') showContextMenu(items);
    } catch (e) {
      console.error('[Library] Erreur showAddToPlaylist:', e);
    }
  },

  addSongToPlaylist(song, pl) {
    try {
      if (!song || !pl) return;
      const exists = (pl.songs || []).find(s => s.id === song.id);
      if (exists) {
        if (typeof showToast === 'function') showToast('Déjà dans la playlist');
        return;
      }
      pl.songs = pl.songs || [];
      pl.songs.push(song);
      this.saveToStorage();
      if (typeof showToast === 'function') showToast('✓ Ajouté à ' + pl.name);
    } catch (e) {
      console.error('[Library] Erreur addSongToPlaylist:', e);
    }
  },

  removeSongFromPlaylist(pl, song) {
    try {
      if (!pl || !song) return;
      pl.songs = (pl.songs || []).filter(s => s.id !== song.id);
      this.saveToStorage();
      this.openPlaylistDetail(pl); // Rafraîchir
      if (typeof showToast === 'function') showToast('Retiré de la playlist');
    } catch (e) {
      console.error('[Library] Erreur removeSongFromPlaylist:', e);
    }
  },

  playPlaylist(playlistId, startIndex) {
    try {
      let pl;
      if (playlistId && playlistId.startsWith('smart_')) {
        if (typeof showToast === 'function') showToast('▶ Lecture en cours...');
        return;
      }
      pl = this.playlists.find(p => p.id === playlistId);
      if (!pl || !pl.songs || pl.songs.length === 0) return;
      this.playSong(pl.songs[startIndex || 0], pl.songs, startIndex || 0);
    } catch (e) {
      console.error('[Library] Erreur playPlaylist:', e);
    }
  },

  shufflePlaylist(playlistId) {
    try {
      if (typeof showToast === 'function') showToast('🔀 Lecture aléatoire...');
    } catch (e) {
      console.error('[Library] Erreur shufflePlaylist:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ACCUEIL
     ═══════════════════════════════════════════════════════ */

  initAccueil() {
    try {
      // Bouton continuer
      const continueBtn = document.getElementById('continue-btn');
      const continueCard = document.getElementById('continue-card');
      if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof openPlayer === 'function') openPlayer();
        });
      }
      if (continueCard) {
        continueCard.addEventListener('click', () => {
          if (typeof openPlayer === 'function') openPlayer();
        });
      }

      // Bouton chanson du moment
      const momentCard = document.getElementById('moment-card');
      if (momentCard) {
        momentCard.addEventListener('click', () => {
          if (typeof openPlayer === 'function') openPlayer();
        });
      }

      // Tri oubliés
      const oubliesSort = document.getElementById('oublies-sort');
      if (oubliesSort) {
        oubliesSort.addEventListener('click', () => {
          if (typeof showToast === 'function') showToast('Tri des oubliés...');
        });
      }

    } catch (e) {
      console.error('[Library] Erreur initAccueil:', e);
    }
  },

  renderAccueil() {
    try {
      this.renderTodayStats();
      this.renderRecentScroll();
      this.renderCoeurs();
      this.renderNewScroll();
      this.renderOublies();
      this.renderMoment();
    } catch (e) {
      console.error('[Library] Erreur renderAccueil:', e);
    }
  },

  renderTodayStats() {
    try {
      const today   = this.getTodayStats();
      const titresEl  = document.getElementById('stat-titres');
      const tempsEl   = document.getElementById('stat-temps');
      const artistesEl = document.getElementById('stat-artistes');

      if (titresEl)   titresEl.textContent   = today.plays || 0;
      if (tempsEl)    tempsEl.textContent     = this.formatDuration(today.duration || 0);
      if (artistesEl) artistesEl.textContent  = today.artists || 0;
    } catch (e) {
      console.error('[Library] Erreur renderTodayStats:', e);
    }
  },

  renderRecentScroll() {
    try {
      const container = document.getElementById('recent-scroll');
      if (!container) return;

      // Chansons récemment écoutées (par lastPlayed décroissant)
      const recent = [...this.songs]
        .filter(s => (this.stats[s.id] || {}).lastPlayed)
        .sort((a,b) => (this.stats[b.id]?.lastPlayed||0) - (this.stats[a.id]?.lastPlayed||0))
        .slice(0, 10);

      container.innerHTML = '';

      if (recent.length === 0) {
        container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px 0;">Aucune écoute récente</div>';
        return;
      }

      // Grouper par album
      const albums = {};
      recent.forEach(s => {
        const key = ((s.album||'Sans album')+'|'+(s.artist||'')).toLowerCase();
        if (!albums[key]) albums[key] = { name: s.album||'Sans album', artist: s.artist||'', cover: s.cover||null, isPlaying: this.isCurrentSong(s) };
      });

      Object.values(albums).slice(0,8).forEach(album => {
        const el = document.createElement('div');
        el.className = 'album-card';
        el.innerHTML = `
          <div class="album-thumb ${album.isPlaying ? 'playing' : ''}">${album.cover ? `<img src="${album.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : '🎵'}</div>
          <div class="album-name">${this.escape(album.name)}</div>
          <div class="album-artist">${this.escape(album.artist)}</div>
        `;
        el.addEventListener('click', () => {
          if (typeof openPlayer === 'function') openPlayer();
        });
        container.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderRecentScroll:', e);
    }
  },

  renderCoeurs() {
    try {
      const list = document.getElementById('coeur-list');
      if (!list) return;

      const coeurs = this.getCoeursThisWeek().slice(0, 5);

      list.innerHTML = '';

      if (coeurs.length === 0) {
        list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px 0;">Écoute 5× un titre cette semaine pour le voir ici</div>';
        return;
      }

      coeurs.forEach((song, idx) => {
        const isPlaying = this.isCurrentSong(song);
        const plays = (this.stats[song.id] || {}).weekPlays || 0;
        const el = this.createSongRow(song, idx + 1, isPlaying, [
          { icon:'▶', label:'Lire', action: () => this.playSong(song, coeurs, idx) },
          { icon:'⊕', label:'Ajouter à la file', action: () => showToast('Ajouté à la file') },
        ]);
        // Ajouter info écoutes semaine
        const metaEl = el.querySelector('.song-meta');
        if (metaEl) metaEl.textContent = (song.artist||'') + ' • ' + plays + ' fois cette semaine';
        list.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderCoeurs:', e);
    }
  },

  renderNewScroll() {
    try {
      const container = document.getElementById('new-scroll');
      if (!container) return;

      const recent = [...this.songs]
        .sort((a,b) => (b.addedAt||0) - (a.addedAt||0))
        .slice(0, 8);

      container.innerHTML = '';

      if (recent.length === 0) {
        container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px 0;">Aucun titre récent</div>';
        return;
      }

      // Grouper par album
      const seen = new Set();
      recent.forEach(song => {
        const key = ((song.album||song.title||'')+'|'+(song.artist||'')).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const el = document.createElement('div');
        el.className = 'album-card';
        el.innerHTML = `
          <div class="album-thumb">${song.cover ? `<img src="${song.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : '🎵'}</div>
          <div class="album-name">${this.escape(song.album || song.title || '—')}</div>
          <div class="album-artist">${this.escape(song.artist || '—')}</div>
        `;
        el.addEventListener('click', () => this.playSong(song, recent, 0));
        container.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderNewScroll:', e);
    }
  },

  renderOublies() {
    try {
      const list = document.getElementById('oublies-list');
      if (!list) return;

      const thirtyDaysAgo = Date.now() - (30 * 24 * 3600 * 1000);
      const oublies = this.songs.filter(s => {
        const lastPlayed = (this.stats[s.id] || {}).lastPlayed || 0;
        return lastPlayed > 0 && lastPlayed < thirtyDaysAgo;
      }).sort((a,b) => (this.stats[a.id]?.lastPlayed||0) - (this.stats[b.id]?.lastPlayed||0)).slice(0, 5);

      list.innerHTML = '';

      if (oublies.length === 0) {
        list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px 0;">Aucun oublié pour l\'instant</div>';
        return;
      }

      oublies.forEach((song, idx) => {
        const lastPlayed = (this.stats[song.id] || {}).lastPlayed || 0;
        const daysAgo    = Math.floor((Date.now() - lastPlayed) / (24*3600*1000));
        const isPlaying  = this.isCurrentSong(song);
        const el = this.createSongRow(song, idx + 1, isPlaying, [
          { icon:'▶', label:'Lire', action: () => this.playSong(song, oublies, idx) },
        ]);
        const metaEl = el.querySelector('.song-meta');
        if (metaEl) metaEl.textContent = (song.artist||'') + ' • il y a ' + daysAgo + ' jours';
        list.appendChild(el);
      });

    } catch (e) {
      console.error('[Library] Erreur renderOublies:', e);
    }
  },

  renderMoment() {
    try {
      // Chanson la plus écoutée cette semaine
      const weekStart = this.getWeekStart();
      let best = null;
      let bestCount = 0;

      this.songs.forEach(song => {
        const st = this.stats[song.id] || {};
        const weekPlays = st.weekPlays || 0;
        if (weekPlays > bestCount) {
          bestCount = weekPlays;
          best      = song;
        }
      });

      const card = document.getElementById('moment-card');
      if (!card) return;

      if (!best || bestCount === 0) {
        card.classList.add('hidden');
        return;
      }

      card.classList.remove('hidden');

      const thumbEl  = document.getElementById('moment-thumb');
      const titleEl  = document.getElementById('moment-title');
      const artistEl = document.getElementById('moment-artist');
      const countEl  = document.getElementById('moment-count');

      if (thumbEl)  thumbEl.innerHTML  = best.cover ? `<img src="${best.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : '🎵';
      if (titleEl)  titleEl.textContent  = best.title  || '—';
      if (artistEl) artistEl.textContent = best.artist || '—';
      if (countEl)  countEl.textContent  = bestCount + ' écoute' + (bestCount>1?'s':'') + ' cette semaine';

    } catch (e) {
      console.error('[Library] Erreur renderMoment:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     LECTURE
     ═══════════════════════════════════════════════════════ */

  playSong(song, queue, index) {
    try {
      if (!song) return;

      // Initialiser Player si pas encore fait
      if (typeof Player !== 'undefined' && !Player.audio) {
        Player.init();
      }

      // Passer au Player
      if (typeof Player !== 'undefined' && Player.play) {
        Player.play(song, queue || [song], index || 0);
        // Ouvrir le lecteur plein écran
        if (typeof openPlayer === 'function') openPlayer();
      } else {
        // Fallback
        if (typeof updateMiniPlayer === 'function') updateMiniPlayer(song);
        if (typeof openPlayer === 'function') openPlayer();
        if (typeof showToast === 'function') showToast('▶ ' + (song.title || '—'));
        try { localStorage.setItem('gag_last_song', JSON.stringify(song)); } catch(e) {}
        this.updateContinueCard(song);
      }

    } catch (e) {
      console.error('[Library] Erreur playSong:', e);
    }
  },

  updateContinueCard(song) {
    try {
      if (!song) return;
      const card = document.getElementById('continue-card');
      if (card) card.classList.remove('hidden');

      const titleEl  = document.getElementById('continue-title');
      const artistEl = document.getElementById('continue-artist');
      if (titleEl)  titleEl.textContent  = song.title  || '—';
      if (artistEl) artistEl.textContent = (song.artist||'—') + (song.album ? ' • ' + song.album : '');
    } catch (e) {
      console.error('[Library] Erreur updateContinueCard:', e);
    }
  },

  /* Vérifier si une chanson est en cours de lecture */
  isCurrentSong(song) {
    try {
      if (!song) return false;
      if (typeof Player !== 'undefined' && Player.currentSong) {
        return Player.currentSong.id === song.id;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  /* ═══════════════════════════════════════════════════════
     SUPPRIMER
     ═══════════════════════════════════════════════════════ */

  deleteSong(song) {
    try {
      if (!song) return;
      const confirm = window.confirm('Supprimer "' + (song.title||'ce titre') + '" de la bibliothèque ?');
      if (!confirm) return;

      this.songs = this.songs.filter(s => s.id !== song.id);
      // Retirer des playlists aussi
      this.playlists.forEach(pl => {
        pl.songs = (pl.songs||[]).filter(s => s.id !== song.id);
      });
      this.buildIndex();
      this.saveToStorage();
      this.renderAll();
      if (typeof showToast === 'function') showToast('✓ Titre supprimé');
    } catch (e) {
      console.error('[Library] Erreur deleteSong:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     STATS
     ═══════════════════════════════════════════════════════ */

  getTodayStats() {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayTs = today.getTime();

      let plays    = 0;
      let duration = 0;
      const artists = new Set();

      Object.entries(this.stats).forEach(([id, st]) => {
        if (!st) return;
        const song = this.songs.find(s => s.id === id);
        if (!song) return;

        (st.history || []).forEach(entry => {
          if (entry.ts >= todayTs) {
            plays++;
            duration += song.duration || 0;
            if (song.artist) artists.add(song.artist.toLowerCase());
          }
        });
      });

      return { plays, duration, artists: artists.size };
    } catch (e) {
      return { plays: 0, duration: 0, artists: 0 };
    }
  },

  getCoeursThisWeek() {
    try {
      const weekStart = this.getWeekStart();
      return this.songs.filter(s => {
        const st = this.stats[s.id] || {};
        // Compter écoutes depuis lundi
        const weekPlays = (st.history || []).filter(e => e.ts >= weekStart).length;
        // Mise à jour weekPlays dans stats
        if (!this.stats[s.id]) this.stats[s.id] = {};
        this.stats[s.id].weekPlays = weekPlays;
        return weekPlays >= 5;
      }).sort((a,b) => (this.stats[b.id]?.weekPlays||0) - (this.stats[a.id]?.weekPlays||0));
    } catch (e) {
      return [];
    }
  },

  getWeekStart() {
    try {
      const now = new Date();
      const day = now.getDay(); // 0=dim, 1=lun...
      const diff = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0,0,0,0);
      return monday.getTime();
    } catch (e) {
      return Date.now() - (7 * 24 * 3600 * 1000);
    }
  },

  /* ═══════════════════════════════════════════════════════
     COMPOSANT SONG ROW
     ═══════════════════════════════════════════════════════ */

  createSongRow(song, num, isPlaying, menuItems) {
    try {
      const el = document.createElement('div');
      el.className = 'song-row';

      const eqHTML = isPlaying ? `
        <div class="eq-anim">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>` : '';

      el.innerHTML = `
        <div class="song-num">${num}</div>
        <div class="song-thumb ${isPlaying ? 'playing' : ''}">
          ${song.cover ? `<img src="${song.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🎵'}
          ${eqHTML}
        </div>
        <div class="song-info">
          <div class="song-name ${isPlaying ? 'playing' : ''}">${this.escape(song.title || '—')}</div>
          <div class="song-meta">${this.escape(song.artist || '—')}${song.duration ? ' • ' + this.formatSongDuration(song.duration) : ''}</div>
        </div>
        <div class="song-badges">
          ${song.hasLyrics ? '<span class="badge-lyrics">🎤</span>' : ''}
        </div>
        <div class="song-more">···</div>
      `;

      // Clic sur la ligne → lire
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('song-more')) return;
        if (menuItems && menuItems[0] && typeof menuItems[0].action === 'function') {
          menuItems[0].action();
        }
      });

      // Clic sur ··· → menu contextuel
      const moreBtn = el.querySelector('.song-more');
      if (moreBtn && menuItems) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof showContextMenu === 'function') showContextMenu(menuItems);
        });
      }

      return el;
    } catch (e) {
      console.error('[Library] Erreur createSongRow:', e);
      return document.createElement('div');
    }
  },

  /* ═══════════════════════════════════════════════════════
     TRI
     ═══════════════════════════════════════════════════════ */

  sortSongs(songs, sort) {
    try {
      const arr = [...songs];
      switch (sort) {
        case 'az':
          return arr.sort((a,b) => (a.title||'').localeCompare(b.title||''));
        case 'za':
          return arr.sort((a,b) => (b.title||'').localeCompare(a.title||''));
        case 'recent':
          return arr.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
        case 'plays':
          return arr.sort((a,b) => ((this.stats[b.id]||{}).plays||0) - ((this.stats[a.id]||{}).plays||0));
        case 'duration':
          return arr.sort((a,b) => (b.duration||0) - (a.duration||0));
        default:
          return arr;
      }
    } catch (e) {
      return songs;
    }
  },

  /* ═══════════════════════════════════════════════════════
     UTILITAIRES
     ═══════════════════════════════════════════════════════ */

  generateId() {
    return 'song_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  },

  formatDuration(seconds) {
    try {
      if (!seconds) return '0min';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0) return h + 'h' + (m > 0 ? m + 'min' : '');
      return m + 'min';
    } catch (e) {
      return '0min';
    }
  },

  formatSongDuration(seconds) {
    try {
      if (!seconds) return '';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    } catch (e) {
      return '';
    }
  },
};

/* Exposer Library globalement */
window.Library = Library;
