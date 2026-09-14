#!/usr/bin/env node
'use strict';

// PreToolUse guard, workspace-wide: denies tool calls whose payload contains
// content matching a high-signal secret pattern (private key, cloud/API token).
//
// CAVEAT: the exact PreToolUse stdin schema isn't fully documented for this
// runtime, so this recursively scans every string value in the payload rather
// than a single known field. Patterns are deliberately high-signal (specific
// token prefixes/private key headers) to keep false positives low on normal
// reads/searches. This is a best-effort net, not a substitute for a real
// secret scanner (e.g. gitleaks) in CI.

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/, // AWS access key id
  /gh[pousr]_[A-Za-z0-9]{30,}/, // GitHub token (personal/oauth/user/server/refresh)
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // Slack token
  /sk-(live|proj)?_?[A-Za-z0-9]{24,}/, // generic "sk-" style API key
];

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
  const hit = strings.find((value) => SECRET_PATTERNS.some((pattern) => pattern.test(value)));

  if (!hit) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  process.stdout.write(
    JSON.stringify({
      continue: false,
      stopReason: 'Blocked: content matches a known secret pattern.',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Content matches a known secret pattern (private key or API token prefix). Remove it before this proceeds.',
      },
    }),
  );
  process.exit(2);
});
