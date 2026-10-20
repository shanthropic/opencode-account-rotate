import { Plugin } from "@opencode/plugin";
import { Accounts } from "./accounts.js";
import { Dispatches } from "./dispatch.js";
import { Rotation } from "./rotation.js";
import { diagnostic, quota } from "./policy.js";
export default Plugin.define({
    id: "opencode-account-rotate",
    async setup(ctx) {
        if (typeof ctx.credential?.activate !== "function" ||
            typeof ctx.integration?.connection?.active !== "function" ||
            typeof ctx.integration?.connection?.resolve !== "function" ||
            typeof ctx.session?.hook !== "function") {
            throw new Error("opencode-account-rotate requires OpenCode V2 native activation and transport hooks (2.0.32+)");
        }
        const controller = new AbortController();
        const accounts = new Accounts(ctx);
        const dispatches = new Dispatches(accounts);
        const rotation = new Rotation(ctx, accounts, controller.signal);
        const scope = { providerID: "openai" };
        await ctx.session.hook("model.request", (event) => dispatches.begin(event), scope);
        await ctx.session.hook("http.request", async (event) => {
            await dispatches.observe(event, event.request.url, event.request.headers);
        }, scope);
        await ctx.session.hook("experimental.ws.handshake", async (event) => {
            const headers = new Headers(event.headers);
            await dispatches.observe(event, event.url, headers);
            event.headers = Object.fromEntries(headers);
        }, scope);
        await ctx.session.hook("retry", async (event) => {
            const sent = dispatches.take(event);
            const until = quota(event.error);
            if (until === undefined)
                return;
            if (!sent) {
                diagnostic("Quota failure could not be attributed unambiguously; core retry policy left unchanged.");
                return;
            }
            try {
                await rotation.recover(event, sent, until);
            }
            catch {
                event.decision = { retry: false };
                if (!controller.signal.aborted)
                    diagnostic("Account recovery failed; quota retries stopped. Check native sign-in status.");
            }
        }, scope);
        // Cleanup only terminal flows; retry scheduling is not a completion boundary.
        const terminal = new Set([
            "session.step.ended",
            "session.step.failed",
            "session.compaction.ended",
            "session.compaction.failed",
            "session.execution.succeeded",
            "session.execution.failed",
            "session.execution.interrupted",
            "session.deleted",
        ]);
        const events = (async () => {
            try {
                for await (const event of ctx.event.subscribe({
                    signal: controller.signal,
                })) {
                    if (!terminal.has(event.type) ||
                        !("created" in event) ||
                        !("sessionID" in event.data) ||
                        typeof event.data.sessionID !== "string")
                        continue;
                    dispatches.clear(event.data.sessionID, event.created);
                    rotation.clear(event.data.sessionID, event.created);
                }
            }
            catch {
                if (!controller.signal.aborted)
                    diagnostic("Lifecycle event stream ended; attribution uses bounded expiry until reload.");
            }
        })();
        return async () => {
            controller.abort();
            dispatches.dispose();
            await events;
        };
    },
});
