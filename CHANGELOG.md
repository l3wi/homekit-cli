# Changelog

## 0.1.1

- Standardized published setup docs around `npx -y homekit-cli` and optional global `homekit`.
- Made MCP defaults and examples use `npx -y homekit-cli --mcp` so setup works without a global install.
- Included docs, examples, and the curated `homekit` skill in the npm package.

## 0.1.0

- Flattened the project into a single `homekit-cli` Node package.
- Removed native macOS app, signing, provisioning, and release scripts from `main`.
- Preserved the standalone native bridge implementation on `feat/application`.
- Kept the CLI/MCP command surface, schemas, docs, examples, and external `npx skills` package for the upcoming provider adapter.
