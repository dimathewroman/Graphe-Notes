export * from "./generated/api";
// Re-export type-only definitions from the generated types folder.
// We selectively export to avoid name collisions with the Zod schema exports above.
export type { AuthUser } from "./generated/types/authUser";
export type { AuthUserEnvelope } from "./generated/types/authUserEnvelope";
export type { Folder } from "./generated/types/folder";
export type { Note } from "./generated/types/note";
export type { SmartFolder } from "./generated/types/smartFolder";
