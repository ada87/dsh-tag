# Marketplace checklist

Repository-only notes for the `dsh-tag` release. The npm package ships `lib/`, `locale/`, the eight READMEs, `LICENSE` and `cordis.patch.yml`; this folder is not published.

## Package facts the catalogs read

| Field | Value |
|---|---|
| npm name | `dsh-tag` |
| Version | `0.1.1` |
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
- [ ] publish `0.1.1`
- [ ] Wait for the topic sync, then check the Hub listing
- [ ] Ask maintainers to upgrade the entry from unconfirmed to verified (optional issue)

## 2. dsh-plugin-shop

Automatic daily build. Discovery is by npm keyword (`dsh-plugin` / `deepseek-harness`) or by GitHub topic.

- [x] `dsh.bundle` valid (`cordis.patch.yml`)
- [x] License present (`MIT`) and repository public
- [x] Installable, not deprecated
- [x] Info matches the code (10 colors, 10 tags, 8 languages, `PATCH /tags/settings`)
- [x] npm `description`, keywords and README present
- [ ] Wait for the next daily build; rejections appear in its build report

## 3. awesome-dsh-plugin

A submission is **one YAML file** at `data/plugins/<owner>__<repo>.yml`. CI checks `dsh.bundle`, repository age (at least one day), entry count (max three per PR) and README regeneration.

- [x] Public repository and accurate description
- [x] `dsh-plugin` topic
- [x] Repository older than one day
- [x] Entry prepared at [`awesome-dsh-plugin.yml`](awesome-dsh-plugin.yml)
- [ ] publish `0.1.1`
- [ ] Fork the list, add the file, open the PR

The current contributing guide does not mention a star threshold. The old "star > 10" rule applied to the retired SHOWCASE.md flow.

## Release

```sh
npm version patch
npm publish
```

`publishConfig.registry` pins npmjs even though the local npm client points at the npmmirror. `prepublishOnly` rebuilds and reruns the host smoke test before the tarball is created.

Verify after release:

```sh
npm view dsh-tag version description keywords --registry=https://registry.npmjs.org
```

