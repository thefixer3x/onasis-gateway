#!/usr/bin/env node

const axios = require('axios');

// Known public collection URLs
const PUBLIC_COLLECTIONS = {
  'paystack': {
    name: 'Paystack API',
    url: 'https://www.postman.com/paystack-developers/paystack-api/collection/vtizh49/paystack',
    api_url: 'https://api.postman.com/collections/e0519972-5c06-4dc1-889f-08e93e9bc6b0',
    description: 'Official Paystack API collection'
  },
  'flutterwave': {
    name: 'Flutterwave v3',
    url: 'https://www.postman.com/lively-zodiac-773579/flutterwave-api/collection/9qa6trt/flutterwave-v3',
    description: 'Official Flutterwave v3 API collection'
  },
  'stripe': {
    name: 'Stripe API',
    url: 'https://www.postman.com/stripe-dev/stripe-developers/collection/665823-ad34a7b4-c4e4-4b5c-8a6e-7c4d5e6f7a8b',
    description: 'Official Stripe API collection'
  }
};

async function fetchPublicCollection(collectionKey) {
  const collection = PUBLIC_COLLECTIONS[collectionKey];
  if (!collection) {
    console.log(`❌ Unknown collection: ${collectionKey}`);
    console.log('Available collections:', Object.keys(PUBLIC_COLLECTIONS).join(', '));
    return;
  }

  console.log(`🔍 Fetching ${collection.name}...`);
  console.log(`🌐 URL: ${collection.url}`);
  
  // Try to fetch from our local files first
  const fs = require('fs');
  const path = require('path');
  
  const localPaths = [
    `/Users/seyederick/Downloads/${collection.name}.postman_collection.json`,
    `/Users/seyederick/postman-collections-archive/${collection.name}.postman_collection.json`,
    `/Users/seyederick/onasis-gateway/postman-collections/${collection.name}.postman_collection.json`
  ];
  
  for (const localPath of localPaths) {
    if (fs.existsSync(localPath)) {
      console.log(`✅ Found local collection: ${localPath}`);
      try {
        const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        displayCollection(data);
        return;
      } catch (error) {
        console.log(`❌ Error reading local file: ${error.message}`);
      }
    }
  }
  
  console.log('📁 Local collection not found, use the local browser script instead:');
  console.log(`node browse-collections.js ${collectionKey}`);
}

function displayCollection(collection) {
  console.log(`\n🔍 Collection: ${collection.info.name}`);
  console.log(`📝 Description: ${collection.info.description || 'No description'}`);
  console.log(`🔗 Schema: ${collection.info.schema}`);
  
  if (collection.info._collection_link) {
    console.log(`🌐 Public Link: ${collection.info._collection_link}`);
  }
  
  if (collection.item) {
    console.log(`\n📊 Total Items: ${countItems(collection.item)}`);
    console.log('\n📁 Structure:');
    displayItems(collection.item, 0);
  }
}

function countItems(items) {
  let count = 0;
  items.forEach(item => {
    if (item.item && Array.isArray(item.item)) {
      count += countItems(item.item);
    } else if (item.request) {
      count++;
    }
  });
  return count;
}

function displayItems(items, depth = 0) {
  const indent = '  '.repeat(depth);
  
  items.forEach((item) => {
    if (item.item && Array.isArray(item.item)) {
      console.log(`${indent}📁 ${item.name} (${countItems(item.item)} items)`);
      if (depth < 2) {
        displayItems(item.item, depth + 1);
      }
    } else if (item.request) {
      const method = item.request.method || 'GET';
      console.log(`${indent}🔧 ${method} ${item.name}`);
    }
  });
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🌐 Public Collection Browser

Available Collections:
${Object.entries(PUBLIC_COLLECTIONS).map(([key, col]) => 
  `  ${key.padEnd(12)} - ${col.name}`
).join('\n')}

Usage:
  node public-collection-browser.js <collection-name>

Examples:
  node public-collection-browser.js paystack
  node public-collection-browser.js flutterwave
  node public-collection-browser.js stripe
    `);
    return;
  }

  const collectionKey = args[0].toLowerCase();
  await fetchPublicCollection(collectionKey);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PUBLIC_COLLECTIONS, fetchPublicCollection };
