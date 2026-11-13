import { DatabaseErrorCode, databaseError } from "../../errors/index.js";
import { assertExpectations, validateExpectations } from "../../expect.js";
import type { CrepuseResult, CrepuseStatement } from "../../types.js";
import { normalizeSqliteParams } from "../params.js";
import type { CrepuseSqliteDatabase, SqliteBoundValue, SqliteValue } from "../types.js";
import { normalizeD1Result } from "./result.js";
import type { D1ResultLike } from "./result.js";

interface D1PreparedLike {
    bind(...values: unknown[]): D1PreparedLike;
    run(): Promise<D1ResultLike>;
}

interface D1DatabaseLike {
    prepare(sql: string): D1PreparedLike;
    batch(statements: D1PreparedLike[]): Promise<D1ResultLike[]>;
}

type Statement = CrepuseStatement<unknown, unknown[], SqliteValue>;

function validate(statement: Statement): SqliteBoundValue[] {
    if (
        !statement ||
        typeof statement.name !== "string" ||
        !statement.name.trim() ||
        typeof statement.sql !== "string" ||
        !statement.sql.trim()
    ) {
        throw databaseError(DatabaseErrorCode.InvalidStatement);
    }

    validateExpectations(statement.expect, statement.name);
    return normalizeSqliteParams(statement.params, statement.name);
}

export function createD1Database(binding: D1DatabaseLike): CrepuseSqliteDatabase {
    function prepare(statement: Statement, params: SqliteBoundValue[]): D1PreparedLike {
        const prepared = binding.prepare(statement.sql);
        return params.length ? prepared.bind(...params) : prepared;
    }

    async function execute(statement: Statement): Promise<CrepuseResult> {
        const params = validate(statement);

        let raw: D1ResultLike;

        try {
            raw = await prepare(statement, params).run();
        } catch (cause) {
            throw databaseError(DatabaseErrorCode.ExecutionFailed, {
                cause,
                detail: { statement: statement.name },
            });
        }

        const result = normalizeD1Result(raw, statement.name);
        assertExpectations(statement, result);

        return result;
    }

    return {
        run: execute,

        async query<TRow = unknown>(
            statement: CrepuseStatement<TRow, TRow[], SqliteValue>,
        ): Promise<TRow[]> {
            const result = await execute(statement);
            return result.rows as TRow[];
        },

        async batch(statements: readonly Statement[]): Promise<CrepuseResult[]> {
            if (!Array.isArray(statements)) {
                throw databaseError(DatabaseErrorCode.InvalidStatement, {
                    detail: { operation: "batch" },
                });
            }

            if (statements.length === 0) return [];

            const entries = Array.from(statements, (statement) => ({
                statement,
                params: validate(statement),
            }));

            let raw: D1ResultLike[];

            try {
                const prepared = entries.map(({ statement, params }) => prepare(statement, params));

                raw = await binding.batch(prepared);
            } catch (cause) {
                throw databaseError(DatabaseErrorCode.ExecutionFailed, {
                    cause,
                    detail: { operation: "batch" },
                });
            }

            if (!Array.isArray(raw) || raw.length !== entries.length) {
                throw databaseError(DatabaseErrorCode.InvalidResult, {
                    detail: { operation: "batch" },
                });
            }

            return Array.from(raw, (value, index) => {
                const statement = entries[index]!.statement;
                const result = normalizeD1Result(value, statement.name);

                assertExpectations(statement, result);
                return result;
            });
        },
    };
}
