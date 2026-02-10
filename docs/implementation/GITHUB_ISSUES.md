# GitHub Issues for Onasis Gateway Integration

**Project Board:** https://github.com/users/thefixer3x/projects/2

---

## Phase 0: Architecture & Planning

### Issue #1: Complete Architecture Documentation
**Title:** `[Phase 0] Complete Architecture Documentation`
**Labels:** `phase-0`, `priority-critical`, `type-docs`
**Assignee:** TBD
**Milestone:** Phase 0

**Description:**
Create comprehensive architecture documentation for the Onasis Gateway integration project.

**Tasks:**
- [x] Create `MASTER_IMPLEMENTATION_PLAN.md`
- [x] Create `ARCHITECTURE.md`
- [ ] Create service inventory spreadsheet
- [ ] Document all existing Edge Functions
- [ ] Map adapters to services
- [ ] Create deployment diagram
- [ ] Review and approval

**Acceptance Criteria:**
- All architecture documents complete
- Diagrams created and reviewed
- Service mapping verified
- Team alignment achieved

**Files:**
- `docs/implementation/MASTER_IMPLEMENTATION_PLAN.md`
- `docs/implementation/ARCHITECTURE.md`
- `docs/implementation/SERVICE_INVENTORY.md`

---

### Issue #2: Create GitHub Project Board Structure
**Title:** `[Phase 0] Set up Project Board and Issue Templates`
**Labels:** `phase-0`, `priority-high`, `type-infrastructure`

**Description:**
Set up GitHub project board with proper columns, labels, and automation.

**Tasks:**
- [ ] Create project board columns
- [ ] Configure automation rules
- [ ] Create issue templates
- [ ] Set up labels
- [ ] Create milestones for each phase

**Columns:**
- 📋 Backlog
- 🔜 Ready
- 🏗️ In Progress
- 👀 In Review
- ✅ Done

**Labels:**
- Phase: `phase-0` through `phase-7`
- Priority: `priority-critical`, `priority-high`, `priority-medium`, `priority-low`
- Type: `type-infrastructure`, `type-adapter`, `type-testing`, `type-docs`
- Service: `service-auth`, `service-payment`, `service-banking`, etc.

---

## Phase 1: Core Adapter System

### Issue #3: Create Universal Supabase Client
**Title:** `[Phase 1] Implement Universal Supabase Client`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`
**Milestone:** Phase 1

**Description:**
Create a universal client class that extends `BaseClient` for all Supabase Edge Function calls.

**Tasks:**
- [ ] Create `src/clients/universal-supabase-client.js`
- [ ] Extend `BaseClient` with Supabase-specific logic
- [ ] Implement authentication header injection
- [ ] Add error handling and retry logic
- [ ] Write unit tests
- [ ] Document usage

**Acceptance Criteria:**
- Client extends BaseClient properly
- Automatically adds Supabase auth headers
- Handles all HTTP methods
- Retry logic working
- Tests passing (> 80% coverage)
- Documentation complete

**Files:**
- Create: `src/clients/universal-supabase-client.js`
- Create: `tests/clients/universal-supabase-client.test.js`
- Update: `docs/clients/README.md`

---

### Issue #4: Create Base MCP Adapter Class
**Title:** `[Phase 1] Implement Base MCP Adapter Class`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`

**Description:**
Create abstract base class that all MCP adapters will extend.

**Tasks:**
- [ ] Create `src/adapters/base-mcp-adapter.js`
- [ ] Define adapter interface
- [ ] Implement tool management
- [ ] Add health check methods
- [ ] Implement stats collection
- [ ] Write unit tests
- [ ] Create adapter development guide

**Acceptance Criteria:**
- Base class fully functional
- Clear interface defined
- Health checks working
- Stats collection working
- Tests passing
- Developer guide complete

**Files:**
- Create: `src/adapters/base-mcp-adapter.js`
- Create: `tests/adapters/base-mcp-adapter.test.js`
- Create: `docs/adapters/DEVELOPMENT_GUIDE.md`

---

