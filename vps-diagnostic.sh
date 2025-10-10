#!/bin/bash

# 🚨 VPS Diagnostic Script - Database Connection Issue
# Run this on your VPS to diagnose the vibe-gateway problem

echo "🔍 VPS DIAGNOSTIC - DATABASE CONNECTION ISSUE"
echo "=============================================="

echo ""
echo "📊 1. PM2 Process Status"
pm2 list

echo ""
echo "📋 2. Vibe Gateway Details"
pm2 describe vibe-gateway

echo ""
echo "📝 3. Recent Error Logs (last 50 lines)"
pm2 logs vibe-gateway --lines 50 --nostream

echo ""
echo "🔌 4. Database Connection Test"
echo "Checking PostgreSQL connectivity..."

# Test database connectivity
if command -v psql &> /dev/null; then
    echo "PostgreSQL client available"
    # Test connection (replace with your DB details)
    # psql -h your-db-host -U your-db-user -d your-db-name -c "SELECT 1;"
else
    echo "PostgreSQL client not installed"
fi

echo ""
echo "🌐 5. Network Connectivity"
echo "Checking network status..."
netstat -tulpn | grep -E ':(7777|7778|3008)'

echo ""
echo "💾 6. System Resources"
free -h
df -h

echo ""
echo "🔄 7. Environment Variables (DB related)"
pm2 env vibe-gateway | grep -i -E "(database|db_|postgres|supabase|neon)"

echo ""
echo "📈 8. Process Health"
pm2 monit --no-daemon | head -20

echo ""
echo "🎯 DIAGNOSTIC COMPLETE"
echo "Check the output above for:"
echo "- Database connection strings"
echo "- Network connectivity issues"
echo "- Resource constraints"
echo "- Environment variable problems"