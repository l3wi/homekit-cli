# ADR-0004: Per-User Socket Path

## Decision

Use a per-user app group socket path by default, with `${TMPDIR}` fallback for development.

## Consequence

The production socket avoids fixed global `/tmp` collisions and has tighter filesystem permissions.
