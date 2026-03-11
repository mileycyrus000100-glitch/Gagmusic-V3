/* ═══════════════════════════════════════════════════════
   GAGMUSIC v3 — stats.js
   Statistiques d'écoute, tops, périodes, milestones
   ═══════════════════════════════════════════════════════ */

const Stats = {

  /* ─── ÉTAT ─── */
  currentPeriod: 'jour',
  topLimit:      10,
  topMax:        200,
  calYear:       new Date().getFullYear(),
  calMonth:      new Date().getMonth(),

  /* ─── INIT ─── */
  init() {
    try {
      this.initPeriodTabs();
      this.initCalendarBtn();
      this.initDetailsBtn();
      this.render('jour');
      console.log('[Stats] Initialisé');
    } catch (e) {
      console.error('[Stats] Erreur init:', e);
    }
  },

  initCalendarBtn() {
    try {
      const btn = document.getElementById('stats-calendar-btn');
      if (btn) btn.addEventListener('click', () => this.openCalendar());
    } catch(e) {}
  },

  initDetailsBtn() {
    try {
      const btn = document.getElementById('stats-details-btn');
      if (btn) btn.addEventListener('click', () => this.openDetails());
    } catch(e) {}
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

  /* ═══════════════════════════════════════════════════════
     CALENDRIER
     ═══════════════════════════════════════════════════════ */

  openCalendar() {
    try {
      // Créer l'overlay s'il n'existe pas encore
      let overlay = document.getElementById('stats-calendar-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'stats-calendar-overlay';
        overlay.className = 'stats-overlay';
        document.body.appendChild(overlay);
      }

      overlay.innerHTML = '';
      overlay.classList.add('open');

      const panel = document.createElement('div');
      panel.className = 'stats-panel';

      panel.innerHTML = `
        <div class="stats-panel-header">
          <button class="stats-panel-back" id="cal-close">‹</button>
          <div class="stats-panel-title">📅 Historique</div>
          <div></div>
        </div>
        <div class="cal-nav">
          <button class="cal-nav-btn" id="cal-prev">‹</button>
          <div class="cal-month-label" id="cal-month-label"></div>
          <button class="cal-nav-btn" id="cal-next">›</button>
        </div>
        <div class="cal-grid-header">
          <div>L</div><div>M</div><div>M</div>
          <div>J</div><div>V</div><div>S</div><div>D</div>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
        <div class="cal-legend">
          <div class="cal-legend-item"><div class="cal-day-dot" style="background:var(--bg3)"></div> Aucune</div>
          <div class="cal-legend-item"><div class="cal-day-dot" style="background:var(--accent);opacity:0.3"></div> 1–5</div>
          <div class="cal-legend-item"><div class="cal-day-dot" style="background:var(--accent);opacity:0.6"></div> 6–15</div>
          <div class="cal-legend-item"><div class="cal-day-dot" style="background:var(--accent)"></div> 16+</div>
        </div>
        <div class="cal-day-detail hidden" id="cal-day-detail"></div>
      `;

      overlay.appendChild(panel);

      document.getElementById('cal-close')?.addEventListener('click', () => {
        overlay.classList.remove('open');
      });

      document.getElementById('cal-prev')?.addEventListener('click', () => {
        this.calMonth--;
        if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
        this.renderCalendar();
      });

      document.getElementById('cal-next')?.addEventListener('click', () => {
        const now = new Date();
        if (this.calYear > now.getFullYear() ||
           (this.calYear === now.getFullYear() && this.calMonth >= now.getMonth())) return;
        this.calMonth++;
        if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
        this.renderCalendar();
      });

      this.renderCalendar();

    } catch(e) {
      console.error('[Stats] Erreur openCalendar:', e);
    }
  },

  renderCalendar() {
    try {
      const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      const label  = document.getElementById('cal-month-label');
      const grid   = document.getElementById('cal-grid');
      if (!label || !grid) return;

      label.textContent = months[this.calMonth] + ' ' + this.calYear;

      // Calculer écoutes par jour du mois
      const dayPlays = {};
      const dayHistory = {}; // pour le détail au clic

      if (Library && Library.songs) {
        Library.songs.forEach(song => {
          const st = Library.stats[song.id] || {};
          (st.history || []).forEach(entry => {
            if (!entry || !entry.ts) return;
            const d = new Date(entry.ts);
            if (d.getFullYear() !== this.calYear || d.getMonth() !== this.calMonth) return;
            const day = d.getDate();
            dayPlays[day]   = (dayPlays[day] || 0) + 1;
            if (!dayHistory[day]) dayHistory[day] = [];
            dayHistory[day].push({ song, ts: entry.ts });
          });
        });
      }

      // Nb de jours et premier jour
      const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
      let firstDay      = new Date(this.calYear, this.calMonth, 1).getDay();
      firstDay          = firstDay === 0 ? 6 : firstDay - 1; // lundi = 0

      grid.innerHTML = '';

      // Cellules vides avant le 1er
      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
      }

      const today = new Date();

      for (let d = 1; d <= daysInMonth; d++) {
        const count  = dayPlays[d] || 0;
        const isToday = (d === today.getDate() &&
          this.calMonth === today.getMonth() &&
          this.calYear  === today.getFullYear());

        const cell = document.createElement('div');
        cell.className = 'cal-day' + (isToday ? ' today' : '') + (count > 0 ? ' has-plays' : '');
        cell.dataset.day = d;

        // Intensité de couleur
        let opacity = 0;
        if      (count >= 16) opacity = 1;
        else if (count >= 6)  opacity = 0.6;
        else if (count >= 1)  opacity = 0.3;

        cell.innerHTML = `
          <div class="cal-day-num">${d}</div>
          ${opacity > 0 ? `<div class="cal-day-bar" style="opacity:${opacity}"></div>` : ''}
          ${count > 0 ? `<div class="cal-day-count">${count}</div>` : ''}
        `;

        if (count > 0) {
          cell.addEventListener('click', () => this.showDayDetail(d, dayHistory[d] || []));
        }

        grid.appendChild(cell);
      }

    } catch(e) {
      console.error('[Stats] Erreur renderCalendar:', e);
    }
  },

  showDayDetail(day, history) {
    try {
      const detailEl = document.getElementById('cal-day-detail');
      if (!detailEl) return;

      const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
      detailEl.classList.remove('hidden');

      // Trier par heure
      const sorted = [...history].sort((a,b) => a.ts - b.ts);

      // Top 5 du jour
      const counts = {};
      sorted.forEach(({song}) => {
        counts[song.id] = counts[song.id] || { song, plays: 0 };
        counts[song.id].plays++;
      });
      const top = Object.values(counts).sort((a,b) => b.plays - a.plays).slice(0, 5);

      detailEl.innerHTML = `
        <div class="cal-detail-title">${day} ${months[this.calMonth]} — ${history.length} écoute${history.length>1?'s':''}</div>
        ${top.map(({ song, plays }) => `
          <div class="cal-detail-row">
            <div class="cal-detail-thumb">${song.cover ? `<img src="${song.cover}">` : '🎵'}</div>
            <div class="cal-detail-info">
              <div class="cal-detail-name">${this.escape(song.title||'—')}</div>
              <div class="cal-detail-sub">${this.escape(song.artist||'—')}</div>
            </div>
            <div class="cal-detail-plays">${plays}×</div>
          </div>
        `).join('')}
      `;
    } catch(e) {}
  },

  /* ═══════════════════════════════════════════════════════
     FENÊTRE DÉTAILS ◈
     ═══════════════════════════════════════════════════════ */

  openDetails() {
    try {
      let overlay = document.getElementById('stats-details-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'stats-details-overlay';
        overlay.className = 'stats-overlay';
        document.body.appendChild(overlay);
      }

      overlay.innerHTML = '';
      overlay.classList.add('open');

      const data = this.computeDetails();

      const panel = document.createElement('div');
      panel.className = 'stats-panel';

      panel.innerHTML = `
        <div class="stats-panel-header">
          <button class="stats-panel-back" id="details-close">‹</button>
          <div class="stats-panel-title">◈ Détails</div>
          <div></div>
        </div>
        <div class="details-scroll">

          <div class="details-section">
            <div class="details-section-title">🏃 Marathons d'écoute</div>
            ${data.marathons.length === 0
              ? '<div class="details-empty">Aucun marathon détecté</div>'
              : data.marathons.map(m => `
                <div class="details-row">
                  <div class="details-row-label">${m.date}</div>
                  <div class="details-row-value">${m.duration} • ${m.count} titres</div>
                </div>
              `).join('')}
          </div>

          <div class="details-section">
            <div class="details-section-title">🕐 Heures de pointe</div>
            <div class="peak-chart" id="peak-chart"></div>
          </div>

          <div class="details-section">
            <div class="details-section-title">💛 Fidélité artiste</div>
            ${data.loyalty.length === 0
              ? '<div class="details-empty">Pas encore de données</div>'
              : data.loyalty.map(a => `
                <div class="details-row">
                  <div class="details-row-label">${this.escape(a.artist)}</div>
                  <div class="details-row-value">${a.days} jours d'écoute</div>
                </div>
              `).join('')}
          </div>

          <div class="details-section">
            <div class="details-section-title">⏭ Titres souvent skippés</div>
            ${data.skipped.length === 0
              ? '<div class="details-empty">Aucun skip enregistré</div>'
              : data.skipped.map(s => `
                <div class="details-row">
                  <div class="details-row-label">${this.escape(s.title)}</div>
                  <div class="details-row-value" style="color:#f87171">${s.skips}× skippé</div>
                </div>
              `).join('')}
          </div>

          <div class="details-section">
            <div class="details-section-title">🌍 Langues détectées</div>
            ${data.langs.length === 0
              ? '<div class="details-empty">Pas encore de données</div>'
              : data.langs.map(l => `
                <div class="details-row">
                  <div class="details-row-label">${l.flag} ${l.lang}</div>
                  <div class="details-row-value">${l.count} titre${l.count>1?'s':''}</div>
                </div>
              `).join('')}
          </div>

        </div>
      `;

      overlay.appendChild(panel);

      document.getElementById('details-close')?.addEventListener('click', () => {
        overlay.classList.remove('open');
      });

      // Rendre le graphique heures de pointe
      this.renderPeakChart(data.peakHours);

    } catch(e) {
      console.error('[Stats] Erreur openDetails:', e);
    }
  },

  computeDetails() {
    try {
      const marathons = [];
      const peakHours = new Array(24).fill(0);
      const artistDays = {};
      const skipped   = {};
      const langCount  = {};

      if (!Library || !Library.songs) return { marathons:[], peakHours, loyalty:[], skipped:[], langs:[] };

      // Regrouper toutes les écoutes par jour
      const dayEntries = {};

      Library.songs.forEach(song => {
        const st = Library.stats[song.id] || {};

        // Heures de pointe
        (st.history || []).forEach(entry => {
          if (!entry || !entry.ts) return;
          const h = new Date(entry.ts).getHours();
          peakHours[h]++;

          // Par jour pour marathons
          const dayKey = new Date(entry.ts).toDateString();
          if (!dayEntries[dayKey]) dayEntries[dayKey] = [];
          dayEntries[dayKey].push({ ts: entry.ts, song });

          // Fidélité artiste
          const ak = (song.artist || '').toLowerCase();
          if (ak) {
            if (!artistDays[ak]) artistDays[ak] = { artist: song.artist, days: new Set() };
            artistDays[ak].days.add(dayKey);
          }
        });

        // Skips
        const skipCount = st.skips || 0;
        if (skipCount > 0) {
          skipped[song.id] = { title: song.title || '—', skips: skipCount };
        }

        // Langues (basé sur le champ genre ou lang stocké)
        const lang = st.lang || song.lang || null;
        if (lang) langCount[lang] = (langCount[lang] || 0) + 1;
      });

      // Marathons : jours avec plus de 10 écoutes en continu (séquences de 30min+)
      Object.entries(dayEntries).forEach(([dayStr, entries]) => {
        if (entries.length < 10) return;
        const sorted = entries.sort((a,b) => a.ts - b.ts);

        let start     = sorted[0].ts;
        let end       = sorted[0].ts;
        let count     = 1;
        let maxCount  = 1;
        let maxStart  = start;
        let maxEnd    = end;

        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].ts - sorted[i-1].ts;
          if (gap < 10 * 60 * 1000) { // gap < 10min = session continue
            end = sorted[i].ts;
            count++;
            if (count > maxCount) {
              maxCount = count;
              maxStart = start;
              maxEnd   = end;
            }
          } else {
            start = sorted[i].ts;
            end   = sorted[i].ts;
            count = 1;
          }
        }

        if (maxCount >= 10) {
          const durSec = Math.round((maxEnd - maxStart) / 1000);
          const d      = new Date(maxStart);
          const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
          marathons.push({
            date:     d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear(),
            duration: this.formatDuration(durSec),
            count:    maxCount,
          });
        }
      });

      marathons.sort((a,b) => b.count - a.count);

      // Fidélité — top artistes par nb de jours distincts
      const loyalty = Object.values(artistDays)
        .map(a => ({ artist: a.artist, days: a.days.size }))
        .sort((a,b) => b.days - a.days)
        .slice(0, 5);

      // Skippés — top 5
      const skippedList = Object.values(skipped)
        .sort((a,b) => b.skips - a.skips)
        .slice(0, 5);

      // Langues
      const langFlags = {
        fr:'🇫🇷', en:'🇬🇧', es:'🇪🇸', de:'🇩🇪', pt:'🇧🇷',
        ar:'🇩🇿', ja:'🇯🇵', ko:'🇰🇷', zh:'🇨🇳', it:'🇮🇹',
      };
      const langNames = {
        fr:'Français', en:'Anglais', es:'Espagnol', de:'Allemand', pt:'Portugais',
        ar:'Arabe', ja:'Japonais', ko:'Coréen', zh:'Chinois', it:'Italien',
      };
      const langs = Object.entries(langCount)
        .map(([code, count]) => ({
          lang:  langNames[code] || code,
          flag:  langFlags[code] || '🌍',
          count,
        }))
        .sort((a,b) => b.count - a.count);

      return { marathons: marathons.slice(0,5), peakHours, loyalty, skipped: skippedList, langs };

    } catch(e) {
      console.error('[Stats] Erreur computeDetails:', e);
      return { marathons:[], peakHours: new Array(24).fill(0), loyalty:[], skipped:[], langs:[] };
    }
  },

  renderPeakChart(peakHours) {
    try {
      const container = document.getElementById('peak-chart');
      if (!container) return;

      const max = Math.max(...peakHours, 1);

      container.innerHTML = peakHours.map((count, h) => {
        const pct    = Math.round((count / max) * 100);
        const active = count > 0;
        const label  = h % 6 === 0 ? h + 'h' : '';
        return `
          <div class="peak-col">
            <div class="peak-bar-wrap">
              <div class="peak-bar" style="height:${pct}%;${active ? 'background:var(--accent)' : ''}"></div>
            </div>
            <div class="peak-label">${label}</div>
          </div>
        `;
      }).join('');

    } catch(e) {}
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
