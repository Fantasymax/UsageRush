#!/usr/bin/env node
// Deterministic privacy scan for commits. Flags absolute machine paths, private IPs,
// and likely hardcoded secrets. The project-specific exact denylist (company names,
// real identities, internal hosts) is NOT stored here — point USAGERUSH_DENYLIST at a
// local-only file (one term per line) to add exact-match terms.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const patterns = [
  [/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, 'private IP (10.x)'],
  [/\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/, 'private IP (172.16-31.x)'],
  [/\b192\.168\.\d{1,3}\.\d{1,3}\b/, 'private IP (192.168.x)'],
  [/[A-Za-z]:\\Users\\[^\\\s"'`]+/, 'absolute Windows user path'],
  [/\/(?:home|Users)\/[A-Za-z0-9._-]+\//, 'absolute home path'],
  [/(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*["'][^"'\s]{8,}/i, 'possible hardcoded secret'],
];

const dl = process.env.USAGERUSH_DENYLIST;
if (dl && existsSync(dl)) {
  for (const term of readFileSync(dl, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    patterns.push([new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 'denylist term']);
  }
}

const staged = process.argv.includes('--staged');
const list = staged
  ? 'git diff --cached --name-only --diff-filter=ACM'
  : 'git ls-files';
let files = [];
try {
  files = execSync(list, { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  process.exit(0); // not a git repo / nothing staged
}

const SELF = 'check-privacy.mjs';
let hits = 0;
for (const f of files) {
  if (f.endsWith(SELF)) continue; // the scanner contains the patterns by design
  if (!existsSync(f)) continue;
  if (/\.(png|jpe?g|gif|ico|zip|pdf|woff2?)$/i.test(f)) continue;
  let txt;
  try {
    txt = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  txt.split('\n').forEach((line, i) => {
    for (const [re, label] of patterns) {
      if (re.test(line)) {
        console.error(`PRIVACY  ${f}:${i + 1}  ${label}\n         ${line.trim().slice(0, 120)}`);
        hits++;
      }
    }
  });
}

if (hits) {
  console.error(`\n✗ privacy scan: ${hits} issue(s) found — commit blocked.`);
  process.exit(1);
}
console.log('✓ privacy scan clean');
