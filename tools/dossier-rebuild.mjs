#!/usr/bin/env node
// The gate's dossier_matches row: dossier.json must be byte for byte what buildDossier writes from
// the same /output. This rebuilds it with the vendored library and compares bytes, so a dossier that
// drifted from its dashboard or screenshots fails here rather than at the scorer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2];
if (!out) { console.error('usage: node tools/dossier-rebuild.mjs <out-dir>'); process.exit(2); }
const rebuilt = buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } });
const onDisk = readFileSync(join(out, 'dossier.json'));
const same = Buffer.compare(Buffer.from(rebuilt), onDisk) === 0;
console.log(`${same ? 'PASS' : 'FAIL'}  dossier_matches: rebuilt dossier is byte-identical  ${rebuilt.length} rebuilt vs ${onDisk.length} on disk`);
process.exit(same ? 0 : 1);
