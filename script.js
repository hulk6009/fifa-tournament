// ---- CONFIG -----------------------------------------------------
// Paste your Google Sheet ID here (the long string in the sheet's URL,
// between /d/ and /edit). The sheet must be shared as "Anyone with the
// link can view".
const SHEET_ID = '1KkzmC4biyIcdH5Err70h8R_cm-9VWX71CL1i-7msw5Y';

// Must match your sheet tab names exactly.
const GROUPS = [
  { key: 'g1', sheetName: 'Group 1 Fixtures' },
  { key: 'g2', sheetName: 'Group 2 Fixtures' }
];
// -------------------------------------------------------------------

const fetchSheetData = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substr(47).slice(0, -2));

  const cols = json.table.cols.map(c => c.label);
  const rows = json.table.rows.map(r => r.c.map(c => (c ? c.v : '')));

  return rows.map(row => Object.fromEntries(row.map((val, i) => [cols[i], val])));
};

const hasScore = (f) =>
  f['Home Score'] !== '' && f['Home Score'] != null &&
  f['Away Score'] !== '' && f['Away Score'] != null;

const computeStandings = (fixtures) => {
  const players = [...new Set(fixtures.flatMap(f => [f['Home Player'], f['Away Player']]))]
    .filter(Boolean);

  const table = {};
  players.forEach(p => table[p] = { player: p, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });

  // fixtures are already in matchday order in the sheet
  fixtures.forEach(f => {
    if (!hasScore(f)) return;
    const home = f['Home Player'], away = f['Away Player'];
    const hS = parseInt(f['Home Score'], 10), aS = parseInt(f['Away Score'], 10);
    if (!table[home] || !table[away]) return;

    table[home].played++; table[away].played++;
    table[home].gf += hS; table[home].ga += aS;
    table[away].gf += aS; table[away].ga += hS;

    if (hS > aS) {
      table[home].w++; table[home].pts += 3; table[away].l++;
      table[home].form.push('W'); table[away].form.push('L');
    } else if (hS < aS) {
      table[away].w++; table[away].pts += 3; table[home].l++;
      table[away].form.push('W'); table[home].form.push('L');
    } else {
      table[home].d++; table[away].d++; table[home].pts += 1; table[away].pts += 1;
      table[home].form.push('D'); table[away].form.push('D');
    }
  });

  return Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
};

const renderForm = (form) => {
  const last5 = form.slice(-5);
  const padded = Array(5 - last5.length).fill(null).concat(last5);
  const wrap = document.createElement('div');
  wrap.className = 'form-container';
  padded.forEach(r => {
    const span = document.createElement('span');
    if (!r) {
      span.className = 'form-indicator';
      span.style.background = '#EDEAE0';
      span.textContent = '';
    } else {
      span.className = `form-indicator ${r === 'W' ? 'form-win' : r === 'L' ? 'form-loss' : 'form-draw'}`;
      span.textContent = r;
    }
    wrap.appendChild(span);
  });
  return wrap;
};

const renderLeagueTable = (groupKey, standings) => {
  const tbody = document.querySelector(`#leagueTable-${groupKey} tbody`);
  tbody.innerHTML = '';
  standings.forEach((row, i) => {
    const gd = row.gf - row.ga;
    const tr = document.createElement('tr');
    if (i < 4) tr.classList.add('qualify');
    if (i === 4) tr.classList.add('cutoff');

    const posTd = document.createElement('td');
    posTd.className = 'pos-cell';
    posTd.textContent = i + 1;

    const playerTd = document.createElement('td');
    playerTd.className = 'player-cell';
    playerTd.textContent = row.player;

    const cells = [row.played, row.w, row.d, row.l, row.gf, row.ga];
    tr.appendChild(posTd);
    tr.appendChild(playerTd);
    cells.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });

    const gdTd = document.createElement('td');
    gdTd.textContent = gd > 0 ? '+' + gd : gd;
    if (gd < 0) gdTd.classList.add('gd-negative');
    tr.appendChild(gdTd);

    const ptsTd = document.createElement('td');
    ptsTd.className = 'important-number';
    ptsTd.textContent = row.pts;
    tr.appendChild(ptsTd);

    const formTd = document.createElement('td');
    formTd.appendChild(renderForm(row.form));
    tr.appendChild(formTd);

    tbody.appendChild(tr);
  });
};

