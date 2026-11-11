import { DatabaseErrorCode, databaseError } from "../errors/index.js";
import type { SqliteBoundValue } from "./types.js";

export function normalizeSqliteParams(
    params: readonly unknown[],
    statement: string,
): SqliteBoundValue[] {
    if (!Array.isArray(params)) {
        throw databaseError(DatabaseErrorCode.InvalidStatement, {
            detail: { statement, field: "params" },
        });
    }

    return params.map((value, index): SqliteBoundValue => {
        if (value === null || typeof value === "string") {
            return value;
        }

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        }

        if (typeof value === "number") {
            if (
                Number.isFinite(value) &&
                (!Number.isInteger(value) || Number.isSafeInteger(value))
            ) {
                return value;
            }
        }

        if (value instanceof Uint8Array) {
            return value;
        }

        throw databaseError(DatabaseErrorCode.InvalidStatement, {
            detail: {
                statement,
                field: "params",
                index,
            },
        });
    });
}