### Issue #5: Implement Adapter Registry
**Title:** `[Phase 1] Create Adapter Registry System`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`

**Description:**
Build the central registry that manages all adapters and provides tool lookup.

**Tasks:**
- [ ] Create `src/mcp/adapter-registry.js`
- [ ] Implement adapter registration
- [ ] Create tool index (Map<toolId, adapter>)
- [ ] Implement tool lookup methods
- [ ] Add bulk registration
- [ ] Implement registry health checks
- [ ] Write comprehensive tests

**Acceptance Criteria:**
- Registry manages all adapters
- Fast tool lookup (< 1ms)
- Thread-safe operations
- Health checks working
- Tests passing (> 90% coverage)

**Files:**
- Create: `src/mcp/adapter-registry.js`
- Create: `tests/mcp/adapter-registry.test.js`

---

### Issue #6: Update Unified Gateway to Use Registry
**Title:** `[Phase 1] Integrate Adapter Registry into Gateway`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`

**Description:**
Replace mock adapter loading with real adapter registry integration.

**Tasks:**
- [ ] Modify `unified_gateway.js` adapter loading
- [ ] Remove mock adapter code
- [ ] Integrate AdapterRegistry
- [ ] Update MCP tool list endpoint
- [ ] Update tool call endpoint
- [ ] Test integration end-to-end
- [ ] Update documentation

**Acceptance Criteria:**
- Mock adapters removed
- Registry fully integrated
- All MCP endpoints working
- No breaking changes to API
- Tests passing
- Documentation updated

**Files:**
- Modify: `unified_gateway.js` (lines 430-460)
- Update: `docs/API.md`

---

## Phase 2: Internal Services Integration

### Issue #7: Create Auth Gateway Adapter
**Title:** `[Phase 2] Implement Auth Gateway Service Adapter`
**Labels:** `phase-2`, `priority-critical`, `service-auth`, `type-adapter`
**Milestone:** Phase 2

**Description:**
Build MCP adapter for Auth Gateway service (JWT, OAuth, API keys).

**Tasks:**
- [ ] Create `services/auth-gateway/auth-gateway-adapter.js`
- [ ] Define auth tools (login, validate, generate-key, etc.)
- [ ] Implement tool execution
- [ ] Add JWT validation
- [ ] Add OAuth flow support
- [ ] Write integration tests
- [ ] Update catalog.json

**Tools to Implement:**
- `authenticate_user` - Email/password login
- `validate_token` - JWT/API key validation
- `generate_api_key` - Create new API key
- `refresh_token` - Refresh JWT
- `revoke_token` - Revoke access
- `oauth_authorize` - OAuth authorization
- `oauth_callback` - OAuth callback handler

**Acceptance Criteria:**
- All auth tools functional
- JWT validation working
- OAuth flow complete
- Integration tests passing
- Registered in catalog
- Documentation complete

**Files:**
- Create: `services/auth-gateway/auth-gateway-adapter.js`
- Create: `tests/services/auth-gateway-adapter.test.js`
- Update: `services/catalog.json`

---

### Issue #8: Create AI Router Adapter
**Title:** `[Phase 2] Implement AI Router Service Adapter`
**Labels:** `phase-2`, `priority-high`, `service-ai`, `type-adapter`

**Description:**
Build adapter for AI Router service (multi-model chat, embeddings).

**Tasks:**
- [ ] Create `services/ai-router/ai-router-adapter.js`
- [ ] Implement chat completion tool
- [ ] Implement streaming chat tool
- [ ] Implement embedding generation tool
- [ ] Add model routing logic
- [ ] Write tests
- [ ] Update catalog

**Tools:**
- `chat_completion` - Multi-provider chat
- `stream_chat` - Streaming chat
- `generate_embedding` - Text embeddings
- `list_models` - Available models

**Files:**
- Create: `services/ai-router/ai-router-adapter.js`
- Update: `services/catalog.json`

---

### Issue #9: Create Memory Service Adapter
**Title:** `[Phase 2] Implement Memory Service (MaaS) Adapter`
**Labels:** `phase-2`, `priority-high`, `service-memory`, `type-adapter`

**Description:**
Build adapter for Memory as a Service (already has 9 Edge Functions).

**Tasks:**
- [ ] Create `services/memory-as-a-service/memory-adapter.js`
- [ ] Map 9 Edge Functions to tools
- [ ] Implement vector search
- [ ] Implement CRUD operations
- [ ] Add batch operations
- [ ] Write tests
- [ ] Update catalog

**Tools** (from existing Edge Functions):
- `create_memory`
- `get_memory`
- `update_memory`
- `delete_memory`
- `list_memories`
- `search_memories`
- `memory_stats`
- `bulk_delete`
- `health_check`

