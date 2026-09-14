#!/usr/bin/env node
'use strict';

// Inline PreToolUse hook, scoped to recon-integration only (see its frontmatter
// `hooks` field). Denies any tool call that targets packages/domain — that
// package is owned by recon-implementer; recon-integration only ever imports
// its exported types, never edits it.

function collectStrings(value, out) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) collectStrings(value[key], out);
  }
}

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const strings = [];
  collectStrings(payload, strings);
  const touchesDomain = strings.some((value) => /packages[\\/]domain[\\/]/.test(value));

  if (!touchesDomain) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  process.stdout.write(
    JSON.stringify({
      continue: false,
      stopReason: 'Blocked: recon-integration cannot edit packages/domain.',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'packages/domain is owned by recon-implementer. Consume its exported types instead, or hand the needed change to recon-implementer/recon-architect.',
      },
    }),
  );
  process.exit(2);
});
