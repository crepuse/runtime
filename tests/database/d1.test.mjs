import test from "node:test";
import assert from "node:assert/strict";

import { createD1Database } from "@crepuse/runtime/database/sqlite/d1";

function result(rows = [], changes = 0) {
    return { success: true, results: rows, meta: { changes } };
}

function mockD1(handler) {
    const calls = [];

    return {
        calls,
        binding: {
            prepare(sql) {
                let params = [];

                return {
                    bind(...values) {
                        params = values;
                        return this;
                    },
                    async run() {
                        calls.push({ sql, params });
                        return handler(sql, params);
                    },
                };
            },
            async batch(statements) {
                const results = [];

                for (const statement of statements) {
                    results.push(await statement.run());
                }

                return results;
            },
        },
    };
}

test("run and query return normalized results", async () => {
    const { binding } = mockD1(() => result([{ id: 1, secret: [1, 2, 255] }]));

    const db = createD1Database(binding);
    const statement = {
        name: "user.find",
        sql: "SELECT * FROM users WHERE id = ?",
        params: [1],
        expect: { rows: [1, 1] },
    };

    const executed = await db.run(statement);
    const rows = await db.query(statement);

    assert.deepEqual(executed.rows, [{ id: 1, secret: new Uint8Array([1, 2, 255]) }]);
    assert.equal(executed.affected, 0);
    assert.deepEqual(rows, executed.rows);
});

test("batch preserves order and normalizes parameters", async () => {
    const { binding, calls } = mockD1((sql, params) => result([{ sql, value: params[0] }], 1));

    const db = createD1Database(binding);

    const results = await db.batch([
        { name: "first", sql: "SELECT 1", params: [true] },
        { name: "second", sql: "SELECT 2", params: [false] },
    ]);

    assert.deepEqual(
        calls.map((call) => call.params),
        [[1], [0]],
    );
    assert.deepEqual(
        results.map((value) => value.rows[0].value),
        [1, 0],
    );
});

test("batch validates before executing", async () => {
    const { binding, calls } = mockD1(() => result());
    const db = createD1Database(binding);

    await assert.rejects(
        db.batch([
            { name: "valid", sql: "SELECT 1", params: [] },
            { name: "invalid", sql: "SELECT ?", params: [undefined] },
        ]),
        { code: "DATABASE_INVALID_STATEMENT" },
    );

    assert.equal(calls.length, 0);
});

test("execution errors preserve the cause", async () => {
    const cause = new Error("D1 failure");
    const { binding } = mockD1(() => {
        throw cause;
    });

    const db = createD1Database(binding);

    await assert.rejects(
        db.run({
            name: "user.insert",
            sql: "INSERT INTO users VALUES (?)",
            params: [1],
        }),
        (error) => {
            assert.equal(error.code, "DATABASE_EXECUTION_FAILED");
            assert.equal(error.cause, cause);
            return true;
        },
    );
});