**Files:**
- Create: `services/memory-as-a-service/memory-adapter.js`
- Update: `services/catalog.json`

---

### Issue #10: Create Security Service Adapter
**Title:** `[Phase 2] Implement Security & Compliance Service Adapter`
**Labels:** `phase-2`, `priority-medium`, `service-security`, `type-adapter`

**Description:**
Build adapter for security verification and compliance services.

**Files:**
- Create: `services/security-service/security-adapter.js`

---

### Issue #11: Update Verification Service Adapter
**Title:** `[Phase 2] Update and Connect Verification Service Adapter`
**Labels:** `phase-2`, `priority-medium`, `service-verification`, `type-adapter`

**Description:**
Update existing verification adapter to use Supabase backend.

**Tasks:**
- [ ] Update `services/verification-service/verification-mcp-adapter.ts`
- [ ] Change client baseURL to Supabase
- [ ] Test KYC/KYB flows
- [ ] Update catalog
- [ ] Integration tests

**Files:**
- Modify: `services/verification-service/verification-mcp-adapter.ts`

---

### Issue #12: Create Intelligence API Adapter
**Title:** `[Phase 2] Implement Intelligence & Analytics API Adapter`
**Labels:** `phase-2`, `priority-medium`, `service-intelligence`, `type-adapter`

**Description:**
Build adapter for Intelligence API (6 Edge Functions for AI insights).

**Tools:**
- `suggest_tags`
- `find_related`
- `detect_duplicates`
- `extract_insights`
- `analyze_patterns`
- `health_check`

**Files:**
- Create: `services/intelligence-api/intelligence-adapter.js`

---

## Phase 3: Payment Services Integration

### Issue #13: Update Paystack Client and Adapter
**Title:** `[Phase 3] Update Paystack to Use Supabase Backend`
**Labels:** `phase-3`, `priority-high`, `service-payment`, `type-adapter`
**Milestone:** Phase 3

**Description:**
Update Paystack client to route through Supabase Edge Function instead of direct API.

**Tasks:**
- [ ] Update `paystack-client.js` baseURL
- [ ] Update `paystack-mcp-adapter.ts` if needed
- [ ] Test all 117 tools
- [ ] Verify transaction flow
- [ ] Test webhooks
- [ ] Update catalog.json
- [ ] Integration tests

**Acceptance Criteria:**
- All Paystack tools route through Supabase
- Transaction initialization working
- Payment verification working
- Webhook handling tested
- Integration tests passing

**Files:**
- Modify: `services/paystack-payment-gateway/paystack-client.js` (line 12)
- Modify: `services/paystack-payment-gateway/paystack-mcp-adapter.ts`
- Update: `services/catalog.json`

---

### Issue #14: Update Flutterwave Client and Adapter
**Title:** `[Phase 3] Update Flutterwave to Use Supabase Backend`
**Labels:** `phase-3`, `priority-high`, `service-payment`, `type-adapter`

**Description:**
Update Flutterwave client to route through Supabase.

**Tasks:**
- [ ] Update `flutterwave-client.js` baseURL
- [ ] Test all 107 tools
- [ ] Verify payment flows
- [ ] Update catalog
- [ ] Integration tests

**Files:**
- Modify: `services/flutterwave-payment-gateway/flutterwave-client.js`

---

### Issue #15: Create Stripe Adapter
**Title:** `[Phase 3] Create Stripe Payment Adapter`
**Labels:** `phase-3`, `priority-high`, `service-payment`, `type-adapter`

**Description:**
Build Stripe adapter (Edge Function exists, no adapter yet).

**Files:**
- Create: `services/stripe-payment-gateway/stripe-adapter.js`

---

### Issue #16: Create SaySwitch Adapter
**Title:** `[Phase 3] Create SaySwitch Bills & Payment Adapter`
**Labels:** `phase-3`, `priority-medium`, `service-payment`, `type-adapter`

**Description:**
Build SaySwitch adapter for bill payments and transfers.

**Files:**
- Create: `services/sayswitch/sayswitch-adapter.js`

---

## Phase 4: Banking & Finance Services

### Issue #17: Update Providus Bank Adapter
**Title:** `[Phase 4] Update Providus Bank Adapter`
**Labels:** `phase-4`, `priority-high`, `service-banking`, `type-adapter`

**Files:**
- Modify: `services/providus-bank/mcp-adapter.ts`

