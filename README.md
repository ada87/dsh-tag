<p align="center"><img src="icon.svg" alt="dsh-tag" width="96" height="96"></p>

# dsh-tag

English | [中文](README.zh.md) | [日本語](README.ja.md)

![version](https://img.shields.io/badge/version-0.1.0-blue) ![DSH](https://img.shields.io/badge/DSH-0.2.2--rc.1-4D6BFE) ![license](https://img.shields.io/badge/license-MIT-green) ![languages](https://img.shields.io/badge/UI_languages-8-8B5CF6)

Color tags for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) sessions and workspaces. Tag a conversation from its context menu; the title takes the tag color, and one click on the color bar filters the sidebar down to that tag.

![Tagged titles and the filter bar](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/sidebar.png)

## Features

### One tag per conversation, one color per title

Right-click a session (or use its `...` menu) and pick a tag. The row keeps exactly one tag: picking a different one replaces it, and clicking the checked tag clears it. The session title is painted with the tag color, and hovering the row shows the tag name next to the dot.

Workspace rows work the same way. A tag on a workspace covers its whole group, which is what the filter uses to pull a group out in one click.

![The Tags submenu](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/menu.png)

### A filter bar built for the sidebar

The color bar above the workspace list is the fast path once you have a few tags:

- Click a color to show only the sessions carrying that tag
- A workspace tag brings out its entire group; matching groups open automatically and show how many sessions matched
- Groups with no matches are hidden, so the result reads like a list instead of a tree
- Click the same color again, or the rainbow **All** button, to restore everything, including groups the filter opened

![Filtering by one tag](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/filter.png)

Don't want the bar? Turn off **Show filter bar** in Settings → Tags. The setting is stored with the tags, so every client sees the same sidebar. Turning it off also clears any filter that is currently active, so nothing stays hidden without a visible way back.

### Settings that stay out of the way

Settings → Tags is a plain card list: rename inline, recolor from the colors nobody else is using, delete with one confirmation, or add a tag at the bottom.

- Up to 10 tags, and every tag owns a unique color
- Colors that are already taken disappear from the picker
- The card frame carries the tag color at rest and goes full-strength while you edit
- The add row disappears once you reach the limit

![Tags settings](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/settings.png)

### Readable in light and dark

Title text uses a separate pair of colors per theme, not the 500-level fill tokens: the light palette clears 4.8:1, the dark palette 6.1:1. Switching the theme recolors titles and settings text without a reload.

### Everything is shared, nothing is trapped

- State lives in `<DSH_HOME>/state/dsh-tag.json`
- Windows and devices stay in sync over SSE
- `GET /tags` is public and read-only, so an app or another plugin can render the same tags

## Install

**Plugin center (after the npm release)**

Open **Settings → Plugins → Add plugin**, enter `dsh-tag`, and enable it.

**DSH Web from the CLI**

```sh
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add dsh-tag
npx @deepseek-ai/dsh@0.2.2-rc.1 web
```

**From a local checkout**

```sh
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add /absolute/path/to/dsh-tag
```

Reload the Web UI with `Ctrl+Shift+R` after installing or rebuilding.

## Usage

1. **Tag a session** — right-click the row or open `...` → **Tags** → pick a color. The checked entry is the current tag; click it again to clear.
2. **Tag a workspace** — right-click the workspace header → **Workspace tags**. The whole group inherits the color.
3. **Filter** — click a dot in the bar. Workspaces that match expand with a count; empty groups disappear. Click **All** to reset.
4. **Manage** — Settings → Tags. Deleting a tag also removes it from every session and workspace.

## Colors

| Name | Hex | Name | Hex |
|---|---|---|---|
| `green` | `#22C55E` | `amber` | `#F59E0B` |
| `blue` | `#3B82F6` | `red` | `#EF4444` |
| `purple` | `#A855F7` | `gray` | `#6B7280` |
| `teal` | `#06B6D4` | `pink` | `#EC4899` |
| `indigo` | `#4F46E5` | `brown` | `#8D5B3E` |

Ten hues, spread so that blue / indigo / violet differ by lightness as well as hue. Swatches and the filter bar use these fixed values; title text and card frames follow the theme.

## API

Everything sits under `/tags`; there is no `/session-tags`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/tags` | Full snapshot (public) |
| GET | `/tags/events` | SSE: snapshot on connect, then on every change |
| GET | `/tags/health` | Capability probe |
| POST | `/tags` | Create `{ label, color }` |
| PATCH | `/tags/settings` | Interface preferences `{ showFilter?: boolean }` |
| PATCH | `/tags/:id` | Rename / recolor / reorder `{ label?, color?, order? }` |
| DELETE | `/tags/:id` | Delete the tag and clear its assignments |
| PUT | `/tags/sessions/:id` | `{ tagId: string \| null }` |
| PUT | `/tags/workspaces/:id` | `{ tagId, path? }` |

Reads are public. Writes require a same-origin browser request, a loopback address, or an authenticated DSH connection.

```json
{
  "version": 2,
  "updatedAt": 1760000000000,
  "settings": { "showFilter": true },
  "tags": [
    { "id": "design", "label": "Design", "color": "purple", "order": 10 },
    { "id": "code", "label": "Code", "color": "blue", "order": 20 }
  ],
  "sessions": { "session-xxx": "design" },
  "workspaces": [
    { "id": "workspace-id", "path": "D:\\work\\demo", "tagId": "code" }
  ]
}
```

## Compatibility

```json
"engines": { "dsh": ">=0.2.2-rc.1 <0.3.0" }
```

DSH enforces this field through semver (prereleases included), so it is a real gate. The floor is the version this plugin is developed and tested against.

Most of the coupling is in the browser side, not the host: `locale`, `contextMenus` and `slots`, plus the `workspaces` / `sessions` snapshots for the cascade filter. Title coloring and filtering also depend on internal DOM attributes (`data-row-key`, `[class*="_title"]`). When the optional services are missing, the filter degrades to the rows currently rendered; when a slot is absent, that entry simply never appears.

0.2.1 does not have the settings icon slot and only ships `zh` / `en` UI catalogs, which is why the floor is not lower. After upgrading DSH, re-check title coloring, filter mounting, the settings page, and language switching.

## Languages

The UI ships with **English, 简体中文, 日本語, Español, Français, Deutsch, Русский, Português**. Dictionaries register through `ctx.locale.register` and fall back to English key by key. Default tag labels follow the host language on first run and can be renamed afterwards.

## Development

```sh
npm install
npm run build      # tsc + esbuild + client syntax check
npm run typecheck
npm run test:host  # /tags smoke test against a temporary DSH_HOME
```

```
cordis.patch.yml   bundle insert
src/index.ts       host: /tags routes, SSE, auth
src/store.ts       JSON state, settings, default tags
src/protocol.ts    wire contract
client/client.js   browser half: coloring, menus, filter, settings, 8 dictionaries
locale/*.json      plugin listing copy
```

Known limits:

- Title coloring relies on DSH's `[class*="_title"]` CSS module convention
- Archived sessions stay gray
- Search result rows have no `data-row-key`, so they are neither colored nor filtered
- The ungrouped group has no workspace id and cannot be tagged

## License

MIT
