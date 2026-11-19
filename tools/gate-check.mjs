#!/usr/bin/env node
// Verify a built /output against every gate row in RULES.txt, plus the checks the brief names:
// board size, farm-step shape, dossier bytes, screenshot count/bytes/pixels, dashboard files and
// bytes, no http(s) in the dashboard, ranks 1..N, implied non-increasing with rank.
//
//   node tools/gate-check.mjs out1 [out2]
//
// With two output directories it also asserts the two runs are byte-identical.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const dirs = process.argv.slice(2);
const snapshotPath = process.env.SNAPSHOT ?? '/home/hatch/workspace/makefun/token-radar-01/token-radar-01-kit/input/snapshot.json';
if (dirs.length === 0 || dirs.length > 2) {
  console.error('usage: node tools/gate-check.mjs <out-dir> [<out-dir-2>]   (SNAPSHOT=<snapshot.json>)');
  process.exit(2);
}

let failures = 0;
const say = (ok, name, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failures++;
};

/** PNG/JPEG pixel size from the header, or null. */
function imageSize(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), type: 'png' };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry the frame size.
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7), type: 'jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

function check(out) {
  console.log(`\n=== ${out} ===`);
  const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));

  // ---- board_file
  const boardRaw = readFileSync(join(out, 'board.json'));
  const boardDoc = JSON.parse(boardRaw.toString('utf8'));
  const rows = Array.isArray(boardDoc) ? boardDoc : boardDoc.rows;
  say(Array.isArray(rows), 'board_file: rows is an array', `${rows.length} rows`);
  say(rows.length >= 100 && rows.length <= 4000, 'board_file: 100..4000 rows', `${rows.length}`);
  say(boardRaw.length <= 8 * 1024 * 1024, 'board_file: <= 8 MiB', `${boardRaw.length} bytes`);

  const snapshotSlugs = new Set(snap.protocols.map((p) => p.slug));
  const badSlug = rows.find((r) => !snapshotSlugs.has(r.slug));
  say(badSlug === undefined, 'board_file: every slug is a snapshot protocol', badSlug ? badSlug.slug : 'all known');

  const badName = rows.find((r) => typeof r.name !== 'string' || r.name.length === 0);
  say(badName === undefined, 'board_file: every row has a name', badName ? badName.slug : 'all named');

  const badRank = rows.find((r) => !Number.isInteger(r.rank) || r.rank < 1);
  say(badRank === undefined, 'board_file: every rank is a positive whole number', badRank ? String(badRank.rank) : 'all whole');

  const badValue = rows.find((r) => !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd < 1 || r.implied_value_usd > 100_000_000_000_000);
  say(badValue === undefined, 'board_file: implied_value_usd is a positive whole number <= 1e14', badValue ? String(badValue.implied_value_usd) : 'all in range');

  const slugSeen = new Set();
  const dupSlug = rows.find((r) => (slugSeen.has(r.slug) ? true : (slugSeen.add(r.slug), false)));
  say(dupSlug === undefined, 'board_file: no slug twice', dupSlug ? dupSlug.slug : 'unique');

  const distinct = new Set(rows.map((r) => r.implied_value_usd));
  say(rows.length < 2 || distinct.size > 1, 'board_file: not all implied values equal', `${distinct.size} distinct values`);

  // ---- sorted_by_value
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  const ranksOk = ranks.length > 0 && ranks.every((v, i) => v === i + 1);
  say(ranksOk, 'sorted_by_value: ranks are exactly 1..N', ranksOk ? `1..${ranks.length}` : 'gaps or duplicates');

  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  let drop = -1;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].implied_value_usd > ordered[i - 1].implied_value_usd) { drop = i; break; }
  }
  say(drop === -1, 'sorted_by_value: implied does not rise with rank',
    drop === -1 ? `rank 1 $${ordered[0].implied_value_usd} -> rank ${ordered.length} $${ordered[ordered.length - 1].implied_value_usd}`
                : `rank ${ordered[drop].rank} $${ordered[drop].implied_value_usd} > rank ${ordered[drop - 1].rank} $${ordered[drop - 1].implied_value_usd}`);

  // ---- coverage
  const onBoard = new Set(rows.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !onBoard.has(s));
  say(missing.length === 0, 'coverage: every watchlist slug on the board',
    missing.length === 0 ? `${snap.watchlist.length}/${snap.watchlist.length}` : `missing ${missing.slice(0, 5).join(', ')}`);

  // ---- farm_steps
  let worst = { n: 0, slug: '' }, shortest = { n: Infinity, slug: '' }, longest = { n: 0, slug: '' };
  for (const r of rows) {
    const steps = r.farm_steps;
    if (!Array.isArray(steps) || steps.length < 3 || steps.length > 12) { worst = { n: Array.isArray(steps) ? steps.length : -1, slug: r.slug }; break; }
    for (const s of steps) {
      const t = String(s).trim();
      if (t.length < shortest.n) shortest = { n: t.length, slug: r.slug };
      if (t.length > longest.n) longest = { n: t.length, slug: r.slug };
    }
  }
  say(worst.slug === '' && shortest.n >= 20 && longest.n <= 600, 'farm_steps: 3..12 steps, 20..600 chars each',
    worst.slug === '' ? `steps ${Math.min(...rows.map((r) => r.farm_steps.length))}..${Math.max(...rows.map((r) => r.farm_steps.length))}, chars ${shortest.n}..${longest.n} (${shortest.slug} .. ${longest.slug})`
                      : `${worst.slug} has ${worst.n} steps`);

  // ---- dashboard_files
  const dash = join(out, 'dashboard');
  const dashFiles = readdirSync(dash).filter((n) => statSync(join(dash, n)).isFile());
  const dashBytes = dashFiles.reduce((n, f) => n + statSync(join(dash, f)).size, 0);
  say(dashFiles.includes('index.html') && dashFiles.some((f) => f.endsWith('.css')) && dashFiles.some((f) => f.endsWith('.js')),
    'dashboard_files: index.html + a .css + a .js', dashFiles.join(', '));
  say(dashFiles.length <= 400, 'dashboard_files: <= 400 files', `${dashFiles.length}`);
  say(dashBytes <= 4 * 1024 * 1024, 'dashboard_files: <= 4 MiB', `${dashBytes} bytes`);

  let netHit = null;
  for (const f of dashFiles) {
    const text = readFileSync(join(dash, f), 'utf8');
    if (/https?:\/\//.test(text)) { netHit = f; break; }
  }
  say(netHit === null, 'dashboard_files: no http(s) anywhere in the dashboard', netHit === null ? 'none' : netHit);

  // ---- screenshots
  const shotDir = join(out, 'screenshots');
  const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.') && statSync(join(shotDir, n)).isFile());
  say(shots.length >= 3 && shots.length <= 4, 'screenshots: 3..4 images', `${shots.length}: ${shots.join(', ')}`);
  const shotReport = [];
  let shotsOk = true;
  for (const name of shots) {
    const bytes = readFileSync(join(shotDir, name));
    const dim = imageSize(bytes);
    const ok = dim !== null && bytes.length <= 524_288 && Math.max(dim.w, dim.h) <= 1440 && Math.min(dim.w, dim.h) >= 800;
    if (!ok) shotsOk = false;
    shotReport.push(`${name} ${dim ? `${dim.w}x${dim.h}` : 'NOT AN IMAGE'} ${bytes.length}B ${ok ? 'ok' : 'OUT OF LIMITS'}`);
  }
  say(shotsOk, 'screenshots: whole image, <= 512 KiB, long <= 1440, short >= 800', shotReport.join(' | '));
  const totalShot = shots.reduce((n, f) => n + statSync(join(shotDir, f)).size, 0);
  say(totalShot <= 1.5 * 1024 * 1024, 'screenshots: fit the 1.5 MiB dossier', `${totalShot} bytes`);

  // ---- dossier_matches: rebuild from the output and compare bytes.
  const dossierPath = join(out, 'dossier.json');
  const dossierRaw = readFileSync(dossierPath);
  say(dossierRaw.length <= 1.5 * 1024 * 1024, 'dossier: <= 1.5 MiB', `${dossierRaw.length} bytes`);
  const dossier = JSON.parse(dossierRaw.toString('utf8'));
  const textBytes = Buffer.byteLength(dossier.text, 'utf8');
  say(textBytes <= 65_536, 'dossier: text under the 65,536-byte cap', `${textBytes} bytes (${65_536 - textBytes} spare)`);
  say(!/^\[Cut at /m.test(dossier.text), 'dossier: no file was cut', /^\[Cut at /m.test(dossier.text) ? 'the source was truncated' : 'every source file whole');

  return { rows: rows.length, dashBytes, shotTotal: totalShot, dossierBytes: dossierRaw.length, textBytes };
}

const results = dirs.map((d) => {
  if (!existsSync(join(d, 'board.json'))) {
    console.error(`no board.json in ${d}`);
    process.exit(2);
  }
  return check(d);
});

if (dirs.length === 2) {
  console.log('\n=== determinism ===');
  const files = ['board.json', 'data.js', 'dossier.json'];
  let same = true;
  for (const f of files) {
    const a = createHash('sha256').update(readFileSync(join(dirs[0], f))).digest('hex');
    const b = createHash('sha256').update(readFileSync(join(dirs[1], f))).digest('hex');
    const ok = a === b;
    if (!ok) same = false;
    console.log(`${ok ? 'PASS' : 'FAIL'}  byte-identical ${f}  ${a.slice(0, 16)} ${ok ? '==' : '!='} ${b.slice(0, 16)}`);
  }
  const dA = readFileSync(join(dirs[0], 'dashboard', 'index.html'));
  const dB = readFileSync(join(dirs[1], 'dashboard', 'index.html'));
  const ok = dA.equals(dB);
  if (!ok) same = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  byte-identical dashboard/index.html  ${createHash('sha256').update(dA).digest('hex').slice(0, 16)} ${ok ? '==' : '!='} ${createHash('sha256').update(dB).digest('hex').slice(0, 16)}`);
  if (!same) failures++;
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
