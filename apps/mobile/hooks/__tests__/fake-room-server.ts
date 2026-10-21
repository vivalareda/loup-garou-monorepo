import { vi } from 'vitest';
import type { RoomServer } from '@/hooks/room';

/**
 * A `RoomServer` whose answers the test sets (`exists.mockResolvedValue`…)
 * and whose `connect` calls it reads back.
 */
export function createFakeRoomServer() {
  return {
    create: vi.fn<RoomServer['create']>(),
    exists: vi.fn<RoomServer['exists']>(),
    connect: vi.fn<RoomServer['connect']>(),
  } satisfies RoomServer;
}
