import assert from 'node:assert/strict'

async function main() {
  const authModule = await import('../../auth')

  assert.ok(authModule.handlers, 'expected auth handlers to be exported')
  assert.equal(typeof authModule.handlers.GET, 'function', 'expected GET handler')
  assert.equal(typeof authModule.handlers.POST, 'function', 'expected POST handler')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
