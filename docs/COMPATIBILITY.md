# Compatibility

Generated from [`compat.json`](../compat.json). Do not edit by hand; run `pnpm compat` in the monorepo root.

| | |
|---|---|
| Plugin | `dsh-tag` **0.1.2** |
| dsh range | `>=0.2.2-rc.1 <0.3.0` |
| Protocol | 3 |
| App minimum | 0.1.0 |
| Updated | 2026-11-17 |

## Tested

| dsh | Result | Tested | Notes |
|---|---|---|---|
| `0.2.2-rc.1` | pass | 2026-11-17 | Sidebar colours, filter bar, reads shared with the phone. |
| `0.2.2-rc.3` | pending | — | Additive API only; runtime matrix pending. |

`pass` = automated tests and a real-host smoke run; `partial` = static review only;
`pending` = not run yet; `fail` = known incompatibility.

Install: `dsh plugin --profile web add dsh-tag@0.1.2`
