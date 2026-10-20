import type { Adapter } from "../contract.js";
import type { Account, Capability } from "../../core/types.js";
import type { Snapshot } from "../../core/model.js";
import { directToken, fingerprint, signature } from "./authentication.js";
import { classify } from "./quota.js";
import type { Profile } from "./profiles.js";

export class StandardAdapter implements Adapter {
  readonly id: string;
  constructor(protected profile: Profile) { this.id = profile.id; }

  matches(snapshot: Snapshot): boolean {
    return this.profile.providers.includes(snapshot.binding.providerID) &&
      this.profile.packages.includes(snapshot.binding.package) &&
      (snapshot.binding.canonical === undefined || this.profile.canonical.includes(snapshot.binding.canonical));
  }
  capability(account: Account): Capability {
    return this.profile.credential(account.value) && directToken(account.value)
      ? "continue" as const : "unsupported" as const;
  }
  quota(error: Parameters<Adapter["quota"]>[0]) {
    return classify(error, this.profile.quota);
  }
  async inspect(account: Account | undefined, url: string, headers: Headers, snapshot: Snapshot) {
    const route = this.profile.destination(url);
    const observed = headers.get(this.profile.header);
    if (!this.matches(snapshot) || !route || !observed || !observed.startsWith(this.profile.scheme)) return;
    return {
      route,
      fingerprint: await fingerprint(
        JSON.stringify([snapshot.binding.integrationID, snapshot.binding.providerID, this.id, snapshot.binding.package]),
        route, headers, [this.profile.header, ...this.profile.identityHeaders],
      ),
      matches: !!account && this.capability(account) === "continue" &&
        observed === `${this.profile.scheme}${directToken(account.value)}`,
    };
  }
  ready(account: Account, snapshot: Snapshot): boolean {
    return this.matches(snapshot) && this.capability(account) === "continue" &&
      this.profile.configuration(account, snapshot);
  }
  signature(snapshot: Snapshot): Promise<string> {
    const clean = (input: Record<string, string> | undefined) => {
      const headers = new Headers(input);
      for (const key of [this.profile.header, ...this.profile.identityHeaders]) headers.delete(key);
      return Object.fromEntries(headers);
    };
    // Full definitions catch route/config changes beyond the selected variant.
    return signature({
      binding: snapshot.binding,
      provider: { ...snapshot.provider, headers: clean(snapshot.provider.headers) },
      model: { ...snapshot.model, headers: clean(snapshot.model.headers) },
      settings: snapshot.settings, body: snapshot.body,
      headers: clean(Object.fromEntries(snapshot.headers)),
    });
  }
}
