# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Callback methods (`get`/`put`/`delete`/`open`) are thin shims over the `*Async` implementations. Make behavioral changes in the async versions.

Lock pattern across the directory `.lock` file and per-key files:

- `get` — shared on `.lock`, shared on key file
- `put` — shared on `.lock`, exclusive on key file
- `delete` — exclusive on `.lock`, no per-key lock

Concurrent reads and writes to different keys proceed in parallel; deletes serialize against everything else in the directory.

The lock pattern is realized through `withDirectoryLock` and `withKeyLock` (private to the module). Both wrap a single `withFlock` primitive that owns the open/flock/release/close lifecycle — including the swallow-close-failures invariant.

## Behavioral contracts to preserve

- `get` of a missing key fires `callback()` with **no arguments** (not `callback(null, undefined)`). The test `get returns undefined for non-existent key` asserts `err === undefined` — keep this if you refactor the callback shim.
- Close failures inside the `finally` blocks are intentionally swallowed so the caller still sees the real underlying error.
