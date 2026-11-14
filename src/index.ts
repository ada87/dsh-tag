import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HttpError } from './errors.js'
import {
  assertTrusted,
  header,
  readJson,
  sameOrigin,
  sendJson,
  startSse,
  sseSend,
} from './http.js'
import type {
  HostContext,
  HostRequest,
  HostResponse,
  WebServerService,
  WorkspaceRegistryService,
} from './host.js'
import { openTagStore, type TagStore } from './store.js'
import type { Snapshot, TagPatch } from './protocol.js'

export const name = 'dsh-tag'
export const inject = ['webServer']

const BASE_PATH = '/tags'
const VERSION = readVersion()

/**
 * Color tags for sessions and workspaces.
 *
 * Reads are public (`GET /tags`) so the phone can consume the same snapshot
 * later; mutations require the dsh browser session, a same-origin browser
 * request, or loopback.
 */
export async function apply(ctx: HostContext): Promise<void> {
  const webServer = ctx.webServer ?? (ctx.get('webServer') as WebServerService | undefined)
  if (webServer === undefined) throw new Error('dsh-tag: the webServer service is required')

  const registry = ctx.get('workspaceRegistry') as WorkspaceRegistryService | undefined
  const workspacePath = (id: string): string | undefined => {
    try {
      const item = registry?.list?.().find(entry => String(entry.id) === id)
      return typeof item?.path === 'string' ? item.path : undefined
    } catch {
      return undefined
    }
  }

  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const stateFile = join(home, 'state', 'dsh-tag.json')
  const store = openTagStore(stateFile, workspacePath)
  const hub = new SseHub()
  const handler = createHandler(ctx, store, hub)

  ctx.effect(() => {
    const dispose = webServer.register({ kind: 'prefix', path: BASE_PATH, handler })
    console.log(`[dsh-tag] listening at ${BASE_PATH} (${stateFile})`)
    return () => {
      hub.closeAll()
      dispose()
    }
  }, 'dsh-tag: routes')
}

function createHandler(
  ctx: HostContext,
  store: TagStore,
  hub: SseHub,
): (req: HostRequest, res: HostResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const origin = header(req, 'origin')
      const authority = header(req, 'host') ?? ''
      if (origin !== undefined && !sameOrigin(origin, authority)) {
        throw new HttpError(403, 'origin-refused', 'cross-origin requests are not accepted')
      }
      const method = (req.method ?? 'GET').toUpperCase()
      if (!url.pathname.startsWith(BASE_PATH)) throw new HttpError(404, 'not-found', 'not found')

      let segments: string[]
      try {
        segments = url.pathname
          .slice(BASE_PATH.length)
          .split('/')
          .filter(segment => segment.length > 0)
          .map(segment => decodeURIComponent(segment))
      } catch {
        throw new HttpError(400, 'bad-path', 'the request path is not valid')
      }

      // Reads -----------------------------------------------------------------
      if (method === 'GET' && segments.length === 0) {
        sendJson(res, 200, store.snapshot())
        return
      }
      if (method === 'GET' && segments.length === 1 && segments[0] === 'health') {
        const snapshot = store.snapshot()
        sendJson(res, 200, {
          ok: true,
          name: 'dsh-tag',
          version: VERSION,
          features: { sessions: true, workspaces: true },
          tags: snapshot.tags.length,
        })
        return
      }
      if (method === 'GET' && segments.length === 1 && segments[0] === 'events') {
        hub.add(req, res, store.snapshot())
        return
      }

      // Writes ----------------------------------------------------------------
      if (method === 'POST' && segments.length === 0) {
        assertTrusted(ctx, req)
        const body = (await readJson(req)) as { label?: unknown; color?: unknown } | undefined
        const tag = await store.createTag(body?.label, body?.color)
        respondWithState(res, store, hub, 201, { tag })
        return
      }
      if ((method === 'PATCH' || method === 'DELETE') && segments.length === 1) {
        assertTrusted(ctx, req)
        const id = segments[0]!
        if (method === 'DELETE') {
          await store.deleteTag(id)
          respondWithState(res, store, hub, 200, {})
          return
        }
        const body = ((await readJson(req)) ?? {}) as TagPatch
        const tag = await store.updateTag(id, {
          ...(body.label === undefined ? {} : { label: body.label }),
          ...(body.color === undefined ? {} : { color: body.color }),
          ...(body.order === undefined ? {} : { order: body.order }),
        })
        respondWithState(res, store, hub, 200, { tag })
        return
      }
      if (method === 'PUT' && segments.length === 2 && (segments[0] === 'sessions' || segments[0] === 'workspaces')) {
        assertTrusted(ctx, req)
        const kind = segments[0] === 'sessions' ? 'session' : 'workspace'
        const body = ((await readJson(req)) ?? {}) as { tagIds?: unknown; path?: unknown }
        if (!Array.isArray(body.tagIds)) throw new HttpError(400, 'bad-tags', 'tagIds must be an array of tag ids')
        const path = typeof body.path === 'string' ? body.path : undefined
        await store.assign(kind, segments[1]!, body.tagIds as string[], path)
        respondWithState(res, store, hub, 200, {})
        return
      }

      throw new HttpError(404, 'not-found', `no route for ${method} ${url.pathname}`)
    } catch (error) {
      if (res.headersSent) {
        try {
          res.end()
        } catch {
          // The client is gone.
        }
        console.warn('[dsh-tag] stream failed:', error instanceof Error ? error.message : String(error))
        return
      }
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } })
        return
      }
      console.warn('[dsh-tag] request failed:', error instanceof Error ? error.message : String(error))
      sendJson(res, 500, { error: { code: 'internal', message: 'internal error' } })
    }
  }
}

function respondWithState(
  res: HostResponse,
  store: TagStore,
  hub: SseHub,
  status: number,
  extra: Record<string, unknown>,
): void {
  const snapshot = store.snapshot()
  hub.broadcast(snapshot)
  sendJson(res, status, { ok: true, ...extra, snapshot })
}

class SseHub {
  private readonly clients = new Set<HostResponse>()

  add(req: HostRequest, res: HostResponse, snapshot: Snapshot): void {
    startSse(res)
    this.clients.add(res)
    let timer: ReturnType<typeof setInterval> | undefined
    const cleanup = (): void => {
      this.clients.delete(res)
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }
    res.on('close', cleanup)
    res.on('error', cleanup)
    req.on('close', cleanup)
    sseSend(res, snapshot)
    timer = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        cleanup()
      }
    }, 20_000)
    ;(timer as { unref?: () => void }).unref?.()
  }

  broadcast(snapshot: Snapshot): void {
    for (const res of [...this.clients]) {
      if (res.writableEnded || res.destroyed === true) {
        this.clients.delete(res)
        continue
      }
      try {
        sseSend(res, snapshot)
      } catch {
        this.clients.delete(res)
      }
    }
  }

  closeAll(): void {
    for (const res of [...this.clients]) {
      try {
        res.end()
      } catch {
        // The client is gone.
      }
    }
    this.clients.clear()
  }
}

function readVersion(): string {
  try {
    const text = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(text) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}
