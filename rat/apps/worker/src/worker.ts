/**
 * Placeholder Worker entry for the Alchemy stack.
 *
 * Next step (see rat/MIGRATION.md): port `apps/worker/src` GameRoom Durable
 * Object + `createGameRuntime` here, declare DO bindings in the Worker
 * construction Effect, and delete the wrangler-based `apps/worker` deploy path.
 *
 * This file must stay import-safe for `alchemy plan` without pulling the
 * Effect-3 `apps/server` tree until the port lands.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        workspace: "loup-rat",
        note: "Stub Worker — GameRoom not ported yet",
      });
    }
    return new Response(
      "Loup-Garou rat-stack Worker stub. Port apps/worker GameRoom next.",
      { status: 501 }
    );
  },
};
