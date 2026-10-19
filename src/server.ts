import { createGatewayDemoServer } from './demo-server.js'

const port = readPort(process.env.PORT)
const server = createGatewayDemoServer(process.env)

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Antifraud Demo gateway listening on ${port}; virtual ledger only.\n`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

function readPort(value: string | undefined): number {
  const port = Number.parseInt(value ?? '8080', 10)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 through 65535.')
  }
  return port
}
