#!/usr/bin/env node

/**
 * Service Migration Analysis
 * Identifies which services should route through Supabase vs direct providers
 * 
 * Run: node migration-analysis.js
 */

import * as fs from 'fs';
import * as path from 'path';

interface ServiceCategory {
  name: string;
  services: string[];
  recommendation: 'supabase' | 'direct' | 'hybrid';
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

const serviceAnalysis: ServiceCategory[] = [
  {
    name: 'Memory & MaaS',
    services: [
      'memory-create',
      'memory-get',
      'memory-update',
      'memory-delete',
      'memory-list',
      'memory-search',
      'memory-bulk-delete',
      'memory-stats',
      'memory-chunked-create',
    ],
    recommendation: 'supabase',
    reasoning: 'Centralized auth, audit logs, no real-time latency requirements',
    priority: 'high',
  },
  {
    name: 'Intelligence & AI',
    services: [
      'intelligence-health-check',
      'intelligence-analyze-patterns',
      'intelligence-detect-duplicates',
      'intelligence-extract-insights',
      'intelligence-find-related',
      'intelligence-suggest-tags',
    ],
    recommendation: 'supabase',
    reasoning: 'CPU-intensive, benefits from Supabase edge compute',
    priority: 'high',
  },
  {
    name: 'API Key Management',
    services: [
      'api-key-create',
      'api-key-list',
      'api-key-delete',
      'api-key-revoke',
      'api-key-rotate',
    ],
    recommendation: 'supabase',
    reasoning: 'Security-critical, needs centralized auth and audit trails',
    priority: 'high',
  },
  {
    name: 'Configuration Management',
    services: ['config-get', 'config-set', 'config-list'],
    recommendation: 'supabase',
    reasoning: 'Low-frequency updates, benefits from centralized storage',
    priority: 'medium',
  },
  {
    name: 'Authentication Services',
    services: ['auth-status', 'auth-login', 'auth-logout', 'auth-refresh'],
    recommendation: 'supabase',
    reasoning: 'Supabase Auth is the source of truth',
    priority: 'high',
  },
  {
    name: 'Payment Webhooks (Real-time)',
    services: [
      'paystack-webhook',
      'flutterwave-webhook',
      'stripe-webhook',
      'paypal-webhook',
    ],
    recommendation: 'direct',
    reasoning:
      'Time-critical, providers require fast response (<500ms), bypass Supabase for lower latency',
    priority: 'high',
  },
  {
    name: 'Payment Initiation (Non-critical)',
    services: [
      'stripe-create-payment-intent',
      'paystack-initialize-transaction',
      'flutterwave-initiate-payment',
    ],
    recommendation: 'hybrid',
    reasoning:
      'Route through Supabase for billing tracking, fallback to direct on Supabase downtime',
    priority: 'medium',
  },
  {
    name: 'Banking & WaaS',
    services: [
      'xpress-wallet-create-account',
      'xpress-wallet-transfer',
      'sayswitch-verify-account',
    ],
    recommendation: 'direct',
    reasoning: 'Real-time banking requires lowest latency, compliance-critical',
    priority: 'high',
  },
  {
    name: 'Verification Services',
    services: [
      'verification-bvn',
      'verification-nin',
      'verification-phone',
      'seftec-verify-identity',
    ],
    recommendation: 'direct',
    reasoning: 'Third-party APIs, rate-limited, better handled at gateway',
    priority: 'medium',
  },
  {
    name: 'EDoc & Document Services',
    services: ['edoc-generate', 'edoc-verify', 'edoc-list'],
    recommendation: 'supabase',
    reasoning: 'Document storage in Supabase, benefits from edge caching',
    priority: 'low',
  },
  {
    name: 'Health Checks',
    services: [
      'health-check',
      'health-database',
      'health-cache',
      'health-services',
    ],
    recommendation: 'supabase',
    reasoning: 'Monitor Supabase health from inside, detect issues early',
    priority: 'high',
  },
];

/**
 * Generate migration report
 */
function generateReport() {
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│   Service Migration Analysis Report                │');
  console.log('│   Supabase Adapter vs Direct Provider              │');
  console.log('└─────────────────────────────────────────────────────┘\n');

  const stats = {
    total: 0,
    supabase: 0,
    direct: 0,
    hybrid: 0,
  };

  // Group by recommendation
  const grouped = {
    supabase: [] as ServiceCategory[],
    direct: [] as ServiceCategory[],
    hybrid: [] as ServiceCategory[],
  };

  serviceAnalysis.forEach((category) => {
    stats.total += category.services.length;
    stats[category.recommendation] += category.services.length;
    grouped[category.recommendation].push(category);
  });

  // Display summary
  console.log('📊 Summary:');
  console.log(`   Total Services: ${stats.total}`);
  console.log(`   ✅ Route through Supabase: ${stats.supabase} (${((stats.supabase / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   🔗 Direct Provider: ${stats.direct} (${((stats.direct / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   🔀 Hybrid (Supabase + Fallback): ${stats.hybrid} (${((stats.hybrid / stats.total) * 100).toFixed(1)}%)`);
  console.log('\n' + '─'.repeat(60) + '\n');

  // Display Supabase services
  console.log('🟢 ROUTE THROUGH SUPABASE ADAPTER:\n');
  grouped.supabase.forEach((category) => {
    console.log(`   ${getPriorityIcon(category.priority)} ${category.name}`);
    console.log(`      Reason: ${category.reasoning}`);
    console.log(`      Services (${category.services.length}):`);
    category.services.forEach((service) => {
      console.log(`         - ${service}`);
    });
    console.log('');
  });

  console.log('─'.repeat(60) + '\n');

  // Display Direct services
  console.log('🔵 KEEP AS DIRECT PROVIDER CONNECTION:\n');
  grouped.direct.forEach((category) => {
    console.log(`   ${getPriorityIcon(category.priority)} ${category.name}`);
    console.log(`      Reason: ${category.reasoning}`);
    console.log(`      Services (${category.services.length}):`);
    category.services.forEach((service) => {
      console.log(`         - ${service}`);
    });
    console.log('');
  });

  console.log('─'.repeat(60) + '\n');

  // Display Hybrid services
  console.log('🟡 HYBRID APPROACH (Primary: Supabase, Fallback: Direct):\n');
  grouped.hybrid.forEach((category) => {
    console.log(`   ${getPriorityIcon(category.priority)} ${category.name}`);
    console.log(`      Reason: ${category.reasoning}`);
    console.log(`      Services (${category.services.length}):`);
    category.services.forEach((service) => {
      console.log(`         - ${service}`);
    });
    console.log('');
  });

  console.log('─'.repeat(60) + '\n');

  // Action items
  console.log('✅ NEXT STEPS:\n');
  console.log('1. Deploy Supabase Adapter (see INTEGRATION_GUIDE.md)');
  console.log(
    `2. Configure ${stats.supabase + stats.hybrid} services to route through Supabase`
  );
  console.log(`3. Keep ${stats.direct} services as direct connections`);
  console.log('4. Test hybrid fallback for payment services');
  console.log('5. Monitor latency and error rates\n');

  // Export to JSON
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: stats,
    categories: serviceAnalysis,
  };

