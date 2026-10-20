import type { Credential, Model, Plugin } from "@opencode/plugin";

export type Context = Plugin.Context;
export type Saved = Extract<
  Awaited<ReturnType<Context["integration"]["connection"]["active"]>>,
  { type: "credential" }
>;
export type Route = "codex" | "api";
export interface Account {
  connection: Saved;
  value: Credential.Value;
  route?: Route;
}

export function route(value: Credential.Value): Route | undefined {
  if (value.type === "key") return "api";
  if (value.type !== "oauth") return;
  if (value.methodID === "chatgpt-token-sharing") return "api";
  if (
    value.methodID === "chatgpt-browser" ||
    value.methodID === "chatgpt-headless"
  )
    return "codex";
}

export function bearer(value: Credential.Value): string | undefined {
  return value.type === "oauth"
    ? value.access
    : value.type === "key"
      ? value.key
      : undefined;
}

export function accountHeader(value: Credential.Value): string | undefined {
  const id = value.metadata?.accountID;
  return typeof id === "string" ? id : undefined;
}

/** Strict endpoint boundaries; custom routes are never authenticated by this plugin. */
export function destination(input: string): Route | undefined {
  try {
    const url = new URL(input);
    if (url.username || url.password || url.port || url.hash || url.search)
      return;
    if (url.protocol !== "https:" && url.protocol !== "wss:") return;
    if (
      url.hostname === "chatgpt.com" &&
      /^\/backend-api\/codex\/responses(?:\/compact)?$/.test(url.pathname)
    )
      return "codex";
    if (
      url.hostname === "api.openai.com" &&
      /^\/v1\/(?:responses(?:\/compact)?|chat\/completions)$/.test(url.pathname)
    )
      return "api";
  } catch {
    /* Unknown routes remain unmanaged. */
  }
}

function baseRoute(input: unknown): Route | undefined {
  if (typeof input !== "string") return;
  return destination(`${input.replace(/\/$/, "")}/responses`);
}

export class Accounts {
  private resolving = new Map<string, Promise<Account | undefined>>();
  private order: string[] = [];

  constructor(private ctx: Context) {}

  async list(): Promise<Saved[]> {
    const result = await this.ctx.integration.get({ integrationID: "openai" });
    const entries = result.data.connections.filter(
      (c): c is Saved => c.type === "credential",
    );
    const byID = new Map(entries.map((c) => [c.id, c]));
    this.order = this.order.filter((id) => byID.has(id as Saved["id"]));
    for (const id of byID.keys())
      if (!this.order.includes(id)) this.order.push(id);
    return this.order.flatMap((id) => {
      const entry = byID.get(id as Saved["id"]);
      return entry ? [entry] : [];
    });
  }

  async active(): Promise<Account | undefined> {
    const connection = await this.ctx.integration.connection.active("openai");
    return connection?.type === "credential"
      ? this.resolve(connection)
      : undefined;
  }

  async activeID(): Promise<string | undefined> {
    const connection = await this.ctx.integration.connection.active("openai");
    return connection?.type === "credential" ? connection.id : undefined;
  }

  resolve(connection: Saved): Promise<Account | undefined> {
    const existing = this.resolving.get(connection.id);
    if (existing) return existing;
    const pending = this.ctx.integration.connection
      .resolve(connection)
      .then((value) =>
        value ? { connection, value, route: route(value) } : undefined,
      )
      .finally(() => this.resolving.delete(connection.id));
    this.resolving.set(connection.id, pending);
    return pending;
  }

  /** Reads available models, not provider.get()'s possibly inactive definition. */
  async ready(account: Account, ref: Model.Ref): Promise<boolean> {
    if (!account.route || (await this.activeID()) !== account.connection.id)
      return false;
    const [providers, models] = await Promise.all([
      this.ctx.provider.list(),
      this.ctx.model.list(),
    ]);
    const provider = providers.data.find((p) => p.id === ref.providerID);
    const model = models.data.find(
      (m) => m.providerID === ref.providerID && m.id === ref.id && m.enabled,
    );
    if (!provider || !model) return false;
    if (
      ref.variant &&
      ref.variant !== "default" &&
      !model.variants.some((v) => v.id === ref.variant)
    )
      return false;
    const variant = model.variants.find(
      (item) => item.id === ref.variant && ref.variant !== "default",
    );
    const settings = {
      ...provider.settings,
      ...model.settings,
      ...variant?.settings,
    };
    if (
      baseRoute(settings.baseURL ?? "https://api.openai.com/v1") !==
      account.route
    )
      return false;
    if (
      account.value.type === "oauth" &&
      account.value.methodID === "chatgpt-token-sharing" &&
      (settings.transport !== "http" || settings.compaction?.type !== "summary")
    )
      return false;
    const headers = new Headers({
      ...provider.headers,
      ...model.headers,
      ...variant?.headers,
    });
    const accountID = headers.get("chatgpt-account-id") ?? undefined;
    if (account.route === "codex" && accountID !== accountHeader(account.value))
      return false;
    if (account.route === "api" && accountID !== undefined) return false;
    return (await this.activeID()) === account.connection.id;
  }

  /** Account-neutral route/model fingerprint for prepared compaction reuse. */
  async signature(ref: Model.Ref): Promise<string> {
    const [models, providers] = await Promise.all([
      this.ctx.model.list(),
      this.ctx.provider.list(),
    ]);
    const model = models.data.find(
      (m) => m.providerID === ref.providerID && m.id === ref.id,
    );
    const provider = providers.data.find((p) => p.id === ref.providerID);
    if (!model || !provider) return "";
    const clean = (input: { headers?: Record<string, string> }) => {
      const headers = new Headers(input.headers);
      headers.delete("authorization");
      headers.delete("chatgpt-account-id");
      headers.delete("api-key");
      return { ...input, headers: Object.fromEntries(headers) };
    };
    return hash(JSON.stringify([clean(provider), clean(model)]));
  }
}

export async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
