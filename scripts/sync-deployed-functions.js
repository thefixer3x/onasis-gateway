#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.resolve(__dirname, '../docs/architecture/supabase-api/DEPLOYED_FUNCTIONS.json');
const PROJECT_REF_PATH = path.resolve(__dirname, '../supabase/.temp/project-ref');

const normalizeTimestamp = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
};

const readProjectRef = () => {
  if (!fs.existsSync(PROJECT_REF_PATH)) return null;
  return fs.readFileSync(PROJECT_REF_PATH, 'utf8').trim() || null;
};

const deriveFallbackTimestamp = () => {
  const epochSource = process.env.CI_COMMIT_TIMESTAMP || process.env.SOURCE_DATE_EPOCH || '';
  const raw = Number(epochSource);
  if (Number.isFinite(raw) && raw > 0) {
    // Accept either seconds or milliseconds.
    return raw < 1e12 ? Math.trunc(raw * 1000) : Math.trunc(raw);
  }
  return Date.now();
};

const fetchFunctions = () => {
  try {
    const stdout = execSync('supabase functions list -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      throw new Error('Supabase CLI did not return an array');
    }
    return parsed;
  } catch (error) {
    const msg = error?.stderr?.toString?.() || error.message;
    throw new Error(`Failed to run 'supabase functions list -o json': ${msg}`);
  }
};

const normalizeFunctions = (functions) => {
  const fallbackTimestamp = deriveFallbackTimestamp();
  const normalizedNames = [];

  const normalized = functions.map((fn) => {
    const createdAt = normalizeTimestamp(fn.created_at);
    const updatedAt = normalizeTimestamp(fn.updated_at);
    const effectiveCreatedAt = createdAt || updatedAt || fallbackTimestamp;

    if (!createdAt) {
      normalizedNames.push(fn.name || fn.slug || fn.id || 'unknown');
    }

    return {
      ...fn,
      created_at: effectiveCreatedAt
    };
  });

  return { normalized, normalizedNames };
};

const main = () => {
  const functions = fetchFunctions();
  const { normalized, normalizedNames } = normalizeFunctions(functions);

  const payload = {
    generatedAt: new Date().toISOString(),
    projectRef: readProjectRef(),
    generation: {
      source: 'supabase functions list -o json',
      createdAtNormalization: {
        applied: normalizedNames.length > 0,
        normalizedCount: normalizedNames.length,
        strategy: 'created_at || updated_at || ci/generated timestamp',
        functionNames: normalizedNames
      }
    },
    functions: normalized
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

  const message = normalizedNames.length > 0
    ? `Normalized created_at for ${normalizedNames.length} functions`
    : 'No created_at normalization needed';
  // eslint-disable-next-line no-console
  console.log(`Wrote ${OUTPUT_PATH} (${normalized.length} functions). ${message}.`);
};

main();
