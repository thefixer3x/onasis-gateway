#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function browseCollection(filePath) {
  try {
    const collection = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`\n🔍 Collection: ${collection.info.name}`);
    console.log(`📝 Description: ${collection.info.description || 'No description'}`);
    console.log(`🔗 Schema: ${collection.info.schema}`);
    
    if (collection.info._collection_link) {
      console.log(`🌐 Link: ${collection.info._collection_link}`);
    }
    
    console.log(`\n📁 Structure:`);
    browseItems(collection.item || [], 0);
    
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
  }
}

function browseItems(items, depth = 0) {
  const indent = '  '.repeat(depth);
  
  items.forEach((item, index) => {
    if (item.item && Array.isArray(item.item)) {
      // Folder
      console.log(`${indent}📁 ${item.name} (${item.item.length} items)`);
      if (depth < 2) { // Limit depth to avoid too much output
        browseItems(item.item, depth + 1);
      }
    } else if (item.request) {
      // Request
      const method = item.request.method || 'GET';
      console.log(`${indent}🔧 ${method} ${item.name}`);
    }
  });
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('📚 Available Collections:');
  const collectionsDir = '/Users/seyederick/postman-collections-archive';
  const files = fs.readdirSync(collectionsDir)
    .filter(f => f.endsWith('.json'))
    .slice(0, 10); // Show first 10
  
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  console.log('\n💡 Usage: node browse-collections.js <collection-name>');
  console.log('Example: node browse-collections.js Paystack');
} else {
  const searchTerm = args[0];
  
  // Check if it's a direct file path
  if (fs.existsSync(searchTerm)) {
    browseCollection(searchTerm);
  } else {
    // Search in collections directory
    const collectionsDir = '/Users/seyederick/postman-collections-archive';
    const files = fs.readdirSync(collectionsDir)
      .filter(f => f.endsWith('.json') && f.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (files.length === 0) {
      console.log(`❌ No collections found matching "${searchTerm}"`);
    } else {
      files.forEach(file => {
        browseCollection(path.join(collectionsDir, file));
      });
    }
  }
}
