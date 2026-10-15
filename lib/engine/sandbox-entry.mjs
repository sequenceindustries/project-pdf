// Worker bootstrap: enable TypeScript (tsx) in this thread, then load the sandbox.
import { register } from "tsx/esm/api";
register();
await import("./sandbox-thread.ts");
