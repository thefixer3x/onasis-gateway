-- Query to find RLS policies that need performance optimization
-- This identifies policies using auth functions without (select ...) wrapper

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd AS command,
  CASE 
    WHEN qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'USING clause needs optimization'
    WHEN with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%' THEN 'WITH CHECK clause needs optimization'
    ELSE 'Both clauses need optimization'
  END AS optimization_needed,
  qual AS using_clause,
  with_check AS check_clause
FROM pg_policies 
WHERE schemaname IN ('public', 'credit')
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
    OR 
    (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
  )
ORDER BY schemaname, tablename, policyname;
