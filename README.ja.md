# DSH Tag

[English](README.md) | [中文](README.zh.md) | 日本語 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português](README.pt.md)

[![npm version](https://img.shields.io/npm/v/dsh-tag?color=3d7bfd)](https://www.npmjs.com/package/dsh-tag)
[![npm downloads](https://img.shields.io/npm/dm/dsh-tag?color=3d7bfd)](https://www.npmjs.com/package/dsh-tag)
[![license](https://img.shields.io/npm/l/dsh-tag?color=3d7bfd)](https://github.com/ada87/dsh-tag/blob/main/LICENSE)
[![dsh](https://img.shields.io/badge/dsh-0.2.x-3d7bfd)](https://github.com/ada87/dsh-tag/blob/main/docs/COMPATIBILITY.md)
[![GitHub stars](https://img.shields.io/github/stars/ada87/dsh-tag?color=3d7bfd&logo=github)](https://github.com/ada87/dsh-tag)

DeepSeek Harness のセッションとワークスペースに色付きのタグを付けます。1 行に 1 つのタグ、タイトルはその色になり、ワークスペース一覧の上のバーでタグ絞り込みができます。

![2 つのワークスペース、色付きタイトル、フィルターバー](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/sidebar.png)

## インストール

プラグイン → プラグインを追加 → `dsh-tag`

![プラグインを追加](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/install.png)

## 使い方

- セッションまたはワークスペースの見出しを右クリック → **タグ** → 色を選択
- ワークスペースのタグはグループ全体を覆います
- ワークスペース一覧の上の色をクリックすると絞り込み。一致したグループは件数付きで開きます
- 設定 → **DSH Tag**：名前変更、色変更、削除、追加。最大 10 個、色は重複不可
- 使わないときはフィルターバーを非表示にできます

![DSH Tag 設定](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/settings.png)

API、色、互換性、開発: [docs/REFERENCE.md](https://github.com/ada87/dsh-tag/blob/main/docs/REFERENCE.md)。

MIT
