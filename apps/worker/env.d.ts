import type { WorkerEnv } from './alchemy.run';

declare global {
  /** The Worker's bindings, derived from the Worker in `alchemy.run.ts`. */
  interface Env extends WorkerEnv {}

  // Types `env` and `exports` from `cloudflare:workers` (the tests use them)
  namespace Cloudflare {
    interface Env extends WorkerEnv {}

    interface GlobalProps {
      mainModule: typeof import('./src/index');
      durableNamespaces: 'GameRoom';
    }
  }
}
