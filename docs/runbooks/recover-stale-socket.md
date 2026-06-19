# Recover Stale Socket Or Cache

1. Stop the bridge:

```bash
homekit bridge stop
```

2. Relaunch:

```bash
homekit bridge launch
```

3. Verify:

```bash
homekit status --json
```

For development with tmp socket fallback:

```bash
HOMEKIT_USE_TMP_SOCKET=1 homekit status --json
```
