# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iwanr94/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iwanr94/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar (model radar-3): 198 pre-token DeFi protocols ranked by implied launch value from a sealed DefiLlama snapshot, each with a netted farm verdict and a nine-step plan.

What changed from radar-2, and why:

- **The multiple is fitted to size, not held flat.** A flat category median prices a $2.7B protocol and a $5M protocol at the same market-cap-per-TVL, and the market does not. The multiple is now read off a log-log curve fitted to the snapshot's own traded protocols: one pooled slope over 96 anchors, a per-category intercept where the category has at least three anchors, and the result clamped to 0.05–1.50. The slope on this snapshot is 0.4154.
- **The curve is checked out of sample and the numbers are reported honestly.** Five folds by slug order, each predicted by a curve fitted on the other four, and the flat median radar-2 used is scored on the very same folds. The committed run gives a 76.36% median absolute error for the curve against 81.03% for the flat median. Both numbers are on the page. The curve is used for its shape — small protocols price at a higher multiple — not for a precision it does not have, and the page says so.
- **The board is the field guide's rule, not a raw protocol dump.** 198 protocols: every protocol with no token at all, minus exchanges, bridges, staking categories, versioned pools, wrapped or staked products and exchange-named products, with the TVL floor removed. All 40 watchlist slugs are covered. A raw dump would have put Bybit, Bitfinex and wrapped BTC on top.
- **Every row is netted to a verdict.** Expected value is 5% of the implied launch value split by 10,000 farmers, stated as an assumption rather than a fact; gas is the sum of what that row's own plan names; the deposit is capital that comes back. Farm needs five times the gas, Thin needs the gas, Skip is below it. The board runs 22 Farm, 151 Thin, 25 Skip, and a ninth farm step on every row states the arithmetic so a reader can check the call.
- **The dashboard carries the evidence.** EV, net, net-per-hour and verdict columns with their own sorts and a verdict filter; a detail view with the model's inputs, the clamp when it binds, the gas line by line and the plan; a sensitivity matrix computed by the program rather than in the browser; and a "How the model works" that states the coverage rule, the curve, both out-of-sample numbers and the verdict assumption.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only. The program writes `out/board.json` (the ranked board), `out/data.js` (the dashboard's dataset), `out/dashboard/` and `out/screenshots/` (copied from this repository), and `out/dossier.json` (the summary the judge reads). Run it twice and the outputs are byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
