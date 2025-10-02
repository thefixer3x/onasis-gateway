-- =====================================================
-- Supabase RLS Performance Optimization Script
-- =====================================================
-- This script fixes the auth_rls_initplan warnings by replacing
-- auth.<function>() calls with (select auth.<function>()) in RLS policies
-- to ensure they're evaluated once per query, not per row.

-- Start transaction to ensure all changes are atomic
BEGIN;

-- =====================================================
-- CREDIT SCHEMA POLICIES
-- =====================================================

-- Fix credit.applications policies
DROP POLICY IF EXISTS "Users can create own applications" ON credit.applications;
CREATE POLICY "Users can create own applications" ON credit.applications
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own applications" ON credit.applications;
CREATE POLICY "Users can update own applications" ON credit.applications
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own applications" ON credit.applications;
CREATE POLICY "Users can view own applications" ON credit.applications
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix credit.credit_scores policies
DROP POLICY IF EXISTS "Users can view own credit scores" ON credit.credit_scores;
CREATE POLICY "Users can view own credit scores" ON credit.credit_scores
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- =====================================================
-- PUBLIC SCHEMA POLICIES
-- =====================================================

-- Fix public.profiles policies
DROP POLICY IF EXISTS "Profiles can be inserted by owner" ON public.profiles;
CREATE POLICY "Profiles can be inserted by owner" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
FOR SELECT TO authenticated
USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Profiles can be updated by owner" ON public.profiles;
CREATE POLICY "Profiles can be updated by owner" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

-- Fix public.api_keys policies
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
CREATE POLICY "Users can create their own API keys" ON public.api_keys
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
CREATE POLICY "Users can update their own API keys" ON public.api_keys
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Service role can manage api_keys" ON public.api_keys;
CREATE POLICY "Service role can manage api_keys" ON public.api_keys
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix public.user_consents policies
DROP POLICY IF EXISTS "Users can manage their own consents" ON public.user_consents;
CREATE POLICY "Users can manage their own consents" ON public.user_consents
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.user_roles policies
DROP POLICY IF EXISTS "Users can view their assigned roles" ON public.user_roles;
CREATE POLICY "Users can view their assigned roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.ai_recommendations policies
DROP POLICY IF EXISTS "Users can view AI recommendations" ON public.ai_recommendations;
CREATE POLICY "Users can view AI recommendations" ON public.ai_recommendations
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.memory_entries policies (handle duplicates)
DROP POLICY IF EXISTS "Users can view own memory entries" ON public.memory_entries;
DROP POLICY IF EXISTS "Users can manage own memory entries" ON public.memory_entries;

-- Create a single comprehensive policy for memory_entries
CREATE POLICY "Users can manage own memory entries" ON public.memory_entries
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.business_financial_insights policies
DROP POLICY IF EXISTS "Users can view their own business insights" ON public.business_financial_insights;
CREATE POLICY "Users can view their own business insights" ON public.business_financial_insights
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.edoc_financial_analysis policies
DROP POLICY IF EXISTS "Users can view their own financial analysis" ON public.edoc_financial_analysis;
CREATE POLICY "Users can view their own financial analysis" ON public.edoc_financial_analysis
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.feature_flags policies
DROP POLICY IF EXISTS "Authenticated users can view feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can view feature flags" ON public.feature_flags
FOR SELECT TO authenticated
USING (true); -- Feature flags are typically visible to all authenticated users

-- Fix public.system_error_logs policies
DROP POLICY IF EXISTS "System admins can view error logs" ON public.system_error_logs;
CREATE POLICY "System admins can view error logs" ON public.system_error_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- Fix public.edoc_consents policies
DROP POLICY IF EXISTS "Users can manage their own consents" ON public.edoc_consents;
CREATE POLICY "Users can manage their own consents" ON public.edoc_consents
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.simple_users policies
DROP POLICY IF EXISTS "Simple users can update own record" ON public.simple_users;
CREATE POLICY "Simple users can update own record" ON public.simple_users
FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Simple users can view own record" ON public.simple_users;
CREATE POLICY "Simple users can view own record" ON public.simple_users
FOR SELECT TO authenticated
USING (id = (select auth.uid()));

