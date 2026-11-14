# Node SQLite Adapter

`@crepuse/runtime/database/sqlite/node` provides the official adapter implementation for [Node.js built-in SQLite](https://nodejs.org/api/sqlite.html) (`node:sqlite`).

This adapter wraps a native `DatabaseSync` instance (or any compatible SQLite database object matching `NodeSqliteLike`) into a standard [`CrepuseSqliteDatabase`](../database.md#sqlite-extensions), automatically handling parameter normalization, statement execution branching (for queries vs. mutations, including `RETURNING` clauses), affected row count tracking via SQLite `changes()` / `total_changes()`, and expectation assertions.

---

## Table of Contents

- [Installation & Import](#installation--import)
- [Quick Start](#quick-start)
- [Core API](#core-api)
    - [createNodeSqliteDatabase](#createnodesqlitedatabase)
    - [Type Definitions](#type-definitions)
- [Features & Guarantees](#features--guarantees)
    - [Adaptive Execution & Affected Row Tracking](#adaptive-execution--affected-row-tracking)
    - [Result Normalization](#result-normalization)
    - [Batch Pre-validation Mechanism](#batch-pre-validation-mechanism)
    - [Error Context Encapsulation](#error-context-encapsulation)
- [Usage Examples](#usage-examples)
    - [Querying Single & Multiple Records](#querying-single--multiple-records)
    - [Data Mutations & Affected Rows Assertion](#data-mutations--affected-rows-assertion)
    - [Mutations with RETURNING Clause](#mutations-with-returning-clause)
    - [Batch Operations](#batch-operations)
    - [Binary Data (BLOB) Read & Write](#binary-data-blob-read--write)

---

## Installation & Import

Ensure `@crepuse/runtime` is installed in your project:

```bash
npm install @crepuse/runtime
```

Import the factory function from the dedicated subpath:

```typescript
import { createNodeSqliteDatabase } from "@crepuse/runtime/database/sqlite/node";
```

> [!NOTE]
> The Node.js built-in SQLite module (`node:sqlite`) is available natively in Node.js v22.5.0+.

---

## Quick Start

Initialize a `DatabaseSync` instance from `node:sqlite` and pass it directly to `createNodeSqliteDatabase`:

```typescript
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDatabase } from "@crepuse/runtime/database/sqlite/node";

// 1. Initialize native SQLite database (in-memory or file-backed)
const nativeDb = new DatabaseSync(":memory:");

// 2. Set up schema
nativeDb.exec(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
    );
`);

// 3. Create the adapter instance
const db = createNodeSqliteDatabase(nativeDb);

// 4. Insert data
await db.run({
    name: "users.create",
    sql: "INSERT INTO users (name, active) VALUES (?, ?)",
    params: ["Alice", true], // Automatically normalizes true to 1
    expect: { affected: [1, 1] },
});

// 5. Query data
const users = await db.query<{ id: number; name: string }>({
    name: "users.list",
    sql: "SELECT id, name FROM users WHERE active = ?",
    params: [true],
});

console.log(users);
```

---

## Core API

### createNodeSqliteDatabase

```typescript
function createNodeSqliteDatabase(database: NodeSqliteLike): CrepuseSqliteDatabase;
```

#### Parameters

- `database`: An instance of Node.js `DatabaseSync` (from `node:sqlite`) or any SQLite database object matching the `NodeSqliteLike` interface.

#### Returns

- Returns a [`CrepuseSqliteDatabase`](../database.md#sqlite-extensions) instance supporting `run`, `query`, and `batch` methods.

### Type Definitions

```typescript
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
```

---

## Features & Guarantees

### Adaptive Execution & Affected Row Tracking

Unlike drivers that provide a single execution method returning both rows and mutation metadata, `node:sqlite` divides statement execution between `prepared.all()` (for statements returning row sets) and `prepared.run()` (for pure mutations).

The adapter inspects `prepared.columns().length` to determine the execution strategy:

1. **Query Statements (`columns().length > 0`)**:
    - Executes `prepared.all(...params)`.
    - Automatically checks `SELECT total_changes() AS count` before and after execution. If `total_changes()` changed (for example, in `INSERT ... RETURNING`, `UPDATE ... RETURNING`, or `DELETE ... RETURNING` statements), it reads `SELECT changes() AS count` to accurately record the affected row count while returning the row data.
2. **Mutation Statements (`columns().length === 0`)**:
    - Executes `prepared.run(...params)`.
    - Directly retrieves the driver's returned `changes` property.

### Result Normalization

The adapter processes driver results through `normalizeNodeSqliteResult`:

1. **BigInt to Number Conversion**: Safely converts `changes` (which `node:sqlite` can return as `bigint` or `number`) into a JavaScript `number`.
2. **Safety Validation**: Asserts that `affected` is a non-negative safe integer (`Number.isSafeInteger(affected) && affected >= 0`). If validation fails, throws a `DATABASE_INVALID_RESULT` error with `{ field: "affected" }`.
3. **Row Immutability**: Shallow-copies each row object (`{ ...row }`) to decouple application data from internal driver structures.

### Batch Pre-validation Mechanism

When calling `db.batch([...])`:

1. **Atomic Pre-validation**: Before dispatching any statement to SQLite, the adapter **pre-validates the validity, expectation format, and all parameters of every statement**.
2. **Fail-Fast**: If any statement contains invalid parameters (e.g. `undefined`, unsafe integers, or sparse arrays) or malformed expectations, the entire batch throws a `DATABASE_INVALID_STATEMENT` error immediately **without executing any SQL**, preventing partial execution or inconsistent state.
3. **Sequential Execution & Assertion**: Executes statements in order and asserts expectations (`expect`) after each statement.

### Error Context Encapsulation

All exceptions thrown by the underlying `node:sqlite` driver are caught and wrapped in a `RuntimeError`:

- **Error Code**: Set to `DatabaseErrorCode.ExecutionFailed` (`DATABASE_EXECUTION_FAILED`).
- **Preserved Root Cause**: The original driver error is preserved in `error.cause`.
- **Diagnostic Details**: `error.detail` includes the offending statement name (`statement: statement.name`) or operation type (`operation: "batch"`).

---

## Usage Examples

### Querying Single & Multiple Records

```typescript
interface UserProfile {
    id: number;
    username: string;
    email: string;
}

// 1. Query multiple records
const activeUsers = await db.query<UserProfile>({
    name: "users.findActive",
    sql: "SELECT id, username, email FROM users WHERE status = ?",
    params: ["active"],
});

// 2. Query a single record (using expect to ensure 0 or 1 row)
const user = await db.query<UserProfile>({
    name: "users.findById",
    sql: "SELECT id, username, email FROM users WHERE id = ?",
    params: [1001],
    expect: { rows: [0, 1] }, // Ensures 0 or 1 row; throws an error if multiple rows return
});
```

### Data Mutations & Affected Rows Assertion

Use `db.run()` for data mutations and assert on the `affected` row count:

```typescript
// Expects exactly 1 row to be updated
const result = await db.run({
    name: "users.updateEmail",
    sql: "UPDATE users SET email = ? WHERE id = ?",
    params: ["new_email@example.com", 1001],
    expect: { affected: [1, 1] },
});

console.log("Update succeeded, affected rows:", result.affected);
```

### Mutations with RETURNING Clause

Statements using SQLite's `RETURNING` clause return modified rows while also tracking affected row counts:

```typescript
const result = await db.run({
    name: "users.archive",
    sql: "UPDATE users SET active = 0 WHERE id = ? RETURNING id, name, active",
    params: [1001],
    expect: {
        rows: [1, 1], // Exactly 1 row returned
        affected: [1, 1], // Exactly 1 row modified
    },
});

console.log("Archived user:", result.rows[0]);
console.log("Affected rows:", result.affected);
```

### Batch Operations

Execute multiple statements sequentially with fail-fast pre-validation:

```typescript
const [insertResult, logResult] = await db.batch([
    {
        name: "orders.create",
        sql: "INSERT INTO orders (id, amount, user_id) VALUES (?, ?, ?)",
        params: ["order_123", 99.5, 1001],
        expect: { affected: [1, 1] },
    },
    {
        name: "logs.record",
        sql: "INSERT INTO audit_logs (action, target_id) VALUES (?, ?)",
        params: ["create_order", "order_123"],
        expect: { affected: [1, 1] },
    },
]);
```

### Binary Data (BLOB) Read & Write

The Node SQLite adapter natively supports `Uint8Array` for binary data:

```typescript
// Write BLOB data
const salt = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

await db.run({
    name: "credentials.insert",
    sql: "INSERT INTO credentials (user_id, salt) VALUES (?, ?)",
    params: [1001, salt],
    expect: { affected: [1, 1] },
});

// Read BLOB data
const rows = await db.query<{ user_id: number; salt: Uint8Array }>({
    name: "credentials.findByUserId",
    sql: "SELECT user_id, salt FROM credentials WHERE user_id = ?",
    params: [1001],
});

console.log(rows[0].salt instanceof Uint8Array); // true
```
