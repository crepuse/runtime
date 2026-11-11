import { RuntimeError } from "../../errors/index.js";

export enum DatabaseErrorCode {
    InvalidStatement = "DATABASE_INVALID_STATEMENT",
    InvalidExpectation = "DATABASE_INVALID_EXPECTATION",
    InvalidResult = "DATABASE_INVALID_RESULT",
    ExpectationFailed = "DATABASE_EXPECTATION_FAILED",
    ExecutionFailed = "DATABASE_EXECUTION_FAILED",
}

const messages: Record<DatabaseErrorCode, string> = {
    [DatabaseErrorCode.InvalidStatement]: "Invalid database statement",
    [DatabaseErrorCode.InvalidExpectation]: "Invalid database expectation",
    [DatabaseErrorCode.InvalidResult]: "Invalid database result",
    [DatabaseErrorCode.ExpectationFailed]: "Database expectation failed",
    [DatabaseErrorCode.ExecutionFailed]: "Database execution failed",
};

export function databaseError(
    code: DatabaseErrorCode,
    options: {
        cause?: unknown;
        detail?: Record<string, unknown>;
    } = {},
): RuntimeError<DatabaseErrorCode> {
    return new RuntimeError(code, messages[code], options);
}
