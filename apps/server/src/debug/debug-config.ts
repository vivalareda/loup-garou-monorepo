import { Context, Effect, Layer } from 'effect';

export class DebugConfig extends Context.Tag('DebugConfig')<
  DebugConfig,
  { debugSegment: boolean }
>() {
  static readonly Live = Layer.effect(
    this,
    Effect.sync(() => ({
      debugSegment: process.env.DEBUG_SEGMENT === 'true',
    }))
  );
  static readonly Test = Layer.effect(
    this,
    Effect.succeed({ debugSegment: true })
  );
}
