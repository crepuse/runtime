import { DatabaseErrorCode, databaseError } from "../../errors/index.js";
import type { CrepuseResult } from "../../types.js";

export function normalizeNodeSqliteResult(
    rows: Record<string, unknown>[],
    changes: number | bigint,
    statement: string,
): CrepuseResult {
    const affected = typeof changes === "bigint" ? Number(changes) : changes;

    if (!Number.isSafeInteger(affected) || affected < 0) {
        throw databaseError(DatabaseErrorCode.InvalidResult, {
            detail: { statement, field: "affected" },
        });
    }

    return {
        rows: rows.map((row) => ({ ...row })),
        affected,
    };
}
