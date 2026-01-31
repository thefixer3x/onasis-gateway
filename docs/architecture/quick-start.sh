#!/bin/bash

#########################################################
# Supabase Adapter Quick Start
# Automates the integration of Supabase Edge Functions
# into Onasis Gateway
#########################################################

set -e  # Exit on error

echo "┌─────────────────────────────────────────────────────┐"
echo "│   Supabase Adapter Quick Start                     │"
echo "│   Onasis Gateway Integration                       │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if we're in the gateway directory
if [ ! -d "adapters" ]; then
  echo -e "${RED}❌ Error: Run this script from the onasis-gateway root directory${NC}"
  exit 1
fi

# Check for required files
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}\n"

# Step 1: Create adapter directory
echo "📁 Step 1: Creating adapter directory..."
mkdir -p adapters/supabase-edge-functions

# Step 2: Copy adapter files
echo "📄 Step 2: Setting up adapter files..."

# Check if files exist in Downloads or current directory
DOWNLOAD_DIR="$HOME/Downloads"
CURRENT_DIR="."

if [ -f "$DOWNLOAD_DIR/supabase-adapter.ts" ]; then
  cp "$DOWNLOAD_DIR/supabase-adapter.ts" adapters/supabase-edge-functions/adapter.ts
  cp "$DOWNLOAD_DIR/supabase-adapter-config.json" adapters/supabase-edge-functions/config.json
  cp "$DOWNLOAD_DIR/adapter-types.ts" adapters/types.ts
  echo -e "${GREEN}✅ Files copied from Downloads${NC}"
elif [ -f "$CURRENT_DIR/supabase-adapter.ts" ]; then
  cp "$CURRENT_DIR/supabase-adapter.ts" adapters/supabase-edge-functions/adapter.ts
  cp "$CURRENT_DIR/supabase-adapter-config.json" adapters/supabase-edge-functions/config.json
  cp "$CURRENT_DIR/adapter-types.ts" adapters/types.ts
  echo -e "${GREEN}✅ Files copied from current directory${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: Adapter files not found in expected locations${NC}"
  echo "Please download them from Claude and place in Downloads or current directory"
  exit 1
fi

# Step 3: Environment variables
echo ""
echo "🔐 Step 3: Configuring environment variables..."

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  .env file not found, creating one...${NC}"
  touch .env
fi

# Check if Supabase vars already exist
if grep -q "SUPABASE_URL" .env; then
  echo -e "${GREEN}✅ Supabase variables already configured${NC}"
