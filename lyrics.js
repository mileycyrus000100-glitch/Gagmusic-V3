/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — lyrics.js
   Paroles synchronisées, karaoke, traduction, EQ
   ═══════════════════════════════════════════════════════ */

const Lyrics = {

  /* ─── ÉTAT ─── */
  lines:        [],     // [{ time, text }]
  currentLine:  -1,
  syncOffset:   0,      // décalage en secondes
  autoSync:     true,
  fontSize:     'md',   // 'sm' | 'md' | 'lg'
  isTranslated: false,
  translatedLines: [],
  wakeLock:     null,
  batteryWarningTimer: null,
  currentSong:  null,

  /* ─── INIT ─── */
  init() {
    try {
      this.initLyricsPanel();
      this.initEQPanel();
      this.initSyncPanel();
      console.log('[Lyrics] Initialisé');
    } catch (e) {
      console.error('[Lyrics] Erreur init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     CHARGEMENT PAROLES
     ═══════════════════════════════════════════════════════ */

  load(song) {
    try {
      if (!song) return;
      this.currentSong  = song;
      this.lines        = [];
      this.currentLine  = -1;
      this.translatedLines = [];
      this.isTranslated = false;

      // Vider l'aperçu
      this.updatePreview('', '');

      // 1. Vérifier cache local
      const cached = this.getFromCache(song.id);
      if (cached) {
        this.setLines(cached);
        return;
      }

      // 2. Chercher en ligne (cascade APIs)
      if (navigator.onLine) {
        this.fetchLyrics(song);
      } else {
        this.updatePreview('Paroles indisponibles hors ligne', '');
      }

    } catch (e) {
      console.error('[Lyrics] Erreur load:', e);
    }
  },

  async fetchLyrics(song) {
    try {
      if (!song) return;

      const title  = this.cleanTitle(song.title  || '');
      const artist = this.cleanArtist(song.artist || '');

      // Cascade : LRCLib → Lyrics.ovh → Musixmatch → Genius
      let found = false;

      // 1. LRCLib (sync LRC — meilleure source)
      if (!found) found = await this.fetchLRCLib(title, artist, song.duration);

      // 2. Lyrics.ovh
      if (!found) found = await this.fetchLyricsOvh(title, artist);

      // 3. Musixmatch (via proxy public non officiel)
      if (!found) found = await this.fetchMusixmatch(title, artist);

      // 4. Genius (scraping titre via API search)
      if (!found) found = await this.fetchGenius(title, artist);

      if (!found) {
        this.updatePreview('Paroles introuvables', 'Essaie de corriger le titre ou l\'artiste');
        song.hasLyrics = false;
      }

    } catch (e) {
      console.error('[Lyrics] Erreur fetchLyrics:', e);
      this.updatePreview('Erreur lors du chargement', '');
    }
  },

  async fetchLRCLib(title, artist, duration) {
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}${duration ? '&duration=' + Math.round(duration) : ''}`;

      const res = await this.fetchWithTimeout(url, 8000);
      if (!res || !res.ok) return false;

      const data = await res.json();
      if (!data) return false;

      // Paroles synchronisées (LRC)
      if (data.syncedLyrics) {
        const lines = this.parseLRC(data.syncedLyrics);
        if (lines.length > 0) {
          this.setLines(lines, true);
          this.saveToCache(this.currentSong?.id, lines);
          if (this.currentSong) this.currentSong.hasLyrics = true;
          return true;
        }
      }

      // Paroles non synchronisées
      if (data.plainLyrics) {
        const lines = this.parsePlain(data.plainLyrics);
        if (lines.length > 0) {
          this.setLines(lines, false);
          this.saveToCache(this.currentSong?.id, lines);
          if (this.currentSong) this.currentSong.hasLyrics = true;
          return true;
        }
      }

      return false;
    } catch (e) {
      console.warn('[Lyrics] LRCLib:', e.message);
      return false;
    }
  },

  async fetchLyricsOvh(title, artist) {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const res = await this.fetchWithTimeout(url, 8000);
      if (!res || !res.ok) return false;

      const data = await res.json();
      if (!data || !data.lyrics) return false;

      const lines = this.parsePlain(data.lyrics);
      if (lines.length === 0) return false;

      this.setLines(lines, false);
      this.saveToCache(this.currentSong?.id, lines);
      if (this.currentSong) this.currentSong.hasLyrics = true;
      return true;

    } catch (e) {
      console.warn('[Lyrics] Lyrics.ovh:', e.message);
      return false;
    }
  },

  async fetchMusixmatch(title, artist) {
    try {
      // API publique non officielle — pas de clé requise
      const q   = encodeURIComponent(artist + ' ' + title);
      const url = 'https://corsproxy.io/?' + encodeURIComponent(
        `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&namespace=lyrics_richsynched&subtitle_format=mxm&app_id=web-desktop-app-v1.0&q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}`
      );

      const res = await this.fetchWithTimeout(url, 8000);
      if (!res || !res.ok) return false;

      const data = await res.json();
      const body = data?.message?.body?.macro_calls;

      // Paroles synchronisées
      const subtitleBody = body?.['track.subtitles.get']?.message?.body;
      if (subtitleBody && subtitleBody.subtitle_list && subtitleBody.subtitle_list[0]) {
        const subtitle = subtitleBody.subtitle_list[0].subtitle;
        if (subtitle && subtitle.subtitle_body) {
          try {
            const parsed = JSON.parse(subtitle.subtitle_body);
            const lines  = parsed.map(l => ({
              time:   l.time.total,
              text:   l.text || '♪',
              synced: true,
            })).filter(l => l.text !== '♪' || l.time > 0);

            if (lines.length > 0) {
              this.setLines(lines, true);
              this.saveToCache(this.currentSong?.id, lines);
              if (this.currentSong) this.currentSong.hasLyrics = true;
              return true;
            }
          } catch (e2) {}
        }
      }

      // Paroles non synchronisées
      const lyricsBody = body?.['track.lyrics.get']?.message?.body;
      if (lyricsBody && lyricsBody.lyrics && lyricsBody.lyrics.lyrics_body) {
        const text  = lyricsBody.lyrics.lyrics_body.replace(/\*{3}.*$/m, '').trim();
        const lines = this.parsePlain(text);
        if (lines.length > 0) {
          this.setLines(lines, false);
          this.saveToCache(this.currentSong?.id, lines);
          if (this.currentSong) this.currentSong.hasLyrics = true;
          return true;
        }
      }

      return false;
    } catch (e) {
      console.warn('[Lyrics] Musixmatch:', e.message);
      return false;
    }
  },

  async fetchGenius(title, artist) {
    try {
      // Genius API publique — recherche du titre, puis scraping des paroles
      const q   = encodeURIComponent(artist + ' ' + title);
      const url = 'https://corsproxy.io/?' + encodeURIComponent(
        `https://api.genius.com/search?q=${q}`
      );

      const res = await this.fetchWithTimeout(url, 8000);
      if (!res || !res.ok) return false;

      const data = await res.json();
      const hits = data?.response?.hits;
      if (!hits || hits.length === 0) return false;

      // Prendre le premier résultat
      const hit     = hits[0].result;
      const pageUrl = hit && hit.url;
      if (!pageUrl) return false;

      // Scraper la page Genius pour extraire les paroles
      const pageRes = await this.fetchWithTimeout(
        'https://corsproxy.io/?' + encodeURIComponent(pageUrl), 10000
      );
      if (!pageRes || !pageRes.ok) return false;

      const html   = await pageRes.text();
      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');

      // Genius utilise des divs data-lyrics-container
      const containers = doc.querySelectorAll('[data-lyrics-container="true"]');
      if (containers.length === 0) return false;

      let text = '';
      containers.forEach(el => {
        el.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        text += el.textContent + '\n';
      });

      const lines = this.parsePlain(text.trim());
      if (lines.length === 0) return false;

      this.setLines(lines, false);
      this.saveToCache(this.currentSong?.id, lines);
      if (this.currentSong) this.currentSong.hasLyrics = true;
      return true;

    } catch (e) {
      console.warn('[Lyrics] Genius:', e.message);
      return false;
    }
  },

  /* ═══════════════════════════════════════════════════════
     PARSING
     ═══════════════════════════════════════════════════════ */

  parseLRC(lrc) {
    try {
      const lines = [];
      const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
      let match;

      while ((match = regex.exec(lrc)) !== null) {
        const min  = parseInt(match[1]);
        const sec  = parseInt(match[2]);
        const cs   = parseInt(match[3]);
        const text = (match[4] || '').trim();
        const time = min * 60 + sec + cs / 100;

        if (text) lines.push({ time, text, synced: true });
      }

      return lines.sort((a,b) => a.time - b.time);
    } catch (e) {
      console.error('[Lyrics] Erreur parseLRC:', e);
      return [];
    }
  },

  parsePlain(text) {
    try {
      return text
        .split('\n')
        .map((line, i) => ({ time: i * 4, text: line.trim(), synced: false }))
        .filter(l => l.text.length > 0);
    } catch (e) {
      return [];
    }
  },

  /* ═══════════════════════════════════════════════════════
     AFFICHAGE
     ═══════════════════════════════════════════════════════ */

  setLines(lines, synced) {
    try {
      this.lines = lines || [];
      // Aperçu dans le lecteur
      this.updatePreview(
        this.lines[0]?.text || '',
        this.lines[1]?.text || ''
      );
      // Rafraîchir la vue paroles si ouverte
      if (typeof renderParolesView === 'function') renderParolesView();
    } catch (e) {
      console.error('[Lyrics] Erreur setLines:', e);
    }
  },

  /* Appelé à chaque seconde par Player */
  onTimeUpdate(currentTime) {
    try {
      if (!this.lines || this.lines.length === 0) return;

      const adjusted = currentTime + this.syncOffset;
      let newLine = -1;

      for (let i = 0; i < this.lines.length; i++) {
        if (this.lines[i].time <= adjusted) {
          newLine = i;
        } else {
          break;
        }
      }

      if (newLine !== this.currentLine) {
        this.currentLine = newLine;
        this.renderCurrentLine();
      }

    } catch (e) {
      console.error('[Lyrics] Erreur onTimeUpdate:', e);
    }
  },

  renderCurrentLine() {
    try {
      if (this.currentLine < 0 || !this.lines[this.currentLine]) return;

      const current = this.lines[this.currentLine];
      const next    = this.lines[this.currentLine + 1];

      const display = this.isTranslated && this.translatedLines[this.currentLine]
        ? this.translatedLines[this.currentLine]
        : current.text;

      const displayNext = next
        ? (this.isTranslated && this.translatedLines[this.currentLine + 1]
          ? this.translatedLines[this.currentLine + 1]
          : next.text)
        : '';

      // Aperçu dans le lecteur principal
      this.updatePreview(display, displayNext);

      // Ligne active dans la vue paroles
      if (typeof updateParolesActive === 'function') {
        updateParolesActive(this.currentLine);
      }

    } catch (e) {
      console.error('[Lyrics] Erreur renderCurrentLine:', e);
    }
  },

  updatePreview(line1, line2) {
    try {
      const el1 = document.getElementById('player-lyrics-line1');
      const el2 = document.getElementById('player-lyrics-line2');
      if (el1) el1.textContent = line1 || '';
      if (el2) el2.textContent = line2 || '';
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     PANNEAU PAROLES (écran paroles complet)
     ═══════════════════════════════════════════════════════ */

  initLyricsPanel() {
    try {
      // Le panneau paroles est un swipe depuis le lecteur
      // Géré par app.js via swipe → ici on initialise les boutons

      // Pas d'écran paroles séparé dans le HTML actuel
      // Les paroles s'affichent dans l'aperçu du lecteur
      // L'écran complet sera ajouté dans index.html si nécessaire

    } catch (e) {
      console.error('[Lyrics] Erreur initLyricsPanel:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     PANNEAU EQ / SON
     ═══════════════════════════════════════════════════════ */

  initEQPanel() {
    try {
      // Presets EQ
      this.eqPresets = {
        normal:    [0,  0,  0,  0,  0,  0,  0],
        bass:      [6,  4,  2,  0,  0,  0,  0],
        rock:      [4,  2,  0,  2,  4,  2,  0],
        pop:       [0,  2,  4,  4,  2,  0,  0],
        electro:   [4,  0,  2,  0,  4,  2,  4],
        jazz:      [0,  2,  2,  4,  2,  2,  0],
        classique: [0,  0,  0,  0,  0,  2,  4],
        party:     [4,  2,  0,  2,  4,  6,  4],
        night:     [-2, -2,  0,  2,  2,  0, -2],
      };

      this.currentPreset = 'normal';
      this.eqBands = [0,0,0,0,0,0,0]; // 60,170,310,600,1K,3K,6K Hz

    } catch (e) {
      console.error('[Lyrics] Erreur initEQPanel:', e);
    }
  },

  applyEQPreset(preset) {
    try {
      if (!this.eqPresets[preset]) return;
      this.currentPreset = preset;
      this.eqBands       = [...this.eqPresets[preset]];

      // Appliquer via WebAudio si disponible
      if (Player && Player.audioContext && Player.eqNodes) {
        this.eqBands.forEach((gain, i) => {
          if (Player.eqNodes[i]) Player.eqNodes[i].gain.value = gain;
        });
      }

      if (typeof showToast === 'function') {
        const labels = { normal:'Normal', bass:'Bass Boost', rock:'Rock', pop:'Pop', electro:'Électro', jazz:'Jazz', classique:'Classique', party:'Party', night:'Night' };
        showToast('🎛 ' + (labels[preset] || preset));
      }
    } catch (e) {
      console.error('[Lyrics] Erreur applyEQPreset:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     PANNEAU SYNC
     ═══════════════════════════════════════════════════════ */

  initSyncPanel() {
    try {
      this.autoSync   = true;
      this.syncOffset = 0;
    } catch (e) {}
  },

  adjustSync(delta) {
    try {
      this.syncOffset += delta;
      this.syncOffset  = Math.max(-10, Math.min(10, this.syncOffset));
      if (typeof showToast === 'function') {
        showToast('Sync : ' + (this.syncOffset >= 0 ? '+' : '') + this.syncOffset.toFixed(1) + 's');
      }
    } catch (e) {
      console.error('[Lyrics] Erreur adjustSync:', e);
    }
  },

  resetSync() {
    try {
      this.syncOffset = 0;
      this.autoSync   = true;
      if (typeof showToast === 'function') showToast('✦ Sync automatique');
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     TAILLE TEXTE
     ═══════════════════════════════════════════════════════ */

  setFontSize(size) {
    try {
      this.fontSize = size;
      const sizes = { sm:'13px', md:'16px', lg:'22px' };
      const px    = sizes[size] || '16px';
      // Aperçu lecteur
      const el1 = document.getElementById('player-lyrics-line1');
      const el2 = document.getElementById('player-lyrics-line2');
      if (el1) el1.style.fontSize = px;
      if (el2) el2.style.fontSize = (parseInt(px) - 2) + 'px';
      // Vue paroles complète
      const list = document.getElementById('paroles-list');
      if (list) {
        list.querySelectorAll('.paroles-line').forEach(el => {
          el.style.fontSize = '';  // reset CSS gère l'actif/inactif
        });
        list.style.setProperty('--paroles-font', px);
      }
      if (typeof showToast === 'function') showToast('Taille : ' + size.toUpperCase());
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     TRADUCTION
     ═══════════════════════════════════════════════════════ */

  async translate() {
    try {
      if (!this.lines || this.lines.length === 0) {
        if (typeof showToast === 'function') showToast('Pas de paroles à traduire');
        return;
      }

      if (this.isTranslated) {
        // Désactiver traduction
        this.isTranslated = false;
        this.renderCurrentLine();
        if (typeof showToast === 'function') showToast('Traduction désactivée');
        return;
      }

      if (typeof showToast === 'function') showToast('🌐 Traduction en cours...');

      // Regrouper toutes les lignes
      const text = this.lines.map(l => l.text).join('\n');

      // API de traduction gratuite (MyMemory)
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,500))}&langpair=en|fr`;

      const res  = await this.fetchWithTimeout(url, 10000);
      if (!res || !res.ok) throw new Error('Traduction échouée');

      const data = await res.json();
      if (!data?.responseData?.translatedText) throw new Error('Pas de traduction');

      const translated = data.responseData.translatedText.split('\n');
      this.translatedLines = translated;
      this.isTranslated    = true;
      this.renderCurrentLine();
      if (typeof showToast === 'function') showToast('🌐 Traduit en français');

    } catch (e) {
      console.warn('[Lyrics] Erreur translate:', e);
      if (typeof showToast === 'function') showToast('❌ Traduction indisponible');
    }
  },

  /* ═══════════════════════════════════════════════════════
     ÉCRAN TOUJOURS ALLUMÉ (WakeLock)
     ═══════════════════════════════════════════════════════ */

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.startBatteryWarning();
        console.log('[Lyrics] WakeLock activé');
      }
    } catch (e) {
      console.warn('[Lyrics] WakeLock non disponible:', e);
    }
  },

  releaseWakeLock() {
    try {
      if (this.wakeLock) {
        this.wakeLock.release();
        this.wakeLock = null;
      }
      this.stopBatteryWarning();
    } catch (e) {}
  },

  startBatteryWarning() {
    try {
      // Avertissement toutes les 45 minutes
      clearInterval(this.batteryWarningTimer);
      this.batteryWarningTimer = setInterval(() => {
        if (typeof showToast === 'function') {
          showToast('🔋 Écran allumé depuis 45min — pense à brancher ton téléphone');
        }
      }, 45 * 60 * 1000);
    } catch (e) {}
  },

  stopBatteryWarning() {
    try {
      clearInterval(this.batteryWarningTimer);
      this.batteryWarningTimer = null;
    } catch (e) {}
  },

  /* ═══════════════════════════════════════════════════════
     CACHE PAROLES
     ═══════════════════════════════════════════════════════ */

  getFromCache(songId) {
    try {
      if (!songId) return null;
      const raw = localStorage.getItem('gag_lyrics_' + songId);
      if (!raw) return null;

      const data = JSON.parse(raw);
      // Cache 30 jours
      if (Date.now() - data.ts > 30 * 24 * 3600 * 1000) {
        localStorage.removeItem('gag_lyrics_' + songId);
        return null;
      }
      return data.lines || null;
    } catch (e) {
      return null;
    }
  },

  saveToCache(songId, lines) {
    try {
      if (!songId || !lines) return;
      localStorage.setItem('gag_lyrics_' + songId, JSON.stringify({
        ts:    Date.now(),
        lines: lines,
      }));
    } catch (e) {
      console.warn('[Lyrics] Erreur saveToCache:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     UTILITAIRES
     ═══════════════════════════════════════════════════════ */

  cleanTitle(title) {
    try {
      const NOISE = [
        'official audio', 'official video', 'official music video', 'official mv',
        'official lyric video', 'official visualizer', 'official clip',
        'music video', 'lyric video', 'lyrics video',
        'visualizer', 'visualiser',
        'clean version', 'clean edit', 'clean radio edit', 'radio edit',
        'explicit version', 'extended version', 'extended mix',
        'remastered', 'remaster',
        'lyrics', 'paroles', 'audio', 'video', 'clip',
        'hd', 'hq', '4k', '1080p', '720p',
      ];

      let t = title;

      // Retirer contenu entre parenthèses/crochets si c'est du bruit
      t = t.replace(/[\(\[][^\)\]]*[\)\]]/gi, s => {
        const inner = s.slice(1,-1).trim().toLowerCase();
        if (NOISE.some(n => inner.includes(n))) return '';
        if (/^\d+\s*k(bps|hz)?$/.test(inner)) return '';
        if (/^(flac|mp3|aac|ogg|wav)$/.test(inner)) return '';
        if (/^(ft\.?|feat\.?|featuring)/i.test(inner)) return s;
        return s;
      });

      // Retirer mots parasites hors parenthèses
      const noiseReg = new RegExp(
        '\\b(' + NOISE.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi'
      );
      t = t.replace(noiseReg, '');

      // Retirer qualité audio : 256k 320kbps etc.
      t = t.replace(/\b\d+\s*k(bps|hz)?\b/gi, '');
      t = t.replace(/\b(flac|mp3|aac|ogg|wav)\b/gi, '');

      // Retirer feat
      t = t.replace(/feat\.?.*/i, '');

      return t.replace(/\s+/g, ' ').replace(/[\s,\-–—]+$/, '').trim();
    } catch (e) {
      return title || '';
    }
  },

  cleanArtist(artist) {
    try {
      return artist
        .replace(/feat\.?.*/i, '')
        .replace(/&.*/,'')
        .replace(/\s+/g,' ')
        .trim();
    } catch (e) {
      return artist || '';
    }
  },

  async fetchWithTimeout(url, timeout) {
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timer);
      return res;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn('[Lyrics] Timeout:', url);
      }
      return null;
    }
  },
};

/* Exposer Lyrics globalement */
window.Lyrics = Lyrics;
