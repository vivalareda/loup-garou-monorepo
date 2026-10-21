import { type EventFrame, type FrameData, parseServerFrame } from '@repo/types';
import { WebSocketHost, type WebSocketLike } from '@/server/websocket-host';

export type Frame = EventFrame;

type Listener = (event: { data: FrameData }) => void;

function ignoreClose() {
  // The host closes sockets it drops; nothing to do for a fake
}

/** A connected client socket: the test sends frames, the host's are kept. */
export function fakeSocket() {
  const listeners = new Map<string, Listener[]>();
  const frames: Frame[] = [];

  const socket: WebSocketLike = {
    readyState: 1,
    // Keeps the event frames the host sends; these fakes never ping or ask
    // for acks, so nothing else arrives
    send: (data) => {
      const frame = parseServerFrame(data);

      if (frame && 'event' in frame) {
        frames.push(frame);
      }
    },
    close: ignoreClose,
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };

  const fire = (type: string, data: FrameData = '') => {
    for (const listener of listeners.get(type) ?? []) {
      listener({ data });
    }
  };

  return {
    socket,
    frames,
    send: (event: string, ...args: unknown[]) =>
      fire('message', JSON.stringify({ event, args })),
    drop: () => fire('close'),
  };
}

export type FakeSocket = ReturnType<typeof fakeSocket>;

/** A host without the idle timer, so fake timers only see the game's. */
export const newHost = () => new WebSocketHost({ idleTimeoutMs: 0 });
