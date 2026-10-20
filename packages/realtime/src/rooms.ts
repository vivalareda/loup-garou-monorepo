import { type RoomInfo, roomsApiUrl } from '@repo/types';

/** The room API answered something other than what the call expects. */
export class RoomApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RoomApiError';
    this.status = status;
  }
}

type RoomApiOptions = {
  /** The Worker's optional shared token, sent as `?token=`. */
  accessToken?: string | undefined;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

/**
 * Reads the `RoomInfo` of a successful answer. A body-less request with no
 * custom header is a "simple" CORS request, so browsers need no preflight.
 */
async function readRoom(response: Response): Promise<RoomInfo> {
  if (!response.ok) {
    throw new RoomApiError(
      response.status,
      `Room API answered ${response.status}: ${await response.text()}`
    );
  }
  const body = (await response.json()) as Partial<RoomInfo>;
  if (typeof body.code !== 'string') {
    throw new RoomApiError(response.status, 'Room API sent no room code');
  }
  return { code: body.code };
}

/**
 * Creates a private room on the server at `baseUrl` (its http(s) base URL)
 * and returns its code. Throws a `RoomApiError` when refused (401 for a
 * wrong token), or the fetch error when the server is unreachable.
 */
export async function createRoom(
  baseUrl: string,
  { accessToken, fetch: fetchImpl = fetch }: RoomApiOptions = {}
): Promise<string> {
  const response = await fetchImpl(
    roomsApiUrl(baseUrl, undefined, accessToken),
    { method: 'POST' }
  );
  return (await readRoom(response)).code;
}

/**
 * Whether the room `code` exists (was created and has not expired), so a
 * mistyped code can be reported before connecting: a refused WebSocket
 * upgrade looks the same as a network failure to the client.
 */
export async function roomExists(
  baseUrl: string,
  code: string,
  { accessToken, fetch: fetchImpl = fetch }: RoomApiOptions = {}
): Promise<boolean> {
  const response = await fetchImpl(roomsApiUrl(baseUrl, code, accessToken));
  if (response.status === 404) {
    return false;
  }
  await readRoom(response);
  return true;
}
