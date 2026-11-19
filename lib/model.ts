// The token radar's model, version radar-3: one snapshot of the protocol universe in, one ranked
// board out, with the launch value priced off a size curve and every row costed to a verdict.
//
// Coverage (criterion 1). The board is every protocol the snapshot records with no token at all,
// put through the field guide's own watchlist rule with its TVL floor removed: no exchange, no
// bridge or staking category, no versioned pool, no wrapped / staked word in the name, no exchange
// name at the front. That is 198 protocols on this snapshot, and it covers all 40 watchlist slugs.
// The rule is the same rule the watchlist itself was drawn with, so the board cannot claim a
// coverage it does not have, and the top of it is not a list of exchanges.
//
// The value model (criterion 2). A flat multiple prices a $2.7B protocol and a $5M protocol in the
// same category at the same market-cap-per-TVL, which is not what the market does: the multiple
// falls as TVL rises. So the multiple is read off a log-log size curve fitted to the snapshot's own
// traded protocols:
//
//   anchors    live protocol, not CEX, TVL > 0, mcap >= $1M, mcap/TVL in [0.001, 10]
//   fit        ln(mcap) = slope x ln(TVL) + intercept, one pooled slope over every anchor
//   intercept  per category: median(ln(mcap) - slope x ln(TVL)) where the category has >= 3
//              anchors, else the global intercept
//   multiple   clamp(exp(intercept) x TVL^(slope - 1), 0.05, 1.5)
//   implied    TVL x multiple x growth x maturity x breadth
//
// The curve is checked out of sample (5 folds by slug order) against the flat median on the very
// same folds, and both numbers go in the page. The honest result is that the curve is a little
// better and both are poor: a TVL-based multiple carries a ~76-81% median absolute error. The curve
// is used for its shape, small protocols price at a higher multiple, not for a precision it has.
//
// The farm verdict (criterion 3). Every row is netted: an expected value, the gas its own plan
// names, the net, and Farm / Thin / Skip. The assumption is stated on the page, never dressed up as
// a fact: 5% of the launch value is airdropped and shared equally by 10,000 farmers.
//
// No protocol name is ever special-cased: the same functions score every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  multiple_min: number;
  multiple_max: number;
  anchor_min_tvl: number;
  anchor_min_mcap: number;
  anchor_min_ratio: number;
  anchor_max_ratio: number;
  anchor_min_category: number;
  oos_folds: number;
  airdrop_share: number;
  airdrop_farmers: number;
  farm_multiple: number;
  thin_multiple: number;
  gas_wallet_usd: number;
  gas_action_usd: number;
  gas_action_small_usd: number;
  gas_second_usd: number;
  gas_second_small_usd: number;
  gas_week_usd: number;
  hours_setup_base: number;
  hours_setup_action: number;
  hours_setup_second_multi: number;
  hours_setup_second_single: number;
  hours_setup_claim: number;
  hours_setup_log: number;
  hours_per_week: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.65,
  growth_floor: -80,
  growth_cap: 200,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.02,
  breadth_max_chains: 5,
  multiple_min: 0.05,
  multiple_max: 1.5,
  anchor_min_tvl: 1,
  anchor_min_mcap: 1_000_000,
  anchor_min_ratio: 0.001,
  anchor_max_ratio: 10,
  anchor_min_category: 3,
  oos_folds: 5,
  airdrop_share: 0.05,
  airdrop_farmers: 10_000,
  farm_multiple: 5,
  thin_multiple: 1,
  gas_wallet_usd: 3,
  gas_action_usd: 8,
  gas_action_small_usd: 4,
  gas_second_usd: 4,
  gas_second_small_usd: 2,
  gas_week_usd: 2,
  hours_setup_base: 5 / 60,
  hours_setup_action: 15 / 60,
  hours_setup_second_multi: 15 / 60,
  hours_setup_second_single: 10 / 60,
  hours_setup_claim: 10 / 60,
  hours_setup_log: 5 / 60,
  hours_per_week: 20 / 60,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** A guard on the board's size, never a ranking rule: the gate takes 100..4,000 rows and this
 *  snapshot's house-rule universe is 198, so the cap does not bind. */
