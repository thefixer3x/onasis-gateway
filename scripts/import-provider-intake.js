#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const repoRoot = path.resolve(__dirname, '..');
const defaultManifestPath = path.join(repoRoot, 'postman', 'provider-intake.manifest.yaml');
const baseUrl = 'https://api.getpostman.com';

function parseArgs(argv) {
  const options = {
    manifest: defaultManifestPath,
    dryRun: false,
    only: null,
    workspaceId: process.env.POSTMAN_WORKSPACE_ID || '',
    apiKey: process.env.POSTMAN_API_KEY || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest' && argv[i + 1]) {
      options.manifest = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--only' && argv[i + 1]) {
      options.only = argv[i + 1].split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--workspace' && argv[i + 1]) {
      options.workspaceId = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Import curated provider-intake collections into a Postman workspace.

Usage:
  node scripts/import-provider-intake.js [options]

Options:
  --manifest <path>   Path to provider-intake manifest YAML
  --workspace <id>    Target Postman workspace id
  --only <slugs>      Comma-separated subset to process
  --dry-run           Print planned actions without importing
  -h, --help          Show help

Environment:
  POSTMAN_API_KEY         Required unless already exported
  POSTMAN_WORKSPACE_ID    Optional if passed with --workspace
`);
}

function requireEnv(options) {
  if (!options.apiKey) {
    throw new Error('POSTMAN_API_KEY is required');
  }
  if (!options.workspaceId) {
    throw new Error('POSTMAN_WORKSPACE_ID is required');
  }
}

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

async function postmanFetch(options, endpoint, requestOptions = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...requestOptions,
    headers: {
      'X-Api-Key': options.apiKey,
      Accept: 'application/json',
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(requestOptions.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = text;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function fetchWorkspaceCollections(options) {
  const data = await postmanFetch(options, `/workspaces/${options.workspaceId}`);
  return data.workspace?.collections || [];
}

async function createCollectionFork(options, collectionUid, targetName) {
  const data = await postmanFetch(
    options,
    `/collections/fork/${encodeURIComponent(collectionUid)}?workspace=${encodeURIComponent(options.workspaceId)}`,
    {
    method: 'POST',
    body: JSON.stringify({ label: targetName }),
  });
  return data.collection || data.forked_collection || data;
}

function resolveRefPath(refPath) {
  return path.resolve(repoRoot, refPath);
}

function matchesOnlyFilter(provider, only) {
  if (!only || only.length === 0) {
    return true;
  }
  return only.includes(provider.slug);
}

function buildDocsOnlyMessage(ref) {
  if (ref.rest_api_docs) {
    return `Docs-only source. Review ${ref.rest_api_docs} and create a curated collection manually if needed.`;
  }
  return 'Docs-only source. No import action will be attempted.';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireEnv(options);

  const manifest = loadYaml(options.manifest);
  const workspaceCollections = await fetchWorkspaceCollections(options);
  const existingNames = new Set(workspaceCollections.map((item) => item.name));

  console.log(`Workspace: ${options.workspaceId}`);
  console.log(`Manifest: ${options.manifest}`);
  console.log(`Dry run: ${options.dryRun ? 'yes' : 'no'}`);
  console.log('');

  for (const provider of manifest.providers || []) {
    if (!matchesOnlyFilter(provider, options.only)) {
      continue;
    }

    const ref = loadYaml(resolveRefPath(provider.ref_path));
    const targetName = provider.target_name;

    console.log(`⏳ ${provider.provider} [${provider.slug}]`);
    console.log(`   Lane: ${provider.lane}`);
    console.log(`   Target: ${targetName}`);
    console.log(`   Strategy: ${provider.import_strategy}`);

    if (existingNames.has(targetName)) {
      console.log('   ↩️  Skipping: target collection already exists in workspace');
      console.log('');
      continue;
    }

    if (provider.import_strategy === 'docs_only') {
      console.log(`   ℹ️  ${buildDocsOnlyMessage(ref)}`);
      console.log('');
      continue;
    }

    if (!ref.postman_collection_id) {
      console.log('   ⚠️  Skipping: no public Postman collection id available in ref');
      console.log('');
      continue;
    }

    if (options.dryRun) {
      console.log(`   🧪 Dry run: would copy public collection ${ref.postman_collection_id}`);
      console.log('');
      continue;
    }

    try {
      const created = await createCollectionFork(options, ref.postman_collection_id, targetName);
      existingNames.add(targetName);

      console.log(`   ✅ Imported as ${created?.name || targetName}`);
      if (created?.uid) {
        console.log(`   🔗 UID: ${created.uid}`);
      }
    } catch (error) {
      console.log(`   ❌ Import failed: ${error.message}`);
    }

    console.log('');
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
