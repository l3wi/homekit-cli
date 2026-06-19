# ADR-0005: External Agent Skill Package

## Decision

Distribute the curated `homekit` Agent Skill through the external Skills CLI from `skills/homekit`.

Disable `homekit skills` in the package entrypoint so agents do not install generated command-dump skills from Incur.

## Consequence

The skill can include references and helper scripts, and it can focus on workflow, safety posture, and progressive disclosure instead of duplicating command schemas.

Command details remain discoverable through `homekit --help`, `homekit --llms`, and `homekit <command> --schema --format json`.
