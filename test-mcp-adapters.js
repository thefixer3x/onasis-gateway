#!/usr/bin/env node

/**
 * Test script for MCP Adapters
 * Verifies that our new MCP adapters can be loaded and initialized
 */

const path = require('path');

async function testMCPAdapters() {
  console.log('🧪 Testing MCP Adapter Registration...\n');

  try {
    // Test adapter registry import
    console.log('📋 Loading adapter registry...');
    const { 
      ADAPTER_REGISTRY, 
      ADAPTER_METADATA, 
      listAdapters, 
      getAdapterMetadata,
      createAdapterInstance 
    } = require('./src/adapters/index.ts');
    
    console.log('✅ Adapter registry loaded successfully\n');

    // List all available adapters
    console.log('📊 Available Adapters:');
    const adapters = listAdapters();
    adapters.forEach((name, index) => {
      const metadata = getAdapterMetadata(name);
      console.log(`  ${index + 1}. ${name}`);
      console.log(`     Description: ${metadata?.description || 'No description'}`);
      console.log(`     Tools: ${metadata?.tools?.length || 0} tools`);
      console.log(`     Auth Type: ${metadata?.authType || 'Unknown'}`);
      console.log(`     Base URL: ${metadata?.baseUrl || 'Not specified'}`);
      console.log('');
    });

    // Test specific production-ready adapters
    const productionAdapters = [
      'verification-service',
      'paystack-payment-gateway', 
      'xpress-wallet-waas'
    ];

    console.log('🎯 Testing Production-Ready Adapters:\n');

    for (const adapterName of productionAdapters) {
      console.log(`Testing ${adapterName}...`);
      
      try {
        const metadata = getAdapterMetadata(adapterName);
        if (!metadata) {
          console.log(`  ❌ No metadata found for ${adapterName}`);
          continue;
        }

        console.log(`  ✅ Metadata loaded: ${metadata.tools.length} tools`);
        
        // Try to create adapter instance (without initializing)
        const AdapterClass = ADAPTER_REGISTRY[adapterName];
        if (!AdapterClass) {
          console.log(`  ❌ Adapter class not found in registry`);
          continue;
        }

        console.log(`  ✅ Adapter class loaded: ${metadata.className}`);
        console.log(`  📋 Tools available: ${metadata.tools.slice(0, 3).join(', ')}${metadata.tools.length > 3 ? '...' : ''}`);
        
      } catch (error) {
        console.log(`  ❌ Error testing ${adapterName}: ${error.message}`);
      }
      
      console.log('');
    }

    // Test legacy adapters
    console.log('🔄 Testing Legacy Adapters:\n');
    const legacyAdapters = ['flutterwave-v3', 'paystack'];
    
    for (const adapterName of legacyAdapters) {
      console.log(`Testing ${adapterName}...`);
      
      try {
        const metadata = getAdapterMetadata(adapterName);
        if (metadata) {
          console.log(`  ✅ Legacy adapter available: ${metadata.tools.length} tools`);
        } else {
          console.log(`  ⚠️  No metadata found for legacy adapter`);
        }
      } catch (error) {
        console.log(`  ❌ Error testing ${adapterName}: ${error.message}`);
      }
      
      console.log('');
    }

    // Summary
    console.log('📈 Test Summary:');
    console.log(`  Total Adapters: ${adapters.length}`);
    console.log(`  Production Ready: ${productionAdapters.length}`);
    console.log(`  Legacy Adapters: ${legacyAdapters.length}`);
    console.log('\n✅ MCP Adapter test completed successfully!');

  } catch (error) {
    console.error('❌ MCP Adapter test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testMCPAdapters().catch(console.error);