import { createServer, type Server } from 'node:http'

import { createAntifraudGatewayHttpHandler } from './index.js'
import { createGatewayDemoRuntime } from './demo-runtime.js'

type DemoEnvironment = Readonly<Record<string, string | undefined>>

export function createGatewayDemoServer(
  environment: DemoEnvironment,
  options: Readonly<{ wait?: (milliseconds: number) => Promise<void> }> = {},
): Server {
  const runtime = createGatewayDemoRuntime(environment, options)
  return createServer(createAntifraudGatewayHttpHandler({
    gateway: runtime.gateway,
    controller: runtime.controller,
    artifacts: runtime.artifacts,
    publications: runtime.publications,
    resolveActor: runtime.resolveActor,
  }))
}
