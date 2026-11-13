# Agent Instructions

## Project

This repository contains `@crepuse/runtime`, a lightweight,
framework-independent TypeScript runtime library.

- ESM only, targeting ES2022 with NodeNext module resolution.
- No production dependencies unless clearly justified.
- Keep public abstractions independent of specific providers.
- Prefer small, focused implementations over additional abstraction layers.

## Development

- Follow the existing TypeScript conventions and Prettier configuration.
- Use four-space indentation.
- Preserve public API contracts and package entry points.
- Keep provider-specific logic inside its adapter.
- Update documentation when public APIs or behavior change.

## Validation

Run the relevant checks before completing a change:

- `npm run format:check`
- `npm run check`
- `npm test`
- `npm pack --dry-run` for packaging or export changes

## Git and Releases

- Follow the existing feature-branch and PR workflow.
- Target `dev` for ordinary changes.
- Do not create commits, push branches, merge PRs, create tags,
  or publish packages without explicit authorization.
- Treat changes to `main`, package versions, and release workflows
  as release-sensitive operations.
- Never add `Co-authored-by`, `Assisted-by`, `Generated-by`, or similar
  AI attribution trailers to commits, PRs, or source files.
- Preserve the author's existing Git identity and commit metadata.

## Code Review Rules

Prioritize actionable findings involving:

- Runtime correctness and edge cases.
- Public API and TypeScript compatibility.
- Error propagation and data integrity.
- Database consistency and transaction semantics.
- Security and unintended exposure of sensitive data.
- Missing tests for meaningful behavior.

Avoid purely stylistic findings already covered by automated formatting.
