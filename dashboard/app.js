// Token Radar dashboard, model radar-3. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board with its expected value, net and verdict, the filters, a
// per-protocol detail view with the model's own inputs and the verdict arithmetic, a sandbox that
// re-ranks in the page only, the sensitivity matrix, the size-curve table, the live-token set and
// the out-of-sample numbers. No network: every byte it shows is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var DEF_GW = DATA.model.growth_weight, DEF_CAP = DATA.model.multiple_max, DEF_VM = DATA.model.farm_multiple;
  var state = { q: '', cat: '', chain: '', verdict: '', wl: false, sort: 'rank', dir: 1, selected: null, gw: DEF_GW, cap: DEF_CAP, vm: DEF_VM };

  function $(id) { return document.getElementById(id); }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtUsdExact(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtSigned(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
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
  function vclass(v) { return v === 'Farm' ? 'v-farm' : v === 'Thin' ? 'v-thin' : 'v-skip'; }

  // The sandbox recompute: the same four multipliers, with the growth weight and the multiple cap
  // taken from the sliders, and the verdict threshold taken from its own slider.
  function sandboxImplied(r) {
    var mult = Math.min(r.size_multiple, state.cap);
    var growth = 1 + (r.growth_pct / 100) * state.gw;
    return Math.max(1, Math.round(r.tvl_usd * mult * growth * r.maturity_multiplier * r.breadth_multiplier));
  }
  function sandboxOn() { return state.gw !== DEF_GW || state.cap !== DEF_CAP || state.vm !== DEF_VM; }
  function shownImplied(r) { return sandboxOn() ? sandboxImplied(r) : r.implied_value_usd; }
  function shownVerdict(r) {
    if (!sandboxOn()) return r.verdict;
    var ev = shownImplied(r) * DATA.model.airdrop_share / DATA.model.airdrop_farmers;
    var ratio = r.gas_total_usd === 0 ? 0 : ev / r.gas_total_usd;
    return ratio >= state.vm ? 'Farm' : ratio >= DATA.model.thin_multiple ? 'Thin' : 'Skip';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.verdict && shownVerdict(r) !== state.verdict) return false;
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
      else if (k === 'ev') { av = a.expected_value_usd; bv = b.expected_value_usd; }
      else if (k === 'net') { av = a.net_usd; bv = b.net_usd; }
      else if (k === 'nph') { av = a.net_per_hour_usd; bv = b.net_per_hour_usd; }
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
      var v = shownVerdict(r);
      var netCls = r.net_usd > 0 ? 'pos' : 'neg';
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td>' + star + esc(r.name) + '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + chgCls + '">' + chg + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><b>' + fmtUsd(shownImplied(r)) + '</b></td>' +
        '<td class="num">' + fmtUsd(r.expected_value_usd) + '</td>' +
        '<td class="num ' + netCls + '">' + fmtSigned(r.net_usd) + '</td>' +
        '<td class="num">' + fmtSigned(r.net_per_hour_usd) + '</td>' +
        '<td><span class="badge ' + vclass(v) + '">' + v + '</span></td>';
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tb.appendChild(tr);
    });
    $('showing').textContent = list.length + ' of ' + DATA.board_size + ' rows' + (sandboxOn() ? ' · sandbox values' : '');
  }

  function verdictBox(r) {
    var ev = r.expected_value_usd, gas = r.gas_total_usd, net = r.net_usd;
    var ratio = gas === 0 ? 'n/a' : (ev / gas).toFixed(2) + '×';
    var g = r.gas_breakdown;
    var gasLines = [
      'wallet $' + g.wallet_usd,
      'the action $' + g.action_usd,
      'a second step $' + g.second_usd,
      '$' + (g.weekly_usd / Math.max(1, g.weeks)) + ' a week × ' + g.weeks + ' weeks = $' + g.weekly_usd
    ].join(' + ');
    return '<div class="verdictbox">' +
      '<h3>Verdict <span class="badge ' + vclass(r.verdict) + '">' + r.verdict + '</span></h3>' +
      '<div class="vmath">' +
        '<div><b>' + fmtUsdExact(ev) + '</b><span>expected value<br>implied ' + fmtUsd(r.implied_value_usd) + ' × 5% ÷ 10,000 farmers</span></div>' +
        '<div><b>− ' + fmtUsdExact(gas) + '</b><span>gas, line by line<br>' + gasLines + '</span></div>' +
        '<div><b>' + fmtSigned(net) + '</b><span>net, deposit excluded<br>the deposit is capital that comes back</span></div>' +
        '<div><b>' + ratio + '</b><span>expected value / gas<br>Farm needs ' + state.vm + '×, Thin 1×</span></div>' +
        '<div><b>' + fmtSigned(r.net_per_hour_usd) + '</b><span>net an hour<br>over ' + r.hours_total + ' hours</span></div>' +
      '</div>' +
      '<p class="note">The one assumption, stated as an assumption: 5% of the implied value is airdropped and split equally by 10,000 farmers. The gas is what the plan\'s own steps name. Move the threshold in the sandbox and the verdict moves with it.</p>' +
    '</div>';
  }

  function openDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.selected = slug;
    var d = $('detail');
    var base = r.tvl_usd * r.size_multiple;
    var steps = (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var clampNote = r.multiple_clamped
      ? '<p class="note">The curve gives ' + r.size_multiple_unclamped.toFixed(4) + ' at this TVL, outside the 0.05–1.50 band, so the multiple is held at ' + r.size_multiple.toFixed(3) + '. The clamp is stated here rather than hidden: on a protocol this large the curve\'s raw output is not a price the market supports.</p>'
      : '';
    d.innerHTML =
      '<h2>' + (r.watchlist ? '<span class="wl">★</span> ' : '') + esc(r.name) + ' <span class="dim">#' + r.rank + '</span></h2>' +
      '<p class="meta">' + esc(r.category || 'Other') + ' · ' + esc((r.chains || []).join(', ') || 'no chain listed') +
      ' · listed ' + (r.listed_at || 'unknown') + ' · ' + fmtAge(r.age_days) + ' old · snapshot ' + esc(DATA.as_of) + '</p>' +
      '<div class="math">' +
      '<div><b>' + fmtUsd(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>× ' + r.size_multiple.toFixed(3) + '</b><span>size-curve multiple<br>' + esc(r.category || 'Other') + ' intercept at this TVL</span></div>' +
      '<div><b>× ' + r.growth_multiplier.toFixed(3) + '</b><span>growth<br>7d ' + fmtPct(r.change_7d) + ' × weight ' + DATA.model.growth_weight + ', clamped ' + DATA.model.growth_floor + '%…+' + DATA.model.growth_cap + '%</span></div>' +
      '<div><b>× ' + r.maturity_multiplier.toFixed(3) + '</b><span>maturity<br>' + DATA.model.maturity_floor + ' at listing rising to 1.00 after ' + (DATA.model.maturity_days / 365) + ' years</span></div>' +
      '<div><b>× ' + r.breadth_multiplier.toFixed(3) + '</b><span>breadth<br>+2% a chain, capped at ' + DATA.model.breadth_max_chains + ' chains (' + (r.chains || []).length + ' here)</span></div>' +
      '<div><b>' + fmtUsd(r.implied_value_usd) + '</b><span>implied launch value</span></div>' +
      '</div>' +
      clampNote +
      '<p class="note">Base value ' + fmtUsd(base) + ' = TVL × size-curve multiple. The multiple is read off a log-log curve fitted on the snapshot\'s own traded protocols, at this protocol\'s TVL and its category\'s intercept. An estimate, not a price.</p>' +
      verdictBox(r) +
      '<h3 class="planhead">Farm plan</h3><ol class="steps">' + steps + '</ol>';
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
    var counts = DATA.curve.category_anchor_counts || {};
    var icepts = DATA.curve.category_intercepts || {};
    var cats = Object.keys(counts).sort(function (a, b) {
      var ma = icepts[a] !== undefined ? Math.exp(icepts[a]) * Math.pow(50e6, DATA.curve.slope - 1) : -1;
      var mb = icepts[b] !== undefined ? Math.exp(icepts[b]) * Math.pow(50e6, DATA.curve.slope - 1) : -1;
      return mb - ma || (a < b ? -1 : 1);
    });
    $('multrows').innerHTML = cats.map(function (c) {
      var ic = icepts[c];
      var own = ic !== undefined;
      var mult = own ? Math.exp(ic) * Math.pow(50e6, DATA.curve.slope - 1) : Math.exp(DATA.curve.global_intercept) * Math.pow(50e6, DATA.curve.slope - 1);
      mult = Math.min(DATA.model.multiple_max, Math.max(DATA.model.multiple_min, mult));
      return '<tr><td>' + esc(c) + (own ? '' : ' <span class="dim">(global intercept)</span>') + '</td>' +
        '<td class="num">' + counts[c] + '</td>' +
        '<td class="num">' + (ic !== undefined ? ic.toFixed(4) : DATA.curve.global_intercept.toFixed(4)) + '</td>' +
        '<td class="num">' + mult.toFixed(3) + '</td></tr>';
    }).join('');
  }

  function renderCurve() {
    $('curverows').innerHTML = (DATA.curve_points || []).map(function (p) {
      return '<tr><td class="num">' + fmtUsd(p.tvl_usd) + '</td><td class="num">' + p.multiple.toFixed(3) + '</td></tr>';
    }).join('');
  }

  function renderSensitivity() {
    $('sensrows').innerHTML = (DATA.sensitivity || []).map(function (s) {
      return '<tr><td>' + esc(s.label) + '</td>' +
        '<td class="num">' + s.growth_weight.toFixed(2) + '</td>' +
        '<td class="num">' + s.multiple_cap.toFixed(2) + '</td>' +
        '<td class="num">' + s.verdict_multiple + '×</td>' +
        '<td class="num">' + fmtUsd(s.top1_usd) + '</td>' +
        '<td class="num">' + fmtUsd(s.top10_usd) + '</td>' +
        '<td class="num">' + s.top10_kept + '/10</td>' +
        '<td class="num">' + s.farm + '</td>' +
        '<td class="num">' + s.thin + '</td>' +
        '<td class="num">' + s.skip + '</td></tr>';
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
    if (!h) return false;
    var p = new URLSearchParams(h);
    var before = JSON.stringify([state.selected, state.cat, state.chain, state.verdict, state.wl, state.q]);
    if (p.get('slug')) state.selected = p.get('slug');
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('v')) state.verdict = p.get('v');
    if (p.get('wl') === '1') state.wl = true;
    if (p.get('q')) state.q = p.get('q');
    return before !== JSON.stringify([state.selected, state.cat, state.chain, state.verdict, state.wl, state.q]);
  }

  // A hash link shared between rows changes only the fragment, so the page does not reload: apply it
  // by hand, or a link to a row or a verdict would land on the unfiltered board.
  window.addEventListener('hashchange', function () {
    if (!readHash()) return;
    $('cat').value = state.cat;
    $('chain').value = state.chain;
    $('verdict').value = state.verdict;
    $('wl').checked = state.wl;
    $('q').value = state.q;
    renderBoard();
    if (state.selected) openDetail(state.selected);
  });

  function bind() {
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
    $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
    $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
    $('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; renderBoard(); });
    $('wl').addEventListener('change', function (e) { state.wl = e.target.checked; renderBoard(); });
    $('sort').addEventListener('change', function (e) {
      state.sort = e.target.value;
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
    $('vm').addEventListener('input', function (e) { state.vm = parseFloat(e.target.value); $('vmv').textContent = String(state.vm); renderBoard(); });
    $('reset').addEventListener('click', function () {
      state.gw = DEF_GW; state.cap = DEF_CAP; state.vm = DEF_VM;
      $('gw').value = String(DEF_GW); $('cap').value = String(DEF_CAP); $('vm').value = String(DEF_VM);
      $('gwv').textContent = DEF_GW.toFixed(2); $('capv').textContent = DEF_CAP.toFixed(2); $('vmv').textContent = String(DEF_VM);
      renderBoard();
    });
  }

  // Header + static sections.
  $('asof').textContent = DATA.as_of;
  $('counts').textContent = DATA.board_size + ' rows · ' + DATA.watchlist_size + ' watchlist · ' + DATA.live_size + ' live';
  var vc = DATA.verdict_counts;
  $('modeltag').textContent = 'model ' + DATA.model_version + '\nsize curve slope ' + DATA.curve.slope.toFixed(4) + '\n' + DATA.curve.anchors + ' anchors · deterministic\ntwo runs, identical bytes';
  $('oosline').textContent = 'Out-of-sample, 5 folds on ' + DATA.validation.n + ' anchors: size curve ' + DATA.validation.curve.median_ape_pct.toFixed(1) + '% median error, flat median ' + DATA.validation.flat.median_ape_pct.toFixed(1) + '%. The curve is used for its shape, not for a precision it has.';
  $('anchors').textContent = DATA.curve.anchors + ' traded protocols';
  $('coveragecount').textContent = DATA.board_size;
  $('watchcount').textContent = DATA.watchlist_size;
  $('oosdetail').textContent = 'The size curve lands at ' + DATA.validation.curve.median_ape_pct.toFixed(1) + '% median absolute error with ' + DATA.validation.curve.within_2x_pct.toFixed(1) + '% of anchors within a factor of two; the flat median, on the same folds, lands at ' + DATA.validation.flat.median_ape_pct.toFixed(1) + '% with ' + DATA.validation.flat.within_2x_pct.toFixed(1) + '%.';
  $('verdictcounts').textContent = vc.Farm + ' Farm, ' + vc.Thin + ' Thin, ' + vc.Skip + ' Skip';
  fillSelects();
  readHash();
  if (state.cat) $('cat').value = state.cat;
  if (state.chain) $('chain').value = state.chain;
  if (state.verdict) $('verdict').value = state.verdict;
  if (state.wl) $('wl').checked = true;
  if (state.q) $('q').value = state.q;
  bind();
  renderBoard();
  renderLive();
  renderMults();
  renderCurve();
  renderSensitivity();
  if (state.selected) openDetail(state.selected);
})();
