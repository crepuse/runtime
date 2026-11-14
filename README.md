# crepuse Runtime

**crepuse Runtime** is the core runtime foundation library for the crepuse ecosystem, providing environment-agnostic low-level abstractions.

[Documentation](docs/README.md)

---

## Installation

```bash
npm install @crepuse/runtime
```

---

## Subpath Exports

This package supports subpath exports, allowing specific modules to be loaded on demand:

| Export Path                             | Description                   | Key Exports                                                                                                                                     |
| :-------------------------------------- | :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@crepuse/runtime`                      | Root export                   | Re-exports all public APIs from `errors` and `database`                                                                                         |
| `@crepuse/runtime/errors`               | Error handling system         | `RuntimeError`, `RuntimeErrorOptions`                                                                                                           |
| `@crepuse/runtime/database`             | Core database abstractions    | `CrepuseDatabase`, `CrepuseStatement`, `CrepuseResult`, `CrepuseExpectation`, `DatabaseErrorCode`, `validateExpectations`, `assertExpectations` |
| `@crepuse/runtime/database/sqlite`      | SQLite extensions & utilities | `SqliteValue`, `SqliteBoundValue`, `CrepuseSqliteDatabase`, `normalizeSqliteParams`                                                             |
| `@crepuse/runtime/database/sqlite/d1`   | Cloudflare D1 adapter         | `createD1Database`, `D1ResultLike`                                                                                                              |
| `@crepuse/runtime/database/sqlite/node` | Node.js SQLite adapter        | `createNodeSqliteDatabase`                                                                                                                      |

---

## Local Development & Testing

```bash
# Type check
npm run check

# Build bundle (output in dist/)
npm run build

# Run unit tests
npm test

# Code formatting
npm run format
npm run format:check
```

---

## License

This project is open-sourced under the [AGPL-3.0-only](./LICENSE.md) license.
