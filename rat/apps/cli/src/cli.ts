#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Approval } from "@rat-stack/capability";
import { GameHarness } from "@loup/game";
import { Effect, Layer } from "effect";

import { runCommand } from "./command.js";

const program = runCommand(process.argv.slice(2)).pipe(
  Effect.provide(
    Layer.mergeAll(
      GameHarness.layer,
      NodeServices.layer,
      Approval.denyAll
    )
  )
);

NodeRuntime.runMain(program);
