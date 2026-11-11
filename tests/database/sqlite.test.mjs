import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSqliteParams } from "@crepuse/runtime/database/sqlite";

test("accepts valid SQLite parameters", () => {
    const blob = new Uint8Array([0, 127, 255]);

    assert.deepEqual(
        normalizeSqliteParams([null, "hello", 42, 3.14, true, false, blob], "test.valid"),
        [null, "hello", 42, 3.14, 1, 0, blob],
    );
});

test("rejects invalid numeric values", () => {
    for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => normalizeSqliteParams([value], "test.invalid"), {
            code: "DATABASE_INVALID_STATEMENT",
        });
    }
});

test("rejects unsupported parameter types", () => {
    for (const value of [undefined, 42n, {}, [], new Date()]) {
        assert.throws(() => normalizeSqliteParams([value], "test.invalid"), {
            code: "DATABASE_INVALID_STATEMENT",
        });
    }
});

test("preserves parameter order", () => {
    assert.deepEqual(normalizeSqliteParams(["alice", 10, false], "test.order"), ["alice", 10, 0]);
});

test("enriches invalid parameter errors", () => {
    assert.throws(() => normalizeSqliteParams(["alice", undefined], "user.insert"), {
        code: "DATABASE_INVALID_STATEMENT",
        detail: {
            statement: "user.insert",
            field: "params",
            index: 1,
        },
    });
});

test("supports empty parameters", () => {
    assert.deepEqual(normalizeSqliteParams([], "test.empty"), []);
});
