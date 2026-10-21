import { capabilities } from "@loup/game";
import { toToolkit } from "@rat-stack/capability";
import { Layer, Logger } from "effect";
import { McpServer } from "effect/ai";

import { mcpProtocols } from "./mcp-protocols.js";
import { VERSION } from "./version.js";

export { capabilities };

export const tools = toToolkit(capabilities);

const stdio = McpServer.layerStdio({
  name: "loup-garou",
  protocols: mcpProtocols,
  version: VERSION,
});

const withStdio = <A, E, R>(server: Layer.Layer<A, E, R>) =>
  server.pipe(
    Layer.provide(stdio),
    Layer.provide(Layer.succeed(Logger.LogToStderr, true))
  );

export const mcpServer = {
  tools: withStdio(
    McpServer.toolkit(tools.toolkit).pipe(Layer.provideMerge(tools.layer))
  ),
};
