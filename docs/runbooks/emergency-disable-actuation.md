# Emergency Disable Actuation

The current v1 actuation gate is command-level and bridge-level. To disable actuation operationally:

1. Stop using `accessories control`.
2. Remove MCP access to this server if an agent is suspected of unsafe use.
3. Stop the bridge:

```bash
homekit bridge stop
```

4. Inspect audit log:

```bash
open "$HOME/Library/Application Support/BlackwattleHomeKitBridge"
```
