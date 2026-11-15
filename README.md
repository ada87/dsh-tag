# dsh-tag

给 DeepSeek Harness（dsh）的**会话和工作区**加颜色标签：

- 右键会话或工作区 → **标签** → 二级菜单，点一下打标签；再点当前标签即清除
- 每个行只有一个标签；标题颜色就是标签颜色
- 会话列表上方有一条**颜色过滤条**：色块 + 悬停显示 label，点一下只看该标签的会话，再点或点「全部」恢复
- 悬停会话时显示标签名
- 设置 → **内置插件 → 标签** 里改名、换色、删除、新增
- 状态保存在 `<DSH_HOME>/state/dsh-tag.json`，窗口/设备通过 SSE 实时同步
- 只读 API `GET /tags`，方便 App / 第三方插件读取

默认标签：**设计 / 编码 / 运营 / 临时**。

## 安装

开发期（本地路径）：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-tag
```

npm 发布后：

```sh
dsh plugin --profile web add dsh-tag
```

装完硬刷新 dsh Web（`Ctrl+Shift+R`）。

## 使用

- **会话**：右键会话行（或 `...` 菜单）→ 标签 → 点选。当前标签前面有 `✓`；再点一次清除。
- **工作区**：右键工作区行 → 工作区标签 → 点选，行为一致。
- **过滤**：会话列表上方的色块就是过滤条；鼠标悬停显示标签名，点击只显示该标签的会话；点「全部」或再点同一个色块恢复。
- **管理**：设置 → 内置插件 → 标签。删除标签会同时清掉它所有的会话/工作区标记。

## API

所有路径都在 `/tags` 下，**没有 `/session-tags`**。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tags` | 完整快照（公开读） |
| GET | `/tags/events` | SSE，连接时推全量，变更再推 |
| GET | `/tags/health` | 能力探测 |
| POST | `/tags` | 新建标签 `{ label, color }` |
| PATCH | `/tags/:id` | 改名/换色/排序 `{ label?, color?, order? }` |
| DELETE | `/tags/:id` | 删除标签并清空关联 |
| PUT | `/tags/sessions/:id` | `{ tagId: string \| null }`（`null` 清除） |
| PUT | `/tags/workspaces/:id` | `{ tagId, path? }` |

读接口公开；写接口要求同源请求、loopback 或 dsh 已认证连接。

### 快照

```json
{
  "version": 1,
  "updatedAt": 1760000000000,
  "tags": [
    { "id": "design", "label": "设计", "color": "purple", "order": 10 },
    { "id": "code", "label": "编码", "color": "blue", "order": 20 }
  ],
  "sessions": {
    "session-xxx": "design"
  },
  "workspaces": [
    { "id": "workspace-id", "path": "D:\\work\\demo", "tagId": "code" }
  ]
}
```

`workspaces[].path` 从 dsh 工作区注册表实时读取，读不到时回退到赋值时保存的路径，手机端可以按 id 或 path 匹配。

### 颜色

`green` / `amber` / `blue` / `red` / `purple` / `gray`，或 `#rrggbb`。命名颜色在标题上映射到 dsh 主题 token，换深浅色不会突兀；过滤条和菜单圆点使用固定 hex。

## 存储

`<DSH_HOME>/state/dsh-tag.json`，结构：

```json
{
  "version": 1,
  "tags": [{ "id": "design", "label": "设计", "color": "purple", "order": 10, "createdAt": 1760000000000 }],
  "sessions": { "<sessionId>": "design" },
  "workspaces": { "<workspaceId>": { "tagId": "code", "path": "D:\\work\\demo" } }
}
```

写入使用临时文件 + rename，避免半截文件。插件不依赖 `storageDomain`，所以任何 profile 都能装。旧的多标签数组会自动收敛到最后一个标签。

## 手机端（后续）

`/tags` 公开可读，App 可以直接：

1. 读 `/tags` 拿到标签定义、会话/工作区赋值和路径
2. 在会话/工作区列表里显示颜色
3. 先做本地筛选，不需要服务端额外接口

写操作目前只开放给 Web；手机要改标签时，后续可以让 dsh-door 代理，避免再引入一套 token。

## 开发

```sh
npm install
npm run build      # tsc + esbuild + client 语法检查
npm run typecheck
npm run test:host  # 临时 DSH_HOME 的 /tags 冒烟测试
```

结构：

```
cordis.patch.yml   bundle 插入行
src/index.ts       Host：/tags 路由、SSE、鉴权
src/store.ts       JSON 文件状态 + 快照
src/protocol.ts    线协议
client/client.js   浏览器半：着色、右键子菜单、过滤条、设置页、悬停
```

## 已知边界

- 标题着色依赖 dsh 的 `[class*="_title"]` CSS Modules 命名，升级 dsh 后需要回归
- 归档会话保持灰色，标签色不会覆盖
- 搜索结果行没有 `data-row-key`，不会着色，也不会被过滤条隐藏
- 「Ungrouped」组没有 workspaceId，不能打标签
- 过滤条只筛会话，不筛工作区
- 过滤条只处理当前渲染出来的会话行；折叠工作区里的会话需要先展开（空状态会提示“当前列表里没有…”）
- 删除标签不是跨文件事务，但一次写入完成；读快照时会过滤悬空引用

## License

MIT
