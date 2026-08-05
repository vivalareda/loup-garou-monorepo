/**
 * A mock `SocketType` for headless game simulation. Records every emit —
 * broadcast (`io.emit`) and per-socket (`io.to(sid).emit`) — into an ordered
 * log the `GameSimulator` reads to know which player input a phase is waiting
 * on. Only `to` + `emit` are exercised on the simulation paths, so the rest
 * of the `Server` surface is left unimplemented (cast `as unknown as
 * SocketType` at the call site).
 */
export interface EmitRecord {
  scope: string; // 'broadcast' or a socket id
  event: string;
  args: unknown[];
}

export class RecordingIO {
  readonly emits: EmitRecord[] = [];

  to(sid: string) {
    return {
      emit: (event: string, ...args: unknown[]) => {
        this.emits.push({ scope: sid, event, args });
      },
    };
  }

  emit(event: string, ...args: unknown[]) {
    this.emits.push({ scope: 'broadcast', event, args });
  }

  /** All records for `event`, in order. */
  eventsOf(event: string): EmitRecord[] {
    return this.emits.filter((record) => record.event === event);
  }

  /** Records for `event` at or after `fromIndex`. */
  eventsOfSince(event: string, fromIndex: number): EmitRecord[] {
    return this.emits
      .slice(fromIndex)
      .filter((record) => record.event === event);
  }

  /** True if `event` has been emitted at least once. */
  emitted(event: string): boolean {
    return this.emits.some((record) => record.event === event);
  }
}
