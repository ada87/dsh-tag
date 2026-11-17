# DSH Tag

English | [中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português](README.pt.md)

[![npm version](https://img.shields.io/npm/v/dsh-tag?color=3d7bfd)](https://www.npmjs.com/package/dsh-tag)
[![license](https://img.shields.io/npm/l/dsh-tag?color=3d7bfd)](https://github.com/ada87/dsh-tag/blob/main/LICENSE)
[![dsh](https://img.shields.io/badge/dsh-0.2.x-3d7bfd)](https://github.com/ada87/dsh-tag/blob/main/docs/COMPATIBILITY.md)

Color tags for DeepSeek Harness sessions and workspaces: one tag per row, the title takes its color, and the bar above the workspace list filters by tag.

![Two workspaces with tagged sessions and the filter bar](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/sidebar.png)

## Features

- **Tag any session or workspace.** Right-click a row, pick a color; a workspace tag covers its whole group.
- **Filter from the sidebar.** Click a color to see matching sessions; groups open automatically with a count.
- **Colors that survive both themes.** Each tag has a light and a dark title color.
- **Unread at a glance.** Updated sessions are bold until you open them, and the same state reaches the phone.
- **Small and predictable.** Up to 10 tags, 10 colors, no database, one JSON state file.

## Install

Add the plugin by name:

```text
Plugins → Add plugin → dsh-tag
```

Or from the CLI:

```sh
dsh plugin --profile web add dsh-tag
```

Restart `dsh web`, then open **Settings → DSH Tag**.

## Usage

- Right-click a session or a workspace header → **Tags** → pick a color
- A workspace tag covers its whole group
- Click a color above the workspace list to filter; matching groups open with a count
- Settings → **DSH Tag**: rename, recolor, delete, add. Up to 10 tags, one color each
- Turn the filter bar off if you don't use it
- Unread sessions are shown in bold; opening one clears it, and the same weight reaches the phone

![DSH Tag settings](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/settings.png)

## Reference

- API, palette, compatibility and development: [docs/REFERENCE.md](https://github.com/ada87/dsh-tag/blob/main/docs/REFERENCE.md)
- Tested versions: [docs/COMPATIBILITY.md](https://github.com/ada87/dsh-tag/blob/main/docs/COMPATIBILITY.md)

## License

MIT
