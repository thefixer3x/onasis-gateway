#!/bin/bash

# Migration script for Onasis Gateway
# Moves original Postman collections to external storage

echo "📦 Migrating Postman collections out of repo..."

# Create external storage directory
EXTERNAL_DIR="/Users/seyederick/postman-collections-archive"
mkdir -p "$EXTERNAL_DIR"

echo "📁 Created archive directory: $EXTERNAL_DIR"

# Move all Postman collection files
echo "🔄 Moving collection files..."

# Root level collection files
find . -maxdepth 1 -name "*.postman_collection.json" -exec mv {} "$EXTERNAL_DIR/" \;

# Other JSON files (except essential ones)
find . -maxdepth 1 -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name "tsconfig.json" ! -name "vercel.json" -exec mv {} "$EXTERNAL_DIR/" \;

# Move postman-collections directory
if [ -d "postman-collections" ]; then
    mv postman-collections "$EXTERNAL_DIR/"
    echo "📂 Moved postman-collections directory"
fi

# Move services JSON files (keep generated code)
echo "🔧 Moving services JSON files..."
find services -name "*.json" -type f -exec mv {} "$EXTERNAL_DIR/" \;

# Create inventory file
echo "📋 Creating inventory file..."
cat > "$EXTERNAL_DIR/INVENTORY.md" << EOF
# Postman Collections Archive

**Migrated from:** onasis-gateway repository
**Date:** $(date)
**Total Collections:** $(find "$EXTERNAL_DIR" -name "*.json" | wc -l)

## Collections Included:
$(find "$EXTERNAL_DIR" -name "*.json" -exec basename {} \; | sort)

## Purpose:
These are the original Postman collection files that were used to generate the MCP adapters.
They have been moved out of the repository to reduce size and focus on the generated code.

## Generated Adapters:
All adapters have been successfully generated and are located in:
- \`src/adapters/generated/\`
- \`netlify/functions/mcp-server.ts\`

## Recovery:
If you need to regenerate adapters, these files can be used with:
\`bun run scripts/generate-adapters.js\`
EOF

echo "✅ Migration complete!"
echo ""
echo "📊 Summary:"
echo "  - Collections moved to: $EXTERNAL_DIR"
echo "  - Repository cleaned up"
echo "  - Generated adapters preserved"
echo "  - Inventory created: $EXTERNAL_DIR/INVENTORY.md"
echo ""
echo "🚀 Your onasis-gateway repo is now clean and ready for deployment!"

# Show final size
echo "📏 Repository size after cleanup:"
du -sh . | head -1
