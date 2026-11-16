/**
 * Minimal structural view of the dsh Host services this plugin consumes.
 *
 * The plugin deliberately does not import dsh implementation modules at
 * runtime: the Host owns their instances. These shapes document exactly what
 * the plugin needs and keep the bundle free of dsh sources.
 */

export interface HostRequest {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string; remotePort?: number }
  on(event: 'close' | 'aborted', listener: () => void): void
}

export interface HostResponse {
  statusCode: number
  headersSent: boolean
  setHeader(name: string, value: string | string[]): void
  writeHead(status: number, headers?: Record<string, string | string[]>): void
  write(chunk: string): boolean
  end(chunk?: string): void
  readonly writableEnded: boolean
  readonly destroyed?: boolean
  on(event: 'close' | 'error', listener: () => void): void
  flushHeaders?(): void
}

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: HostRequest, res: HostResponse) => void | Promise<void>
}

export interface WebService {
  register(route: WebRoute): () => void
}

export interface ConnectionService {
  admit(request: { headers: Record<string, string | string[] | undefined> }): {
    peer?: unknown
    rejection?: number
  }
}

export interface WorkspaceService {
  list?(): Array<{ id?: unknown; path?: unknown }>
}

export interface HostContext {
  webServer?: WebService
  effect(fn: () => void | (() => void), label?: string): unknown
  get(name: string): unknown
}
