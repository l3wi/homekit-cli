# First Setup

This repo is CLI-only. HomeClaw is the entitlement-bearing HomeKit provider.

HomeKit access requires a signed App Store or TestFlight app. A Node CLI cannot hold the HomeKit entitlement or prompt for HomeKit permission itself.

1. Install [HomeClaw from the Mac App Store](https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12), or use HomeClaw's TestFlight build if that is how you are testing.
2. Approve HomeKit permission in HomeClaw.
3. Skip HomeClaw's bundled CLI and MCP setup. HomeClaw provides the HomeKit socket; this repo provides the documented CLI/MCP and skills.
4. Install dependencies with `bun install`.
5. Build with `bun run build`.
6. Verify with `node dist/bin.js bridge setup --format json`.
7. Verify HomeKit visibility with `node dist/bin.js status --format json`.
8. Inspect CLI help with `bun run dev -- --help`.
9. Install the local skill with `npx skills add ./skills --skill homekit --copy -y`.

Do not add native signing, provisioning, or app-bundling steps on `main`. That work is preserved on `feat/application`.
