# homekit-cli Agent Notes

This repo controls physical HomeKit devices. Default to read-only inspection.

- Do not run `homekit accessories control` unless the user explicitly asks to actuate a device.
- Treat locks, garage doors, covers, thermostats, security systems, cameras, occupancy, presence, scenes, and automations as sensitive.
- Prefer `--json` for machine-readable command output.
- Never print secrets or unsanitized HomeKit snapshots into durable docs.
- Keep the signed bridge app as the only HomeKit-entitled process.
- Do not add legacy HomeClaw surfaces unless explicitly requested.
