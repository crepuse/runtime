import { DatabaseErrorCode, databaseError } from "../../errors/index.js";
import type { CrepuseResult } from "../../types.js";

export interface D1ResultLike {
    success: boolean;
    results: unknown[] | null;
    meta: {
        changes: number;
    };
}

export function normalizeD1Result(raw: D1ResultLike, statement: string): CrepuseResult {
    function invalid(field: string): never {
        throw databaseError(DatabaseErrorCode.InvalidResult, {
            detail: { statement, field },
        });
    }

    if (
        !raw ||
        raw.success !== true ||
        !raw.meta ||
        !Number.isSafeInteger(raw.meta.changes) ||
        raw.meta.changes < 0 ||
        (raw.results !== null && !Array.isArray(raw.results))
    ) {
        invalid("result");
    }

    const rows = Array.from(raw.results ?? [], (row, index) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
            invalid(`results[${index}]`);
        }

        return Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
                if (!Array.isArray(value)) return [key, value];

                for (const byte of value) {
                    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
                        invalid(`results[${index}].${key}`);
                    }
                }

                return [key, Uint8Array.from(value)];
            }),
        );
    });

    return {
        rows,
        affected: raw.meta.changes,
    };
}