  fs.writeFileSync(
    'migration-report.json',
    JSON.stringify(reportData, null, 2)
  );
  console.log('📄 Full report exported to: migration-report.json\n');
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

/**
 * Generate routing configuration
 */
function generateRoutingConfig() {
  const routes: any[] = [];

  serviceAnalysis.forEach((category) => {
    category.services.forEach((service) => {
      const route: any = {
        path: `/api/${service}`,
        service: service,
        strategy: category.recommendation,
      };

      if (category.recommendation === 'supabase') {
        route.adapter = 'supabase-edge-functions';
        route.serviceId = `supabase-${service}`;
      } else if (category.recommendation === 'direct') {
        route.adapter = getDirectAdapter(service);
        route.serviceId = service;
      } else if (category.recommendation === 'hybrid') {
        route.adapter = 'supabase-edge-functions';
        route.serviceId = `supabase-${service}`;
        route.fallback = {
          adapter: getDirectAdapter(service),
          serviceId: service,
        };
      }

      routes.push(route);
    });
  });

  fs.writeFileSync(
    'routing-config.json',
    JSON.stringify({ routes }, null, 2)
  );
  console.log('📄 Routing configuration exported to: routing-config.json\n');
}

function getDirectAdapter(service: string): string {
  if (service.includes('paystack')) return 'paystack-payment-gateway';
  if (service.includes('flutterwave')) return 'flutterwave-v3';
  if (service.includes('xpress')) return 'xpress-wallet-waas';
  if (service.includes('verification') || service.includes('seftec'))
    return 'verification-service';
  return 'unknown-adapter';
}

// Run analysis
generateReport();
generateRoutingConfig();
