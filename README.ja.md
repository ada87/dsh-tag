<p align="center"><img src="icon.svg" alt="dsh-tag" width="96" height="96"></p>

# dsh-tag

[English](README.md) | [中文](README.zh.md) | 日本語

![version](https://img.shields.io/badge/version-0.1.0-blue) ![DSH](https://img.shields.io/badge/DSH-0.2.2--rc.1-4D6BFE) ![license](https://img.shields.io/badge/license-MIT-green) ![languages](https://img.shields.io/badge/UI_languages-8-8B5CF6)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) のセッションとワークスペースに色付きのタグを付けます。右クリックでタグを選ぶとタイトルがその色になり、サイドバー上部のカラーバーをクリックすれば、そのタグのセッションだけを表示できます。

![タグ付きのタイトルとフィルターバー](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/sidebar.png)

## 機能

### 1 セッションに 1 つのタグ、1 つのタグに 1 つの色

セッションを右クリックするか行末の `...` を開き、タグを選びます。1 行に付くタグは 1 つだけです。別のタグを選ぶと置き換わり、チェック済みのタグをもう一度選ぶと解除されます。タイトルはタグの色で描画され、行にカーソルを合わせるとタグ名が表示されます。

ワークスペースも同じです。ワークスペースに付けたタグはグループ全体を覆い、フィルターバーでそのグループをまとめて絞り込む根拠になります。

![タグのサブメニュー](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/menu.png)

### サイドバーのためのフィルターバー

タグが増えたら、ワークスペース一覧の上のカラーバーが近道です。

- 色をクリックすると、そのタグが付いたセッションだけを表示
- ワークスペースに付いたタグはグループ全体を対象にし、一致したグループは自動で開いて件数を表示
- 一致しないグループは非表示になり、結果は「展開が必要な木」ではなく 1 つのリストとして読めます
- 同じ色をもう一度、または虹色の **All** をクリックすると元に戻ります（フィルターが開いたグループも含む）

![1 つのタグで絞り込む](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/filter.png)

バーが不要なら、設定 → タグ で **Show filter bar** をオフにします。設定はタグと一緒に保存されるため、どのクライアントでも同じサイドバーになります。オフにすると現在のフィルターも解除され、見えないまま行が隠れる状態にはなりません。

### 邪魔をしない設定画面

設定 → タグ はカードの一覧です。その場で名前を変更し、まだ使われていない色に変え、確認 1 回で削除、下部から新規作成できます。

- タグは最大 10 個、色は重複不可
- 使用済みの色は選択肢から消えます
- カードの枠がタグの色を帯び、編集時は濃くなります
- 上限に達すると追加行は表示されません

![タグ設定](https://raw.githubusercontent.com/ada87/dsh-tag/main/docs/images/settings.png)

### ライトでもダークでも読める

タイトル文字は 500 系の塗り色をそのまま使わず、テーマごとに 2 色を用意しています。ライトは最低 4.8:1、ダークは 6.1:1。テーマを切り替えると、再読み込みなしでタイトルと設定画面の文字色が変わります。

### 共有されるデータ

- 状態は `<DSH_HOME>/state/dsh-tag.json` に保存
- 複数ウィンドウ・端末は SSE で同期
- `GET /tags` は公開・読み取り専用で、アプリや他のプラグインから同じタグを描画できます

## インストール

**プラグインセンター（npm 公開後）**

設定 → プラグイン → プラグインを追加 で `dsh-tag` を入力し、インストールして有効化します。

**CLI から DSH Web に入れる**

```sh
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add dsh-tag
npx @deepseek-ai/dsh@0.2.2-rc.1 web
```

**ローカルのチェックアウトから**

```sh
npx @deepseek-ai/dsh@0.2.2-rc.1 plugin --profile web add /absolute/path/to/dsh-tag
```

インストールや再ビルドの後は `Ctrl+Shift+R` で Web UI をハードリロードしてください。

## 使い方

1. **セッションにタグ** — 行を右クリック、または `...` → **Tags** → 色を選択。チェックが付いているものが現在のタグで、もう一度選ぶと解除されます。
2. **ワークスペースにタグ** — ワークスペースの見出しを右クリック → **Workspace tags**。グループ全体に色が付きます。
3. **絞り込み** — バーの丸をクリック。一致したワークスペースは件数付きで開き、空のグループは消えます。**All** で解除。
4. **管理** — 設定 → タグ。タグを削除すると、すべてのセッションとワークスペースからも外れます。

## 色

| 名前 | 色 | 名前 | 色 |
|---|---|---|---|
| `green` | `#22C55E` | `amber` | `#F59E0B` |
| `blue` | `#3B82F6` | `red` | `#EF4444` |
| `purple` | `#A855F7` | `gray` | `#6B7280` |
| `teal` | `#06B6D4` | `pink` | `#EC4899` |
| `indigo` | `#4F46E5` | `brown` | `#8D5B3E` |

10 色は色相をできるだけ離し、青 / インディゴ / 紫は明度でも区別しています。色見本とフィルターバーは固定 hex、タイトル文字とカード枠はテーマに追従します。

## API

パスはすべて `/tags` 配下です（`/session-tags` はありません）。

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/tags` | スナップショット全体（公開） |
| GET | `/tags/events` | SSE：接続時と変更時に全体を送信 |
| GET | `/tags/health` | 機能検出 |
| POST | `/tags` | 作成 `{ label, color }` |
| PATCH | `/tags/settings` | 表示設定 `{ showFilter?: boolean }` |
| PATCH | `/tags/:id` | 名前・色・順序 `{ label?, color?, order? }` |
| DELETE | `/tags/:id` | 削除と関連の解除 |
| PUT | `/tags/sessions/:id` | `{ tagId: string \| null }` |
| PUT | `/tags/workspaces/:id` | `{ tagId, path? }` |

読み取りは公開、書き込みは同一オリジン、loopback、または認証済みの dsh 接続が必要です。

```json
{
  "version": 2,
  "updatedAt": 1760000000000,
  "settings": { "showFilter": true },
  "tags": [
    { "id": "design", "label": "Design", "color": "purple", "order": 10 }
  ],
  "sessions": { "session-xxx": "design" },
  "workspaces": [
    { "id": "workspace-id", "path": "D:\\work\\demo", "tagId": "code" }
  ]
}
```

## 互換性

```json
"engines": { "dsh": ">=0.2.2-rc.1 <0.3.0" }
```

dsh はこのフィールドを semver（prerelease 含む）で検証し、満たさない場合は読み込みを拒否します。下限は実際に開発・検証しているバージョンです。

依存の大半はブラウザ側にあります：`locale`、`contextMenus`、`slots`、および段階フィルター用の `workspaces` / `sessions` スナップショット。タイトルの着色と絞り込みは内部 DOM 属性（`data-row-key`、`[class*="_title"]`）にも依存します。任意サービスがない場合、フィルターは現在描画されている行だけに退化し、スロットがない場合はその入口が表示されません。

0.2.1 には設定項目のアイコンスロットがなく、言語カタログも `zh` / `en` のみのため、下限を下げていません。dsh を更新したら、タイトルの着色、フィルターバーの表示、設定画面、言語切り替えを確認してください。

## 多言語

UI は **English、简体中文、日本語、Español、Français、Deutsch、Русский、Português** を同梱します。辞書は `ctx.locale.register` で登録し、キーがなければ英語にフォールバックします。初回の状態ファイル作成時、既定タグ名は Host の言語に合わせて生成され、後から変更できます。

## 開発

```sh
npm install
npm run build      # tsc + esbuild + クライアント構文チェック
npm run typecheck
npm run test:host  # 一時 DSH_HOME に対する /tags スモークテスト
```

```
cordis.patch.yml   bundle への挿入
src/index.ts       Host：/tags ルート、SSE、認証
src/store.ts       JSON 状態、設定、既定タグ
src/protocol.ts    ワイヤープロトコル
client/client.js   ブラウザ側：着色、メニュー、フィルター、設定、8 言語
locale/*.json      プラグイン一覧の文言
```

既知の制限：

- タイトルの着色は dsh の `[class*="_title"]` CSS Modules 命名に依存
- アーカイブ済みセッションは灰色のまま
- 検索結果の行には `data-row-key` がなく、着色も絞り込みもされない
- 「Ungrouped」グループには workspaceId がなく、タグを付けられない

## License

MIT
