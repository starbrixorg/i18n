# i18n CLI – Usage Guide

This CLI manages translation **snapshots**, **handoffs**, **types**, **merging**, **validation**, **sync**, **upload**, and **download** for both **UI** and **API** workflows.

---

## Configuration

> **Required:**  
> Create an `i18n.config.mjs` file at the root of your project (where this CLI is installed).  
> This file must export your i18n configuration as the default export.

See: https://github.com/starbrixorg/i18n/blob/main/src/utils/load-config.ts#L15 for configSchema definition

> All commands expect a valid `i18n.config.mjs` at the project root unless `--config` is specified.

---

## Available Commands

### Generate

- `yarn i18n generate snapshot [--config <path>]`
- `yarn i18n generate handoff [--config <path>]`
- `yarn i18n generate types [--config <path>]`

### Merge

- `yarn i18n merge [--config <path>]`

### Validate

- `yarn i18n validate [--config <path>]`

### Sync

- `yarn i18n sync [--config <path>]`

### Upload

- `yarn i18n upload [--config <path>]`

### Download

- `yarn i18n download [--config <path>]`

> Use `--config <path>` to specify a custom config file if not using the default `i18n.config.mjs`.

---

## Core Concepts

- **Types**: Generated TypeScript types for type-safe translation keys
- **Handoff**: Only changed/new translation keys sent for translation
- **Received translations**: Files returned from translators
- **Snapshot**: Baseline copy of current translations (used to compute handoff diffs)

---

## Typical Workflow

1. Update keys (base locale)
2. Generate handoff (compared against previous snapshot)
3. Generate snapshot
4. Translate
5. Validate received translations (prefer “against handoff”)
6. Merge
7. Validate merged translations

---
