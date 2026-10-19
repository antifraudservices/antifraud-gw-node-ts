// Flow contract: the deployable Gateway image builds the exact lockfile under Node 24, runs only compiled service code as a non-root user and carries no local secrets or generated evidence.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('defines a reproducible non-root Cloud Run container boundary', async () => {
  const [dockerfile, dockerignore] = await Promise.all([
    readFile(new URL('Dockerfile', root), 'utf8'),
    readFile(new URL('.dockerignore', root), 'utf8'),
  ])

  assert.match(dockerfile, /FROM node:24\.15\.0-alpine AS build/u)
  assert.match(dockerfile, /npm ci/u)
  assert.match(dockerfile, /npm run build/u)
  assert.match(dockerfile, /USER node/u)
  assert.match(dockerfile, /CMD \["node", "dist\/server\.js"\]/u)
  assert.match(dockerignore, /^\.env/mu)
  assert.match(dockerignore, /^screenshots/mu)
})
