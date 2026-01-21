// import { Effect, Layer } from 'effect';
// import { AudioManager } from '../AudioManager.js';
// import { SocketServer, type SocketIOInstance } from '../SocketServer.js';
//
// export const makeSocketCapture = () => {
//   const emissions: Array<{ to: string; event: string; data: unknown }> = [];
//
//   const layer = Layer.succeed(
//     SocketServer,
//     new SocketServer({
//       to: (sid: string) => ({
//         emit: (event: string, data?: unknown) => {
//           emissions.push({ to: sid, event, data });
//         },
//       }),
//     } as unknown as SocketIOInstance)
//   );
//
//   return { layer, emissions };
// };
//
// export const makeAudioCapture = () => {
//   const calls: string[] = [];
//
//   const layer = Layer.succeed(
//     AudioManager,
//     new AudioManager({
//       ...AudioManager.Test,
//       playIntro: () =>
//         Effect.sync(() => {
//           calls.push('intro');
//         }),
//       playSegmentStart: (s) =>
//         Effect.sync(() => {
//           calls.push(`start:${s}`);
//         }),
//       playSegmentEnd: (s) =>
//         Effect.sync(() => {
//           calls.push(`end:${s}`);
//         }),
//     })
//   );
//
//   return { layer, calls };
// };
