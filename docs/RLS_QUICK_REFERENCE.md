# RLS Performance Quick Reference

## TL;DR - Apply the Fix in 3 Steps

### Method 1: Automated Script (Easiest)
```bash
cd /Users/seyederick/onasis-gateway
./scripts/apply_rls_fixes.sh
```
Choose option 1, 2, or 3 based on your preference.

### Method 2: Supabase Dashboard (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents from: `supabase/migrations/rls_performance_optimization.sql`
3. Paste and click "Run"
4. Done! ✅

### Method 3: Direct psql
```bash
psql "YOUR_SUPABASE_DB_URL" \
  -f supabase/migrations/rls_performance_optimization.sql
```

## The Core Fix Pattern

### ❌ Before (Slow - N function calls)
```sql
USING (user_id = auth.uid())
```

### ✅ After (Fast - 1 function call)
```sql
USING (user_id = (select auth.uid()))
```

## Verification Query
```sql
-- Should return 0 if all policies are optimized
SELECT COUNT(*) 
FROM pg_policies 
WHERE schemaname IN ('public', 'credit')
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
    OR 
    (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
  );
```

## Performance Impact
- **1,000 row query**: 1000x fewer auth calls
- **10,000 row query**: 10,000x fewer auth calls
- **Expected speedup**: 50-100x for auth-heavy queries

## Files Created
1. `supabase/migrations/rls_performance_optimization.sql` - The migration
2. `docs/SUPABASE_RLS_PERFORMANCE_GUIDE.md` - Complete guide
3. `scripts/apply_rls_fixes.sh` - Automated application script
4. `supabase/check_rls_performance.sql` - Check for unoptimized policies

## Need Help?
Read the full guide: `docs/SUPABASE_RLS_PERFORMANCE_GUIDE.md`
