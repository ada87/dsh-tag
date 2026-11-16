/**
 * Browser half of dsh-tag.
 *
 * - Colors session and workspace titles with generated CSS rules keyed by the
 *   stable `data-row-key` attribute (no DOM mutation per row).
 * - Adds a "Tags" submenu to the session and workspace context menus. Each row
 *   carries one tag: click to apply, click the checked tag to remove.
 * - Settings page renames, recolors and deletes tags.
 * - The colour bar above the session list filters sessions; it uses the
 *   `workspaces`/`sessions` services to open matching groups and hide empty
 *   ones, then hides non-matching rows with generated CSS.
 *
 * Reads `/tags`; mutations go to `/tags/...` with the dsh browser session.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tag',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dshTag'
    const API = '/tags'
    const EVENTS = '/tags/events'
    const SWATCHES = [
      'green', 'amber', 'blue', 'red', 'purple',
      'gray', 'teal', 'pink', 'indigo', 'brown',
    ]

    /** Concrete colors for menu dots and settings swatches. */
    const HEX = {
      green: '#22C55E',
      amber: '#F59E0B',
      blue: '#3B82F6',
      red: '#EF4444',
      purple: '#8B5CF6',
      gray: '#6B7280',
      teal: '#14B8A6',
      pink: '#EC4899',
      indigo: '#6366F1',
      brown: '#A2845E',
    }

    /** Theme-aware colors for title text. */
    const PALETTE = {
      green: 'var(--dsw-alias-state-success-primary)',
      amber: 'var(--dsw-alias-state-warn-primary)',
      blue: 'var(--dsw-alias-state-business-primary)',
      red: 'var(--dsw-alias-state-error-primary)',
      purple: '#8B5CF6',
      gray: 'var(--dsw-alias-label-caption)',
      teal: '#14B8A6',
      pink: '#EC4899',
      indigo: '#6366F1',
      brown: '#A2845E',
    }

    const zh = {
      nav: '标签',
      menuSession: '标签',
      menuWorkspace: '工作区标签',
      clear: '清除标签',
      noTags: '还没有标签，先去 设置 → 标签 创建',
      newPlaceholder: '新标签文字…',
      add: '添加',
      remove: '删除',
      confirmDelete: '删除标签「{label}」？对应标记也会清除。',
      settingsTitle: '标签',
      settingsDesc: '会话和工作区共用同一套标签。右键会话或工作区即可打标签；标题颜色就是标签颜色。过滤时，标在工作区上的标签会带出整组会话，标在会话上的只带出该会话。',
      empty: '还没有标签，先创建一个。',
      failed: '标签操作失败',
      limit: '最多支持 10 个标签',
      noColors: '没有可用的颜色了',
      cycleColor: '切换颜色',
      color: '颜色',
      filterAll: '全部',
      filterTitle: '按标签过滤会话',
      filterEmpty: '没有带「{label}」标签的会话',
      filterWorkspaceEmpty: '「{label}」标在工作区上；这个工作区下暂无会话',
    }

    const en = {
      nav: 'Tags',
      menuSession: 'Tags',
      menuWorkspace: 'Workspace tags',
      clear: 'Clear tag',
      noTags: 'No tags yet — create one in Settings → Tags',
      newPlaceholder: 'New tag label…',
      add: 'Add',
      remove: 'Delete',
      confirmDelete: 'Delete “{label}”? Its assignments will be cleared.',
      settingsTitle: 'Tags',
      settingsDesc: 'Sessions and workspaces share this tag set. Right-click either to set a tag; the title uses the tag color. Filtering by a workspace tag includes its whole group; a session tag only includes that session.',
      empty: 'No tags yet — create one below.',
      failed: 'Tag update failed',
      limit: 'At most 10 tags are supported',
      noColors: 'No colors left',
      cycleColor: 'Change color',
      color: 'Color',
      filterAll: 'All',
      filterTitle: 'Filter sessions by tag',
      filterEmpty: 'No sessions tagged “{label}”',
      filterWorkspaceEmpty: '“{label}” is on a workspace; it holds no sessions yet',
    }

    const CSS = `
.dsh-tag-error{margin:8px 0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-tag-dot{flex:none;width:9px;height:9px;border-radius:50%;display:inline-block}
.dsh-tag-input{flex:1;min-width:120px;box-sizing:border-box;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.06));color:inherit;font:inherit;outline:none}
.dsh-tag-input:focus{border-color:var(--dsw-alias-state-business-primary,#3d7bfd)}
.dsh-tag-swatches{display:flex;align-items:center;gap:5px}
.dsh-tag-swatch{width:20px;height:20px;padding:0;border:2px solid transparent;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);background-image:radial-gradient(circle at 32% 26%,rgba(255,255,255,.5),rgba(255,255,255,0) 48%)}
.dsh-tag-swatch.is-current{border-color:var(--dsw-alias-label-primary,#111);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 0 0 1px var(--dsw-alias-label-primary,#111)}
.dsh-tag-swatch.is-used{opacity:.22;cursor:not-allowed}
.dsh-tag-dotWrap{position:relative;display:flex;align-items:center;flex:none}
.dsh-tag-pickerButton{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;cursor:pointer}
.dsh-tag-pickerButton:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dsh-tag-pickerButton:disabled{cursor:default;opacity:.45}
.dsh-tag-pickerButton .dsh-tag-dot{width:22px;height:22px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1),0 0 0 2px var(--dsw-alias-surface-primary,#fff),0 1px 3px rgba(0,0,0,.18);background-image:radial-gradient(circle at 32% 26%,rgba(255,255,255,.55),rgba(255,255,255,0) 48%)}
.dsh-tag-colorMenu{position:absolute;top:calc(100% + 5px);left:0;z-index:30;display:flex;align-items:center;gap:7px;padding:9px;border-radius:12px;background:var(--dsw-alias-surface-primary,#fff);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.22));box-shadow:0 10px 28px rgba(0,0,0,.2)}
.dsh-tag-colorMenu.is-right{left:auto;right:0}
.dsh-tag-dotButton{display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer}
.dsh-tag-dotButton:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dsh-tag-dotButton:disabled{cursor:default;opacity:.5}
.dsh-tag-hint{margin:0;padding:0 2px;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-primary{height:32px;padding:0 14px;border:0;border-radius:8px;background:var(--dsw-alias-state-business-primary,#3d7bfd);color:#fff;font:inherit;font-size:13px;cursor:pointer}
.dsh-tag-primary:disabled{opacity:.45;cursor:default}
.dsh-tag-secondary{height:32px;padding:0 12px;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dsh-tag-secondary:disabled{opacity:.45;cursor:default}
.dsh-tag-delete{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer}
.dsh-tag-delete:hover{background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff}
.dsh-tag-delete:disabled{opacity:.45;cursor:default}
.dsh-tag-create{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}
.dsh-tag-create .dsh-tag-input{flex:1;min-width:140px;border:0;background:transparent}
.dsh-tag-addIcon{display:flex;align-items:center;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-settings{display:flex;flex-direction:column;gap:14px;width:100%}
.dsh-tag-settingsHead{display:flex;flex-direction:column;gap:4px}
.dsh-tag-settingsTitle{margin:0;font-size:18px;font-weight:600;line-height:26px;color:var(--dsw-alias-label-primary,#111)}
.dsh-tag-settingsDesc{margin:0;font-size:13px;line-height:19px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-settingsList{display:flex;flex-direction:column;gap:2px;padding:0;border-radius:0;background:transparent}
.dsh-tag-rowWrap{display:flex;flex-direction:column;padding:0 4px;border-radius:8px}
.dsh-tag-rowWrap:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}
.dsh-tag-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:2px 0;border-bottom:0}
.dsh-tag-row .dsh-tag-input{flex:1;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent}
.dsh-tag-row .dsh-tag-input:focus{background:var(--dsw-alias-surface-primary,#fff);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary,#3d7bfd)}
.dsh-tag-settingsCreate{padding-top:12px}
.dsh-tag-empty{padding:10px 0;font-size:13px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-hover{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;line-height:17px;color:#cfd3d6}
.dsh-tag-hoverItem{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-tag-filterWrap{flex:none;box-sizing:border-box;width:100%}
.dsh-tag-filter{display:flex;align-items:center;gap:6px;flex:none;box-sizing:border-box;width:100%;padding:2px var(--dsh-sidebar-row-padding,8px) 6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.dsh-tag-filter::-webkit-scrollbar{display:none}
.dsh-tag-filterAll{position:relative;width:22px;height:22px;padding:0;border:0;border-radius:50%;flex:none;cursor:pointer;background:conic-gradient(#22C55E 0 36deg,#F59E0B 36deg 72deg,#3B82F6 72deg 108deg,#EF4444 108deg 144deg,#8B5CF6 144deg 180deg,#6B7280 180deg 216deg,#14B8A6 216deg 252deg,#EC4899 252deg 288deg,#6366F1 288deg 324deg,#A2845E 324deg 360deg);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:transform .15s ease,box-shadow .15s ease}
.dsh-tag-filterAll::after{content:'';position:absolute;inset:5px;border-radius:50%;background:var(--dsw-alias-surface-primary,#fff)}
.dsh-tag-filterAll:hover{transform:scale(1.08)}
.dsh-tag-filterAll.is-active{transform:scale(1.08);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.2)}
.dsh-tag-filterBlock{position:relative;width:22px;height:22px;padding:0;border:0;border-radius:7px;flex:none;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);background-image:radial-gradient(circle at 32% 26%,rgba(255,255,255,.45),rgba(255,255,255,0) 48%);transition:transform .15s ease,box-shadow .15s ease}
.dsh-tag-filterBlock:hover{transform:scale(1.08)}
.dsh-tag-filterBlock.is-active{transform:scale(1.1);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.28)}
.dsh-tag-filterBlock.is-active::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.dsh-tag-filterEmpty{padding:2px var(--dsh-sidebar-row-padding,8px) 8px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#888)}
`

    /** Menu dot as an inline SVG so every tag carries its own color. */
    function dotSrc(color) {
      const fill = HEX[color] || (/^#[0-9a-f]{6}$/i.test(color) ? color : HEX.gray)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${fill}"/></svg>`
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    function DotIcon({ icon }) {
      if (!icon || typeof icon.src !== 'string') return null
      return h('img', { src: icon.src, width: 12, height: 12, alt: '', style: { display: 'block' } })
    }

    function TagIcon({ size = 16, active }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M2.5 2.5h6.1l4.9 4.9a1.2 1.2 0 0 1 0 1.7l-3.2 3.2a1.2 1.2 0 0 1-1.7 0L2.5 8.6V2.5z',
          fill: active ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('circle', {
          cx: 5.2,
          cy: 5.2,
          r: 1,
          fill: active ? 'var(--dsw-alias-surface-primary,#fff)' : 'currentColor',
        }))
    }

    return {
      inject: ['slots', 'locale', 'contextMenus'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-tag: copy')
        const t = ctx.locale.bind(NS)

        const baseStyle = document.createElement('style')
        baseStyle.dataset.dshTag = ''
        baseStyle.textContent = CSS
        document.head.append(baseStyle)
        const colorStyle = document.createElement('style')
        colorStyle.dataset.dshTagColor = ''
        document.head.append(colorStyle)
        const filterStyle = document.createElement('style')
        filterStyle.dataset.dshTagFilter = ''
        document.head.append(filterStyle)

        // ── Data ───────────────────────────────────────────────────────────────
        let state = { tags: [], sessions: {}, workspaces: [], loaded: false, error: null }
        const listeners = new Set()
        function emit() {
          for (const listener of [...listeners]) listener()
        }
        function setState(patch) {
          state = { ...state, ...patch }
          emit()
          paint()
        }
        function subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
        function getState() {
          return state
        }

        function swatch(color) {
          return HEX[color] || (/^#[0-9a-f]{6}$/i.test(color) ? color : HEX.gray)
        }
        function textColor(color) {
          return PALETTE[color] || (/^#[0-9a-f]{6}$/i.test(color) ? color : PALETTE.gray)
        }
        function colorOfTag(tagId) {
          const tag = state.tags.find(item => item.id === tagId)
          return tag === undefined ? null : textColor(tag.color)
        }
        function paint() {
          const rules = []
          for (const [sessionId, tagId] of Object.entries(state.sessions)) {
            const color = colorOfTag(tagId)
            if (color !== null) rules.push(rule('session', sessionId, color))
          }
          for (const workspace of state.workspaces) {
            const color = colorOfTag(workspace.tagId)
            if (color !== null) rules.push(rule('workspace', workspace.id, color))
          }
          colorStyle.textContent = rules.join('\n')
          renderFilter()
          applyFilter()
        }
        function rule(kind, id, color) {
          const safe = String(id).replace(/["\\\r\n]/g, '')
          return `[data-row-key="${kind}:${safe}"] [class*="_title"]{color:${color}}`
        }

        function tagIdOf(value) {
          if (typeof value === 'string') return value
          if (Array.isArray(value)) {
            for (let index = value.length - 1; index >= 0; index -= 1) {
              if (typeof value[index] === 'string') return value[index]
            }
            return undefined
          }
          if (value !== null && typeof value === 'object') {
            if (typeof value.tagId === 'string') return value.tagId
            if (Array.isArray(value.tagIds)) return tagIdOf(value.tagIds)
          }
          return undefined
        }

        function normalize(data) {
          const tags = Array.isArray(data && data.tags) ? data.tags : []
          const sessions = {}
          if (data && data.sessions && typeof data.sessions === 'object') {
            for (const [id, value] of Object.entries(data.sessions)) {
              const tagId = tagIdOf(value)
              if (tagId !== undefined) sessions[id] = tagId
            }
          }
          const workspaces = (Array.isArray(data && data.workspaces) ? data.workspaces : [])
            .map(item => {
              const tagId = tagIdOf(item)
              return {
                id: String((item && item.id) || ''),
                ...(item && typeof item.path === 'string' ? { path: item.path } : {}),
                tagId,
              }
            })
            .filter(item => item.id.length > 0 && typeof item.tagId === 'string' && item.tagId.length > 0)
          return { tags, sessions, workspaces }
        }

        // ── Filter bar ─────────────────────────────────────────────────────────
        const FILTER_KEY = 'dsh.tag.filter.v1'
        let filterTagId = readFilter()
        let filterWrap = null
        let filterBar = null
        let filterEmpty = null
        let filterObserver = null
        let filterTimer = 0
        let filterSignature = ''

        /**
         * Live list data from dsh's workspace and session services. The DOM only
         * contains expanded rows, so hiding non-matching rows is not enough to
         * build a real filter: counts, empty groups and auto-expansion need the
         * whole tree. Both services are optional so an older dsh still works.
         */
        let workspaceMembers = null // Map<workspaceId, Set<sessionId>>
        let sessionCatalog = null // Set<sessionId>
        let archivedSessions = new Set()
        /** Workspace row keys this filter opened; closed again when it clears. */
        const autoExpanded = new Set()
        /** Groups whose "show more sessions" button the filter pressed. */
        const autoRevealed = new Set()
        /** Groups the user collapsed while a filter is active; never re-open them. */
        const userCollapsed = new Set()
        let autoClicking = 0

        function readFilter() {
          try {
            const value = window.localStorage.getItem(FILTER_KEY)
            return typeof value === 'string' && value.length > 0 ? value : null
          } catch {
            return null
          }
        }
        function writeFilter() {
          try {
            if (filterTagId === null) window.localStorage.removeItem(FILTER_KEY)
            else window.localStorage.setItem(FILTER_KEY, filterTagId)
          } catch {
            // Blocked storage only loses persistence; the filter still applies.
          }
        }
        function clearFilter() {
          restoreExpanded()
          userCollapsed.clear()
          filterTagId = null
          writeFilter()
          renderFilter()
          applyFilter()
        }
        function selectFilter(tagId) {
          if (tagId === filterTagId) {
            clearFilter()
            return
          }
          // Groups opened for the previous tag go back to their saved state,
          // except those that also match the new tag and stay open.
          restoreExpanded(expandedKeys(computeGroups(tagId)))
          userCollapsed.clear()
          filterTagId = tagId
          writeFilter()
          renderFilter()
          applyFilter()
        }
        function cssSafe(value) {
          return String(value).replace(/["\\\r\n]/g, '')
        }
        /** Our own writes are not React updates; pausing the observer avoids feedback loops. */
        function withoutFilterObserver(task) {
          if (filterObserver !== null) filterObserver.disconnect()
          try {
            return task()
          } finally {
            if (filterObserver !== null) {
              filterObserver.observe(document.body, { childList: true, subtree: true })
            }
          }
        }
        function ensureFilterWrap() {
          if (filterWrap !== null) return filterWrap
          filterWrap = document.createElement('div')
          filterWrap.className = 'dsh-tag-filterWrap'
          filterBar = document.createElement('div')
          filterBar.className = 'dsh-tag-filter'
          filterBar.setAttribute('role', 'toolbar')
          filterBar.setAttribute('aria-label', t('filterTitle'))
          filterEmpty = document.createElement('div')
          filterEmpty.className = 'dsh-tag-filterEmpty'
          filterEmpty.hidden = true
          filterWrap.append(filterBar, filterEmpty)
          return filterWrap
        }
        /** Rebuild the colour blocks only when the tag list or the selection changed. */
        function renderFilter() {
          if (filterWrap === null) return
          const tags = state.tags
          filterWrap.hidden = tags.length === 0
          if (tags.length === 0) {
            if (filterSignature !== '') {
              filterSignature = ''
              withoutFilterObserver(() => filterBar.replaceChildren())
            }
            if (filterTagId !== null && state.loaded) {
              restoreExpanded()
              filterTagId = null
              writeFilter()
            }
            filterEmpty.hidden = true
            return
          }
          if (filterTagId !== null && !tags.some(tag => tag.id === filterTagId)) {
            filterTagId = null
            writeFilter()
            restoreExpanded()
          }
          // The MutationObserver re-mounts the bar after React updates. Rebuilding
          // the buttons on every pass would replace the node between a real
          // pointerdown and click, so the click would be lost.
          const signature = JSON.stringify([filterTagId, tags.map(tag => [tag.id, tag.label, tag.color, tag.order])])
          if (signature === filterSignature) return
          filterSignature = signature
          const all = document.createElement('button')
          all.type = 'button'
          all.className = 'dsh-tag-filterAll' + (filterTagId === null ? ' is-active' : '')
          all.title = t('filterAll')
          all.setAttribute('aria-label', t('filterAll'))
          all.setAttribute('aria-pressed', String(filterTagId === null))
          all.addEventListener('click', clearFilter)
          const blocks = tags.map(tag => {
            const block = document.createElement('button')
            block.type = 'button'
            block.className = 'dsh-tag-filterBlock' + (filterTagId === tag.id ? ' is-active' : '')
            block.style.backgroundColor = swatch(tag.color)
            block.title = tag.label
            block.setAttribute('aria-label', tag.label)
            block.setAttribute('aria-pressed', String(filterTagId === tag.id))
            block.addEventListener('click', () => selectFilter(tag.id))
            return block
          })
          withoutFilterObserver(() => filterBar.replaceChildren(all, ...blocks))
        }
        /** The session list's scroll container and the node to insert the bar before. */
        function filterAnchor() {
          // Workspace rows are also present when every group is collapsed, so the
          // bar can be mounted even before a single session row is rendered.
          const rows = document.querySelectorAll('[data-row-key^="session:"], [data-row-key^="workspace:"], [data-row-key="empty"]')
          if (rows.length === 0) return null
          let node = rows[0]
          while (node !== null && node !== document.body) {
            const overflow = getComputedStyle(node).overflowY
            if (overflow === 'auto' || overflow === 'scroll') {
              const parent = node.parentElement
              if (parent === null) return null
              return { parent, before: node }
            }
            node = node.parentElement
          }
          return null
        }
        function mountFilter() {
          const place = filterAnchor()
          if (place === null) return false
          const wrap = ensureFilterWrap()
          if (wrap.parentElement !== place.parent) {
            withoutFilterObserver(() => place.parent.insertBefore(wrap, place.before))
          }
          renderFilter()
          return true
        }

        /**
         * Every existing session carrying the tag, as far as dsh's own list is
         * concerned. Derived data is unavailable on older builds, and then the
         * filter falls back to the rows currently in the DOM.
         */
        function computeGroups(tagId) {
          if (workspaceMembers === null || sessionCatalog === null) return null
          const live = (sessionId) => sessionCatalog.has(sessionId) && !archivedSessions.has(sessionId)
          const tagged = new Set()
          for (const [sessionId, owner] of Object.entries(state.sessions)) {
            if (owner !== tagId) continue
            if (!live(sessionId)) continue
            tagged.add(sessionId)
          }
          // A workspace tag covers its whole group: the workspace is a tagged
          // entity, so its sessions share the result. Session tags stay local.
          const taggedWorkspaces = new Set()
          for (const workspace of state.workspaces) {
            if (workspace.tagId === tagId) taggedWorkspaces.add(workspace.id)
          }
          const matched = new Set(tagged)
          for (const workspaceId of taggedWorkspaces) {
            const ids = workspaceMembers.get(workspaceId)
            if (ids === undefined) continue
            for (const id of ids) {
              if (live(id)) matched.add(id)
            }
          }
          const byWorkspace = new Map()
          const taggedByWorkspace = new Map()
          const grouped = new Set()
          for (const [workspaceId, ids] of workspaceMembers) {
            const hits = new Set()
            const own = new Set()
            for (const id of ids) {
              grouped.add(id)
              if (matched.has(id)) hits.add(id)
              if (tagged.has(id)) own.add(id)
            }
            taggedByWorkspace.set(workspaceId, own)
            byWorkspace.set(workspaceId, hits.size)
          }
          const ungroupedIds = new Set()
          for (const id of matched) {
            if (!grouped.has(id)) ungroupedIds.add(id)
          }
          return {
            tagged,
            taggedWorkspaces,
            matched,
            byWorkspace,
            taggedByWorkspace,
            ungroupedIds,
            ungrouped: ungroupedIds.size,
            total: matched.size,
          }
        }

        function renderedSessionIds() {
          const ids = new Set()
          for (const row of document.querySelectorAll('[data-row-key^="session:"]')) {
            ids.add((row.getAttribute('data-row-key') || '').slice('session:'.length))
          }
          return ids
        }

        function renderedMatches(tagId) {
          const ids = renderedSessionIds()
          let count = 0
          for (const id of ids) {
            if (state.sessions[id] === tagId) count += 1
          }
          return count
        }

        /** Row keys of the groups that hold at least one match. */
        function expandedKeys(groups) {
          const keys = new Set()
          if (groups === null) return keys
          for (const [workspaceId, count] of groups.byWorkspace) {
            if (count > 0) keys.add(`workspace:${workspaceId}`)
          }
          if (groups.ungrouped > 0) keys.add('workspace:')
          return keys
        }

        /**
         * Open the groups that hold matches so the filter reads like a result
         * list instead of a tree the user has to unfold. Only groups this filter
         * opened are recorded, and clearing it closes exactly those again.
         */
        function expandMatches(groups) {
          for (const key of expandedKeys(groups)) {
            if (autoExpanded.has(key) || userCollapsed.has(key)) continue
            const row = document.querySelector(`[data-row-key="${cssSafe(key)}"]`)
            if (row === null || row.getAttribute('aria-expanded') !== 'false') continue
            autoClicking += 1
            try {
              // The group header's own onClick toggles and persists expansion.
              row.click()
            } finally {
              autoClicking -= 1
            }
            autoExpanded.add(key)
          }
        }
        function restoreExpanded(keep) {
          if (autoRevealed.size !== 0) {
            for (const key of [...autoRevealed]) {
              if (keep !== undefined && keep.has(key)) continue
              autoRevealed.delete(key)
              const group = key.slice('workspace:'.length)
              const button = document.querySelector(`[data-row-key="overflow:${cssSafe(group)}"]`)
              if (button === null || button.getAttribute('aria-expanded') !== 'true') continue
              autoClicking += 1
              try {
                button.click()
              } finally {
                autoClicking -= 1
              }
            }
          }
          if (autoExpanded.size === 0) return
          const keys = [...autoExpanded]
          autoExpanded.clear()
          for (const key of keys) {
            if (keep !== undefined && keep.has(key)) {
              // Still relevant to the next filter: leave it open and owned.
              autoExpanded.add(key)
              continue
            }
            const row = document.querySelector(`[data-row-key="${cssSafe(key)}"]`)
            if (row === null || row.getAttribute('aria-expanded') !== 'true') continue
            autoClicking += 1
            try {
              row.click()
            } finally {
              autoClicking -= 1
            }
          }
        }

        /**
         * A group shows five sessions plus a "show more" row. When a match sits
         * beyond that watermark, press the row until the match is rendered so
         * the filter never points at a session the user cannot see.
         */
        function revealMatches(groups) {
          if (groups === null) return
          for (const key of expandedKeys(groups)) {
            if (userCollapsed.has(key)) continue
            const workspaceId = key.slice('workspace:'.length)
            const hits = workspaceId === '' ? groups.ungroupedIds : groups.taggedByWorkspace.get(workspaceId)
            if (hits === undefined || hits.size === 0) continue
            const missingFrom = (rendered) => {
              for (const id of hits) {
                if (!rendered.has(id)) return true
              }
              return false
            }
            if (!missingFrom(renderedSessionIds())) continue
            for (let step = 0; step < 40; step += 1) {
              const button = document.querySelector(`[data-row-key="overflow:${cssSafe(workspaceId)}"]`)
              if (button === null || button.getAttribute('aria-expanded') === 'true') break
              autoClicking += 1
              try {
                button.click()
              } finally {
                autoClicking -= 1
              }
              autoRevealed.add(key)
              if (!missingFrom(renderedSessionIds())) break
            }
          }
        }

        function updateFilterEmpty(activeTag, groups) {
          if (filterEmpty === null) return
          let text = null
          if (groups === null) {
            if (renderedMatches(activeTag.id) === 0) text = t('filterEmpty', { label: activeTag.label })
          } else if (groups.total === 0) {
            if (groups.taggedWorkspaces.size > 0) text = t('filterWorkspaceEmpty', { label: activeTag.label })
            else if (renderedMatches(activeTag.id) === 0) text = t('filterEmpty', { label: activeTag.label })
          }
          if (text !== null) {
            if (filterEmpty.textContent !== text) filterEmpty.textContent = text
            if (filterEmpty.hidden) filterEmpty.hidden = false
          } else if (!filterEmpty.hidden) {
            filterEmpty.hidden = true
          }
        }

        /**
         * Filtering is pure CSS: one rule hides every session row, later rules
         * re-show the matching ids. Groups without matches lose their header, so
         * an active filter never leaves a column of empty sections behind.
         */
        function applyFilter() {
          const activeTag = filterTagId === null ? undefined : state.tags.find(tag => tag.id === filterTagId)
          if (activeTag === undefined) {
            if (filterStyle.textContent !== '') filterStyle.textContent = ''
            if (filterEmpty !== null) filterEmpty.hidden = true
            return
          }
          const groups = computeGroups(activeTag.id)
          expandMatches(groups)
          revealMatches(groups)
          const rules = ['[data-row-key^="session:"]{display:none!important}']
          // A revealed group shows a "collapse sessions" control that a filter
          // has no use for; hidden groups lose their whole group footprint.
          rules.push('[data-row-key^="overflow:"][aria-expanded="true"]{display:none!important}')
          const show = new Set()
          for (const [sessionId, owner] of Object.entries(state.sessions)) {
            if (owner === activeTag.id) show.add(sessionId)
          }
          if (groups !== null) {
            for (const sessionId of groups.matched) show.add(sessionId)
          }
          for (const sessionId of show) {
            rules.push(`[data-row-key="session:${cssSafe(sessionId)}"]{display:flex!important}`)
          }
          if (groups !== null) {
            const hideGroup = (key) => {
              rules.push(`[data-row-key="${cssSafe(key)}"]{display:none!important}`)
              rules.push(`span:has(> [data-row-key="${cssSafe(key)}"]){display:none!important}`)
              rules.push(`[data-row-key="overflow:${cssSafe(key.slice('workspace:'.length))}"]{display:none!important}`)
            }
            const badge = (key, count) => {
              rules.push(
                `[data-row-key="${cssSafe(key)}"] [class*="_title"]::after{content:"${count}";` +
                'margin-left:6px;padding:0 5px;border-radius:7px;display:inline-block;' +
                'background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16));' +
                'color:var(--dsw-alias-label-tertiary,#888);font-size:11px;line-height:15px;font-weight:400}',
              )
            }
            for (const [workspaceId, count] of groups.byWorkspace) {
              const key = `workspace:${workspaceId}`
              if (count > 0) badge(key, count)
              // A tagged workspace belongs to the result even when it holds no
              // session; its coloured title is the only marker it needs.
              else if (!groups.taggedWorkspaces.has(workspaceId)) hideGroup(key)
            }
            if (groups.ungrouped === 0) hideGroup('workspace:')
            else badge('workspace:', groups.ungrouped)
          }
          filterStyle.textContent = rules.join('\n')
          updateFilterEmpty(activeTag, groups)
        }
        /** Collapse one burst of React mutations into one mount + filter pass. */
        function scheduleFilter() {
          if (filterTimer !== 0) return
          filterTimer = window.setTimeout(() => {
            filterTimer = 0
            mountFilter()
            applyFilter()
          }, 50)
        }

        async function refresh() {
          try {
            const response = await fetch(API, { cache: 'no-store', credentials: 'same-origin' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            setState({ ...normalize(await response.json()), loaded: true, error: null })
          } catch (error) {
            setState({ loaded: true, error: error instanceof Error ? error.message : String(error) })
          }
        }

        let source
        let retryTimer
        let disposed = false
        function connect() {
          if (disposed || source !== undefined || typeof EventSource !== 'function') return
          try {
            source = new EventSource(EVENTS)
            source.onmessage = (event) => {
              try {
                setState({ ...normalize(JSON.parse(event.data)), loaded: true, error: null })
              } catch {
                // A malformed frame is ignored; the next snapshot replaces it.
              }
            }
            source.onerror = () => {
              if (source !== undefined) {
                source.close()
                source = undefined
              }
              if (retryTimer !== undefined || disposed) return
              retryTimer = window.setTimeout(() => {
                retryTimer = undefined
                connect()
              }, 5000)
            }
          } catch {
            source = undefined
          }
        }

        async function request(method, path, body) {
          const response = await fetch(API + path, {
            method,
            credentials: 'same-origin',
            headers: body === undefined ? undefined : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
          })
          const text = await response.text()
          let data = null
          try {
            data = text.length > 0 ? JSON.parse(text) : null
          } catch {
            // Non-JSON error body; the status is enough.
          }
          if (!response.ok) {
            const message = data && data.error ? (data.error.message || data.error.code) : `HTTP ${response.status}`
            throw new Error(message)
          }
          if (data && data.snapshot) setState({ ...normalize(data.snapshot), loaded: true, error: null })
          return data
        }

        function setTag(kind, target, tagId) {
          const base = kind === 'session' ? 'sessions' : 'workspaces'
          const body = kind === 'workspace' && typeof target.path === 'string'
            ? { tagId, path: target.path }
            : { tagId }
          return request('PUT', `/${base}/${encodeURIComponent(target.id)}`, body)
        }

        /**
         * One submenu for the captured row. `resolve` runs when the menu opens,
         * so the checked state matches the latest snapshot.
         */
        function tagMenu(kind, target) {
          const current = kind === 'session'
            ? state.sessions[target.id]
            : (state.workspaces.find(item => item.id === target.id) || {}).tagId
          const parentLabel = kind === 'session' ? t('menuSession') : t('menuWorkspace')
          if (state.tags.length === 0) {
            return [{ id: 'tags', label: parentLabel, disabled: true, children: [{ id: 'empty', label: t('noTags'), disabled: true }] }]
          }
          const children = state.tags.map(tag => {
            const active = current === tag.id
            return {
              id: `tag:${tag.id}`,
              label: `${active ? '✓ ' : ''}${tag.label}`,
              icon: { key: 'dsh-tag.dot', src: dotSrc(tag.color) },
              failureLabel: t('failed'),
              run: () => setTag(kind, target, active ? null : tag.id),
            }
          })
          if (typeof current === 'string' && current.length > 0) {
            children.push({
              id: 'clear',
              label: t('clear'),
              separatorBefore: true,
              failureLabel: t('failed'),
              run: () => setTag(kind, target, null),
            })
          }
          return [{
            id: 'tags',
            label: parentLabel,
            icon: { key: 'dsh-tag.icon' },
            children,
          }]
        }

        // ── Settings ───────────────────────────────────────────────────────────
        /**
         * Color trigger: the dot opens a small listbox of the colors still
         * available to this row. Used colors never reach the menu.
         */
        function ColorPicker({ value, options, disabled = false, align = 'left', onChange, label }) {
          const [open, setOpen] = React.useState(false)
          const wrapRef = React.useRef(null)

          React.useEffect(() => {
            if (!open) return undefined
            const onDown = (event) => {
              if (wrapRef.current !== null && !wrapRef.current.contains(event.target)) setOpen(false)
            }
            document.addEventListener('mousedown', onDown)
            return () => document.removeEventListener('mousedown', onDown)
          }, [open])

          return h('div', { className: 'dsh-tag-dotWrap', ref: wrapRef },
            h('button', {
              type: 'button',
              className: 'dsh-tag-pickerButton',
              disabled,
              'aria-label': label,
              title: label,
              'aria-haspopup': 'listbox',
              'aria-expanded': open,
              onClick: () => setOpen(current => !current),
            },
            h('span', { className: 'dsh-tag-dot', style: { backgroundColor: swatch(value) }, 'aria-hidden': 'true' })),
            open && options.length > 0
              ? h('div', {
                className: 'dsh-tag-colorMenu' + (align === 'right' ? ' is-right' : ''),
                role: 'listbox',
              }, options.map(name => h('button', {
                key: name,
                type: 'button',
                className: 'dsh-tag-swatch' + (value === name ? ' is-current' : ''),
                style: { backgroundColor: swatch(name) },
                'aria-label': name,
                title: name,
                onClick: () => {
                  setOpen(false)
                  onChange(name)
                },
              })))
              : null)
        }

        function TagRow({ tag, tags }) {
          const [text, setText] = React.useState(tag.label)
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)
          const usedByOthers = new Set(
            tags.filter(item => item.id !== tag.id).map(item => item.color),
          )
          const colorOptions = SWATCHES.filter(name => name === tag.color || !usedByOthers.has(name))

          React.useEffect(() => {
            setText(tag.label)
          }, [tag.label])

          async function run(task) {
            setBusy(true)
            setError(null)
            try {
              await task()
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : String(failure))
            } finally {
              setBusy(false)
            }
          }

          const save = () => {
            const next = text.trim()
            if (next.length === 0 || next === tag.label) return
            void run(() => request('PATCH', `/${encodeURIComponent(tag.id)}`, { label: next }))
          }
          const recolor = (color) => {
            void run(() => request('PATCH', `/${encodeURIComponent(tag.id)}`, { color }))
          }
          const remove = () => {
            if (!window.confirm(t('confirmDelete', { label: tag.label }))) return
            void run(() => request('DELETE', `/${encodeURIComponent(tag.id)}`))
          }

          return h('div', { className: 'dsh-tag-rowWrap' },
            h('div', { className: 'dsh-tag-row' },
              h(ColorPicker, {
                value: tag.color,
                options: colorOptions,
                disabled: busy,
                onChange: recolor,
                label: t('cycleColor'),
              }),
              h('input', {
                className: 'dsh-tag-input',
                value: text,
                maxLength: 48,
                disabled: busy,
                style: { color: textColor(tag.color) },
                'aria-label': tag.label,
                onChange: (event) => setText(event.target.value),
                onBlur: save,
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  event.currentTarget.blur()
                },
              }),
              h('button', {
                type: 'button',
                className: 'dsh-tag-delete',
                disabled: busy,
                'aria-label': t('remove'),
                title: t('remove'),
                onClick: remove,
              }, h('svg', {
                width: 15,
                height: 15,
                viewBox: '0 0 16 16',
                'aria-hidden': true,
              }, h('path', {
                d: 'M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.5 7v4M9.5 7v4',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              })))),
            error === null ? null : h('p', { className: 'dsh-tag-error' }, error))
        }

        function SettingsPage() {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const [label, setLabel] = React.useState('')
          const [color, setColor] = React.useState('green')
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)
          const usedColors = new Set(snapshot.tags.map(tag => tag.color))
          const availableColors = SWATCHES.filter(name => !usedColors.has(name))
          const atLimit = snapshot.tags.length >= 10
          const selectedColor = availableColors.includes(color) ? color : availableColors[0] ?? ''

          React.useEffect(() => {
            void refresh()
          }, [])

          React.useEffect(() => {
            if (!availableColors.includes(color)) setColor(availableColors[0] ?? '')
          }, [snapshot.tags, color])

          const create = () => {
            const text = label.trim()
            if (text.length === 0 || atLimit || selectedColor.length === 0) return
            setBusy(true)
            setError(null)
            void request('POST', '', { label: text, color: selectedColor })
              .then(() => setLabel(''))
              .catch((failure) => setError(failure instanceof Error ? failure.message : String(failure)))
              .finally(() => setBusy(false))
          }

          return h('section', { className: 'dsh-tag-settings' },
            h('header', { className: 'dsh-tag-settingsHead' },
              h('h2', { className: 'dsh-tag-settingsTitle' }, t('settingsTitle')),
              h('p', { className: 'dsh-tag-settingsDesc' }, t('settingsDesc'))),
            error === null ? null : h('p', { className: 'dsh-tag-error' }, error),
            snapshot.error === null ? null : h('p', { className: 'dsh-tag-error' }, snapshot.error),
            snapshot.tags.length === 0
              ? h('div', { className: 'dsh-tag-empty' }, t('empty'))
              : h('div', { className: 'dsh-tag-settingsList' },
                snapshot.tags.map(tag => h(TagRow, { key: tag.id, tag, tags: snapshot.tags }))),
            h('div', { className: 'dsh-tag-create dsh-tag-settingsCreate' },
              h('span', { className: 'dsh-tag-addIcon', 'aria-hidden': 'true' }, h('svg', {
                width: 15,
                height: 15,
                viewBox: '0 0 16 16',
              }, h('path', {
                d: 'M8 3v10M3 8h10',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.3,
                strokeLinecap: 'round',
              }))),
              h('input', {
                className: 'dsh-tag-input',
                value: label,
                maxLength: 48,
                disabled: busy || atLimit,
                style: label.trim().length > 0 ? { color: textColor(selectedColor) } : undefined,
                placeholder: atLimit ? t('limit') : t('newPlaceholder'),
                'aria-label': t('newPlaceholder'),
                onChange: (event) => setLabel(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  create()
                },
              }),
              h(ColorPicker, {
                value: selectedColor,
                options: availableColors,
                disabled: busy || atLimit,
                align: 'right',
                onChange: setColor,
                label: t('color'),
              }),
              h('button', {
                type: 'button',
                className: 'dsh-tag-primary',
                disabled: busy || atLimit || selectedColor.length === 0 || label.trim().length === 0,
                onClick: create,
              }, t('add'))),
            atLimit
              ? h('p', { className: 'dsh-tag-hint' }, t('limit'))
              : availableColors.length === 0
                ? h('p', { className: 'dsh-tag-hint' }, t('noColors'))
                : null)
        }

        function HoverTag({ sessionId }) {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const tagId = snapshot.sessions[sessionId]
          const tag = snapshot.tags.find(item => item.id === tagId)
          if (tag === undefined) return null
          return h('div', { className: 'dsh-tag-hover' }, h('span', {
            className: 'dsh-tag-hoverItem',
          },
          h('span', { className: 'dsh-tag-dot', style: { background: swatch(tag.color) }, 'aria-hidden': 'true' }),
          tag.label))
        }

        // ── Wiring ─────────────────────────────────────────────────────────────
        /**
         * Membership of every session, not only the rendered rows. Optional:
         * when either service is missing the filter keeps its DOM-only behaviour.
         */
        ctx.inject(['workspaces', 'sessions'], (scope) => {
          let signature = ''
          const sync = () => {
            try {
              const ws = scope.workspaces.list.getSnapshot()
              const list = scope.sessions.list.getSnapshot()
              if (!Array.isArray(ws.items) || !Array.isArray(list.ids)) return
              if (ws.phase !== 'ready' || list.phase !== 'ready') return
              const items = ws.items
              const ids = list.ids
              const next = items.map(item => [String(item.workspaceId), (item.sessionIds || []).map(String)])
              const archived = (ws.archivedSessionIds || []).map(String)
              const nextSignature = JSON.stringify([next, archived, ids])
              if (nextSignature === signature) return
              signature = nextSignature
              workspaceMembers = new Map(next.map(([id, members]) => [id, new Set(members)]))
              archivedSessions = new Set(archived)
              sessionCatalog = new Set(ids.map(String))
              scheduleFilter()
            } catch {
              // A build without these snapshots keeps the DOM-only fallback.
            }
          }
          sync()
          scope.effect(() => {
            const offWorkspaces = scope.workspaces.list.subscribe(sync)
            const offSessions = scope.sessions.list.subscribe(sync)
            return () => {
              offWorkspaces()
              offSessions()
            }
          }, 'dsh-tag: workspace membership')
        })

        ctx.effect(() => {
          filterObserver = new MutationObserver(scheduleFilter)
          filterObserver.observe(document.body, { childList: true, subtree: true })
          scheduleFilter()
          // A manual toggle of a group we opened is respected; clearing the
          // filter must not undo a choice the user just made.
          const onGroupClick = (event) => {
            if (autoClicking > 0) return
            const target = event.target
            if (!(target instanceof Element)) return
            const overflow = target.closest('[data-row-key^="overflow:"]')
            if (overflow !== null) {
              const key = `workspace:${overflow.getAttribute('data-row-key').slice('overflow:'.length)}`
              if (overflow.getAttribute('aria-expanded') === 'true') {
                // "Collapse sessions": keep the filter from pressing it again.
                userCollapsed.add(key)
                autoRevealed.delete(key)
              } else {
                userCollapsed.delete(key)
              }
              return
            }
            if (target.closest('button') !== null) return
            const row = target.closest('[data-row-key^="workspace:"]')
            if (row === null) return
            const key = row.getAttribute('data-row-key')
            autoExpanded.delete(key)
            autoRevealed.delete(key)
            // Collapsing a group under an active filter is a user decision;
            // expanding it again cancels that decision.
            if (row.getAttribute('aria-expanded') === 'true') userCollapsed.add(key)
            else userCollapsed.delete(key)
          }
          document.addEventListener('click', onGroupClick, true)
          const onVisibility = () => {
            if (document.hidden) {
              if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer)
                retryTimer = undefined
              }
              if (source !== undefined) {
                source.close()
                source = undefined
              }
              return
            }
            void refresh()
            connect()
          }
          document.addEventListener('visibilitychange', onVisibility)
          void refresh()
          if (!document.hidden) connect()
          return () => {
            disposed = true
            document.removeEventListener('visibilitychange', onVisibility)
            document.removeEventListener('click', onGroupClick, true)
            if (filterObserver !== null) {
              filterObserver.disconnect()
              filterObserver = null
            }
            if (filterTimer !== 0) {
              window.clearTimeout(filterTimer)
              filterTimer = 0
            }
            if (filterWrap !== null) {
              filterWrap.remove()
              filterWrap = null
              filterBar = null
              filterEmpty = null
            }
            filterStyle.textContent = ''
            if (source !== undefined) {
              source.close()
              source = undefined
            }
            if (retryTimer !== undefined) {
              window.clearTimeout(retryTimer)
              retryTimer = undefined
            }
          }
        }, 'dsh-tag: data')

        ctx.effect(() => ctx.contextMenus.register({
          id: 'dsh-tag.session',
          target: 'session',
          order: 500,
          resolve: ({ sessionId }) => tagMenu('session', { id: sessionId }),
        }), 'dsh-tag: session menu')

        ctx.effect(() => ctx.contextMenus.register({
          id: 'dsh-tag.workspace',
          target: 'workspace',
          order: 500,
          resolve: ({ workspaceId, path }) => tagMenu('workspace', { id: workspaceId, path }),
        }), 'dsh-tag: workspace menu')

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: 'dsh-tag.dot',
        }, DotIcon))

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: 'dsh-tag.icon',
        }, TagIcon))

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-tag',
          order: 6,
          label: () => t('nav'),
        }, SettingsPage))

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'dsh-tag',
        }, TagIcon))

        ctx.slots.inject('sidebar.session.row.hover', () => ctx.slots.register({
          name: 'sidebar.session.row.hover',
          id: 'dsh-tag',
          order: 10,
        }, HoverTag))

        ctx.effect(() => () => {
          baseStyle.remove()
          colorStyle.remove()
          filterStyle.remove()
        }, 'dsh-tag: styles')
      },
    }
  },
})
