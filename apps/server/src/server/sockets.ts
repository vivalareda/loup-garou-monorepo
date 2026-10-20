import { httpServer } from './http-server';
import { WebSocketHost } from './websocket-host';
import { attachWebSocketServer } from './websocket-server';

/** The live transport: raw WebSockets on the http server's `/room/<code>`. */
const host = new WebSocketHost();

attachWebSocketServer(httpServer, host);

/** The live host's type (tests type their mock hosts with it). */
export type SocketType = WebSocketHost;

export { host };
