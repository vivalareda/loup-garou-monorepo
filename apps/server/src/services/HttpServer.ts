import { createServer, type Server } from 'node:http';
import { Config, Context, Effect, Layer } from 'effect';

const acquire = (port: number, host: string) =>
  Effect.async<Server, Error>((resume) => {
    const server = createServer();
    server.on('error', (err) => {
      resume(Effect.fail(err));
    });
    // Use port from env if set (by test setup), otherwise config default
    const listenPort = process.env.PORT
      ? Number.parseInt(process.env.PORT, 10)
      : port;

    server.listen(listenPort, host, () => {
      console.log(
        `Werewolf Game Server running on port ${listenPort} with host ${host}`
      );
      resume(Effect.succeed(server));
    });
  });

const release = (server: Server) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log('Closing server...');
        server.close(() => {
          console.log('Server closed');
          resolve();
        });
      })
  );

export class HttpServer extends Context.Tag('HttpServer')<
  HttpServer,
  Server
>() {
  static readonly Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const port = yield* Config.port().pipe(Config.withDefault(3000));
      const host = yield* Config.string('HOST').pipe(
        Config.withDefault('0.0.0.0')
      );

      return yield* Effect.acquireRelease(acquire(port, host), release);
    })
  );
}
