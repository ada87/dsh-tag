# Marketplace checklist

Prepared for the `dsh-tag` release. The npm package itself only ships `lib/`, `locale/`, the two READMEs, `LICENSE`, `icon.svg` and `cordis.patch.yml`; this folder is repository-only.

## Package facts the catalogs read

| Field | Value |
|---|---|
| npm name | `dsh-tag` |
| Version | `0.1.0` |
| `description` | Color tags for DSH sessions and workspaces: context-menu tags, colored titles, a sidebar filter bar, and 8 UI languages. |
| Keywords | `dsh`, `dsh-plugin`, `deepseek-harness`, `plugin`, `tags`, `session`, `workspace`, `sidebar`, `filter` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `dsh.client.platform` | `web` |
| License | MIT (`LICENSE`) |
| Repository | https://github.com/ada87/dsh-tag |
| Topics | `dsh-plugin`, `deepseek-harness`, `dsh`, `plugin`, `tags`, `sidebar`, `filter` |
| `engines.dsh` | `>=0.2.2-rc.1 <0.3.0` |

## 1. dsh-plugin.org (Hub)

Automatic: it scans the GitHub `dsh-plugin` topic every six hours. No submission is required for the directory.

- [x] Public repository
- [x] `dsh-plugin` topic
- [x] Repository description
- [x] `dsh.bundle` in `package.json`
- [ ] npm publish (`0.1.0`), needed before it can appear in DSH's in-app plugin center

After the npm release, the "verified" state is upgraded by maintainers; an issue in the Hub repository can speed that up.

## 2. dsh-plugin-shop

Automatic daily build. Discovery is by npm keyword (`dsh-plugin` / `deepseek-harness`) or by GitHub topic.

- [x] `dsh.bundle` valid (`cordis.patch.yml`)
- [x] License present (`MIT`) and repository public
- [x] Installable, not deprecated
- [x] Info matches the code (10 colors, 10 tags, 8 languages, `PATCH /tags/settings`)
- [x] npm `description` and README present
- [ ] npm publish (`0.1.0`)

No application form. Rejections are listed in the shop's build report with one of its seventeen reasons.

## 3. awesome-dsh-plugin

Current rules differ from the older SHOWCASE.md flow: a submission is **one YAML file** at `data/plugins/<owner>__<repo>.yml`, and CI checks `dsh.bundle`, repository age (at least one day), entry count (max three per PR) and README regeneration.

- [x] Public repository and accurate description
- [x] `dsh-plugin` topic
- [x] Repository older than one day
- [x] Entry prepared at [`awesome-dsh-plugin.yml`](awesome-dsh-plugin.yml)
- [ ] npm publish preferred
- [ ] Open the PR from a fork after the npm release

The current contributing guide does not mention a star threshold. The old "star > 10" rule applied to the retired SHOWCASE.md flow; verify the guide again before submitting.

## Publishing

The local npm client points at `https://registry.npmmirror.com`, which is a read-only mirror. Publish to npmjs explicitly:

```sh
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org
```

Then verify:

```sh
npm view dsh-tag version description keywords --registry=https://registry.npmjs.org
```
