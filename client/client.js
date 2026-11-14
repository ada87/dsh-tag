/**
 * Browser half of dsh-tag.
 *
 * - Colors session and workspace titles with generated CSS rules keyed by the
 *   stable `data-row-key` attribute (no DOM mutation per row).
 * - Adds a "Tags" submenu to the session and workspace context menus. Each tag
 *   is a toggle: click to apply, click again to remove. Multiple tags can be
 *   applied; the last one colors the title.
 * - Settings page renames, recolors and deletes tags.
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
    const SWATCHES = ['green', 'amber', 'blue', 'red', 'purple', 'gray']

    /** Concrete colors for menu dots and settings swatches. */
    const HEX = {
      green: '#22C55E',
      amber: '#F59E0B',
      blue: '#3B82F6',
      red: '#EF4444',
      purple: '#8B5CF6',
      gray: '#6B7280',
    }

    /** Theme-aware colors for title text. */
    const PALETTE = {
      green: 'var(--dsw-alias-state-success-primary)',
      amber: 'var(--dsw-alias-state-warn-primary)',
      blue: 'var(--dsw-alias-state-business-primary)',
      red: 'var(--dsw-alias-state-error-primary)',
      purple: '#8B5CF6',
      gray: 'var(--dsw-alias-label-caption)',
    }

    const zh = {
      nav: '标签',
      menuSession: '标签',
      menuWorkspace: '工作区标签',
      clear: '清除全部标签',
      noTags: '还没有标签，先去 设置 → 标签 创建',
      newPlaceholder: '新标签文字…',
      add: '添加',
      remove: '删除',
      confirmDelete: '删除标签「{label}」？对应标记也会清除。',
      settingsTitle: '标签',
      settingsDesc: '会话和工作区共用同一套标签。右键会话或工作区即可打标签；标题颜色取最后一次打上的标签。',
      empty: '还没有标签，先创建一个。',
      failed: '标签操作失败',
    }

    const en = {
      nav: 'Tags',
      menuSession: 'Tags',
      menuWorkspace: 'Workspace tags',
      clear: 'Clear all tags',
      noTags: 'No tags yet — create one in Settings → Tags',
      newPlaceholder: 'New tag label…',
      add: 'Add',
      remove: 'Delete',
      confirmDelete: 'Delete “{label}”? Its assignments will be cleared.',
      settingsTitle: 'Tags',
      settingsDesc: 'Sessions and workspaces share this tag set. Right-click a row to toggle tags; the last tag colors the title.',
      empty: 'No tags yet — create one below.',
      failed: 'Tag update failed',
    }

    const CSS = `
.dsh-tag-error{margin:8px 0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-tag-dot{flex:none;width:9px;height:9px;border-radius:50%;display:inline-block}
.dsh-tag-input{flex:1;min-width:120px;box-sizing:border-box;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.06));color:inherit;font:inherit;outline:none}
.dsh-tag-input:focus{border-color:var(--dsw-alias-state-business-primary,#3d7bfd)}
.dsh-tag-swatches{display:flex;align-items:center;gap:6px}
.dsh-tag-swatch{width:18px;height:18px;padding:0;border:2px solid transparent;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.dsh-tag-swatch.is-current{border-color:var(--dsw-alias-label-primary,#111)}
.dsh-tag-primary{height:34px;padding:0 14px;border:0;border-radius:8px;background:var(--dsw-alias-state-business-primary,#3d7bfd);color:#fff;font:inherit;font-size:13px;cursor:pointer}
.dsh-tag-primary:disabled{opacity:.45;cursor:default}
.dsh-tag-secondary{height:34px;padding:0 14px;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dsh-tag-secondary:disabled{opacity:.45;cursor:default}
.dsh-tag-create{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsh-tag-settings{display:flex;flex-direction:column;gap:14px;width:100%}
.dsh-tag-settingsHead{display:flex;flex-direction:column;gap:4px}
.dsh-tag-settingsTitle{margin:0;font-size:18px;font-weight:600;line-height:26px;color:var(--dsw-alias-label-primary,#111)}
.dsh-tag-settingsDesc{margin:0;font-size:13px;line-height:19px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-settingsList{display:flex;flex-direction:column}
.dsh-tag-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.18))}
.dsh-tag-row:last-child{border-bottom:0}
.dsh-tag-row .dsh-tag-input{height:32px}
.dsh-tag-settingsCreate{padding-top:12px}
.dsh-tag-empty{padding:10px 0;font-size:13px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-hover{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;line-height:17px;color:#cfd3d6}
.dsh-tag-hoverItem{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
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
        function primaryColor(tagIds) {
          if (!Array.isArray(tagIds) || tagIds.length === 0) return null
          return colorOfTag(tagIds[tagIds.length - 1])
        }
        function paint() {
          const rules = []
          for (const [sessionId, tagIds] of Object.entries(state.sessions)) {
            const color = primaryColor(tagIds)
            if (color !== null) rules.push(rule('session', sessionId, color))
          }
          for (const workspace of state.workspaces) {
            const color = primaryColor(workspace.tagIds)
            if (color !== null) rules.push(rule('workspace', workspace.id, color))
          }
          colorStyle.textContent = rules.join('\n')
        }
        function rule(kind, id, color) {
          const safe = String(id).replace(/["\\\r\n]/g, '')
          return `[data-row-key="${kind}:${safe}"] [class*="_title"]{color:${color}}`
        }

        function normalize(data) {
          const tags = Array.isArray(data && data.tags) ? data.tags : []
          const sessions = {}
          if (data && data.sessions && typeof data.sessions === 'object') {
            for (const [id, value] of Object.entries(data.sessions)) {
              const ids = Array.isArray(value)
                ? value.filter(item => typeof item === 'string')
                : typeof value === 'string'
                  ? [value]
                  : []
              if (ids.length > 0) sessions[id] = ids
            }
          }
          const workspaces = (Array.isArray(data && data.workspaces) ? data.workspaces : [])
            .map(item => {
              const ids = Array.isArray(item && item.tagIds)
                ? item.tagIds.filter(value => typeof value === 'string')
                : typeof (item && item.tagId) === 'string'
                  ? [item.tagId]
                  : []
              return {
                id: String((item && item.id) || ''),
                ...(item && typeof item.path === 'string' ? { path: item.path } : {}),
                tagIds: ids,
              }
            })
            .filter(item => item.id.length > 0 && item.tagIds.length > 0)
          return { tags, sessions, workspaces }
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

        function setTags(kind, target, tagIds) {
          const base = kind === 'session' ? 'sessions' : 'workspaces'
          const body = kind === 'workspace' && typeof target.path === 'string'
            ? { tagIds, path: target.path }
            : { tagIds }
          return request('PUT', `/${base}/${encodeURIComponent(target.id)}`, body)
        }

        /**
         * One submenu for the captured row. `resolve` runs when the menu opens,
         * so the checked state matches the latest snapshot.
         */
        function tagMenu(kind, target) {
          const current = kind === 'session'
            ? (state.sessions[target.id] || [])
            : ((state.workspaces.find(item => item.id === target.id) || {}).tagIds || [])
          const parentLabel = kind === 'session' ? t('menuSession') : t('menuWorkspace')
          if (state.tags.length === 0) {
            return [{ id: 'tags', label: parentLabel, disabled: true, children: [{ id: 'empty', label: t('noTags'), disabled: true }] }]
          }
          const children = state.tags.map(tag => {
            const active = current.includes(tag.id)
            return {
              id: `tag:${tag.id}`,
              label: `${active ? '✓ ' : ''}${tag.label}`,
              icon: { key: 'dsh-tag.dot', src: dotSrc(tag.color) },
              failureLabel: t('failed'),
              run: () => setTags(kind, target, active ? current.filter(id => id !== tag.id) : [...current, tag.id]),
            }
          })
          if (current.length > 0) {
            children.push({
              id: 'clear',
              label: t('clear'),
              separatorBefore: true,
              failureLabel: t('failed'),
              run: () => setTags(kind, target, []),
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
        function TagRow({ tag }) {
          const [text, setText] = React.useState(tag.label)
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)

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

          return h('div', { className: 'dsh-tag-row' },
            h('span', { className: 'dsh-tag-dot', style: { background: swatch(tag.color) }, 'aria-hidden': 'true' }),
            h('input', {
              className: 'dsh-tag-input',
              value: text,
              maxLength: 48,
              disabled: busy,
              'aria-label': tag.label,
              onChange: (event) => setText(event.target.value),
              onBlur: save,
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                event.currentTarget.blur()
              },
            }),
            h('div', { className: 'dsh-tag-swatches' }, SWATCHES.map(name => h('button', {
              key: name,
              type: 'button',
              className: 'dsh-tag-swatch' + (tag.color === name ? ' is-current' : ''),
              style: { background: swatch(name) },
              'aria-label': name,
              title: name,
              disabled: busy,
              onClick: () => recolor(name),
            }))),
            h('button', {
              type: 'button',
              className: 'dsh-tag-secondary',
              disabled: busy,
              onClick: remove,
            }, t('remove')),
            error === null ? null : h('span', { className: 'dsh-tag-error' }, error))
        }

        function SettingsPage() {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const [label, setLabel] = React.useState('')
          const [color, setColor] = React.useState('green')
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)

          React.useEffect(() => {
            void refresh()
          }, [])

          const create = () => {
            const text = label.trim()
            if (text.length === 0) return
            setBusy(true)
            setError(null)
            void request('POST', '', { label: text, color })
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
                snapshot.tags.map(tag => h(TagRow, { key: tag.id, tag }))),
            h('div', { className: 'dsh-tag-create dsh-tag-settingsCreate' },
              h('input', {
                className: 'dsh-tag-input',
                value: label,
                maxLength: 48,
                disabled: busy,
                placeholder: t('newPlaceholder'),
                'aria-label': t('newPlaceholder'),
                onChange: (event) => setLabel(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  create()
                },
              }),
              h('div', { className: 'dsh-tag-swatches' }, SWATCHES.map(name => h('button', {
                key: name,
                type: 'button',
                className: 'dsh-tag-swatch' + (color === name ? ' is-current' : ''),
                style: { background: swatch(name) },
                'aria-label': name,
                title: name,
                disabled: busy,
                onClick: () => setColor(name),
              }))),
              h('button', {
                type: 'button',
                className: 'dsh-tag-primary',
                disabled: busy || label.trim().length === 0,
                onClick: create,
              }, t('add'))))
        }

        function HoverTag({ sessionId }) {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const tagIds = snapshot.sessions[sessionId] || []
          const tags = tagIds
            .map(id => snapshot.tags.find(item => item.id === id))
            .filter(tag => tag !== undefined)
          if (tags.length === 0) return null
          return h('div', { className: 'dsh-tag-hover' }, tags.map(tag => h('span', {
            key: tag.id,
            className: 'dsh-tag-hoverItem',
          },
          h('span', { className: 'dsh-tag-dot', style: { background: swatch(tag.color) }, 'aria-hidden': 'true' }),
          tag.label)))
        }

        // ── Wiring ─────────────────────────────────────────────────────────────
        ctx.effect(() => {
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

        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
          name: 'settings.plugins.tab',
          id: 'dsh-tag',
          order: 20,
          label: () => t('nav'),
        }, SettingsPage))

        ctx.slots.inject('sidebar.session.row.hover', () => ctx.slots.register({
          name: 'sidebar.session.row.hover',
          id: 'dsh-tag',
          order: 10,
        }, HoverTag))

        ctx.effect(() => () => {
          baseStyle.remove()
          colorStyle.remove()
        }, 'dsh-tag: styles')
      },
    }
  },
})
