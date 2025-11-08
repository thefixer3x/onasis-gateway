#!/usr/bin/env node

const axios = require('axios');

class PostmanMarketplaceClient {
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

  // Search public collections in the marketplace
  async searchPublicCollections(query, limit = 20) {
    try {
      const response = await this.client.get('/collections', {
        params: {
          workspace: 'public',
          search: query,
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching public collections:', error.response?.data || error.message);
      return null;
    }
  }

  // Get public collection by ID
  async getPublicCollection(collectionId) {
    try {
      const response = await this.client.get(`/collections/${collectionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching public collection:', error.response?.data || error.message);
      return null;
    }
  }

  // Browse popular collections
  async getPopularCollections(category = null) {
    try {
      const params = { workspace: 'public', sort: 'popular' };
      if (category) params.category = category;
      
      const response = await this.client.get('/collections', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching popular collections:', error.response?.data || error.message);
      return null;
    }
  }

  // Get collections by category
  async getCollectionsByCategory(category) {
    try {
      const response = await this.client.get('/collections', {
        params: {
          workspace: 'public',
          category: category
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching collections by category:', error.response?.data || error.message);
      return null;
    }
  }

  // Known public collection IDs for direct access
  getKnownPublicCollections() {
    return {
      'paystack': {
        id: 'e0519972-5c06-4dc1-889f-08e93e9bc6b0',
        name: 'Paystack API',
        description: 'Official Paystack API collection'
      },
      'stripe': {
        id: '665823-ad34a7b4-c4e4-4b5c-8a6e-7c4d5e6f7a8b',
        name: 'Stripe API',
        description: 'Official Stripe API collection'
      },
      'twilio': {
        id: '12345-twilio-collection-id',
        name: 'Twilio API',
        description: 'Official Twilio API collection'
      }
    };
  }

  displayCollection(collection) {
    console.log(`\n🔍 Collection: ${collection.info?.name || collection.name}`);
    console.log(`📝 Description: ${collection.info?.description || collection.description || 'No description'}`);
    console.log(`🆔 ID: ${collection.info?._postman_id || collection.id || collection.uid}`);
    
    if (collection.info?._collection_link) {
      console.log(`🌐 Public Link: ${collection.info._collection_link}`);
    }
    
    if (collection.info?.schema) {
      console.log(`🔗 Schema: ${collection.info.schema}`);
    }

    if (collection.collection?.item || collection.item) {
      const items = collection.collection?.item || collection.item;
      console.log(`\n📊 Total Requests: ${this.countRequests(items)}`);
      console.log('\n📁 Structure:');
      this.displayItems(items, 0);
    }
  }

  countRequests(items) {
    let count = 0;
    items.forEach(item => {
      if (item.item && Array.isArray(item.item)) {
        count += this.countRequests(item.item);
      } else if (item.request) {
        count++;
      }
    });
    return count;
  }

  displayItems(items, depth = 0) {
    const indent = '  '.repeat(depth);
    
    items.forEach((item) => {
      if (item.item && Array.isArray(item.item)) {
        console.log(`${indent}📁 ${item.name} (${this.countRequests(item.item)} requests)`);
        if (depth < 2) {
          this.displayItems(item.item, depth + 1);
        }
      } else if (item.request) {
        const method = item.request.method || 'GET';
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
🌐 Postman Marketplace Client

Usage:
  node postman-marketplace-client.js <api-key> [command] [args]

Commands:
  search <query>          - Search public collections
  popular [category]      - Get popular collections
  category <category>     - Get collections by category
  get <collection-id>     - Get specific public collection
  known                   - List known public collections

Examples:
  node postman-marketplace-client.js YOUR_API_KEY search paystack
  node postman-marketplace-client.js YOUR_API_KEY popular payments
  node postman-marketplace-client.js YOUR_API_KEY category fintech
  node postman-marketplace-client.js YOUR_API_KEY get e0519972-5c06-4dc1-889f-08e93e9bc6b0

Categories: payments, fintech, social, productivity, developer-tools, etc.
    `);
    return;
  }

  const apiKey = args[0];
  const command = args[1] || 'search';
  const client = new PostmanMarketplaceClient(apiKey);

  switch (command) {
    case 'search':
      const query = args[2];
      if (!query) {
        console.log('❌ Please provide a search query');
        return;
      }
      console.log(`🔍 Searching public collections for: "${query}"`);
      const searchResults = await client.searchPublicCollections(query);
      if (searchResults && searchResults.collections) {
        console.log(`\n✅ Found ${searchResults.collections.length} public collections:\n`);
        searchResults.collections.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   ID: ${collection.id || collection.uid}`);
          console.log(`   Owner: ${collection.owner || 'Public'}`);
          console.log('');
        });
      }
      break;

    case 'popular':
      const category = args[2];
      console.log(`🔥 Fetching popular collections${category ? ` in category: ${category}` : ''}...`);
      const popular = await client.getPopularCollections(category);
      if (popular && popular.collections) {
        console.log(`\n✅ Found ${popular.collections.length} popular collections:\n`);
        popular.collections.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   ID: ${collection.id || collection.uid}`);
          console.log(`   Description: ${collection.description || 'No description'}`);
          console.log('');
        });
      }
      break;

    case 'category':
      const cat = args[2];
      if (!cat) {
        console.log('❌ Please provide a category');
        return;
      }
      console.log(`📂 Fetching collections in category: ${cat}`);
      const categoryResults = await client.getCollectionsByCategory(cat);
      if (categoryResults && categoryResults.collections) {
        console.log(`\n✅ Found ${categoryResults.collections.length} collections:\n`);
        categoryResults.collections.forEach((collection, index) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   ID: ${collection.id || collection.uid}`);
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
      console.log(`🔍 Fetching public collection: ${collectionId}`);
      const collection = await client.getPublicCollection(collectionId);
      if (collection) {
        client.displayCollection(collection);
      }
      break;

    case 'known':
      const known = client.getKnownPublicCollections();
      console.log('📚 Known Public Collections:\n');
      Object.entries(known).forEach(([key, info]) => {
        console.log(`${key.toUpperCase()}:`);
        console.log(`  Name: ${info.name}`);
        console.log(`  ID: ${info.id}`);
        console.log(`  Description: ${info.description}`);
        console.log('');
      });
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Available commands: search, popular, category, get, known');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PostmanMarketplaceClient;
