// Token Radar dashboard, model radar-2. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail view with the model's own
// inputs and the farm plan board.json carries, a sandbox that re-ranks in the page only, the
// live-token set and the category multiples. No network: every byte it shows is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var DEF_GW = 0.65, DEF_CAP = 1.5;
  var state = { q: '', cat: '', chain: '', wl: false, sort: 'rank', dir: 1, selected: null, gw: DEF_GW, cap: DEF_CAP };

  function $(id) { return document.getElementById(id); }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // The sandbox recompute: the same four multipliers, with the growth weight and the multiple cap
  // taken from the sliders. At the defaults it reproduces the board's own implied value.
  function sandboxImplied(r) {
    var cat = Math.min(r.category_multiple, state.cap);
    var growth = 1 + (r.growth_pct / 100) * state.gw;
    return Math.max(1, Math.round(r.tvl_usd * cat * growth * r.maturity_multiplier * r.breadth_multiplier));
  }
  function sandboxOn() { return state.gw !== DEF_GW || state.cap !== DEF_CAP; }
  function shownImplied(r) { return sandboxOn() ? sandboxImplied(r) : r.implied_value_usd; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.wl && !r.watchlist) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var k = state.sort, d = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (k === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (k === 'chg') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (k === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (k === 'implied') { av = shownImplied(a); bv = shownImplied(b); }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -d;
      if (av > bv) return d;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function renderBoard() {
    var list = sorted(filtered());
    var tb = $('rows');
    tb.innerHTML = '';
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.selected === r.slug) tr.className = 'sel';
      var chg = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var chgCls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var star = r.watchlist ? '<span class="wl" title="Watchlist">★</span> ' : '';
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td>' + star + esc(r.name) + '<br><span style="color:var(--mut);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + chgCls + '">' + chg + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><b>' + fmtUsd(shownImplied(r)) + '</b></td>';
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tb.appendChild(tr);
    });
    $('showing').textContent = list.length + ' of ' + DATA.board_size + ' rows' + (sandboxOn() ? ' · sandbox values' : '');
  }

  function openDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.selected = slug;
    var d = $('detail');
    var base = r.tvl_usd * r.category_multiple;
    var steps = (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    d.innerHTML =
      '<h2>' + (r.watchlist ? '<span class="wl">★</span> ' : '') + esc(r.name) + ' <span style="color:var(--mut);font-size:14px">#' + r.rank + '</span></h2>' +
      '<p class="meta">' + esc(r.category || 'Other') + ' · ' + esc((r.chains || []).join(', ') || 'no chain listed') +
      ' · listed ' + (r.listed_at || 'unknown') + ' · ' + fmtAge(r.age_days) + ' old · snapshot ' + esc(DATA.as_of) + '</p>' +
      '<div class="math">' +
      '<div><b>' + fmtUsd(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>× ' + r.category_multiple.toFixed(3) + '</b><span>category multiple (' + esc(r.category || 'Other') + ')</span></div>' +
      '<div><b>× ' + r.growth_multiplier.toFixed(3) + '</b><span>growth (' + fmtPct(r.change_7d) + ' in 7d)</span></div>' +
      '<div><b>× ' + r.maturity_multiplier.toFixed(3) + '</b><span>maturity</span></div>' +
      '<div><b>× ' + r.breadth_multiplier.toFixed(3) + '</b><span>breadth (' + (r.chains || []).length + ' chains)</span></div>' +
      '<div><b>' + fmtUsd(r.implied_value_usd) + '</b><span>implied launch value</span></div>' +
      '</div>' +
      '<p class="note">Base value ' + fmtUsd(base) + ' = TVL × category multiple. The multiple is the median market-cap-per-TVL of the live-token protocols in this category. An estimate, not a price.</p>' +
      '<h3 style="margin:16px 0 4px">Farm plan</h3><ol class="steps">' + steps + '</ol>';
    d.hidden = false;
    renderBoard();
    try { window.history.replaceState(null, '', '#slug=' + encodeURIComponent(slug)); } catch (e) {}
    d.scrollIntoView({ block: 'nearest' });
  }

  function renderLive() {
    var tb = $('liverows');
    tb.innerHTML = DATA.live.map(function (r) {
      var chg = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var cls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.category || 'Other') + '</td><td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td><td class="num ' + cls + '">' + chg + '</td></tr>';
    }).join('');
  }

  function renderMults() {
    var counts = DATA.category_live_counts || {};
    var mults = DATA.category_multiples || {};
    var cats = Object.keys(counts).sort(function (a, b) {
      var ma = mults[a] !== undefined ? mults[a] : DATA.global_multiple;
      var mb = mults[b] !== undefined ? mults[b] : DATA.global_multiple;
      return mb - ma;
    });
    $('multrows').innerHTML = cats.map(function (c) {
      var m = mults[c];
      return '<tr><td>' + esc(c) + '</td><td class="num">' + counts[c] + '</td><td class="num">' + (m !== undefined ? m.toFixed(3) : 'global ' + DATA.global_multiple.toFixed(3)) + '</td></tr>';
    }).join('');
  }

  function fillSelects() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get('slug')) state.selected = p.get('slug');
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('wl') === '1') state.wl = true;
    if (p.get('q')) state.q = p.get('q');
  }

  function bind() {
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
    $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
    $('wl').addEventListener('change', function (e) { state.wl = e.target.checked; renderBoard(); });
    $('sort').addEventListener('change', function (e) {
      var v = e.target.value;
      state.sort = v === 'rank' ? 'rank' : v;
      state.dir = 1;
      renderBoard();
    });
    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (!k) return;
        if (state.sort === k) state.dir = -state.dir;
        else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        if (k === 'rank') state.dir = 1;
        renderBoard();
      });
    });
    $('gw').addEventListener('input', function (e) { state.gw = parseFloat(e.target.value); $('gwv').textContent = state.gw.toFixed(2); renderBoard(); });
    $('cap').addEventListener('input', function (e) { state.cap = parseFloat(e.target.value); $('capv').textContent = state.cap.toFixed(2); renderBoard(); });
    $('reset').addEventListener('click', function () {
      state.gw = DEF_GW; state.cap = DEF_CAP;
      $('gw').value = String(DEF_GW); $('cap').value = String(DEF_CAP);
      $('gwv').textContent = DEF_GW.toFixed(2); $('capv').textContent = DEF_CAP.toFixed(2);
      renderBoard();
    });
  }

  // Header + static sections.
  $('asof').textContent = DATA.as_of;
  $('counts').textContent = DATA.board_size + ' rows · ' + DATA.watchlist_size + ' watchlist · ' + DATA.early_size + ' early · ' + DATA.live_size + ' live set aside';
  $('modeltag').textContent = 'model ' + DATA.model_version + '\nglobal multiple ' + DATA.global_multiple.toFixed(3) + '\ndeterministic · two runs, identical bytes';
  fillSelects();
  readHash();
  if (state.cat) $('cat').value = state.cat;
  if (state.chain) $('chain').value = state.chain;
  if (state.wl) $('wl').checked = true;
  if (state.q) $('q').value = state.q;
  bind();
  renderBoard();
  renderLive();
  renderMults();
  if (state.selected) openDetail(state.selected);
})();
