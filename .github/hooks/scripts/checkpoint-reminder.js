#!/usr/bin/env node
'use strict';

// Fires at the moments context is actually at risk of being lost (new session,
// about to compact, session ending) and reminds the agent to checkpoint into
// /memories/ instead of relying on someone asking for a manual handoff summary.
// A hook script can't call the memory tool itself (only the agent can) — this
// just guarantees the reminder is never skipped or forgotten.

const stage = process.argv[2] || 'unknown';

const messages = {
  'session-start':
    'New session started in this workspace. Before asking the user to re-explain context, check /memories/repo/ (file names are already listed automatically) and /memories/session/ for existing notes on the current task and read any that look relevant.',
  'pre-compact':
    'Context is about to be compacted. If there is meaningful in-progress or completed work not yet captured, checkpoint it now: durable facts/decisions/file lists to /memories/repo/<topic>.md, current in-progress state to /memories/session/. Keep it terse — bullet points, not prose.',
  stop:
    'Session is ending. If meaningful work happened this session that is not yet reflected in /memories/repo/ or /memories/session/, write a short checkpoint before finishing so the next session does not have to reconstruct it from scratch.',
};

process.stdout.write(JSON.stringify({ continue: true, systemMessage: messages[stage] || messages['pre-compact'] }));
