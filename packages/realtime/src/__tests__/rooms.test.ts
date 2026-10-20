import { describe, expect, it, vi } from 'vitest';
import { createRoom, RoomApiError, roomExists } from '../rooms';

const BASE = 'https://game.test/';

/** A fetch answering every call with `status` and `body`. */
function answering(status: number, body: unknown) {
  return vi.fn(async () =>
    typeof body === 'string'
      ? new Response(body, { status })
      : Response.json(body, { status })
  );
}

describe('createRoom', () => {
  it('POSTs to /rooms with the token and returns the code', async () => {
    const fetch = answering(201, { code: 'ABCD2345' });

    const code = await createRoom(BASE, { accessToken: 's3 cret', fetch });

    expect(code).toBe('ABCD2345');
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://game.test/rooms?token=s3%20cret',
      { method: 'POST' }
    );
  });

  it('throws a RoomApiError with the status when refused', async () => {
    const fetch = answering(401, 'Missing or wrong access token');

    const created = createRoom(BASE, { fetch });

    await expect(created).rejects.toBeInstanceOf(RoomApiError);
    await expect(created).rejects.toMatchObject({ status: 401 });
  });
});

describe('roomExists', () => {
  it('GETs /rooms/<code> and is true on 200', async () => {
    const fetch = answering(200, { code: 'ABCD2345' });

    expect(await roomExists(BASE, 'ABCD2345', { fetch })).toBe(true);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://game.test/rooms/ABCD2345'
    );
  });

  it('is false on 404', async () => {
    const fetch = answering(404, 'No such room');
    expect(await roomExists(BASE, 'NOPE2345', { fetch })).toBe(false);
  });

  it('throws on any other answer', async () => {
    const fetch = answering(503, 'busy');
    await expect(roomExists(BASE, 'ABCD2345', { fetch })).rejects.toMatchObject(
      { status: 503 }
    );
  });
});
