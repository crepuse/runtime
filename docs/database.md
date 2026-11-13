# Database Abstraction

`@crepuse/runtime/database` provides the core database abstraction layer for the crepuse runtime. It defines a unified database execution interface, execution result standards, an expectation assertion mechanism, and error handling specifications.

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [Type Definitions & Interfaces](#type-definitions--interfaces)
    - [CrepuseStatement](#crepusestatement)
    - [CrepuseResult](#crepuseresult)
    - [CrepuseDatabase](#crepusedatabase)
- [Expectation Mechanism (Expectations)](#expectation-mechanism-expectations)
    - [CrepuseCountRange](#crepusecountrange)
    - [CrepuseExpectation](#crepuseexpectation)
    - [Validation & Assertion Functions](#validation--assertion-functions)
- [SQLite Extensions](#sqlite-extensions)
    - [Type Definitions](#type-definitions)
    - [Parameter Normalization (normalizeSqliteParams)](#parameter-normalization-normalizesqliteparams)
- [Error Handling & Error Codes](#error-handling--error-codes)
- [Related Adapters](#related-adapters)

---

## Core Concepts

The database layer of the crepuse runtime follows these design principles:

1. **Unified Interface**: Exposes a consistent execution interface across different database instances.
2. **Structured Statements**: Encapsulates each execution into a statement object containing name, SQL, parameters, and expectations.
3. **Built-in Expectations**: Native support for row count and affected count assertions at the database layer, automatically throwing structured errors when results deviate from expectations.
4. **Strong Typing & Normalization**: Provides parameter normalization and validation, rejecting sparse arrays, invalid numbers (e.g. `NaN`, `Infinity`), and unsafe integers.

---

## Type Definitions & Interfaces

### CrepuseStatement

Represents a database statement to be executed:

```typescript
export interface CrepuseStatement<TRow = unknown, TRows extends TRow[] = TRow[], TParam = unknown> {
    /** Statement identifier for logging, tracing, and debugging (e.g. "user.findById") */
    name: string;
    /** SQL statement template (using placeholders, e.g. ?) */
    sql: string;
    /** Bound parameter list */
    params: TParam[];
    /** Expected assertions on the execution result (optional) */
    expect?: CrepuseExpectation;
}
```

### CrepuseResult

Unified database execution result format:

```typescript
export interface CrepuseResult<TRows extends unknown[] = unknown[]> {
    /** Array of row data returned by the query */
    rows: TRows;
    /** Number of affected records (applicable to INSERT/UPDATE/DELETE) */
    affected: number;
}
```

### CrepuseDatabase

Core database client interface:

```typescript
export interface CrepuseDatabase<TParam = unknown> {
    /**
     * Executes a statement and returns the normalized result (including rows and affected).
     * Expectation validations and assertions run automatically before and after execution.
     */
    run(statement: CrepuseStatement<unknown, unknown[], TParam>): Promise<CrepuseResult>;

    /**
     * Executes a query statement and directly returns a strongly-typed array of row data.
     */
    query<TRow = unknown>(statement: CrepuseStatement<TRow, TRow[], TParam>): Promise<TRow[]>;

    /**
     * Executes multiple statements in a batch.
     * Pre-validates all statements before execution to ensure fail-fast behavior.
     */
    batch(
        statements: readonly CrepuseStatement<unknown, unknown[], TParam>[],
    ): Promise<CrepuseResult[]>;
}
```

---

## Expectation Mechanism (Expectations)

When executing database operations, application logic often has deterministic expectations regarding returned or affected row counts (e.g. primary key lookups expect exactly 1 row, updating a record expects 1 affected row, unique insertions expect 1 affected row).

This project delegates this validation capability directly to the runtime via `CrepuseExpectation`.

### CrepuseCountRange

The expected count range is defined as a two-element closed interval tuple `[min, max]`:

```typescript
export type CrepuseCountRange = readonly [min: number, max: number | null];
```

- `min`: Must be a non-negative safe integer (`>= 0`).
- `max`:
    - When `number`: Must be a safe integer and `>= min`.
    - When `null`: Indicates no upper bound (unbounded).

**Common Range Examples**:

- `[0, 0]`: Expects empty results (0 rows).
- `[1, 1]`: Expects exactly 1 row.
- `[0, 1]`: Expects at most 1 row (optional match).
- `[1, null]`: Expects at least 1 row.

### CrepuseExpectation

```typescript
export interface CrepuseExpectation {
    /** Expected returned row count range (evaluated against result.rows.length) */
    rows?: CrepuseCountRange;
    /** Expected affected row count range (evaluated against result.affected) */
    affected?: CrepuseCountRange;
}
```

### Validation & Assertion Functions

The database module exports two validation functions:

1. **`validateExpectations(expect, statementName)`**:
    - Validates whether the `expect` object and its range formats are well-formed before statement execution.
    - Throws a `DATABASE_INVALID_EXPECTATION` error if unknown fields are present, ranges are not valid arrays, or numbers are negative/floating-point.
2. **`assertExpectations(statement, result)`**:
    - Asserts that the actual `rows.length` and `affected` count satisfy the specified ranges after execution.
    - Throws a `DATABASE_EXPECTATION_FAILED` error with actual and expected quantities in `detail` if expectations are not met.

---

## SQLite Extensions

For SQLite-based databases, the subpath `@crepuse/runtime/database/sqlite` provides type extensions and parameter normalization utilities.

### Type Definitions

```typescript
// Primitive parameter types supported by SQLite
export type SqliteValue = string | number | boolean | null | Uint8Array;

// Values bound to the underlying driver (boolean is converted to 0 or 1)
export type SqliteBoundValue = Exclude<SqliteValue, boolean>;

// SQLite-specific database interface
export type CrepuseSqliteDatabase = CrepuseDatabase<SqliteValue>;
```

### Parameter Normalization (normalizeSqliteParams)

```typescript
function normalizeSqliteParams(params: readonly unknown[], statement: string): SqliteBoundValue[];
```

This function performs strict checks and type alignment on input parameter arrays:

- **Boolean normalization**: `true` converts to `1`, `false` converts to `0`.
- **Numeric validation**: Must be finite (`Number.isFinite`), and integers must be safe integers (`Number.isSafeInteger`). Rejects `NaN`, `Infinity`, and integers exceeding safe ranges.
- **Null & String**: Preserves `null` and `string` values as-is.
- **Binary Data**: Natively supports `Uint8Array`.
- **Strict Rejections**:
    - Rejects unsupported types such as `undefined`, `BigInt`, plain objects, nested arrays, and `Date`.
    - Rejects sparse arrays (e.g. arrays with deleted empty slots).
    - Throws a `DATABASE_INVALID_STATEMENT` error containing the parameter index (`index`) and field name if validation fails.

---

## Error Handling & Error Codes

All database errors derive from `RuntimeError` (exported from `@crepuse/runtime/errors`), whose `code` belongs to the `DatabaseErrorCode` enum, accompanied by a structured `detail` payload.

| Error Code Enum      | Code String                    | Description                                                                        | Typical `detail` Content                    |
| :------------------- | :----------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------------ |
| `InvalidStatement`   | `DATABASE_INVALID_STATEMENT`   | Malformed statement (missing name/sql, or parameter validation failed)             | `{ statement, field, index }`               |
| `InvalidExpectation` | `DATABASE_INVALID_EXPECTATION` | Expectation configuration does not meet specification (malformed or invalid range) | `{ statement, field, expected }`            |
| `InvalidResult`      | `DATABASE_INVALID_RESULT`      | Result structure returned by driver does not conform to standard                   | `{ statement, field }`                      |
| `ExpectationFailed`  | `DATABASE_EXPECTATION_FAILED`  | Actual result count falls outside the expected range                               | `{ statement, field, expected, actual }`    |
| `ExecutionFailed`    | `DATABASE_EXECUTION_FAILED`    | Driver execution failed; original error preserved in `error.cause`                 | `{ statement }` or `{ operation: "batch" }` |

### Error Handling Example

```typescript
import { DatabaseErrorCode } from "@crepuse/runtime/database";
import { RuntimeError } from "@crepuse/runtime/errors";

try {
    await db.run({
        name: "user.updateRole",
        sql: "UPDATE users SET role = ? WHERE id = ?",
        params: ["admin", 42],
        expect: { affected: [1, 1] }, // Expects exactly 1 row to be updated
    });
} catch (error) {
    if (error instanceof RuntimeError) {
        if (error.code === DatabaseErrorCode.ExpectationFailed) {
            console.error("Updated row count did not meet expectation:", error.detail);
            // detail: { statement: "user.updateRole", field: "affected", expected: [1, 1], actual: 0 }
        } else if (error.code === DatabaseErrorCode.ExecutionFailed) {
            console.error("Underlying SQL execution failed, original cause:", error.cause);
        }
    }
}
```

---

## Related Adapters

crepuse provides concrete database adapter implementations for different runtime environments:

- [Cloudflare D1 Adapter Documentation](./adapters/d1.md): Designed for Cloudflare Workers / Pages edge environments.
