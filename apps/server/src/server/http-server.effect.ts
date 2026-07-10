import { createServer } from 'node:http';
import { Context, Effect, Layer, Config } from 'effect';
import type { Server as HttpServer } from 'node:http';

/**
 * HTTP Server configuration
 */
export interface HttpServerConfig {
  readonly port: number;
  readonly host: string;
}

/**
 * HTTP Server service tag
 */
export class HttpServerService extends Context.Tag('HttpServer')<
  HttpServerService,
  {
    readonly server: HttpServer;
    readonly config: HttpServerConfig;
  }
>() {}

/**
 * Creates the HTTP server with proper resource management
 */
const make = Effect.gen(function* () {
  const port = yield* Config.number('PORT').pipe(Config.withDefault(3000));
  const host = yield* Config.string('HOST').pipe(Config.withDefault('0.0.0.0'));

  const config: HttpServerConfig = { port, host };

  const server = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const httpServer = createServer((_, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Werewolf Game Server');
      });
      return httpServer;
    }),
    (server) =>
      Effect.async<void>((resume) => {
        server.close(() => {
          console.log('HTTP server closed');
          resume(Effect.void);
        });
      })
  );

  yield* Effect.async<void>((resume) => {
    server.listen(config.port, config.host, () => {
      console.log(
        `Werewolf Game Server running on ${config.host}:${config.port}`
      );
      resume(Effect.void);
    });
  });

  return { server, config };
});

/**
 * HTTP Server layer with proper lifecycle management
 */
export const HttpServerLive = Layer.scoped(HttpServerService, make);
