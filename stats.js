/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — stats.js
   Statistiques d'écoute, tops, périodes, milestones
   ═══════════════════════════════════════════════════════ */

const Stats = {

  /* ─── ÉTAT ─── */
  currentPeriod: 'jour',
  topLimit:      10,    // nombre d'entrées affichées par défaut
  topMax:        200,   // maximum affichable

  /* ─── INIT ─── */
  init() {
    try {
      this.initPeriodTabs();
      this.render('jour');
      console.log('[Stats] Initialisé');
    } catch (e) {
      console.error('[Stats] Erreur init:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     ONGLETS PÉRIODE
     ═══════════════════════════════════════════════════════ */

  initPeriodTabs() {
    try {
      const tabs = document.querySelectorAll('.period-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const period = tab.dataset.period || 'jour';
          this.currentPeriod = period;
          this.render(period);
        });
      });
    } catch (e) {
      console.error('[Stats] Erreur initPeriodTabs:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     RENDU PRINCIPAL
     ═══════════════════════════════════════════════════════ */

  render(period) {
    try {
      const content = document.getElementById('stats-content');
      if (!content) return;

      const range   = this.getRange(period);
      const data    = this.computeStats(range.start, range.end);

      content.innerHTML = '';

      // Bloc résumé
      content.appendChild(this.renderSummary(data, period));

      // Milestones
      const milestone = this.checkMilestones();
      if (milestone) content.appendChild(this.renderMilestone(milestone));

      // Top titres
      content.appendChild(this.renderTop('🎵 Top Titres',   data.topSongs,   'title',  'artist'));

      // Top artistes
      content.appendChild(this.renderTop('👤 Top Artistes', data.topArtists, 'artist', 'count'));

      // Top albums
      content.appendChild(this.renderTop('💿 Top Albums',   data.topAlbums,  'album',  'artist'));

    } catch (e) {
      console.error('[Stats] Erreur render:', e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     BLOC RÉSUMÉ
     ═══════════════════════════════════════════════════════ */

  renderSummary(data, period) {
    try {
      const el = document.createElement('div');
      el.className = 'stats-today';

      const delta = this.getDelta(period, data);

      el.innerHTML = `
        <div class="stats-nums">
          <div class="stats-num-item">
            <div class="stats-big">${data.plays}</div>
            ${delta.plays !== 0 ? `<div class="stats-delta">${delta.plays > 0 ? '↑' : '↓'} ${Math.abs(delta.plays)} vs avant</div>` : ''}
            <div class="stats-label2">écoutes</div>
          </div>
          <div class="stats-num-item">
            <div class="stats-big">${this.formatDuration(data.duration)}</div>
            ${delta.duration !== 0 ? `<div class="stats-delta">${delta.duration > 0 ? '↑' : '↓'} ${this.formatDuration(Math.abs(delta.duration))}</div>` : ''}
            <div class="stats-label2">temps</div>
          </div>
          ${data.newArtists > 0 ? `
          <div class="stats-num-item">
            <div class="stats-big">${data.newArtists}</div>
            <div class="stats-label2" style="color:#4ade80;">🆕 artistes</div>
          </div>` : ''}
        </div>
        ${this.renderGenreBar(data.genres)}
      `;
      return el;
    } catch (e) {
      console.error('[Stats] Erreur renderSummary:', e);
      return document.createElement('div');
    }
  },

  renderGenreBar(genres) {
    try {
      if (!genres || genres.length === 0) return '';

      const total = genres.reduce((acc, g) => acc + g.count, 0);
      if (total === 0) return '';

      const colors = ['#c084fc','#f472b6','#818cf8','#34d399','#fbbf24','#60a5fa'];

      const barSegs = genres.slice(0,5).map((g, i) => {
        const pct = Math.round((g.count / total) * 100);
        return `<div class="genre-seg" style="width:${pct}%;background:${colors[i % colors.length]};"></div>`;
      }).join('');

      const legend = genres.slice(0,5).map((g, i) => {
        const pct = Math.round((g.count / total) * 100);
        return `<div class="genre-item"><div class="genre-dot" style="background:${colors[i % colors.length]};"></div>${g.name} ${pct}%</div>`;
      }).join('');

      return `
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:700;letter-spacing:0.05em;">🎵 GENRES</div>
        <div class="genre-bar">${barSegs}</div>
        <div class="genre-legend">${legend}</div>
      `;
    } catch (e) {
      return '';
    }
  },

  /* ═══════════════════════════════════════════════════════
     MILESTONES
     ═══════════════════════════════════════════════════════ */

  checkMilestones() {
    try {
      if (!Library || !Library.stats) return null;

      const milestones = [100, 500, 1000, 5000, 10000];

      let best = null;
      Object.entries(Library.stats).forEach(([id, st]) => {
        if (!st) return;
        const plays = st.plays || 0;
        const song  = (Library.songs || []).find(s => s.id === id);
        if (!song) return;

        milestones.forEach(m => {
          if (plays === m) {
            best = { song, plays: m };
          }
        });
      });

      return best;
    } catch (e) {
      return null;
    }
  },

  renderMilestone(data) {
    try {
      const el = document.createElement('div');
      el.style.cssText = 'background:linear-gradient(135deg,#1a1000,#0a0800);border:1px solid rgba(251,191,36,0.3);border-radius:16px;padding:14px;margin-bottom:14px;text-align:center;';
      el.innerHTML = `
        <div style="font-size:28px;margin-bottom:6px;">🏆</div>
        <div style="font-size:14px;font-weight:700;color:#fbbf24;">MILESTONE !</div>
        <div style="font-size:13px;color:var(--text);margin-top:4px;">${this.escape(data.song.title || '—')}</div>
        <div style="font-size:20px;font-weight:900;color:#fbbf24;margin-top:6px;">${data.plays} écoutes 🎉</div>
      `;
      return el;
    } catch (e) {
      return document.createElement('div');
    }
  },

  /* ═══════════════════════════════════════════════════════
     TOPS (titres / artistes / albums)
     ═══════════════════════════════════════════════════════ */

  renderTop(title, items, nameKey, subKey) {
    try {
      const wrapper = document.createElement('div');

      const titleEl = document.createElement('div');
      titleEl.className = 'section-title';
      titleEl.textContent = title;
      wrapper.appendChild(titleEl);

      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = '8px 14px';

      if (!items || items.length === 0) {
        card.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px 0;text-align:center;">Aucune donnée</div>';
        wrapper.appendChild(card);
        return wrapper;
      }

      let showing = Math.min(this.topLimit, items.length);
      let expanded = false;

      const renderItems = (count) => {
        card.innerHTML = '';
        items.slice(0, count).forEach((item, idx) => {
          const el = document.createElement('div');
          el.className = 'top-item';

          // Médaille pour top 3
          let rank = String(idx + 1);
          if (idx === 0) rank = '🥇';
          else if (idx === 1) rank = '🥈';
          else if (idx === 2) rank = '🥉';

          el.innerHTML = `
            <div class="top-rank">${rank}</div>
            <div class="top-thumb">${item.cover ? `<img src="${item.cover}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🎵'}</div>
            <div class="top-info">
              <div class="top-name">${this.escape(item[nameKey] || '—')}</div>
              <div class="top-sub">${this.escape(item[subKey] || '')}</div>
            </div>
            <div class="top-count">${item.plays}×</div>
          `;

          el.addEventListener('click', () => {
            if (typeof openPlayer === 'function' && item.song) {
              Library.playSong(item.song, [item.song], 0);
            }
          });

          card.appendChild(el);
        });
      };

      renderItems(showing);
      wrapper.appendChild(card);

      // Bouton "Voir plus" / "Voir moins"
      if (items.length > this.topLimit) {
        const btnMore = document.createElement('div');
        btnMore.style.cssText = 'text-align:center;padding:10px;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;';
        btnMore.textContent = 'Voir les ' + items.length + ' entrées ▾';

        btnMore.addEventListener('click', () => {
          if (!expanded) {
            const newCount = Math.min(showing + 10, Math.min(items.length, this.topMax));
            showing = newCount;
            renderItems(showing);
            if (showing >= Math.min(items.length, this.topMax)) {
              expanded = true;
              btnMore.textContent = 'Réduire ▴';
            } else {
              btnMore.textContent = 'Voir ' + Math.min(10, items.length - showing) + ' de plus ▾';
            }
          } else {
            showing = this.topLimit;
            expanded = false;
            renderItems(showing);
            btnMore.textContent = 'Voir les ' + items.length + ' entrées ▾';
          }
        });

        wrapper.appendChild(btnMore);
      }

      return wrapper;
    } catch (e) {
      console.error('[Stats] Erreur renderTop:', e);
      return document.createElement('div');
    }
  },

  /* ═══════════════════════════════════════════════════════
     CALCUL STATS
     ═══════════════════════════════════════════════════════ */

  computeStats(start, end) {
    try {
      if (!Library || !Library.songs) return this.emptyStats();

      let plays    = 0;
      let duration = 0;
      const artistCounts = {};
      const albumCounts  = {};
      const songCounts   = {};
      const genreCounts  = {};
      const artistsSeen  = new Set();
      const artistsPrev  = new Set(); // artistes vus avant la période

      Library.songs.forEach(song => {
        if (!song || !song.id) return;
        const st = Library.stats[song.id] || {};
        const history = st.history || [];

        history.forEach(entry => {
          if (!entry || !entry.ts) return;

          if (entry.ts >= start && entry.ts <= end) {
            // Dans la période
            plays++;
            duration += song.duration || 0;
            artistsSeen.add((song.artist || '').toLowerCase());

            // Comptage par chanson
            songCounts[song.id] = songCounts[song.id] || { song, plays:0 };
            songCounts[song.id].plays++;

            // Comptage par artiste
            const ak = (song.artist || 'Inconnu').toLowerCase();
            artistCounts[ak] = artistCounts[ak] || { artist: song.artist||'Inconnu', plays:0, cover: song.cover };
            artistCounts[ak].plays++;

            // Comptage par album
            const albumKey = ((song.album||'Sans album')+'|'+(song.artist||'')).toLowerCase();
            albumCounts[albumKey] = albumCounts[albumKey] || { album: song.album||'Sans album', artist: song.artist||'', plays:0, cover: song.cover };
            albumCounts[albumKey].plays++;

            // Genres
            const genre = song.genre || 'Autre';
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
          }
        });
      });

      // Nouveaux artistes (pas vus avant la période)
      let newArtists = 0;
      artistsSeen.forEach(a => {
        if (!artistsPrev.has(a)) newArtists++;
      });

      // Construire tops (triés par plays)
      const topSongs = Object.values(songCounts)
        .sort((a,b) => b.plays - a.plays)
        .map(s => ({
          title:  s.song.title  || '—',
          artist: s.song.artist || '—',
          plays:  s.plays,
          cover:  s.song.cover  || null,
          song:   s.song,
        }));

      const topArtists = Object.values(artistCounts)
        .sort((a,b) => b.plays - a.plays)
        .map(a => ({
          artist: a.artist,
          count:  a.plays + ' écoutes',
          plays:  a.plays,
          cover:  a.cover || null,
        }));

      const topAlbums = Object.values(albumCounts)
        .sort((a,b) => b.plays - a.plays)
        .map(a => ({
          album:  a.album,
          artist: a.artist,
          plays:  a.plays,
          cover:  a.cover || null,
        }));

      const genres = Object.entries(genreCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a,b) => b.count - a.count);

      return { plays, duration, newArtists, topSongs, topArtists, topAlbums, genres };

    } catch (e) {
      console.error('[Stats] Erreur computeStats:', e);
      return this.emptyStats();
    }
  },

  emptyStats() {
    return { plays:0, duration:0, newArtists:0, topSongs:[], topArtists:[], topAlbums:[], genres:[] };
  },

  /* ═══════════════════════════════════════════════════════
     PLAGES TEMPORELLES
     ═══════════════════════════════════════════════════════ */

  getRange(period) {
    try {
      const now   = Date.now();
      const today = new Date(); today.setHours(0,0,0,0);

      switch (period) {
        case 'jour':
          return { start: today.getTime(), end: now };

        case 'sem': {
          const mon = new Date(today);
          const d   = today.getDay();
          mon.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
          return { start: mon.getTime(), end: now };
        }

        case 'mois': {
          const first = new Date(today.getFullYear(), today.getMonth(), 1);
          return { start: first.getTime(), end: now };
        }

        case 'an': {
          const jan = new Date(today.getFullYear(), 0, 1);
          return { start: jan.getTime(), end: now };
        }

        case 'total':
          return { start: 0, end: now };

        default:
          return { start: today.getTime(), end: now };
      }
    } catch (e) {
      return { start: 0, end: Date.now() };
    }
  },

  /* Période précédente (pour delta) */
  getPreviousRange(period) {
    try {
      const current = this.getRange(period);
      const length  = current.end - current.start;
      return { start: current.start - length, end: current.start };
    } catch (e) {
      return { start: 0, end: 0 };
    }
  },

  getDelta(period, currentData) {
    try {
      if (period === 'total') return { plays:0, duration:0 };
      const prev     = this.getPreviousRange(period);
      const prevData = this.computeStats(prev.start, prev.end);
      return {
        plays:    currentData.plays    - prevData.plays,
        duration: currentData.duration - prevData.duration,
      };
    } catch (e) {
      return { plays:0, duration:0 };
    }
  },

  /* ═══════════════════════════════════════════════════════
     UTILITAIRES
     ═══════════════════════════════════════════════════════ */

  formatDuration(seconds) {
    try {
      if (!seconds || seconds < 60) return Math.round(seconds || 0) + 's';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0) return h + 'h' + (m > 0 ? m + 'min' : '');
      return m + 'min';
    } catch (e) {
      return '0min';
    }
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  },
};

/* Exposer Stats globalement */
window.Stats = Stats;