-- Fix public.webhook_logs policies
DROP POLICY IF EXISTS "System access for webhook logs" ON public.webhook_logs;
CREATE POLICY "System access for webhook logs" ON public.webhook_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix public.topics policies (handle duplicates)
DROP POLICY IF EXISTS "Users can manage own topics" ON public.topics;
DROP POLICY IF EXISTS "Topics viewable by org members" ON public.topics;

-- Create optimized policies for topics
CREATE POLICY "Users can manage own topics" ON public.topics
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Topics viewable by org members" ON public.topics
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = (select auth.uid())
  )
);

-- Fix public.say_bills policies
DROP POLICY IF EXISTS "Users can manage their own bills" ON public.say_bills;
CREATE POLICY "Users can manage their own bills" ON public.say_bills
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.business_profiles policies
DROP POLICY IF EXISTS "Users can manage their own business profiles" ON public.business_profiles;
CREATE POLICY "Users can manage their own business profiles" ON public.business_profiles
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.say_orders policies
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.say_orders;
CREATE POLICY "Users can manage their own orders" ON public.say_orders
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.user_sessions policies
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.say_transfers policies
DROP POLICY IF EXISTS "Users can manage their own transfers" ON public.say_transfers;
CREATE POLICY "Users can manage their own transfers" ON public.say_transfers
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Fix public.users policies
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" ON public.users
FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own record" ON public.users;
CREATE POLICY "Users can view own record" ON public.users
FOR SELECT TO authenticated
USING (id = (select auth.uid()));

-- Fix public.user_activity_logs policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.agent_banks_memories policies
DROP POLICY IF EXISTS "Users can view their own agent memories" ON public.agent_banks_memories;
CREATE POLICY "Users can view their own agent memories" ON public.agent_banks_memories
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.agent_banks_sessions policies
DROP POLICY IF EXISTS "Users can view their own agent sessions" ON public.agent_banks_sessions;
CREATE POLICY "Users can view their own agent sessions" ON public.agent_banks_sessions
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.user_product_interactions policies
DROP POLICY IF EXISTS "Users can view their own interactions" ON public.user_product_interactions;
CREATE POLICY "Users can view their own interactions" ON public.user_product_interactions
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.agent_banks_memory_search_logs policies
DROP POLICY IF EXISTS "Users can view their own memory search logs" ON public.agent_banks_memory_search_logs;
CREATE POLICY "Users can view their own memory search logs" ON public.agent_banks_memory_search_logs
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.user_payments policies
DROP POLICY IF EXISTS "Users can view their own payments" ON public.user_payments;
CREATE POLICY "Users can view their own payments" ON public.user_payments
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.edoc_transactions policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.edoc_transactions;
CREATE POLICY "Users can view their own transactions" ON public.edoc_transactions
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.edoc_usage_logs policies
DROP POLICY IF EXISTS "Users can view their own usage logs" ON public.edoc_usage_logs;
CREATE POLICY "Users can view their own usage logs" ON public.edoc_usage_logs
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Fix public.organizations policies (handle duplicates)
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can manage organization" ON public.organizations;

-- Create optimized policies for organizations
CREATE POLICY "Users can view their organization" ON public.organizations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = (select auth.uid())
  )
);

CREATE POLICY "Org admins can manage organization" ON public.organizations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND organization_id = organizations.id
    AND role = 'org_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND organization_id = organizations.id
    AND role = 'org_admin'
  )
);

-- Commit the transaction
COMMIT;

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this query after applying the fixes to verify the policies are optimized:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname IN ('public', 'credit')
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
    OR
    (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
  )
ORDER BY schemaname, tablename, policyname;
*/

-- If the above query returns no results, all policies have been optimized!
