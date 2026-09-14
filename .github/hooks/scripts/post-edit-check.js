#!/usr/bin/env node
'use strict';

// PostToolUse check, workspace-wide: after a tool call touches a .ts/.tsx file,
// run typecheck + lint so failures surface immediately instead of at the next
// manual gate run. Assumes cwd is the repo root (default for workspace hooks).
//
// CAVEAT: same schema caveat as block-secrets.js — scans every string in the
// payload for a .ts/.tsx path rather than relying on one specific field name.

const { spawnSync } = require('node:child_process');

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
  const touchedTs = strings.some((value) => /\.tsx?(["'`\\/]|$)/.test(value));

  if (!touchedTs) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const failures = [];
  for (const [cmd, args] of [
    ['pnpm', ['typecheck']],
    ['pnpm', ['lint']],
  ]) {
    const result = spawnSync(cmd, args, { shell: true, encoding: 'utf8' });
    if (result.status !== 0) {
      failures.push(`$ ${cmd} ${args.join(' ')}\n${(result.stdout || '') + (result.stderr || '')}`);
    }
  }

  if (failures.length === 0) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  process.stdout.write(
    JSON.stringify({
      continue: true,
      decision: 'block',
      systemMessage: `Gate failed after this edit:\n\n${failures.join('\n\n')}`.slice(0, 4000),
    }),
  );
});