const renderFixtureTable = (groupKey, fixtures) => {
  const container = document.getElementById(`fixtureList-${groupKey}`);
  container.innerHTML = '';

  const byMatchday = new Map();
  fixtures.forEach(f => {
    const md = f['Matchday'];
    if (!byMatchday.has(md)) byMatchday.set(md, []);
    byMatchday.get(md).push(f);
  });

  byMatchday.forEach((rows, md) => {
    const group = document.createElement('div');
    group.className = 'fixture-group';

    const label = document.createElement('div');
    label.className = 'fixture-md-label';
    label.textContent = `Matchday ${md}`;
    group.appendChild(label);

    rows.forEach(f => {
      const played = hasScore(f);
      const row = document.createElement('div');
      row.className = `fixture-row ${played ? 'played' : ''}`;

      const home = document.createElement('span');
      home.className = 'fx-home';
      home.textContent = f['Home Player'];

      const score = document.createElement('span');
      score.className = 'fx-score';
      score.textContent = played ? `${f['Home Score']} - ${f['Away Score']}` : 'vs';

      const away = document.createElement('span');
      away.className = 'fx-away';
      away.textContent = f['Away Player'];

      const dot = document.createElement('span');
      dot.className = 'fx-dot';
      dot.title = played ? 'Played' : 'Upcoming';

      row.appendChild(home);
      row.appendChild(score);
      row.appendChild(away);
      row.appendChild(dot);
      group.appendChild(row);
    });

    container.appendChild(group);
  });

  if (fixtures.length === 0) {
    container.innerHTML = '<div class="fixture-md-label">No fixtures match this filter</div>';
  }
};

const populateFilters = (groupKey, fixtures) => {
  const select = document.getElementById(`fixtureFilter-${groupKey}`);
  const players = [...new Set(fixtures.flatMap(f => [f['Home Player'], f['Away Player']]))]
    .filter(Boolean).sort();
  players.forEach(p => {
    const option = document.createElement('option');
    option.value = p;
    option.textContent = p;
    select.appendChild(option);
  });
};

const applyFixtureFilters = (groupKey, fixtures) => {
  const playerVal = document.getElementById(`fixtureFilter-${groupKey}`).value;
  const statusVal = document.getElementById(`statusFilter-${groupKey}`).value;
  let filtered = fixtures;
  if (playerVal !== 'all') {
    filtered = filtered.filter(f => f['Home Player'] === playerVal || f['Away Player'] === playerVal);
  }
  if (statusVal !== 'all') {
    filtered = filtered.filter(f =>
      (statusVal === 'completed' && hasScore(f)) ||
      (statusVal === 'scheduled' && !hasScore(f))
    );
  }
  renderFixtureTable(groupKey, filtered);
};

const groupData = {};

const loadGroup = async ({ key, sheetName }) => {
  const fixtures = await fetchSheetData(sheetName);
  groupData[key] = fixtures;

  const standings = computeStandings(fixtures);
  renderLeagueTable(key, standings);
  renderFixtureTable(key, fixtures);
  populateFilters(key, fixtures);

  document.getElementById(`fixtureFilter-${key}`).addEventListener('change', () => applyFixtureFilters(key, fixtures));
  document.getElementById(`statusFilter-${key}`).addEventListener('change', () => applyFixtureFilters(key, fixtures));
};

const setupTabs = () => {
  const tabs = document.querySelectorAll('.group-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.group-section').forEach(s => s.style.display = 'none');
      document.getElementById(`section-${tab.dataset.group}`).style.display = '';
    });
  });
};

const init = async () => {
  setupTabs();
  for (const group of GROUPS) {
    await loadGroup(group);
  }
};

window.addEventListener('DOMContentLoaded', init);
