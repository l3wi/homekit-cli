#!/usr/bin/env node
import { cli } from "./cli.js";

const args = process.argv.slice(2);

if (args[0] === "skills" || args[0] === "skill") {
  console.error(
    [
      "The built-in Incur skills command is disabled for homekit-cli.",
      "",
      "Install the curated HomeKit skill with the external Skills CLI instead:",
      "  npx skills add l3wi/homekit-cli --skill homekit",
      "",
      "For local development from this repo:",
      "  npx skills add ./skills --skill homekit --copy -y",
    ].join("\n"),
  );
  process.exit(2);
}

if (
  args.includes("--help") ||
  args.includes("-h") ||
  args.includes("--schema") ||
  args.includes("--llms")
) {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    const text = Buffer.isBuffer(chunk)
      ? chunk.toString("utf8")
      : String(chunk);
    const filtered = text
      .replace(/^  skills\s+Sync skill files to agents \(add, list\)\n/gm, "")
      .replace(
        /^  --llms, --llms-full(\s+)Print LLM-readable manifest$/gm,
        "  --llms$1Print compact LLM-readable manifest",
      )
      .replace(
        /Run `homekit --llms-full` for full manifest\. Run `homekit <command> --schema` for argument details\./g,
        "Run `homekit <command> --schema --format json` for argument details.",
      );
    return write(filtered, ...(rest as []));
  }) as typeof process.stdout.write;
}

cli.serve();
