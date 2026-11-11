import { DatabaseErrorCode, databaseError } from "./errors/index.js";

import type {
    CrepuseResult,
    CrepuseStatement,
    CrepuseCountRange,
    CrepuseExpectation,
} from "./types.js";

const fields = ["rows", "affected"] as const;

function isCountRange(value: unknown): value is CrepuseCountRange {
    if (!Array.isArray(value) || value.length !== 2) return false;

    const [min, max] = value;

    return (
        typeof min === "number" &&
        Number.isSafeInteger(min) &&
        min >= 0 &&
        (max === null || (typeof max === "number" && Number.isSafeInteger(max) && max >= min))
    );
}

function validateExpectations(expect: CrepuseExpectation | undefined, statement: string): void {
    if (expect === undefined) return;

    if (expect === null || typeof expect !== "object" || Array.isArray(expect)) {
        throw databaseError(DatabaseErrorCode.InvalidExpectation, {
            detail: { statement },
        });
    }

    for (const key of Object.keys(expect)) {
        if (!fields.includes(key as (typeof fields)[number])) {
            throw databaseError(DatabaseErrorCode.InvalidExpectation, {
                detail: { statement, field: key },
            });
        }
    }

    for (const field of fields) {
        const range = expect[field];

        if (range !== undefined && !isCountRange(range)) {
            throw databaseError(DatabaseErrorCode.InvalidExpectation, {
                detail: { statement, field, expected: range },
            });
        }
    }
}

function assertExpectations(statement: CrepuseStatement, result: CrepuseResult): void {
    const { expect } = statement;

    validateExpectations(expect, statement.name);

    if (expect === undefined) return;

    for (const field of fields) {
        const range = expect[field];

        if (range === undefined) continue;

        const [min, max] = range;
        const actual = field === "rows" ? result.rows.length : result.affected;

        if (actual < min || (max !== null && actual > max)) {
            throw databaseError(DatabaseErrorCode.ExpectationFailed, {
                detail: {
                    statement: statement.name,
                    field,
                    expected: range,
                    actual,
                },
            });
        }
    }
}

export { validateExpectations, assertExpectations };
