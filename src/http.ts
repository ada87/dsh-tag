import { HttpError } from './errors.js'
import type { ConnectionService, HostContext, HostRequest, HostResponse } from './host.js'
import { MAX_BODY_BYTES } from './protocol.js'

export function header(req: HostRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

export function clientAddress(req: HostRequest): string {
  return (req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '')
}

export function isLoopback(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address.startsWith('127.')
}

export function sameOrigin(origin: string, authority: string): boolean {
  try {
    return new URL(origin).host.toLowerCase() === authority.toLowerCase()
  } catch {
    return false
  }
}

export async function readJson(req: HostRequest, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const stream = req as unknown as AsyncIterable<Buffer | string>
  if (typeof stream[Symbol.asyncIterator] !== 'function') return undefined
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.byteLength
    if (total > maxBytes) throw new HttpError(413, 'body-too-large', `request body exceeds ${maxBytes} bytes`)
    chunks.push(buffer)
  }
  if (total === 0) return undefined
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new HttpError(400, 'bad-json', 'request body is not valid JSON')
  }
}

export function sendJson(res: HostResponse, status: number, value: unknown): void {
  if (res.writableEnded) return
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.writeHead(status, { 'Content-Length': String(Buffer.byteLength(body)) })
  res.end(body)
}

export function sendNoContent(res: HostResponse, status = 204): void {
  if (res.writableEnded) return
  res.writeHead(status)
  res.end()
}

export function startSse(res: HostResponse): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.writeHead(200)
  res.flushHeaders?.()
  res.write('retry: 2000\n\n')
}

export function sseSend(res: HostResponse, value: unknown): void {
  res.write(`data: ${JSON.stringify(value)}\n\n`)
}

/**
 * Reads are public like the reference plugin; mutations require a same-origin
 * browser request, loopback, or a dsh connection admitted by the Host.
 */
export function isTrusted(ctx: HostContext, req: HostRequest): boolean {
  const origin = header(req, 'origin')
  const authority = header(req, 'host') ?? ''
  if (origin !== undefined && sameOrigin(origin, authority)) return true
  if (isLoopback(clientAddress(req))) return true
  const connection = ctx.get('connection') as ConnectionService | undefined
  if (connection !== undefined && typeof connection.admit === 'function') {
    try {
      if (connection.admit({ headers: req.headers }).peer !== undefined) return true
    } catch {
      // The request is untrusted.
    }
  }
  return false
}

export function assertTrusted(ctx: HostContext, req: HostRequest): void {
  if (!isTrusted(ctx, req)) {
    throw new HttpError(401, 'unauthorized', 'open this dsh page from an authenticated browser')
  }
}