else
  echo ""
  echo -e "${BLUE}Please provide your Supabase credentials:${NC}"
  echo "You can find these at: https://supabase.com/dashboard/project/lanonasis/settings/api"
  echo ""
  
  read -p "Supabase URL (default: https://lanonasis.supabase.co): " SUPABASE_URL
  SUPABASE_URL=${SUPABASE_URL:-https://lanonasis.supabase.co}
  
  read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
  read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY
  
  # Append to .env
  echo "" >> .env
  echo "# Supabase Configuration (Auto-added by quick-start.sh)" >> .env
  echo "SUPABASE_URL=$SUPABASE_URL" >> .env
  echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env
  echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" >> .env
  
  # UAI settings
  if ! grep -q "UAI_ENABLED" .env; then
    echo "" >> .env
    echo "# UAI Integration" >> .env
    echo "UAI_ENABLED=true" >> .env
    echo "UAI_TOKEN_HEADER=Authorization" >> .env
  fi
  
  echo -e "${GREEN}✅ Environment variables configured${NC}"
fi

# Step 4: Install dependencies (if needed)
echo ""
echo "📦 Step 4: Checking dependencies..."

if ! grep -q "dotenv" package.json; then
  echo "Installing dotenv..."
  npm install dotenv
fi

echo -e "${GREEN}✅ Dependencies ready${NC}"

# Step 5: Generate adapter registration code
echo ""
echo "🔧 Step 5: Generating adapter registration code..."

cat > adapters/supabase-edge-functions/index.ts << 'EOF'
import { createSupabaseAdapter } from './adapter';
import * as fs from 'fs';
import * as path from 'path';

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Create and export adapter instance
export const supabaseAdapter = createSupabaseAdapter({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  ...config.discovery,
  authPassthrough: config.authentication.passthrough,
  uaiIntegration: config.authentication.uai,
});

// Auto-initialize on import
(async () => {
  try {
    console.log('🔍 Discovering Supabase Edge Functions...');
    const services = await supabaseAdapter.discoverServices();
    console.log(`✅ Discovered ${services.length} Supabase functions`);
  } catch (error) {
    console.error('❌ Failed to initialize Supabase adapter:', error);
  }
})();
EOF

echo -e "${GREEN}✅ Adapter registration code generated${NC}"

# Step 6: Create example integration file
echo ""
echo "📝 Step 6: Creating integration example..."

cat > adapters/supabase-edge-functions/example-integration.ts << 'EOF'
/**
 * Example: How to integrate Supabase adapter into your gateway
 * 
 * Add this to your main adapter registry file (e.g., adapters/index.ts)
 */

import { supabaseAdapter } from './supabase-edge-functions';
import { AdapterRegistry } from './types';

// Your existing adapter registry
const registry: AdapterRegistry = {
  adapters: new Map(),
  
  register(id: string, adapter: any) {
    this.adapters.set(id, adapter);
  },
  
  // ... other methods
};

// Register Supabase adapter
registry.register('supabase-edge-functions', supabaseAdapter);

// Example: Proxy request through adapter
async function proxyToSupabase(functionName: string, request: any) {
  const adapter = registry.adapters.get('supabase-edge-functions');
  
  if (!adapter) {
    throw new Error('Supabase adapter not found');
  }
  
  const serviceId = `supabase-${functionName}`;
  
  return await adapter.proxyRequest(serviceId, '/', {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}

// Example usage
async function testIntegration() {
  // Create a memory
  const response = await proxyToSupabase('memory-create', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_UAI_TOKEN',
      'Content-Type': 'application/json',
    },
    body: {
      title: 'Test Memory',
      content: 'Testing Supabase adapter integration',
      type: 'knowledge',
    },
  });
  
  console.log('Response:', await response.json());
}

export { proxyToSupabase, testIntegration };
EOF

echo -e "${GREEN}✅ Integration example created${NC}"

# Step 7: Run migration analysis
echo ""
echo "📊 Step 7: Running service migration analysis..."

if [ -f "migration-analysis.js" ]; then
  node migration-analysis.js
  echo -e "${GREEN}✅ Migration analysis complete${NC}"
  echo "   Check migration-report.json for details"
else
  echo -e "${YELLOW}⚠️  migration-analysis.js not found, skipping...${NC}"
fi

# Step 8: Create test script
echo ""
echo "🧪 Step 8: Creating test script..."

cat > test-supabase-adapter.sh << 'EOF'
#!/bin/bash

echo "Testing Supabase Adapter Integration"
echo "======================================"

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Test 1: Health check
echo ""
echo "Test 1: Adapter health check"
curl -s http://localhost:3000/health/supabase-edge-functions | jq .

# Test 2: List discovered services
echo ""
echo "Test 2: List discovered services"
curl -s http://localhost:3000/services/supabase-edge-functions | jq '.[] | {id, name, baseUrl}' | head -20

# Test 3: Proxy request (memory-create)
echo ""
echo "Test 3: Create memory through proxy"
curl -s -X POST http://localhost:3000/supabase/memory-create \
  -H "Authorization: Bearer $UAI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Memory",
    "content": "Testing Supabase adapter proxy",
    "type": "knowledge"
  }' | jq .

echo ""
echo "✅ Tests complete"
EOF

chmod +x test-supabase-adapter.sh
echo -e "${GREEN}✅ Test script created (test-supabase-adapter.sh)${NC}"

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Quick start complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Review the generated files:"
echo "   - adapters/supabase-edge-functions/adapter.ts"
echo "   - adapters/supabase-edge-functions/config.json"
echo "   - adapters/supabase-edge-functions/index.ts"
echo "   - adapters/supabase-edge-functions/example-integration.ts"
echo ""
echo "2. Integrate into your gateway:"
echo "   - See INTEGRATION_GUIDE.md for detailed instructions"
echo "   - Reference example-integration.ts for code samples"
echo ""
echo "3. Review migration analysis:"
echo "   - Check migration-report.json"
echo "   - See which services should use Supabase vs direct"
echo ""
echo "4. Test the integration:"
echo "   - Start your gateway: npm run dev"
echo "   - Run tests: ./test-supabase-adapter.sh"
echo ""
echo "5. Monitor and optimize:"
echo "   - Check logs for discovery results"
echo "   - Adjust cache timeout in config.json as needed"
echo "   - Monitor latency metrics"
echo ""
echo -e "${BLUE}Need help? Check INTEGRATION_GUIDE.md${NC}"
echo ""
