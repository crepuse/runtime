import test from "node:test";
import assert from "node:assert/strict";

import { validateExpectations, assertExpectations } from "../../dist/database/expect.js";

const statement = (expect) => ({
    name: "test.query",
    sql: "SELECT 1",
    params: [],
    expect,
});

test("accepts undefined expectations", () => {
    assert.doesNotThrow(() => {
        validateExpectations(undefined, "test.query");
    });
});

test("accepts inclusive boundaries", () => {
    assert.doesNotThrow(() => {
        assertExpectations(
            statement({
                rows: [0, 0],
                affected: [0, 0],
            }),
            { rows: [], affected: 0 },
        );
    });

    assert.doesNotThrow(() => {
        assertExpectations(
            statement({
                rows: [1, 2],
            }),
            { rows: [{ id: 1 }, { id: 2 }], affected: 0 },
        );
    });
});

test("supports unbounded maximum", () => {
    assert.doesNotThrow(() => {
        assertExpectations(
            statement({
                rows: [1, null],
            }),
            {
                rows: Array.from({ length: 100 }, (_, id) => ({ id })),
                affected: 0,
            },
        );
    });
});

test("rejects invalid ranges", () => {
    const invalidRanges = [
        [-1, 1],
        [2, 1],
        [0, -1],
        [0, NaN],
        [0, Infinity],
        [1.5, 2],
        [0],
        [0, 1, 2],
        null,
        "invalid",
    ];

    for (const range of invalidRanges) {
        assert.throws(() => validateExpectations({ rows: range }, "test.query"), {
            code: "DATABASE_INVALID_EXPECTATION",
        });
    }
});

test("rejects unknown expectation fields", () => {
    assert.throws(
        () => {
            validateExpectations(
                {
                    affectedRows: [1, 1],
                },
                "test.query",
            );
        },
        {
            code: "DATABASE_INVALID_EXPECTATION",
            detail: {
                statement: "test.query",
                field: "affectedRows",
            },
        },
    );
});

test("rejects malformed expectation objects", () => {
    for (const expect of [null, [], "invalid", 42]) {
        assert.throws(() => validateExpectations(expect, "test.query"), {
            code: "DATABASE_INVALID_EXPECTATION",
        });
    }
});

test("reports unexpected row counts", () => {
    assert.throws(
        () => {
            assertExpectations(
                statement({
                    rows: [1, 1],
                }),
                { rows: [], affected: 0 },
            );
        },
        {
            code: "DATABASE_EXPECTATION_FAILED",
            detail: {
                statement: "test.query",
                field: "rows",
                expected: [1, 1],
                actual: 0,
            },
        },
    );
});

test("reports unexpected affected counts", () => {
    assert.throws(
        () => {
            assertExpectations(
                statement({
                    affected: [1, 1],
                }),
                { rows: [], affected: 2 },
            );
        },
        {
            code: "DATABASE_EXPECTATION_FAILED",
            detail: {
                statement: "test.query",
                field: "affected",
                expected: [1, 1],
                actual: 2,
            },
        },
    );
});
