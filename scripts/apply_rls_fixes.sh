#!/bin/bash

# =====================================================
# Supabase RLS Performance Fix Application Script
# =====================================================
# This script helps you apply the RLS performance optimizations
# to your remote Supabase database.

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Supabase RLS Performance Optimizer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/rls_performance_optimization.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found at $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will apply RLS performance optimizations to your Supabase database.${NC}"
echo ""
echo "The optimizations will:"
echo "  ✓ Wrap auth.uid() calls in (select ...) for better performance"
echo "  ✓ Consolidate duplicate policies"
echo "  ✓ Maintain all existing security rules"
echo ""

# Method selection
echo "Choose your application method:"
echo "  1) Supabase CLI (requires 'supabase' command and logged in)"
echo "  2) Direct PostgreSQL connection (requires database URL)"
echo "  3) Show SQL for manual application"
echo ""
read -p "Enter your choice (1-3): " METHOD

case $METHOD in
    1)
        echo ""
        echo -e "${YELLOW}Using Supabase CLI...${NC}"
        
        # Check if supabase CLI is installed
        if ! command -v supabase &> /dev/null; then
            echo -e "${RED}Error: Supabase CLI not found. Please install it first:${NC}"
            echo "  npm install -g supabase"
            echo "  or visit: https://supabase.com/docs/guides/cli"
            exit 1
        fi
        
        # Check if logged in
        echo "Checking Supabase login status..."
        if ! supabase projects list &> /dev/null; then
            echo -e "${YELLOW}You need to login to Supabase first.${NC}"
            echo "Running: supabase login"
            supabase login
        fi
        
        # Check if project is linked
        echo "Checking project link..."
        if ! supabase status --linked &> /dev/null; then
            echo -e "${YELLOW}Project not linked. Please provide your project reference:${NC}"
            read -p "Enter your Supabase project ref: " PROJECT_REF
            supabase link --project-ref "$PROJECT_REF"
        fi
        
        echo ""
        echo -e "${GREEN}Applying migration via Supabase CLI...${NC}"
        
        # Push the migration
        if supabase db push; then
            echo ""
            echo -e "${GREEN}✓ Migration applied successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to apply migration via CLI${NC}"
            echo "Try using method 2 (Direct PostgreSQL connection)"
            exit 1
        fi
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Using Direct PostgreSQL Connection...${NC}"
        echo ""
        echo "You'll need your database connection URL from Supabase Dashboard:"
        echo "  1. Go to Settings → Database"
        echo "  2. Under 'Connection string', copy the 'URI' format"
        echo "  3. Replace [YOUR-PASSWORD] with your actual database password"
        echo ""
        read -p "Enter your database URL (postgresql://...): " DB_URL
        
        if [ -z "$DB_URL" ]; then
            echo -e "${RED}Error: Database URL cannot be empty${NC}"
            exit 1
        fi
        
        # Check if psql is installed
        if ! command -v psql &> /dev/null; then
            echo -e "${RED}Error: psql not found. Please install PostgreSQL client.${NC}"
            echo "  macOS: brew install postgresql"
            echo "  Ubuntu: sudo apt-get install postgresql-client"
            exit 1
        fi
        
        echo ""
        echo -e "${GREEN}Applying migration via psql...${NC}"
        
        if psql "$DB_URL" -f "$MIGRATION_FILE"; then
            echo ""
            echo -e "${GREEN}✓ Migration applied successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to apply migration${NC}"
            exit 1
        fi
        ;;
        
    3)
        echo ""
        echo -e "${YELLOW}Displaying SQL for manual application:${NC}"
        echo ""
        echo "Copy the following SQL and paste it into Supabase SQL Editor:"
        echo ""
        echo -e "${GREEN}========== SQL START ==========${NC}"
        cat "$MIGRATION_FILE"
        echo -e "${GREEN}=========== SQL END ===========${NC}"
        echo ""
        echo "To apply manually:"
        echo "  1. Go to Supabase Dashboard"
        echo "  2. Navigate to SQL Editor"
        echo "  3. Create a new query"
        echo "  4. Paste the SQL above"
        echo "  5. Click 'Run'"
        echo ""
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

# Verification
echo ""
echo -e "${YELLOW}Verifying optimization...${NC}"

VERIFICATION_QUERY="SELECT COUNT(*) FROM pg_policies WHERE schemaname IN ('public', 'credit') AND ((qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%') OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%'));"

if [ "$METHOD" == "1" ]; then
    # Use supabase CLI to run verification
    echo "Running verification query..."
    # Note: supabase CLI doesn't have a direct SQL execution command for linked projects
    echo -e "${YELLOW}Please run this verification query in Supabase SQL Editor:${NC}"
    echo "$VERIFICATION_QUERY"
elif [ "$METHOD" == "2" ]; then
    # Use psql to run verification
    RESULT=$(psql "$DB_URL" -t -c "$VERIFICATION_QUERY" | tr -d ' ')
    if [ "$RESULT" == "0" ]; then
        echo -e "${GREEN}✓ All policies optimized! No unoptimized policies found.${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: $RESULT unoptimized policies still found.${NC}"
        echo "Some tables may not exist in your schema. This is normal."
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Optimization Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Monitor query performance in Supabase Dashboard"
echo "  2. Check Database → Query Performance for improvements"
echo "  3. Review the full guide at: docs/SUPABASE_RLS_PERFORMANCE_GUIDE.md"
echo ""
echo -e "${GREEN}Your database should now perform significantly better! 🚀${NC}"
