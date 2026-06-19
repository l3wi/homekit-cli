# Security Model

`homekit-cli` is not the HomeKit trust boundary. It is a local CLI/MCP layer over an external HomeKit provider.

The CLI enforces accidental-write prevention:

- read-only commands are default
- physical actuation requires `--allow-actuation`
- structural mutations require `--allow-mutation`
- commands require exact identifiers for writes
- no wildcard write operations are exposed

The provider is responsible for Apple HomeKit entitlement, HomeKit permission, native API access, and any provider-side audit logging or peer checks.

The CLI does not expose inbound webhooks, a network listener, or external callback routing.
