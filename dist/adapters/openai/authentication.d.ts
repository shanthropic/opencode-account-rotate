import type { Credential } from "@opencode/plugin";
import type { Route } from "./endpoints.js";
export declare function route(value: Credential.Value): Route | undefined;
export declare function accountHeader(value: Credential.Value): string | undefined;
