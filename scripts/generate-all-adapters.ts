#!/usr/bin/env bun

import path from 'path';
import { AdapterGenerator } from '../src/generators/adapter-generator.js';
import { RegistryGenerator } from '../src/generators/registry-generator.js';

async function main() {
  console.log('🚀 Generating MCP adapters from Postman collections...\n');

  const projectRoot = path.resolve(__dirname, '..');
  const collectionsDir = path.join(projectRoot, 'postman-collections');
  const adaptersDir = path.join(projectRoot, 'src', 'adapters');
  const registryFile = path.join(adaptersDir, 'index.ts');

  // Initialize generators
  const adapterGenerator = new AdapterGenerator(collectionsDir, adaptersDir);
  const registryGenerator = new RegistryGenerator(adaptersDir, registryFile);

  try {
    // Generate all adapters
    console.log('📦 Generating adapters...');
    const adapters = await adapterGenerator.generateAllAdapters();
    
    if (adapters.length === 0) {
      console.log('⚠️  No Postman collections found in:', collectionsDir);
      return;
    }

    console.log(`\n✅ Generated ${adapters.length} adapters:`);
    adapters.forEach(adapter => {
      console.log(`   • ${adapter.name} (${adapter.tools.length} tools)`);
    });

    // Generate registry
    console.log('\n📋 Generating adapter registry...');
    await registryGenerator.generateRegistry(adapters);

    console.log('\n🎉 All adapters generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Run `bun run build` to compile TypeScript');
    console.log('2. Import adapters in your MCP server:');
    console.log('   ```typescript');
    console.log('   import { ADAPTER_REGISTRY } from "@core/api-adapters";');
    console.log('   ```');
    console.log('3. Initialize and register adapters with your MCP server');

  } catch (error) {
    console.error('❌ Failed to generate adapters:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
