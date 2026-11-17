# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iwanr94/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iwanr94/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar (model radar-2): 226 pre-token DeFi protocols ranked by implied launch value from a sealed DefiLlama snapshot, each with a farm plan. The base multiple is the market's own multiple for the protocol's category, read out of the snapshot's live-token protocols, so a lending protocol and a bridge are not priced the same.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only. The program writes `out/board.json` (the ranked board), `out/data.js` (the dashboard's dataset), `out/dashboard/` and `out/screenshots/` (copied from this repository), and `out/dossier.json` (the summary the judge reads). Run it twice and the outputs are byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
