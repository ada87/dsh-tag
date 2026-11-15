/**
 * Host smoke test: boots the plugin against a temporary DSH_HOME and exercises
 * the /tags contract without a running dsh.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'dsh-tag-smoke-'))
process.env.DSH_HOME = home

const { apply } = await import('../lib/index.js')

function makeRequest(method, url, body, options = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  return {
    method,
    url,
    headers: { host: '127.0.0.1:3099', ...(options.headers ?? {}) },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
    on() {},
    off() {},
    resume() {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    headersSent: false,
    writableEnded: false,
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    writeHead(status, headers = {}) {
      this.statusCode = status
      this.headersSent = true
      for (const [key, value] of Object.entries(headers)) this.headers[key.toLowerCase()] = value
    },
    write(chunk) {
      this.body += chunk
      return true
    },
    end(chunk) {
      if (chunk) this.body += chunk
      this.writableEnded = true
    },
    on() {},
    flushHeaders() {},
  }
}

async function call(route, method, path, body, options) {
  const res = makeResponse()
  await route.handler(makeRequest(method, path, body, options), res)
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null }
}

const routes = []
const effects = []
const ctx = {
  webServer: {
    register(route) {
      routes.push(route)
      return () => {}
    },
    getOrigin: () => 'http://127.0.0.1:3099',
  },
  effect(fn, label) {
    effects.push({ label, dispose: fn() })
  },
  get(name) {
    if (name === 'workspaceRegistry') {
      return { list: () => [{ id: 'ws1', path: 'D:/work/demo' }] }
    }
    return undefined
  },
}

try {
  await apply(ctx)
  assert.equal(routes.length, 1, 'one prefix route')
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, '/tags')
  const route = routes[0]

  {
    const response = await call(route, 'GET', '/tags')
    assert.equal(response.status, 200)
    assert.equal(response.json.tags.length, 4, 'business defaults seeded')
    assert.deepEqual(response.json.tags.map(tag => tag.id), ['design', 'code', 'ops', 'temp'])
    assert.deepEqual(response.json.sessions, {})
    assert.deepEqual(response.json.workspaces, [])
  }

  let created
  {
    const response = await call(route, 'POST', '/tags', { label: '会议', color: 'amber' })
    assert.equal(response.status, 201)
    created = response.json.tag
    assert.match(created.id, /^tag_/)
    assert.equal(response.json.snapshot.tags.length, 5)
  }

  {
    const response = await call(route, 'PUT', '/tags/sessions/s1', { tagId: 'design' })
    assert.equal(response.status, 200)
    assert.equal(response.json.snapshot.sessions.s1, 'design')
  }

  {
    const response = await call(route, 'PUT', '/tags/sessions/s1', { tagId: 'code' })
    assert.equal(response.status, 200)
    assert.equal(response.json.snapshot.sessions.s1, 'code', 'a new tag replaces the old one')
  }

  {
    const response = await call(route, 'PUT', '/tags/workspaces/ws1', { tagId: 'code' })
    assert.equal(response.status, 200)
    assert.deepEqual(response.json.snapshot.workspaces, [{ id: 'ws1', path: 'D:/work/demo', tagId: 'code' }])
  }

  {
    const response = await call(route, 'PATCH', `/tags/${created.id}`, { label: '会议2', color: '#123456' })
    assert.equal(response.status, 200)
    assert.equal(response.json.tag.label, '会议2')
    assert.equal(response.json.tag.color, '#123456')
  }

  {
    await call(route, 'PUT', '/tags/sessions/s2', { tagId: created.id })
    const response = await call(route, 'DELETE', `/tags/${created.id}`)
    assert.equal(response.status, 200)
    assert.equal(response.json.snapshot.sessions.s2, undefined, 'deleting a tag clears its assignment')
    assert.equal(response.json.snapshot.tags.length, 4)
  }

  {
    const response = await call(route, 'PUT', '/tags/sessions/s1', { tagId: null })
    assert.equal(response.status, 200)
    assert.equal(response.json.snapshot.sessions.s1, undefined, 'null clears the target')
  }

  {
    const response = await call(route, 'PUT', '/tags/sessions/s1', { tagId: 'missing' })
    assert.equal(response.status, 400)
  }

  {
    const response = await call(route, 'PUT', '/tags/sessions/s1', {})
    assert.equal(response.status, 400, 'tagId is required')
  }

  {
    const response = await call(route, 'GET', '/tags/health')
    assert.equal(response.status, 200)
    assert.deepEqual(response.json.features, { sessions: true, workspaces: true })
  }

  {
    const response = await call(route, 'POST', '/tags', { label: 'x', color: 'green' }, { remoteAddress: '10.0.0.9' })
    assert.equal(response.status, 401, 'remote mutation without an origin is rejected')
  }

  {
    const response = await call(route, 'GET', '/tags', undefined, { headers: { origin: 'https://evil.example' } })
    assert.equal(response.status, 403, 'cross-origin read is rejected')
  }

  {
    const state = JSON.parse(readFileSync(join(home, 'state', 'dsh-tag.json'), 'utf8'))
    assert.equal(state.tags.length, 4, 'state file persisted')
    assert.equal(state.workspaces.ws1.tagId, 'code')
    assert.equal(state.sessions.s1, undefined)
  }

  console.log('dsh-tag host smoke: ok')
} finally {
  rmSync(home, { recursive: true, force: true })
}