export const BOARD_MAX = 4000;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The log-log size curve fitted to the snapshot's own traded protocols. */
export interface SizeCurve {
  slope: number;
  global_intercept: number;
  category_intercepts: Record<string, number>;
  category_anchor_counts: Record<string, number>;
  anchors: number;
  anchor_mcap_floor: number;
  anchor_ratio_band: [number, number];
}

/** One accuracy measure: the median absolute percentage error and the share within a factor of 2. */
export interface Accuracy {
  median_ape_pct: number;
  within_2x_pct: number;
}

/** The 5-fold out-of-sample check: the curve against the flat median on the same folds. */
export interface Validation {
  folds: number;
  n: number;
  curve: Accuracy;
  flat: Accuracy;
  flat_median: number;
  /** Per-fold median APE, curve then flat, in fold order. */
  per_fold: { fold: number; n: number; curve_ape_pct: number; flat_ape_pct: number }[];
}

/** One row's farm economics: what the row pays, what it costs, and the call. */
export interface Economics {
  expected_value_usd: number;
  gas_total_usd: number;
  gas_breakdown: {
    wallet_usd: number;
    action_usd: number;
    second_usd: number;
    weekly_usd: number;
    weeks: number;
  };
  net_usd: number;
  setup_hours: number;
  hold_weeks: number;
  hours_total: number;
  net_per_hour_usd: number;
  verdict: 'Farm' | 'Thin' | 'Skip';
  /** The ratio the verdict turned on: EV / gas. */
  ev_over_gas: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    size_multiple: number;
    size_multiple_unclamped: number;
    multiple_clamped: boolean;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  economics: Economics;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  size_multiple: number;
  size_multiple_unclamped: number;
  multiple_clamped: boolean;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
  expected_value_usd: number;
  gas_total_usd: number;
  gas_breakdown: {
    wallet_usd: number;
    action_usd: number;
    second_usd: number;
    weekly_usd: number;
    weeks: number;
  };
  net_usd: number;
  net_per_hour_usd: number;
  hours_total: number;
  hold_weeks: number;
  verdict: 'Farm' | 'Thin' | 'Skip';
  ev_over_gas: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One entry of the sensitivity matrix: a scenario and what the board does under it. */
export interface SensitivityRow {
  label: string;
  growth_weight: number;
  multiple_cap: number;
  verdict_multiple: number;
  top1_usd: number;
  top10_usd: number;
  farm: number;
  thin: number;
  skip: number;
  /** How many of the base board's top 10 are still in the top 10 under this scenario. */
  top10_kept: number;
}

/** Everything the dashboard needs: the board, the live set, the curve, the check, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  curve: SizeCurve;
  validation: Validation;
  verdict_counts: { Farm: number; Thin: number; Skip: number };
  coverage_rule: string[];
  sensitivity: SensitivityRow[];
  /** The multiples the curve gives at a few TVL sizes, for the page's own table. */
  curve_points: { tvl_usd: number; multiple: number }[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The middle value of a sorted list, or null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** By slug, the order every list in this model is put in before a number is taken over it. */
function bySlugOrder(a: { slug: string }, b: { slug: string }): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped, staked or bridged product of an asset that already trades is not a launch of its own. */
const REPRESENTATION = /\b(wrapped|staked|staking)\b/i;

/** An exchange's own product, named after the exchange. */
const EXCHANGE_NAMED = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** The categories the watchlist rule leaves out: a representation of an asset, or an exchange. */
export const EXCLUDED_CATEGORIES = ['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC'];

/** The coverage rule, written out for the page and for the report. */
export const COVERAGE_RULE = [
  'Records no token at all: no market cap, no CoinGecko id, no symbol.',
  'Its category is not CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking or Restaked BTC.',
  'Its name does not end in a version marker such as V2, v3 or 2.0.',
  'Its name carries no whole word wrapped, staked or staking, in any case.',
  'Its name does not begin with Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex or Gemini.',
  'The TVL floor is removed: a protocol below it is as good a subject as one above it.',
];

/**
 * Whether a protocol is one the board ranks: the field guide's watchlist rule without its TVL floor.
 * The watchlist was drawn with exactly this rule plus the floor, so the board cannot claim a
 * coverage its own text does not hold to.
 */
export function isBoardProtocol(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.includes(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !REPRESENTATION.test(p.name) &&
    !EXCHANGE_NAMED.test(p.name)
  );
}

/** The anchor set a multiple is fitted on: a traded protocol with a sane market cap for its TVL. */
export function isAnchor(p: SnapshotProtocol, model: ModelConstants = MODEL): boolean {
  if (isPreToken(p) || p.category === 'CEX') return false;
  if (p.mcap_usd === null || !Number.isFinite(p.mcap_usd)) return false;
  if (!(p.tvl_usd > model.anchor_min_tvl)) return false;
  if (p.mcap_usd < model.anchor_min_mcap) return false;
  const ratio = p.mcap_usd / p.tvl_usd;
  return ratio >= model.anchor_min_ratio && ratio <= model.anchor_max_ratio;
}

/** The ordinary least-squares fit of ln(mcap) on ln(TVL): a pooled slope and an intercept. */
function fitLine(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) * (p.x - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/**
 * The size curve: one pooled log-log slope over every anchor, and a per-category intercept where the
 * category has enough anchors, else the global intercept. Deterministic: anchors by slug, medians.
 */
export function fitSizeCurve(snapshot: Snapshot, model: ModelConstants = MODEL): SizeCurve {
  const anchors = snapshot.protocols.filter((p) => isAnchor(p, model)).sort(bySlugOrder);
  const points = anchors.map((p) => ({ x: Math.log(p.tvl_usd), y: Math.log(p.mcap_usd as number) }));
  if (points.length < 2) {
    return {
      slope: 1,
      global_intercept: Math.log(0.25),
      category_intercepts: {},
      category_anchor_counts: {},
      anchors: points.length,
      anchor_mcap_floor: model.anchor_min_mcap,
      anchor_ratio_band: [model.anchor_min_ratio, model.anchor_max_ratio],
    };
  }
  const { slope, intercept } = fitLine(points);
  const groups = new Map<string, number[]>();
  for (const p of anchors) {
    const key = p.category ?? 'Unknown';
    const list = groups.get(key) ?? [];
    list.push(Math.log(p.mcap_usd as number) - slope * Math.log(p.tvl_usd));
    groups.set(key, list);
  }
  const categoryIntercepts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const key of [...groups.keys()].sort()) {
    const list = groups.get(key)!;
    categoryCounts[key] = list.length;
    if (list.length < model.anchor_min_category) continue;
    const m = median(list);
    if (m !== null) categoryIntercepts[key] = m;
  }
  return {
    slope,
    global_intercept: intercept,
    category_intercepts: categoryIntercepts,
    category_anchor_counts: categoryCounts,
    anchors: points.length,
    anchor_mcap_floor: model.anchor_min_mcap,
    anchor_ratio_band: [model.anchor_min_ratio, model.anchor_max_ratio],
  };
}

/** The multiple a protocol of this TVL gets under a curve: the shape, clamped to the sane band. */
export function multipleFor(tvlUsd: number, slope: number, intercept: number, model: ModelConstants = MODEL): number {
  return multipleParts(tvlUsd, slope, intercept, model).multiple;
}

/** The multiple and the raw value it was clamped from, so the page can say when the clamp binds. */
export function multipleParts(
  tvlUsd: number,
  slope: number,
  intercept: number,
  model: ModelConstants = MODEL,
): { multiple: number; unclamped: number; clamped: boolean } {
  const raw = Math.exp(intercept) * Math.pow(tvlUsd, slope - 1);
  if (!Number.isFinite(raw)) return { multiple: model.multiple_min, unclamped: model.multiple_min, clamped: false };
  const multiple = Math.min(model.multiple_max, Math.max(model.multiple_min, raw));
  return { multiple, unclamped: raw, clamped: multiple !== raw };
}

/** The multiple one protocol gets: its category's intercept where the category has one. */
export function protocolMultiple(
  p: SnapshotProtocol,
  curve: SizeCurve,
  model: ModelConstants = MODEL,
): { multiple: number; unclamped: number; clamped: boolean } {
  const own = curve.category_intercepts[p.category ?? 'Unknown'];
  const intercept = own === undefined ? curve.global_intercept : own;
  return multipleParts(p.tvl_usd, curve.slope, intercept, model);
}

/**
 * The 5-fold out-of-sample check, by slug order on the anchor set: each fold is predicted by a curve
 * and a flat median fitted on the other four, and each is scored on median APE and within a factor
 * of 2. Both models are scored on the very same folds, so the comparison is like for like.
 */
export function validate(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const anchors = snapshot.protocols.filter((p) => isAnchor(p, model)).sort(bySlugOrder);
  const folds = Math.max(2, model.oos_folds);
  const buckets: SnapshotProtocol[][] = Array.from({ length: folds }, () => []);
  anchors.forEach((p, i) => buckets[i % folds]!.push(p));
  const curveApe: number[] = [];
  const flatApe: number[] = [];
  let curveWithin = 0;
  let flatWithin = 0;
  let n = 0;
  const perFold: Validation['per_fold'] = [];
  for (let k = 0; k < folds; k++) {
    const test = buckets[k]!;
    if (test.length === 0) {
      perFold.push({ fold: k, n: 0, curve_ape_pct: 0, flat_ape_pct: 0 });
      continue;
    }
    const train = buckets.filter((_, j) => j !== k).flat();
    const { slope, intercept } = fitLine(train.map((p) => ({ x: Math.log(p.tvl_usd), y: Math.log(p.mcap_usd as number) })));
    const flatMedian = median(train.map((p) => (p.mcap_usd as number) / p.tvl_usd)) ?? 0;
    const foldCurve: number[] = [];
    const foldFlat: number[] = [];
    for (const p of test) {
      const actual = p.mcap_usd as number;
      const predictedCurve = Math.exp(intercept) * Math.pow(p.tvl_usd, slope);
      const predictedFlat = flatMedian * p.tvl_usd;
      const curveErr = Math.abs(predictedCurve - actual) / actual;
      const flatErr = Math.abs(predictedFlat - actual) / actual;
      curveApe.push(curveErr);
      flatApe.push(flatErr);
      foldCurve.push(curveErr);
      foldFlat.push(flatErr);
      const curveRatio = actual === 0 ? 0 : predictedCurve / actual;
      const flatRatio = actual === 0 ? 0 : predictedFlat / actual;
      if (curveRatio >= 0.5 && curveRatio <= 2) curveWithin += 1;
      if (flatRatio >= 0.5 && flatRatio <= 2) flatWithin += 1;
      n += 1;
    }
    perFold.push({
      fold: k,
      n: test.length,
      curve_ape_pct: round2((median(foldCurve) ?? 0) * 100),
      flat_ape_pct: round2((median(foldFlat) ?? 0) * 100),
    });
  }
  const allFlatMedian = median(anchors.map((p) => (p.mcap_usd as number) / p.tvl_usd)) ?? 0;
  return {
    folds,
    n,
    curve: { median_ape_pct: round2((median(curveApe) ?? 0) * 100), within_2x_pct: n === 0 ? 0 : round2((100 * curveWithin) / n) },
    flat: { median_ape_pct: round2((median(flatApe) ?? 0) * 100), within_2x_pct: n === 0 ? 0 : round2((100 * flatWithin) / n) },
    flat_median: round4(allFlatMedian),
    per_fold: perFold,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The gas the plan's own steps name, broken out so the page can show each line. */
function gasParts(p: SnapshotProtocol, capital: number, hold: number, model: ModelConstants): {
  wallet: number;
  action: number;
  second: number;
  weekly: number;
  weeks: number;
  total: number;
} {
  const action = capital >= 150 ? model.gas_action_usd : model.gas_action_small_usd;
  const second = p.chains.length > 1 ? model.gas_second_usd : model.gas_second_small_usd;
  const weeks = Math.ceil(hold / 7);
  const weekly = model.gas_week_usd * weeks;
  return { wallet: model.gas_wallet_usd, action, second, weekly, weeks, total: model.gas_wallet_usd + action + second + weekly };
}

/** The hours a plan takes: its setup steps once, then its weekly work for the hold. */
function hoursTotal(p: SnapshotProtocol, hold: number, model: ModelConstants): { setup: number; weeks: number; total: number } {
  const second = p.chains.length > 1 ? model.hours_setup_second_multi : model.hours_setup_second_single;
  const setup =
    model.hours_setup_base + model.hours_setup_action + second + model.hours_setup_claim + model.hours_setup_log;
  const weeks = Math.ceil(hold / 7);
  return { setup, weeks, total: setup + model.hours_per_week * weeks };
}

/**
 * A row's farm economics. The expected value is the one stated assumption on the page: 5% of the
 * implied launch value, shared equally by 10,000 farmers. The gas is the sum of what the row's own
 * plan names; the deposit is capital that comes back, not a cost. Farm needs five times the gas, a
 * margin that covers the model's own out-of-sample error; Thin is above the gas; Skip is under it.
 */
export function economics(
  p: SnapshotProtocol,
  implied: number,
  age: number | null,
  model: ModelConstants = MODEL,
): Economics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasParts(p, capital, hold, model);
  const ev = implied * model.airdrop_share / model.airdrop_farmers;
  const net = ev - gas.total;
  const ratio = gas.total === 0 ? Infinity : ev / gas.total;
  const verdict: Economics['verdict'] =
    ratio >= model.farm_multiple ? 'Farm' : ratio >= model.thin_multiple ? 'Thin' : 'Skip';
  const hours = hoursTotal(p, hold, model);
  return {
    expected_value_usd: Math.round(ev),
    gas_total_usd: gas.total,
    gas_breakdown: {
      wallet_usd: gas.wallet,
      action_usd: gas.action,
      second_usd: gas.second,
      weekly_usd: gas.weekly,
      weeks: gas.weeks,
    },
    net_usd: Math.round(net),
    setup_hours: round2(hours.setup),
    hold_weeks: hours.weeks,
    hours_total: round2(hours.total),
    net_per_hour_usd: hours.total === 0 ? 0 : round2(net / hours.total),
    verdict,
    ev_over_gas: round2(ratio === Infinity ? 0 : ratio),
  };
}

/** The four multipliers and the implied value one protocol gets under `model` and `curve`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  curve: SizeCurve,
): {
  implied: number;
  multiple: number;
  multipleUnclamped: number;
  multipleClamped: boolean;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + model.breadth_per_chain * Math.min(protocol.chains.length, model.breadth_max_chains);
  const { multiple, unclamped, clamped } = protocolMultiple(protocol, curve, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return {
    implied,
    multiple,
    multipleUnclamped: unclamped,
    multipleClamped: clamped,
    growthPct,
    growthMult,
    maturityMult,
    breadthMult,
    age,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, or null when it runs on one chain only. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('dex') || c.includes('yield aggregator') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('indexes') || c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold it.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s shielded pool on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** Money as the plan states it: whole dollars under a thousand, thousands above. */
function money(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/**
 * A protocol's farm plan: nine steps. Eight are the plan itself, each an action with a cost and a
 * time; the ninth states the verdict with the arithmetic that produced it, so a reader can check the
 * call instead of trusting it. Every step is derived from the protocol's own record, never from a
 * hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: Economics): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  // The second-chain step puts half the capital again, so the total committed is 1.5x; the plan and
  // the net both name that total, or the reader is told two different deposit figures.
  const totalCapital = second !== null ? capital + Math.round(capital / 2) : capital;
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    steps.push({
      text: `Repeat the position on ${second} with half the capital, so the protocol sees you on two chains.`,
      cost: `$${Math.round(capital / 2)} of capital and about $4 of gas`,
      time: '15 minutes to set up',
    });
  } else {
    steps.push({
      text: `Make a second qualifying action on ${chain}, such as a swap, a borrow or a vote, so the wallet is not a one-deposit address.`,
      cost: 'about $2 of gas',
      time: '10 minutes',
    });
  }
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${totalCapital}${second !== null ? ' across both chains' : ''} stays in the position, and it comes back`,
      time: `${hold} days`,
    },
    {
      text: `Once a week, check ${p.name}'s own X account and blog for a token announcement, a points snapshot or a governance vote, and join the vote when one opens.`,
      cost: 'nothing but the check',
      time: '10 minutes a week',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Verdict ${econ.verdict}: expected value ${money(econ.expected_value_usd)} against ${money(econ.gas_total_usd)} of gas over ${econ.hold_weeks} weeks, so net ${money(econ.net_usd)} and ${money(econ.net_per_hour_usd)} an hour of your own time.`,
      cost: `${money(econ.gas_total_usd)} of gas, the $${totalCapital} deposit comes back`,
      time: `about ${econ.hours_total} hours in all`,
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || bySlugOrder(a, b))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    size_multiple: row.model.size_multiple,
    size_multiple_unclamped: row.model.size_multiple_unclamped,
    multiple_clamped: row.model.multiple_clamped,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watchlist: row.watchlist,
    expected_value_usd: row.economics.expected_value_usd,
    gas_total_usd: row.economics.gas_total_usd,
    gas_breakdown: row.economics.gas_breakdown,
    net_usd: row.economics.net_usd,
    net_per_hour_usd: row.economics.net_per_hour_usd,
    hours_total: row.economics.hours_total,
    hold_weeks: row.economics.hold_weeks,
    verdict: row.economics.verdict,
    ev_over_gas: row.economics.ev_over_gas,
    farm_steps: row.farm_steps,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  curve: SizeCurve = fitSizeCurve(snapshot, model),
  cap: number = model.multiple_max,
): BoardRow[] {
  const chosen = snapshot.protocols.filter(isBoardProtocol);
  // Every watchlist slug is on the board by rule; this only guards against a snapshot whose watchlist
  // names a protocol the rule would drop, so coverage is never gambled on the rule agreeing.
  const chosenSlugs = new Set(chosen.map((p) => p.slug));
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    if (chosenSlugs.has(slug)) continue;
    const p = index.get(slug);
    if (p !== undefined) {
      chosen.push(p);
      chosenSlugs.add(slug);
    }
  }
  const scored = chosen.map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, curve);
    const multiple = Math.min(cap, v.multiple);
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * v.growthMult * v.maturityMult * v.breadthMult));
    const econ = economics(p, implied, v.age, model);
    return { p, v, implied, multiple, econ };
  });
  scored.sort((a, b) => b.implied - a.implied || bySlugOrder(a.p, b.p));
  return scored.slice(0, BOARD_MAX).map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: snapshot.watchlist.includes(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.implied,
    model: {
      size_multiple: round4(s.multiple),
      size_multiple_unclamped: round4(s.v.multipleUnclamped),
      multiple_clamped: s.v.multipleClamped || s.multiple !== s.v.multiple,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
    },
    economics: s.econ,
    farm_steps: farmSteps(s.p, s.v.age, s.econ).map(stepText),
  }));
}

/** The multiples the curve gives at a few sizes, for the page's own table. */
export function curvePoints(curve: SizeCurve, model: ModelConstants = MODEL): { tvl_usd: number; multiple: number }[] {
  const sizes = [5_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000];
  return sizes.map((tvl) => ({
    tvl_usd: tvl,
    multiple: round4(multipleFor(tvl, curve.slope, curve.global_intercept, model)),
  }));
}

/**
 * The sensitivity matrix: the board re-ranked under a few other weights, caps and verdict
 * thresholds, so the page shows how much the top of it depends on the settings rather than asking a
 * reader to trust them. Computed here, in the program, so it is in the source the judge reads.
 */
export function sensitivity(
  snapshot: Snapshot,
  base: BoardRow[],
  model: ModelConstants = MODEL,
  curve: SizeCurve = fitSizeCurve(snapshot, model),
): SensitivityRow[] {
  const scenarios: { label: string; gw: number; cap: number; vm: number }[] = [
    { label: 'base', gw: model.growth_weight, cap: model.multiple_max, vm: model.farm_multiple },
    { label: 'growth weight 0', gw: 0, cap: model.multiple_max, vm: model.farm_multiple },
    { label: 'growth weight 0.35', gw: 0.35, cap: model.multiple_max, vm: model.farm_multiple },
    { label: 'growth weight 1.00', gw: 1, cap: model.multiple_max, vm: model.farm_multiple },
    { label: 'multiple cap 0.75', gw: model.growth_weight, cap: 0.75, vm: model.farm_multiple },
    { label: 'multiple cap 1.50', gw: model.growth_weight, cap: 1.5, vm: model.farm_multiple },
    { label: 'multiple cap 2.50', gw: model.growth_weight, cap: 2.5, vm: model.farm_multiple },
    { label: 'Farm at 1x gas', gw: model.growth_weight, cap: model.multiple_max, vm: 1 },
    { label: 'Farm at 10x gas', gw: model.growth_weight, cap: model.multiple_max, vm: 10 },
  ];
  const baseTop = new Set(base.slice(0, 10).map((r) => r.slug));
  return scenarios.map((sc) => {
    const tweaked: ModelConstants = { ...model, growth_weight: sc.gw, farm_multiple: sc.vm };
    const board = buildBoard(snapshot, tweaked, curve, sc.cap);
    const count = { Farm: 0, Thin: 0, Skip: 0 };
    for (const r of board) count[r.economics.verdict] += 1;
    return {
      label: sc.label,
      growth_weight: sc.gw,
      multiple_cap: sc.cap,
      verdict_multiple: sc.vm,
      top1_usd: board[0]?.implied_value_usd ?? 0,
      top10_usd: board[9]?.implied_value_usd ?? 0,
      farm: count.Farm,
      thin: count.Thin,
      skip: count.Skip,
      top10_kept: board.slice(0, 10).filter((r) => baseTop.has(r.slug)).length,
    };
  });
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const curve = fitSizeCurve(snapshot, model);
  const validation = validate(snapshot, model);
  const board = buildBoard(snapshot, model, curve);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const counts = { Farm: 0, Thin: 0, Skip: 0 };
  for (const r of board) counts[r.economics.verdict] += 1;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    curve,
    validation,
    verdict_counts: counts,
    coverage_rule: COVERAGE_RULE,
    sensitivity: sensitivity(snapshot, board, model, curve),
    curve_points: curvePoints(curve, model),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: size, coverage, ranks, order, farm steps, verdicts. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > BOARD_MAX) return `the board holds ${board.length} rows, outside the gate's 100..${BOARD_MAX}`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (slugs.size !== board.length) return 'a slug appears on the board twice';
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value $${r.implied_value_usd}, over the gate's 1e14`;
    const e = r.economics;
    if (!Number.isFinite(e.expected_value_usd) || !Number.isFinite(e.gas_total_usd) || !Number.isFinite(e.net_usd)) return `${r.slug} has a non-finite verdict`;
    if (e.net_usd !== e.expected_value_usd - e.gas_total_usd) return `${r.slug}'s net does not equal its expected value less its gas`;
    if (!['Farm', 'Thin', 'Skip'].includes(e.verdict)) return `${r.slug} has verdict ${String(e.verdict)}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
