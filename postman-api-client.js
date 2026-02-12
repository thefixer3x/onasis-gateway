#!/usr/bin/env node

const axios = require('axios');

class PostmanAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.getpostman.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async getCollections() {
    try {
      const response = await this.client.get('/collections');
      return response.data;
    } catch (error) {
      console.error('Error fetching collections:', error.response?.data || error.message);
      return null;
    }
  }

  async getCollection(collectionId) {
    try {
      const response = await this.client.get(`/collections/${collectionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching collection:', error.response?.data || error.message);
      return null;
    }
  }

  async getWorkspaces() {
    try {
      const response = await this.client.get('/workspaces');
      return response.data;
    } catch (error) {
      console.error('Error fetching workspaces:', error.response?.data || error.message);
      return null;
    }
  }

  async searchCollections(query) {
    try {
      const collections = await this.getCollections();
      if (!collections) return [];
      
      return collections.collections.filter(collection => 
        collection.name.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching collections:', error.message);
      return [];
    }
  }

  displayCollection(collection) {
    console.log(`\n🔍 Collection: ${collection.name}`);
    console.log(`📝 Description: ${collection.description || 'No description'}`);
    console.log(`🆔 ID: ${collection.id || collection.uid}`);
    console.log(`👤 Owner: ${collection.owner}`);
    console.log(`🔗 Fork: ${collection.fork ? 'Yes' : 'No'}`);
    
    if (collection.info) {
      console.log(`🔗 Schema: ${collection.info.schema}`);
      if (collection.info._collection_link) {
        console.log(`🌐 Public Link: ${collection.info._collection_link}`);
      }
    }
  }

  displayCollectionStructure(items, depth = 0) {
    const indent = '  '.repeat(depth);
    
    items.forEach((item) => {
      if (item.item && Array.isArray(item.item)) {
        // Folder
        console.log(`${indent}📁 ${item.name} (${item.item.length} items)`);
        if (depth < 2) {
          this.displayCollectionStructure(item.item, depth + 1);
        }
      } else if (item.request) {
        // Request
        const method = item.request.method || 'GET';
        const url = typeof item.request.url === 'string' 
          ? item.request.url 
          : item.request.url?.raw || 'No URL';
        console.log(`${indent}🔧 ${method} ${item.name}`);
      }
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 Postman API Client

Usage:
  node postman-api-client.js <api-key> [command] [args]

Commands:
  list                    - List all collections
  get <collection-id>     - Get specific collection
  search <query>          - Search collections by name
  workspaces             - List workspaces

Examples:
  node postman-api-client.js YOUR_API_KEY list
  node postman-api-client.js YOUR_API_KEY search paystack
  node postman-api-client.js YOUR_API_KEY get collection-id

💡 Get your API key from: https://web.postman.co/settings/me/api-keys
    `);
    return;
  }

  const apiKey = args[0];
  const command = args[1] || 'list';
  const client = new PostmanAPIClient(apiKey);

  switch (command) {
    case 'list':
      console.log('📚 Fetching your collections...');
      const collections = await client.getCollections();
      if (collections) {
        console.log(`\n✅ Found ${collections.collections.length} collections:\n`);
        collections.collections.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   ID: ${collection.id || collection.uid}`);
          console.log(`   Owner: ${collection.owner}`);
          console.log('');
        });
      }
      break;

    case 'get':
      const collectionId = args[2];
      if (!collectionId) {
        console.log('❌ Please provide a collection ID');
        return;
      }
      console.log(`🔍 Fetching collection: ${collectionId}`);
      const collection = await client.getCollection(collectionId);
      if (collection) {
        client.displayCollection(collection.collection);
        if (collection.collection.item) {
          console.log('\n📁 Structure:');
          client.displayCollectionStructure(collection.collection.item);
        }
      }
      break;

    case 'search':
      const query = args[2];
      if (!query) {
        console.log('❌ Please provide a search query');
        return;
      }
      console.log(`🔍 Searching for: "${query}"`);
      const results = await client.searchCollections(query);
      if (results.length > 0) {
        console.log(`\n✅ Found ${results.length} matching collections:\n`);
        results.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   ID: ${collection.id || collection.uid}`);
          console.log('');
        });
      } else {
        console.log('❌ No collections found matching your query');
      }
      break;

    case 'workspaces':
      console.log('🏢 Fetching your workspaces...');
      const workspaces = await client.getWorkspaces();
      if (workspaces) {
        console.log(`\n✅ Found ${workspaces.workspaces.length} workspaces:\n`);
        workspaces.workspaces.forEach((workspace, index) => {
          console.log(`${index + 1}. ${workspace.name}`);
          console.log(`   ID: ${workspace.id}`);
          console.log(`   Type: ${workspace.type}`);
          console.log('');
        });
      }
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Available commands: list, get, search, workspaces');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PostmanAPIClient;
