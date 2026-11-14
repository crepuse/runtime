import { DatabaseErrorCode, databaseError } from "../../errors/index.js";
import { assertExpectations, validateExpectations } from "../../expect.js";
import type { CrepuseResult, CrepuseStatement } from "../../types.js";
import { normalizeSqliteParams } from "../params.js";
import type { CrepuseSqliteDatabase, SqliteBoundValue, SqliteValue } from "../types.js";
import { normalizeNodeSqliteResult } from "./result.js";

interface NodeSqliteStatementLike {
    columns(): readonly unknown[];
    all(...params: SqliteBoundValue[]): Record<string, unknown>[];
    get(...params: SqliteBoundValue[]): Record<string, unknown> | undefined;
    run(...params: SqliteBoundValue[]): {
        changes: number | bigint;
    };
}

interface NodeSqliteLike {
    prepare(sql: string): NodeSqliteStatementLike;
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

export function createNodeSqliteDatabase(database: NodeSqliteLike): CrepuseSqliteDatabase {
    const totalChanges = database.prepare("SELECT total_changes() AS count");
    const directChanges = database.prepare("SELECT changes() AS count");

    function readCount(prepared: NodeSqliteStatementLike): number | bigint {
        const value = prepared.get()?.count;

        if (typeof value !== "number" && typeof value !== "bigint") {
            throw databaseError(DatabaseErrorCode.InvalidResult, {
                detail: { field: "affected" },
            });
        }

        return value;
    }

    function execute(statement: Statement, params: SqliteBoundValue[]): CrepuseResult {
        let rows: Record<string, unknown>[] = [];
        let changes: number | bigint = 0;

        try {
            const prepared = database.prepare(statement.sql);

            if (prepared.columns().length > 0) {
                const before = readCount(totalChanges);

                rows = prepared.all(...params);

                const after = readCount(totalChanges);

                if (after !== before) {
                    changes = readCount(directChanges);
                }
            } else {
                changes = prepared.run(...params).changes;
            }
        } catch (cause) {
            throw databaseError(DatabaseErrorCode.ExecutionFailed, {
                cause,
                detail: { statement: statement.name },
            });
        }

        return normalizeNodeSqliteResult(rows, changes, statement.name);
    }

    async function run(statement: Statement): Promise<CrepuseResult> {
        const params = validate(statement);
        const result = execute(statement, params);

        assertExpectations(statement, result);
        return result;
    }

    return {
        run,

        async query<TRow = unknown>(
            statement: CrepuseStatement<TRow, TRow[], SqliteValue>,
        ): Promise<TRow[]> {
            return (await run(statement)).rows as TRow[];
        },

        async batch(statements: readonly Statement[]): Promise<CrepuseResult[]> {
            if (!Array.isArray(statements)) {
                throw databaseError(DatabaseErrorCode.InvalidStatement, {
                    detail: { operation: "batch" },
                });
            }

            const entries = Array.from(statements, (statement) => ({
                statement,
                params: validate(statement),
            }));

            return entries.map(({ statement, params }) => {
                const result = execute(statement, params);

                assertExpectations(statement, result);
                return result;
            });
        },
    };
}
