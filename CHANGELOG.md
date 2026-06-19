# Changelog

## 0.1.0

- Flattened the project into a single `homekit-cli` Node package.
- Removed native macOS app, signing, provisioning, and release scripts from `main`.
- Preserved the standalone native bridge implementation on `feat/application`.
- Kept the CLI/MCP command surface, schemas, docs, examples, and external `npx skills` package for the upcoming provider adapter.
