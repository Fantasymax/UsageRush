import claude from './claude.js';
import codex from './codex.js';

const REGISTRY = { claude, codex };

export function getProvider(id) {
  return REGISTRY[id] || null;
}

export function allProviderIds() {
  return Object.keys(REGISTRY);
}