---

### Issue #18: Create Credit-as-a-Service Adapter
**Title:** `[Phase 4] Create Credit Service Adapter`
**Labels:** `phase-4`, `priority-medium`, `service-banking`, `type-adapter`

**Files:**
- Create: `services/credit-as-a-service/credit-adapter.js`

---

### Issue #19: Update Xpress Wallet Adapter
**Title:** `[Phase 4] Update Xpress Wallet (WaaS) Adapter`
**Labels:** `phase-4`, `priority-medium`, `service-banking`, `type-adapter`

**Files:**
- Modify: `services/xpress-wallet-waas/xpress-wallet-mcp-adapter.ts`

---

## Phase 5: EDOC & Document Services

### Issue #20: Create EDOC Adapter
**Title:** `[Phase 5] Create Electronic Document (EDOC) Service Adapter`
**Labels:** `phase-5`, `priority-medium`, `service-documents`, `type-adapter`

**Description:**
Build adapter for 11 EDOC Edge Functions.

**Tools:**
- `init_consent`
- `consent_status`
- `delete_consent`
- `get_transactions`
- `dashboard_data`
- `webhook_handler`
- ... (11 total)

**Files:**
- Create: `services/edoc/edoc-adapter.js`

---

## Phase 6: Testing & Quality Assurance

### Issue #21: Write Unit Tests for Core Infrastructure
**Title:** `[Phase 6] Comprehensive Unit Testing - Core`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] Test UniversalSupabaseClient
- [ ] Test BaseMCPAdapter
- [ ] Test AdapterRegistry
- [ ] Test all adapters
- [ ] Achieve > 90% coverage

---

### Issue #22: Write Integration Tests
**Title:** `[Phase 6] End-to-End Integration Testing`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] Auth flow tests
- [ ] Payment flow tests
- [ ] Memory operation tests
- [ ] AI routing tests
- [ ] Multi-service workflows

---

### Issue #23: Load & Performance Testing
**Title:** `[Phase 6] Load Testing and Performance Benchmarks`
**Labels:** `phase-6`, `priority-high`, `type-testing`

**Tasks:**
- [ ] Concurrent request tests
- [ ] Rate limiting verification
- [ ] Circuit breaker tests
- [ ] Latency benchmarks
- [ ] Throughput tests

---

### Issue #24: Security & Compliance Audit
**Title:** `[Phase 6] Security Audit and Compliance Review`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] Authentication testing
- [ ] Authorization testing
- [ ] API key validation
- [ ] CORS verification
- [ ] Audit logging verification
- [ ] Security penetration testing

---

## Phase 7: Deployment & Monitoring

### Issue #25: Production Deployment
**Title:** `[Phase 7] Deploy to Production (Railway)`
**Labels:** `phase-7`, `priority-critical`, `type-infrastructure`

**Tasks:**
- [ ] Update environment variables
- [ ] Deploy to Railway
- [ ] Verify health checks
- [ ] Test public endpoints
- [ ] Monitor initial traffic

---

### Issue #26: Set Up Monitoring & Alerting
**Title:** `[Phase 7] Configure Production Monitoring`
**Labels:** `phase-7`, `priority-critical`, `type-infrastructure`

**Tasks:**
- [ ] Set up metrics collection
- [ ] Configure alerts
- [ ] Set up logging aggregation
- [ ] Create dashboards
- [ ] Configure error tracking

---

### Issue #27: Complete Documentation
**Title:** `[Phase 7] Finalize All Documentation`
**Labels:** `phase-7`, `priority-high`, `type-docs`

**Tasks:**
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Developer onboarding guide
- [ ] Operations runbook

---

## Summary

**Total Issues:** 27
**Estimated Timeline:** 6-8 weeks

### By Phase:
- Phase 0: 2 issues
- Phase 1: 4 issues (Core infrastructure)
- Phase 2: 6 issues (Internal services)
- Phase 3: 4 issues (Payments)
- Phase 4: 3 issues (Banking)
- Phase 5: 1 issue (Documents)
- Phase 6: 4 issues (Testing)
- Phase 7: 3 issues (Deployment)

### By Priority:
- Critical: 11 issues
- High: 10 issues
- Medium: 6 issues

---

**Next Steps:**
1. Review and approve this issue list
2. Create issues in GitHub
3. Add to project board
4. Assign to team members
5. Start Phase 1 execution
