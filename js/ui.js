/*
  UI rendering and interactions.
  Every standings value rendered here comes from state.teams, which is filled by
  the MLB Stats API through api.js.
*/
(function (window, document) {
  'use strict';

  const state = {
    teams: [],
    meta: {},
    error: null,
    sortK: 'rank',
    revealObserver: null,
    top1Observer: null,
    kpiObserver: null,
  };

  const $ = id => document.getElementById(id);
  const logoUrl = id => window.LMBApi.logoUrl(id);
  const logoFallback = () => window.LMBApi.logoFallback;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setText(selectorOrElement, value) {
    const el = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;

    if (el) el.textContent = value;
  }

  function setStandings(standings) {
    state.teams = Array.isArray(standings?.teams) ? standings.teams : [];
    state.meta = standings?.meta || {};
    state.error = null;
    state.kpiObserver = null;

    const marquee = $('mtrack');
    if (marquee) {
      marquee.innerHTML = '';
      delete marquee.dataset.built;
    }
  }

  function setTeams(teams) {
    setStandings({ teams, meta: state.meta });
  }

  function getTeams() {
    return state.teams;
  }

  function divLabel(div) {
    return div === 'sur' ? 'Sur' : 'Norte';
  }

  function teamFullName(team) {
    if (team.fullName) return team.fullName;
    return team.city ? `${team.n} de ${team.city}` : team.n;
  }

  function pctText(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return n.toFixed(3).replace(/^0/, '');
  }

  function numText(value) {
    return Number.isFinite(Number(value)) ? String(value) : '--';
  }

  function signedText(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return `${n >= 0 ? '+' : ''}${n}`;
  }

  function recordText(team) {
    return `${numText(team.w)} G - ${numText(team.l)} P`;
  }

  function streakText(team) {
    if (!team || !team.rn) return '--';
    return `${team.rw ? 'G' : 'P'}${team.rn}`;
  }

  function leaderLabel(team) {
    return team?.rank === 1 || team?.gb === 'Lider';
  }

  function getLeagueLeaders(limit = 1) {
    return [...state.teams]
      .sort((a, b) => {
        const pctDiff = (Number(b.pct) || 0) - (Number(a.pct) || 0);
        if (pctDiff) return pctDiff;
        return (Number(b.w) || 0) - (Number(a.w) || 0);
      })
      .slice(0, limit);
  }

  function messageHtml(message) {
    return `<p style="font-family:var(--fb);font-size:13px;color:var(--t3);padding:16px 0">${escapeHtml(message)}</p>`;
  }

  function userErrorMessage(error) {
    const message = String(error?.message || '').trim();

    if (!message) return 'No se pudo cargar el servicio de posiciones.';
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return 'No se pudo conectar con el servicio de posiciones. Revisa tu conexión e inténtalo de nuevo.';
    }
    if (/abort|timeout|timed out/i.test(message)) {
      return 'La consulta tardó demasiado. Inténtalo de nuevo en unos segundos.';
    }
    if (/^http\s+\d+/i.test(message)) {
      return `El servicio de posiciones respondió con código ${message.replace(/^http\s+/i, '')}.`;
    }

    return message;
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'actualizado al cargar';

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function configuredSeason() {
    if (window.LMB_CONFIG?.league?.season) return window.LMB_CONFIG.league.season;

    try {
      return new URL(state.meta.endpoint || '', window.location.href).searchParams.get('season') || '';
    } catch (_) {
      return '';
    }
  }

  function updateSeasonLabels() {
    const season = state.meta.season || configuredSeason();
    if (!season) return;

    setText('.h-yr', season);
    setText('.ld-season', `Temporada ${season}`);
  }

  function renderLoadingState() {
    updateSeasonLabels();
    setText('.ld-board-title', 'Consultando posiciones LMB');
    setText('.ld-status', 'Consultando servicio de datos');

    const body = document.querySelector('.ld-board-body');
    if (!body) return;

    body.innerHTML = `
      <div class="ld-row-head">
        <div class="ld-col-h">Estado</div>
        <div class="ld-col-h">G</div>
        <div class="ld-col-h">P</div>
        <div class="ld-col-h">PCT</div>
      </div>
      <div class="ld-row">
        <div class="ld-team">
          <div>
            <div class="ld-team-name">Cargando datos</div>
            <div class="ld-team-city">Servicio de posiciones</div>
          </div>
        </div>
        <div class="ld-cell wins"><span>--</span></div>
        <div class="ld-cell losses"><span>--</span></div>
        <div class="ld-cell pct"><span>--</span></div>
      </div>
    `;
  }

  function renderLoaderBoard() {
    const body = document.querySelector('.ld-board-body');
    if (!body) return;

    const leaders = getLeagueLeaders(3);
    setText('.ld-board-title', `Posiciones LMB ${state.meta.season || ''}`.trim());
    setText('.ld-status', `Datos actualizados: ${formatDate(state.meta.lastUpdated || state.meta.fetchedAt)}`);

    if (!leaders.length) {
      body.innerHTML = messageHtml('No hay equipos disponibles para mostrar.');
      return;
    }

    body.innerHTML = `
      <div class="ld-row-head">
        <div class="ld-col-h">Equipo</div>
        <div class="ld-col-h">G</div>
        <div class="ld-col-h">P</div>
        <div class="ld-col-h">PCT</div>
      </div>
      ${leaders.map((team, index) => `
        <div class="ld-row">
          <div class="ld-team">
            <div class="ld-team-logo">
              <img src="${logoUrl(team.id)}" alt="${escapeHtml(team.n)}" onerror="this.src='${logoFallback()}'" />
            </div>
            <div>
              <div class="ld-team-name">${escapeHtml(team.n)}</div>
              <div class="ld-team-city">${escapeHtml(team.city || divLabel(team.div))} - #${index + 1}</div>
            </div>
          </div>
          <div class="ld-cell wins"><span style="animation-delay:${(index + 1) * .1}s">${numText(team.w)}</span></div>
          <div class="ld-cell losses"><span style="animation-delay:${(index + 2) * .1}s">${numText(team.l)}</span></div>
          <div class="ld-cell pct"><span style="animation-delay:${(index + 3) * .1}s">${pctText(team.pct)}</span></div>
        </div>
      `).join('')}
    `;
  }

  function updateToast() {
    const toast = $('toast-top1');
    const top = getLeagueLeaders(1)[0];
    if (!toast || !top) return;

    toast.querySelector('.toast-txt').innerHTML = `
      <strong>${escapeHtml(top.n)} lidera la liga</strong>
      ${escapeHtml(`${top.w}-${top.l}`)} - PCT ${pctText(top.pct)} - Racha ${escapeHtml(streakText(top))}
    `;
  }

  function updateHero() {
    const top = getLeagueLeaders(1)[0];
    const card = document.querySelector('.hcard');
    if (!card) return;

    if (!top) {
      card.innerHTML = messageHtml('No se pudieron cargar las posiciones.');
      return;
    }

    card.innerHTML = `
      <div class="hcard-badge">Lider de Liga</div>
      <div class="hrank">#1</div>
      <div class="hlogo-wrap">
        <img src="${logoUrl(top.id)}" alt="${escapeHtml(top.n)}" onerror="this.src='${logoFallback()}'" />
      </div>
      <div class="hbody">
        <div class="hname">${escapeHtml(teamFullName(top))}</div>
        <div class="hrec">${escapeHtml(recordText(top))}</div>
        <div class="hpills">
          <span class="hpill g">PCT ${pctText(top.pct)}</span>
          <span class="hpill r">Racha ${escapeHtml(streakText(top))}</span>
          <span class="hpill">${escapeHtml(signedText(top.rd))} carreras</span>
          <span class="hpill">División ${divLabel(top.div)}</span>
        </div>
      </div>
    `;
  }

  function kpiCard({ className, label, sub, value, team, icon, valueId = '' }) {
    const teamText = team
      ? `${team.n}${team.city ? ` - ${team.city}` : ''}`
      : 'Sin dato disponible';

    return `
      <div class="kpi ${className} rv">
        <p class="klbl">${escapeHtml(label)}</p>
        <p class="ksb">${escapeHtml(sub)}</p>
        <div class="kval"${valueId ? ` id="${valueId}"` : ''}>${escapeHtml(value)}</div>
        <div class="kteam">
          ${team ? `<div class="ktl"><img src="${logoUrl(team.id)}" alt="" onerror="this.src='${logoFallback()}'" /></div>` : ''}
          <span>${escapeHtml(teamText)}</span>
        </div>
        <div class="kico" aria-hidden="true">${escapeHtml(icon)}</div>
      </div>
    `;
  }

  function updateKpis() {
    const grid = document.querySelector('.kgrid');
    if (!grid) return;

    if (!state.teams.length) {
      grid.innerHTML = messageHtml('No hay estadísticas disponibles.');
      return;
    }

    const bestPct = getLeagueLeaders(1)[0];
    const mostWins = [...state.teams].sort((a, b) => b.w - a.w)[0];
    const bestHome = [...state.teams]
      .filter(team => Number.isFinite(Number(team.homePct)))
      .sort((a, b) => Number(b.homePct) - Number(a.homePct))[0];
    const bestStreak = [...state.teams]
      .filter(team => Number(team.rn) > 0)
      .sort((a, b) => {
        if (a.rw !== b.rw) return a.rw ? -1 : 1;
        return b.rn - a.rn;
      })[0];

    grid.innerHTML = [
      kpiCard({
        className: 'c-o d1',
        label: 'Mejor equipo',
        sub: 'PCT más alto de liga',
        value: pctText(bestPct?.pct),
        team: bestPct,
        icon: '1',
      }),
      kpiCard({
        className: 'c-r d2',
        label: 'Más victorias',
        sub: `Temporada regular ${state.meta.season || ''}`.trim(),
        value: numText(mostWins?.w),
        team: mostWins,
        icon: 'W',
        valueId: 'kv-w',
      }),
      kpiCard({
        className: 'c-g d3',
        label: 'Mejor local',
        sub: bestHome ? `PCT ${pctText(bestHome.homePct)} en casa` : 'Sin datos de local',
        value: bestHome?.hm || '--',
        team: bestHome,
        icon: 'H',
      }),
      kpiCard({
        className: 'c-a d4',
        label: 'Mejor racha activa',
        sub: bestStreak ? (bestStreak.rw ? 'Racha ganadora' : 'Racha perdedora') : 'Sin racha',
        value: bestStreak ? streakText(bestStreak) : '--',
        team: bestStreak,
        icon: 'R',
      }),
    ].join('');
  }

  function updateDivisionCounts() {
    const northCount = state.teams.filter(team => team.div === 'norte').length;
    const southCount = state.teams.filter(team => team.div === 'sur').length;
    setText('.sc-head.norte .sc-cnt', `${northCount} equipos`);
    setText('.sc-head.sur .sc-cnt', `${southCount} equipos`);

    if (state.error) {
      setText('#fres', 'No se pudieron cargar los equipos.');
      return;
    }

    setText('#fres', `Mostrando ${state.teams.length} equipo${state.teams.length !== 1 ? 's' : ''}`);
  }

  function updateFooterMeta() {
    const footerSource = document.querySelector('.fi-bottom span');
    if (!footerSource) return;

    if (state.error) {
      footerSource.textContent = 'No se pudieron actualizar los datos.';
      return;
    }

    footerSource.textContent = `Datos actualizados: ${formatDate(state.meta.lastUpdated || state.meta.fetchedAt)}`;
  }

  function renderShell() {
    updateSeasonLabels();
    renderLoaderBoard();
    updateToast();
    updateHero();
    updateKpis();
    updateDivisionCounts();
    updateFooterMeta();
  }

  function renderError(error) {
    const message = userErrorMessage(error);
    state.error = message;
    state.teams = [];

    setText('.ld-status', 'Error al consultar posiciones');

    const loaderBody = document.querySelector('.ld-board-body');
    if (loaderBody) loaderBody.innerHTML = messageHtml(message);

    const heroCard = document.querySelector('.hcard');
    if (heroCard) heroCard.innerHTML = messageHtml(message);

    const grid = document.querySelector('.kgrid');
    if (grid) grid.innerHTML = messageHtml(message);

    ['gsn', 'gss', 't5norte', 't5sur'].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = messageHtml(message);
    });

    updateDivisionCounts();
    updateFooterMeta();
  }

  function launchConfetti(count = 40) {
    const wrap = $('confetti-wrap');
    if (!wrap || state.error) return;

    wrap.innerHTML = '';
    const colors = ['#E00020', '#3D9A3D', '#FFFFFF', '#C9A84C', '#0D1128'];

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'conf';
      el.style.cssText = `
        left:${Math.random() * 100}%;
        width:${4 + Math.random() * 5}px;
        height:${7 + Math.random() * 8}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration:${2 + Math.random() * 3}s;
        animation-delay:${Math.random() * 1.5}s;
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      `;
      wrap.appendChild(el);
    }

    window.setTimeout(() => { wrap.innerHTML = ''; }, 5500);
  }

  function showToast() {
    const toast = $('toast-top1');
    if (!toast || state.error || !state.teams.length) return;

    window.setTimeout(() => {
      toast.classList.add('show');
      window.setTimeout(() => toast.classList.remove('show'), 4000);
    }, 1800);
  }

  function buildMarquee() {
    const track = $('mtrack');
    if (!track || track.dataset.built || !state.teams.length) return;

    track.dataset.built = '1';
    const all = [...state.teams, ...state.teams];
    track.innerHTML = all.map(team => `
      <div class="mq-logo" onclick="openDr(${Number(team.id)})" title="${escapeHtml(teamFullName(team))}">
        <img src="${logoUrl(team.id)}" alt="${escapeHtml(team.n)}" loading="lazy" onerror="this.src='${logoFallback()}'"/>
      </div>`).join('');
  }

  function rkClass(rank) {
    return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  }

  function lastTenChip(team) {
    const lastTen = team.last10;
    if (!lastTen || lastTen.label === '--') return '';

    const isPositive = Number(lastTen.wins) >= Number(lastTen.losses);
    return `<span class="stk ${isPositive ? 'win' : 'loss'}">U10 ${escapeHtml(lastTen.label)}</span>`;
  }

  function card(team) {
    const isTop = team.rank <= 3;
    const fireIcon = '<span style="color:#fb923c;font-size:9px;margin-right:2px">+</span>';
    const iceIcon = '<span style="color:#a5b4fc;font-size:9px;margin-right:2px">-</span>';
    const streak = streakText(team);
    const hotCold = Number(team.rn) >= 3 ? (team.rw ? ' hot' : ' cold') : '';
    const streakClass = `stk ${team.rw ? 'win' : 'loss'}${hotCold}`;
    const pctClass = Number(team.pct) >= .500 ? 'pct-win' : 'pct-lose';
    const streakIcon = Number(team.rn) >= 3 ? (team.rw ? fireIcon : iceIcon) : '';

    return `<div class="tcard ${escapeHtml(team.div || 'norte')} ${isTop ? 'top1' : ''} rv" onclick="openDr(${Number(team.id)})" tabindex="0">
      <div class="tc-rk ${rkClass(team.rank)}">${numText(team.rank)}</div>
      <div class="tc-logo"><img src="${logoUrl(team.id)}" alt="${escapeHtml(team.n)}" loading="lazy" onerror="this.src='${logoFallback()}'"/></div>
      <div class="tc-body">
        <div class="tc-name">${escapeHtml(team.n)}</div>
        <div class="tc-city">${escapeHtml(team.city || divLabel(team.div))}</div>
        <div class="tc-meta">
          <span class="tc-rec">${escapeHtml(`${team.w}-${team.l}`)}</span>
          ${streak !== '--' ? `<span class="${streakClass}">${streakIcon}${escapeHtml(streak)}</span>` : ''}
          ${lastTenChip(team)}
        </div>
      </div>
      <div class="tc-right">
        <div class="tc-pct ${pctClass}">${pctText(team.pct)}</div>
        <div class="tc-sub">JJ ${numText(team.gp)}</div>
        <div class="tc-sub">${leaderLabel(team) ? '<span style="color:var(--verde);font-weight:700">Lider</span>' : `JD ${escapeHtml(team.gb)}`}</div>
        <div class="tc-cta">Ver detalle</div>
      </div>
    </div>`;
  }

  function filtered() {
    const q = ($('srch')?.value || '').toLowerCase();
    const d = $('fdiv')?.value || '';
    let result = [...state.teams];

    if (q) {
      result = result.filter(team => `${team.n} ${team.city} ${team.fullName}`.toLowerCase().includes(q));
    }

    if (d) result = result.filter(team => team.div === d);

    if (state.sortK === 'wins') result.sort((a, b) => b.w - a.w);
    else if (state.sortK === 'pct') result.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    else result.sort((a, b) => a.div !== b.div ? (a.div === 'norte' ? -1 : 1) : a.rank - b.rank);

    return result;
  }

  function renderAll() {
    const result = filtered();
    const north = result.filter(team => team.div === 'norte');
    const south = result.filter(team => team.div === 'sur');
    const res = $('fres');

    if (res) res.textContent = `Mostrando ${result.length} equipo${result.length !== 1 ? 's' : ''}`;

    [['gsn', north], ['gss', south]].forEach(([id, list]) => {
      const el = $(id);
      if (!el) return;
      el.innerHTML = list.length
        ? list.map(team => card(team)).join('')
        : messageHtml(state.error || 'No hay resultados para mostrar.');
    });

    window.setTimeout(() => {
      triggerReveal();
      observeTop1();
      document.querySelectorAll('.tcard.top1').forEach((el, i) => {
        window.setTimeout(() => {
          el.classList.add('slam');
          if (i === 0) launchConfetti(18);
        }, i * 120);
      });
    }, 60);
  }

  function applyF() {
    renderAll();
  }

  function setS(key) {
    state.sortK = ['rank', 'wins', 'pct'].includes(key) ? key : 'rank';
    const sortSelect = $('sort-select');
    if (sortSelect && sortSelect.value !== state.sortK) sortSelect.value = state.sortK;
    renderAll();
  }

  function buildTop5() {
    ['norte', 'sur'].forEach(div => {
      const teams = state.teams.filter(team => team.div === div).sort((a, b) => a.rank - b.rank).slice(0, 5);
      const max = Math.max(...teams.map(team => Number(team.pct) || 0), 1);
      const el = $('t5' + div);
      if (!el) return;

      if (!teams.length) {
        el.innerHTML = `<p class="t5h">División ${divLabel(div)}</p>${messageHtml(state.error || 'Sin datos disponibles.')}`;
        return;
      }

      el.innerHTML = `<p class="t5h">División ${divLabel(div)}</p>
      <div class="t5list">${teams.map((team, index) => `
        <div class="t5i rv d${index + 1}">
          <div class="t5r">${index + 1}</div>
          <div class="t5lo"><img src="${logoUrl(team.id)}" alt="${escapeHtml(team.n)}" loading="lazy" onerror="this.src='${logoFallback()}'"/></div>
          <div class="t5bw">
            <div class="t5n">${escapeHtml(team.n)}</div>
            <div class="t5tr"><div class="t5f ${div}" style="width:${(((Number(team.pct) || 0) / max) * 100).toFixed(1)}%"></div></div>
          </div>
          <div class="t5pct">${pctText(team.pct)}</div>
        </div>`).join('')}</div>`;

      window.setTimeout(triggerReveal, 100);
    });
  }

  function openDr(id) {
    const team = state.teams.find(item => Number(item.id) === Number(id));
    if (!team) return;

    const dLogo = $('d-logo');
    if (dLogo) {
      dLogo.src = logoUrl(team.id);
      dLogo.alt = team.n;
      dLogo.onerror = function () { this.src = logoFallback(); };
    }

    setText($('d-name'), teamFullName(team));
    setText($('d-div'), `División ${divLabel(team.div)} - Posición #${numText(team.rank)}`);
    setText($('d-rec'), recordText(team));
    setText($('d-w'), numText(team.w));
    setText($('d-l'), numText(team.l));
    setText($('d-pct'), pctText(team.pct));
    setText($('d-gp'), numText(team.gp));
    setText($('d-gb'), leaderLabel(team) ? '--' : team.gb);
    setText($('d-rd'), signedText(team.rd));
    setText($('d-rs'), numText(team.rs));
    setText($('d-ra'), numText(team.ra));
    setText($('d-hm'), team.hm || '--');
    setText($('d-aw'), team.aw || '--');
    setText($('d-dn'), team.dn || '--');
    setText($('d-ds'), team.ds || '--');
    setText($('d-1r'), team.or || '--');
    setText($('d-ei'), team.ei || '--');

    const lastTen = $('d-l10');
    if (lastTen) {
      const l10 = team.last10;
      lastTen.innerHTML = l10 && l10.label !== '--'
        ? `<div class="l10d win">${numText(l10.wins)} G</div><div class="l10d loss">${numText(l10.losses)} P</div>`
        : messageHtml('Sin datos de los últimos 10 juegos.');
    }

    setText($('d-stk'), streakText(team));
    $('d-stklbl').innerHTML = team.rn
      ? (team.rw ? 'Racha ganadora activa' : 'Racha perdedora activa')
      : 'Sin racha disponible';

    const bp = document.querySelector('.dr-banner-pattern');
    if (bp) {
      bp.style.background = team.div === 'norte'
        ? 'linear-gradient(135deg,#0D1128 0%,#1a2444 50%,#2d7a2d 100%)'
        : 'linear-gradient(135deg,#0D1128 0%,#1a2444 50%,#b8001a 100%)';
    }

    $('do')?.classList.add('show');
    $('dr')?.classList.add('show');
    document.body.style.overflow = 'hidden';

    window.setTimeout(() => {
      document.querySelectorAll('.dst').forEach((el, i) => {
        window.setTimeout(() => {
          el.classList.add('shine');
          window.setTimeout(() => el.classList.remove('shine'), 800);
        }, i * 80);
      });
    }, 400);

    const countEls = [['d-w', team.w], ['d-l', team.l], ['d-gp', team.gp], ['d-rs', team.rs], ['d-ra', team.ra]];
    window.setTimeout(() => {
      countEls.forEach(([elId, to], i) => {
        if (Number.isFinite(Number(to))) window.setTimeout(() => animCount(elId, Number(to), 700), i * 90);
      });

      if (Number.isFinite(Number(team.rd))) {
        animCountFrom('d-rd', 0, Number(team.rd), 700, Number(team.rd) >= 0 ? '+' : '');
      }
    }, 300);
  }

  function closeDr() {
    $('do')?.classList.remove('show');
    $('dr')?.classList.remove('show');
    document.body.style.overflow = '';
  }

  function showFgt() {
    $('mf')?.classList.add('show');
  }

  function hideFgt(event, force) {
    const modal = $('mf');
    if (!modal) return;
    if (event && event.target !== modal && !force) return;
    modal.classList.remove('show');
  }

  function setAT() {
    // Kept for compatibility with older inline handlers.
  }

  function triggerReveal() {
    if (!state.revealObserver) {
      state.revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('in');
        });
      }, { threshold: .06, rootMargin: '0px 0px -20px 0px' });
    }

    document.querySelectorAll('.rv:not(.in)').forEach(el => state.revealObserver.observe(el));
  }

  function triggerHero() {
    document.querySelectorAll('.ha').forEach((el, i) => {
      window.setTimeout(() => el.classList.add('in'), 100 + i * 125);
    });
  }

  function animCount(id, to, ms = 900) {
    const el = $(id);
    if (!el) return;
    const t0 = performance.now();

    (function step(now) {
      const p = Math.min((now - t0) / ms, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ease * to);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = to;
    })(t0);
  }

  function animCountFrom(id, from, to, ms = 900, prefix = '') {
    const el = $(id);
    if (!el) return;
    const t0 = performance.now();
    const range = to - from;

    (function step(now) {
      const p = Math.min((now - t0) / ms, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const value = Math.round(from + ease * range);
      el.textContent = prefix + value;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = prefix + to;
    })(t0);
  }

  function initKpiCounter() {
    const el = $('kv-w');
    if (!el || state.kpiObserver || !state.teams.length) return;

    const maxWins = state.teams.reduce((max, team) => Math.max(max, Number(team.w) || 0), 0);
    state.kpiObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        el.classList.add('ticking');
        animCount('kv-w', maxWins, 1400);
        state.kpiObserver.disconnect();
      }
    }, { threshold: .5 });

    state.kpiObserver.observe(el);
  }

  function initTop1Observer() {
    if (state.top1Observer) return;

    state.top1Observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.impacted) {
          entry.target.dataset.impacted = '1';
          const rank = entry.target.querySelector('.tc-rk.gold');
          if (rank) {
            rank.style.animation = 'glitch .5s steps(2) 1';
            window.setTimeout(() => { rank.style.animation = ''; }, 600);
          }
        }
      });
    }, { threshold: .8 });
  }

  function observeTop1() {
    initTop1Observer();
    document.querySelectorAll('.tcard.top1').forEach(el => state.top1Observer.observe(el));
  }

  function setNavbarState() {
    $('navbar')?.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.LMBUi = {
    state,
    setStandings,
    setTeams,
    getTeams,
    renderLoadingState,
    renderShell,
    renderError,
    launchConfetti,
    showToast,
    setAT,
    showFgt,
    hideFgt,
    buildMarquee,
    renderAll,
    applyF,
    setS,
    buildTop5,
    openDr,
    closeDr,
    triggerReveal,
    triggerHero,
    animCount,
    animCountFrom,
    initKpiCounter,
    observeTop1,
    setNavbarState,
  };
})(window, document);
