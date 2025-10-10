#!/bin/bash

echo "🔍 Validating Providus Bank TypeScript Integration..."

# Check if TypeScript files compile
echo "📝 Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck services/providus-bank/client.ts
if [ $? -eq 0 ]; then
    echo "✅ client.ts - No compilation errors"
else
    echo "❌ client.ts - Compilation errors found"
fi

npx tsc --noEmit --skipLibCheck services/providus-bank/mcp-adapter.ts
if [ $? -eq 0 ]; then
    echo "✅ mcp-adapter.ts - No compilation errors" 
else
    echo "❌ mcp-adapter.ts - Compilation errors found"
fi

# Check if required files exist
echo ""
echo "📁 Checking file structure..."
files=(
    "services/providus-bank/client.ts"
    "services/providus-bank/mcp-adapter.ts"
    "services/providus-bank/config.json"
    "services/providus-bank/test.js"
    "services/providus-bank/webhooks.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
    fi
done

# Check JSON syntax
echo ""
echo "🔧 Validating JSON configuration..."
if node -e "JSON.parse(require('fs').readFileSync('services/providus-bank/config.json', 'utf8'))" 2>/dev/null; then
    echo "✅ config.json - Valid JSON syntax"
else
    echo "❌ config.json - Invalid JSON syntax"
fi

echo ""
echo "🎉 Validation complete!"