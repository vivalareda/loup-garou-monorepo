import { toCommand } from "@rat-stack/capability";
import { capabilities } from "@loup/game";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";

import { mcpServer } from "./surfaces.js";
import { VERSION } from "./version.js";

export { VERSION } from "./version.js";

const capabilityCommands = capabilities.map((capability) =>
  toCommand(capability)
);

const mcpCommand = Command.make("mcp", {}, () =>
  Layer.launch(mcpServer.tools).pipe(Effect.orDie)
).pipe(
  Command.withDescription(
    "Serve Loup-Garou harness capabilities as an MCP server over stdio"
  )
);

export const rootCommand = Command.make("loup").pipe(
  Command.withDescription(
    "Loup-Garou agent harness: one capability surface for CLI and MCP"
  ),
  Command.withSubcommands([...capabilityCommands, mcpCommand])
);

export const runCommand = Command.runWith(rootCommand, { version: VERSION });
