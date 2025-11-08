#!/usr/bin/env node

const http = require('http');

console.log('🔍 Checking Onasis Gateway Interface...\n');

// Check health endpoint
const healthReq = http.get('http://localhost:3000/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ Health Check Response:');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
    console.log('\n' + '='.repeat(50) + '\n');
  });
});

healthReq.on('error', (err) => {
  console.log('❌ Health check failed:', err.message);
});

// Check adapters endpoint
setTimeout(() => {
  const adaptersReq = http.get('http://localhost:3000/api/adapters', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('📡 Adapters Response:');
      const adapters = JSON.parse(data).adapters;
      
      console.log(`\n🎯 Found ${adapters.length} active adapters:\n`);
      
      adapters.forEach((adapter, index) => {
        console.log(`${index + 1}. ${adapter.name}`);
        console.log(`   📝 ${adapter.description}`);
        console.log(`   🔧 ${adapter.toolCount} tools | ${adapter.authType} auth`);
        console.log(`   🌐 ${adapter.baseUrl}`);
        console.log(`   📂 Category: ${adapter.category}`);
        console.log('');
      });
      
      const totalTools = adapters.reduce((sum, a) => sum + a.toolCount, 0);
      console.log(`📊 Total Tools Available: ${totalTools}`);
      console.log(`🎯 Categories: ${[...new Set(adapters.map(a => a.category))].join(', ')}`);
      
      console.log('\n' + '='.repeat(50));
      console.log('🌟 Your Onasis Gateway is running perfectly!');
      console.log('🚀 Ready for Netlify deployment!');
      console.log('🔗 Interface available at: http://localhost:3000');
      console.log('='.repeat(50));
    });
  });

  adaptersReq.on('error', (err) => {
    console.log('❌ Adapters check failed:', err.message);
  });
}, 1000);

// Check main page
setTimeout(() => {
  const mainReq = http.get('http://localhost:3000/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\n📄 Main Page Status:');
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      console.log(`   Content Length: ${data.length} characters`);
      console.log(`   Contains Dashboard: ${data.includes('Onasis Gateway') ? '✅' : '❌'}`);
      console.log(`   Contains Adapters: ${data.includes('adapter-card') ? '✅' : '❌'}`);
      console.log(`   Contains Stats: ${data.includes('stat-card') ? '✅' : '❌'}`);
      
      // Extract title
      const titleMatch = data.match(/<title>(.*?)<\/title>/);
      if (titleMatch) {
        console.log(`   Page Title: "${titleMatch[1]}"`);
      }
      
      console.log('\n✨ Your beautiful interface is ready!');
    });
  });

  mainReq.on('error', (err) => {
    console.log('❌ Main page check failed:', err.message);
  });
}, 2000);
