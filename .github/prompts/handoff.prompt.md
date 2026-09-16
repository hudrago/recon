---
description: "Checkpoint current progress directly into repo/session memory instead of a one-off chat summary, so context survives compaction or a new session."
agent: "agent"
---

Write a concise progress checkpoint directly into memory — do not just print it in chat.

1. Update or create the relevant file(s) under `/memories/repo/` with durable
   facts: what shipped, key decisions and why, file/module locations, gotchas.
   Prefer updating an existing topic file over creating a new one — check
   `/memories/repo/` first.
2. Update `/memories/session/progress.md` with the current in-progress state:
   active task, exact next step, open questions/blockers, any assumptions made.
3. Keep both terse — bullet points, not prose. Assume the reader is an agent
   picking this up cold in a brand-new conversation with none of this history.
4. After writing, reply with a short confirmation of what was checkpointed and
   where — do not repeat the full content back in chat.
