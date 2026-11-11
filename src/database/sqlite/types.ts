import type { CrepuseDatabase } from "../types.js";

export type SqliteValue = string | number | boolean | null | Uint8Array;

export type SqliteBoundValue = Exclude<SqliteValue, boolean>;

export type CrepuseSqliteDatabase = CrepuseDatabase<SqliteValue>;
