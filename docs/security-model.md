# Security Model

The bridge enforces safety. The CLI is a client, not a trust boundary.

Bridge rules:

- Local Unix socket only.
- Socket directory mode `0700`.
- Socket file mode `0600`.
- Same-UID peer validation.
- Explicit RPC methods only.
- No network listener.
- Control requests require `allowActuation=true`.
- Control requests and rejected actuation attempts are audit logged.
- Structural mutation requests require `allowMutation=true`.
- Structural mutation requests and rejected mutation attempts are audit logged.

Same-user malware can still attempt to connect to a local socket. The purpose here is accidental-actuation prevention, clear local boundaries, and auditability.

The bridge does not expose webhooks, inbound HTTP, external callback routing, or a background network listener. All agent access goes through the local CLI/MCP process and the local Unix socket.
