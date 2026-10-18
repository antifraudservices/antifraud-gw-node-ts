// Flow contract: the public neutral gateway implementation, architecture and skill contain no downstream product or organization branding. Sector-specific applications may consume the contracts but are never architectural authorities for this repository.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

function filesUnder(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap(name => filesUnder(join(path, name)))
}

test('keeps the public gateway narrative product-neutral', () => {
  const contents = ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'docs', 'src', '.codex/skills']
    .flatMap(filesUnder)
    .map(path => readFileSync(path, 'utf8'))
    .join('\n')
  assert.doesNotMatch(contents, /VetChain|SOSChain|UHC|GlobalDataCare|Fundaci[oó]n UNID|Connecting Solution/i)
})
