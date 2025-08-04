#!/bin/bash

# Cleanup script for Onasis Gateway
# Removes original Postman collection JSON files after successful extraction

echo "🧹 Cleaning up original Postman collection files..."

# Create backup directory first (optional)
mkdir -p backup/original-collections
echo "📦 Created backup directory"

# Move original JSON files to backup (safer than deleting)
echo "📁 Moving original collection files to backup..."

# Root level collection files
mv *.postman_collection.json backup/original-collections/ 2>/dev/null || echo "No root collection files found"
mv *.json backup/original-collections/ 2>/dev/null || echo "No other JSON files to move"

# Keep essential JSON files
mv backup/original-collections/package.json . 2>/dev/null || echo "package.json already in place"
mv backup/original-collections/package-lock.json . 2>/dev/null || echo "package-lock.json already in place"
mv backup/original-collections/tsconfig.json . 2>/dev/null || echo "tsconfig.json already in place"
mv backup/original-collections/vercel.json . 2>/dev/null || echo "vercel.json already in place"

# Remove postman-collections directory (already processed)
if [ -d "postman-collections" ]; then
    echo "🗂️ Removing postman-collections directory..."
    rm -rf postman-collections
fi

# Clean up services directory JSON files (keep the generated code)
echo "🔧 Cleaning services directory..."
find services -name "*.json" -type f -exec rm {} \;

# Remove logs directory (can be regenerated)
if [ -d "logs" ]; then
    echo "📋 Removing logs directory..."
    rm -rf logs
fi

# Update .gitignore to exclude backup
echo "backup/" >> .gitignore

echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  - Original collection files moved to backup/"
echo "  - Services JSON files removed"
echo "  - Generated adapters preserved in src/adapters/"
echo "  - Core configuration files kept"
echo ""
echo "🚀 Your Onasis Gateway is now clean and ready for deployment!"
