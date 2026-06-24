/*
  API layer for the LMB landing.
  Runtime config comes from data/config.json. There is intentionally no mock
  fallback: if the config or API fails, the UI shows an error instead of fake standings.
*/

(function (window) {
  'use strict';

  const CONFIG_PATH = './data/config.json';
  const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
  const logoFallback = 'https://www.mlbstatic.com/team-logos/league-on-dark/125.svg';
  const logoUrl = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;
  let configPromise = null;

  function toNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toInteger(value, fallback = null) {
    const n = toNumber(value, fallback);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function stripAccents(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeKey(value) {
    return stripAccents(value).toLowerCase();
  }

  function getSeasonFromEndpoint(endpoint) {
    try {
      return new URL(endpoint, window.location.href).searchParams.get('season');
    } catch (_) {
      return null;
    }
  }

  function buildAbsoluteUrl(path, baseUrl) {
    try {
      return new URL(path, baseUrl || window.location.href).href;
    } catch (_) {
      return path || '';
    }
  }

  function describeRequestError(error) {
    if (error?.name === 'AbortError') {
      return 'La consulta tardó demasiado. Inténtalo de nuevo en unos segundos.';
    }

    if (error?.name === 'SyntaxError') {
      return 'El servicio respondió con datos que no se pudieron leer.';
    }

    if (error instanceof TypeError) {
      return 'No se pudo conectar con el servicio de posiciones. Revisa tu conexión e inténtalo de nuevo.';
    }

    return error?.message || 'No se pudo consultar el servicio de posiciones.';
  }

  function normalizeConfig(config = {}) {
    const api = config.api || {};
    const endpoint = api.standingsEndpoint
      || api.endpoint
      || api.url
      || (api.baseUrl && api.endpoints?.standings
        ? buildAbsoluteUrl(api.endpoints.standings, api.baseUrl)
        : '');

    return {
      ...config,
      api: {
        ...api,
        standingsEndpoint: endpoint,
        timeoutMs: toInteger(api.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
      },
    };
  }

  async function loadConfig() {
    if (!configPromise) {
      configPromise = fetchJson(CONFIG_PATH, DEFAULT_REQUEST_TIMEOUT_MS)
        .then(normalizeConfig)
        .then(config => {
          window.LMB_CONFIG = config;
          return config;
        })
        .catch(error => {
          configPromise = null;
          throw new Error(`No se pudo cargar la configuración del sitio: ${describeRequestError(error)}`);
        });
    }

    return configPromise;
  }

  function resolveStandingsEndpoint(config, explicitEndpoint) {
    const endpoint = explicitEndpoint || config.api?.standingsEndpoint;

    if (!endpoint) {
      throw new Error('No se configuró el endpoint de posiciones en data/config.json.');
    }

    return endpoint;
  }

  function buildRecord(wins, losses) {
    if (!Number.isFinite(wins) || !Number.isFinite(losses)) return '--';
    return `${wins}-${losses}`;
  }

  function inferDivisionName(value, recordIndex = null) {
    const text = normalizeKey(value);
    if (text.includes('sur') || text.includes('south')) return 'sur';
    if (text.includes('norte') || text.includes('north')) return 'norte';
    if (recordIndex === 0) return 'norte';
    if (recordIndex === 1) return 'sur';
    return '';
  }

  function splitTeamName(fullName) {
    const cleanName = String(fullName || '').trim();
    const match = cleanName.match(/^(.+?)\s+(?:de los|de las|del|de|la|el)\s+(.+)$/i);

    if (!match) {
      return { name: cleanName || 'Equipo', city: '' };
    }

    return {
      name: match[1].trim(),
      city: match[2].trim(),
    };
  }

  function findSplit(team, typeNames) {
    const types = typeNames.map(normalizeKey);
    const splits = team.records?.splitRecords || [];

    return splits.find(split => types.includes(normalizeKey(split.type)));
  }

  function findDivisionRecord(team, divisionKey) {
    const divisionRecords = team.records?.divisionRecords || [];

    return divisionRecords.find(record => {
      const name = record.division?.name || record.divisionName || record.name || '';
      return inferDivisionName(name) === divisionKey;
    });
  }

  function normalizeSplit(team, typeNames) {
    const split = findSplit(team, typeNames);
    if (!split) return { wins: null, losses: null, pct: null, label: '--' };

    const wins = toInteger(split.wins);
    const losses = toInteger(split.losses);

    return {
      wins,
      losses,
      pct: toNumber(split.pct),
      label: buildRecord(wins, losses),
    };
  }

  function normalizeStreak(streak = {}) {
    const code = String(streak.streakCode || '').toUpperCase();
    const type = normalizeKey(streak.streakType);
    const number = toInteger(streak.streakNumber ?? code.replace(/\D/g, ''), 0);
    const isWin = code.startsWith('W') || type.includes('win');
    const isLoss = code.startsWith('L') || type.includes('loss');

    return {
      count: number,
      isWin: number > 0 && isWin && !isLoss,
      code: number > 0 ? `${isWin ? 'G' : 'P'}${number}` : '--',
    };
  }

  function normalizeGamesBack(value, rank) {
    const raw = String(value ?? '').trim();
    if (rank === 1 || raw === '-' || raw === '0' || raw === '0.0') return 'Líder';
    return raw || '--';
  }

  function normalizeTeam(team = {}, record = {}, index = 0, recordDivision = '') {
    const teamInfo = team.team || team.club || {};
    const fullName = teamInfo.name || team.name || team.fullName || `Equipo ${index + 1}`;
    const nameParts = splitTeamName(fullName);
    const leagueRecord = team.leagueRecord || {};
    const wins = toInteger(team.wins ?? leagueRecord.wins, 0);
    const losses = toInteger(team.losses ?? leagueRecord.losses, 0);
    const gamesPlayed = toInteger(team.gamesPlayed ?? wins + losses, wins + losses);
    const pct = toNumber(team.pct ?? team.winningPercentage ?? leagueRecord.pct, gamesPlayed ? wins / gamesPlayed : null);
    const rank = toInteger(team.divisionRank ?? team.rank);
    const leagueRank = toInteger(team.leagueRank);
    const runsScored = toInteger(team.runsScored ?? team.runsFor);
    const runsAllowed = toInteger(team.runsAllowed ?? team.runsAgainst);
    const runDifferential = toInteger(
      team.runDifferential ?? team.rd,
      Number.isFinite(runsScored) && Number.isFinite(runsAllowed) ? runsScored - runsAllowed : null,
    );
    const home = normalizeSplit(team, ['home']);
    const away = normalizeSplit(team, ['away']);
    const lastTen = normalizeSplit(team, ['lastTen', 'last 10']);
    const oneRun = normalizeSplit(team, ['oneRun', 'one run']);
    const extraInning = normalizeSplit(team, ['extraInning', 'extra innings']);
    const northRecord = findDivisionRecord(team, 'norte');
    const southRecord = findDivisionRecord(team, 'sur');
    const streak = normalizeStreak(team.streak);
    const div = inferDivisionName(
      team.division?.name || team.divisionName || team.division || recordDivision,
    );
    const resolvedRank = rank ?? index + 1;

    return {
      id: teamInfo.id ?? team.id ?? team.teamId ?? index + 1,
      fullName,
      n: team.nickname || team.teamName || nameParts.name,
      city: team.city || teamInfo.locationName || team.locationName || nameParts.city,
      div,
      rank: resolvedRank,
      lr: leagueRank ?? resolvedRank,
      w: wins,
      l: losses,
      pct,
      gp: gamesPlayed,
      gb: normalizeGamesBack(team.divisionGamesBack ?? team.gamesBack, resolvedRank),
      rd: runDifferential,
      rs: runsScored,
      ra: runsAllowed,
      rn: streak.count,
      rw: streak.isWin,
      streakCode: streak.code,
      hm: home.label,
      aw: away.label,
      homePct: home.pct,
      awayPct: away.pct,
      dn: northRecord ? buildRecord(toInteger(northRecord.wins), toInteger(northRecord.losses)) : '--',
      ds: southRecord ? buildRecord(toInteger(southRecord.wins), toInteger(southRecord.losses)) : '--',
      or: oneRun.label,
      ei: extraInning.label,
      last10: lastTen,
      season: team.season || record.season || null,
    };
  }

  function compareByStanding(a, b) {
    if (Number.isFinite(a.rank) && Number.isFinite(b.rank) && a.div === b.div) {
      return a.rank - b.rank;
    }

    return (b.pct ?? 0) - (a.pct ?? 0) || b.w - a.w || a.l - b.l;
  }

  function applyMissingRanks(teams) {
    ['norte', 'sur', ''].forEach(div => {
      const group = teams.filter(team => team.div === div).sort(compareByStanding);
      group.forEach((team, index) => {
        if (!Number.isFinite(team.rank)) team.rank = index + 1;
        if (!Number.isFinite(team.lr)) team.lr = index + 1;
        team.gb = normalizeGamesBack(team.gb, team.rank);
      });
    });

    return teams;
  }

  function normalizeRecordsPayload(payload, endpoint = '', config = {}) {
    const records = Array.isArray(payload?.records) ? payload.records : [];

    if (!records.length) {
      throw new Error('La respuesta del servicio no contiene registros de posiciones.');
    }

    const teams = records.flatMap((record, recordIndex) => {
      const recordDivision = inferDivisionName(record.division?.name || record.divisionName, recordIndex);
      const teamRecords = Array.isArray(record.teamRecords) ? record.teamRecords : [];
      return teamRecords.map((team, teamIndex) => normalizeTeam(team, record, teamIndex, recordDivision));
    });

    if (!teams.length) {
      throw new Error('La respuesta del servicio no contiene equipos.');
    }

    const firstRecord = records[0] || {};
    const firstTeam = records.flatMap(record => record.teamRecords || [])[0] || {};

    return {
      teams: applyMissingRanks(teams),
      meta: {
        source: 'MLB Stats API',
        endpoint,
        leagueName: config.league?.name || firstRecord.league?.name || 'Liga Mexicana de Beisbol',
        season: firstRecord.season || firstTeam.season || config.league?.season || getSeasonFromEndpoint(endpoint),
        lastUpdated: firstRecord.lastUpdated || payload.lastUpdated || null,
        fetchedAt: new Date().toISOString(),
        config,
      },
      raw: payload,
    };
  }

  async function fetchJson(endpoint, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`El servicio de posiciones respondió con código ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(describeRequestError(error));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchStandings(endpoint = '') {
    const config = await loadConfig();
    const resolvedEndpoint = resolveStandingsEndpoint(config, endpoint);
    const timeoutMs = toInteger(config.api?.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
    const payload = await fetchJson(resolvedEndpoint, timeoutMs);
    return normalizeRecordsPayload(payload, resolvedEndpoint, config);
  }

  async function fetchTeams(endpoint = '') {
    const standings = await fetchStandings(endpoint);
    return standings.teams;
  }

  window.LMBApi = {
    loadConfig,
    fetchStandings,
    fetchTeams,
    normalizeRecordsPayload,
    logoUrl,
    logoFallback,
  };
})(window);
