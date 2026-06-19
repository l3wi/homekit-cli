# ADR-0002: Signed Bridge Boundary

## Decision

Only the Mac Catalyst bridge app owns the HomeKit entitlement and `HMHomeManager`.

## Consequence

The TypeScript CLI and MCP server are portable local clients. Signing and HomeKit permission prompts stay in the app where macOS expects them.
