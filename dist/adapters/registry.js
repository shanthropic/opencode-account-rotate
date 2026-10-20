import { OpenAIAdapter } from "./openai/adapter.js";
import { StandardAdapter } from "./standard/adapter.js";
import { profiles } from "./standard/profiles.js";
const openai = new OpenAIAdapter();
const standard = profiles.map((profile) => new StandardAdapter(profile));
export function resolveAdapter(snapshot) {
    // Claim the namespace first. A specialized refusal NEVER falls through.
    if (snapshot.binding.providerID === "openai")
        return openai.matches(snapshot) ? openai : undefined;
    return standard.find((adapter) => adapter.matches(snapshot));
}
