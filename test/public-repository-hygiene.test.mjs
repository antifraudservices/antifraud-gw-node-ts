// Flow contract: preserve the exact documented cybersecurity lineage in its README section while rejecting unrelated product or organization branding everywhere else, including additional mentions and copied lineage in source or other documents.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

function filesUnder(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap(name => filesUnder(join(path, name)))
}

const restrictedBranding = /VetChain|SOSChain|UHC|GlobalDataCare|Fundaci[oó]n UNID|Connecting Solution/i
const documentedLineage = `## Cybersecurity foundation

Antifraud Data Space builds on previous cybersecurity research and
prototype development. The underlying cybersecurity concepts were first
documented in [SOSChain](https://github.com/soschain/docs). Antifraud now
applies the same concepts to identity, qualifications, invoices and other use
cases beyond emergencies and animal health.`

function assertNeutralNarrative(path, text) {
  if (path === 'README.md') {
    assert.ok(text.includes(documentedLineage), 'The documented cybersecurity lineage must remain intact in its README section.')
    text = text.replace(documentedLineage, '')
  }
  assert.doesNotMatch(text, restrictedBranding)
}

test('keeps the public gateway narrative product-neutral with its exact documented lineage', () => {
  for (const path of ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'docs', 'src', '.codex/skills'].flatMap(filesUnder)) {
    assertNeutralNarrative(path, readFileSync(path, 'utf8'))
  }
})

test('rejects additional branding, altered lineage and copies outside its exact README section', () => {
  assert.doesNotThrow(() => assertNeutralNarrative('README.md', documentedLineage))
  for (const brand of ['VetChain', 'SOSChain', 'UHC', 'GlobalDataCare', 'Fundación UNID', 'Connecting Solution']) {
    assert.throws(() => assertNeutralNarrative('README.md', documentedLineage + '\n' + brand))
  }
  for (const path of ['src/adapter.ts', 'docs/architecture.md']) {
    assert.throws(() => assertNeutralNarrative(path, documentedLineage))
  }
  assert.throws(() => assertNeutralNarrative('README.md', documentedLineage + '\n' + documentedLineage))
  assert.throws(() => assertNeutralNarrative('README.md', documentedLineage.replace('## Cybersecurity foundation', '## Implementation')))
  assert.throws(() => assertNeutralNarrative('README.md', documentedLineage.replace('cybersecurity research', 'unrelated implementation')))
})
