# Onasis Gateway — Postman Collections Index

This directory contains Postman collection references for all 16 third-party API integrations used by the Onasis Gateway. Collections are organized by category.

> **How to use:** Each `collection.ref.yaml` file contains the Postman collection ID, auth type, base URL variable, and notes for forking the collection into your workspace. Use the `postman/environments/third-party-apis.env.yaml` environment to manage all credentials.

---

## Collection Structure

```
postman/collections/
├── messaging/
│   ├── slack/collection.ref.yaml
│   ├── whatsapp/collection.ref.yaml
│   ├── gmail/collection.ref.yaml
│   └── telegram/collection.ref.yaml
├── knowledge/
│   ├── google-drive/collection.ref.yaml
│   ├── notion/collection.ref.yaml
│   ├── github/collection.ref.yaml
│   └── confluence/collection.ref.yaml
├── input/
│   ├── typeform/collection.ref.yaml
│   ├── jotform/collection.ref.yaml
│   ├── tally/collection.ref.yaml
│   └── calendly/collection.ref.yaml
└── business/
    ├── hubspot/collection.ref.yaml
    ├── stripe/collection.ref.yaml
    ├── clickup/collection.ref.yaml
    └── monday/collection.ref.yaml
```

---

## All 16 APIs at a Glance

| API | Category | Auth Type | Postman Collection ID | Forks |
|-----|----------|-----------|----------------------|-------|
| [Slack Web API](#slack-web-api) | messaging | bearer | `13509546-993e3b18-d277-4189-8ce5-af45df38e336` | 34,679 |
| [WhatsApp Cloud API](#whatsapp-cloud-api) | messaging | bearer | `13382743-84d01ff8-4253-4720-b454-af661f36acc2` | 264,203 |
| [Gmail REST API](#gmail-rest-api) | messaging | oauth2 | _(no collection)_ | — |
| [Telegram Bot API](#telegram-bot-api) | messaging | bot_token | `32050230-fbecbfa5-8ad2-4fa3-a98d-096e41d48d1e` | 294 |
| [Google Drive API](#google-drive-api) | knowledge | oauth2 | `25426789-d3687c0c-577e-4558-87b7-1b4a105f74a5` | 373 |
| [Notion API](#notion-api) | knowledge | bearer | `15568543-d990f9b7-98d3-47d3-9131-4866ab9c6df2` | 65,160 |
| [GitHub Web API Reference](#github-web-api-reference) | knowledge | bearer | `35240-c446a4c9-8dd6-45c4-99f2-688a96fe76ae` | 466 |
| [Confluence Cloud REST API v2](#confluence-cloud-rest-api-v2) | knowledge | basic | `42654973-3182be8e-99e9-4dec-8b51-e7ec0d6ca3f8` | 136 |
| [Typeform API Reference](#typeform-api-reference) | input | bearer | `7335949-8e3131a9-3313-4dee-a76c-5cf11fc1d713` | 141 |
| [Jotform REST API](#jotform-rest-api) | input | api_key | _(no collection)_ | — |
| [Tally Forms API](#tally-forms-api) | input | bearer | _(no collection)_ | — |
| [Calendly API](#calendly-api) | input | bearer | `32889764-b48f686b-915d-43d5-bf99-c29cf6846e52` | 419 |
| [HubSpot CRM API](#hubspot-crm-api) | business | bearer | `26126890-fa75a62c-7a82-4c9e-ad99-edb189d8a73e` | 4,533 |
| [Stripe API](#stripe-api) | business | basic | `665823-7a054d2e-29d8-441a-8752-fb9b93d71384` | 5,089 |
| [ClickUp API V2](#clickup-api-v2) | business | api_key | `14363797-e80a0657-5775-4669-942c-c399d05ddef1` | 246 |
| [Monday.com GraphQL API](#mondaycom-graphql-api) | business | api_key | `22954425-fb7e3907-b0cb-4786-941f-f7d5efac52ea` | 20 |

---

## Category: Messaging

### Slack Web API
- **Path:** `messaging/slack/collection.ref.yaml`
- **Auth:** Bearer token (`{{slack_token}}`)
- **Base URL:** `https://slack.com/api`
- **Postman URL:** https://www.postman.com/slackhq/workspace/slack-api/collection/13509546-993e3b18-d277-4189-8ce5-af45df38e336
- **Use cases:** Send messages, manage channels, list users, post to channels, handle events via webhooks.

### WhatsApp Cloud API
- **Path:** `messaging/whatsapp/collection.ref.yaml`
- **Auth:** Bearer token (`{{whatsapp_token}}`)
- **Base URL:** `https://graph.facebook.com/v18.0`
- **Postman URL:** https://www.postman.com/meta/workspace/whatsapp-business-platform/collection/13382743-84d01ff8-4253-4720-b454-af661f36acc2
- **Use cases:** Send text/media messages, manage templates, handle webhooks, manage phone numbers.

### Gmail REST API
- **Path:** `messaging/gmail/collection.ref.yaml`
- **Auth:** OAuth2 (`{{gmail_access_token}}`)
- **Base URL:** `https://gmail.googleapis.com`
- **REST Docs:** https://developers.google.com/gmail/api/reference/rest
- **Use cases:** Read/send emails, manage labels, search messages, handle drafts.

### Telegram Bot API
- **Path:** `messaging/telegram/collection.ref.yaml`
- **Auth:** Bot token in URL path (`{{telegram_bot_token}}`)
- **Base URL:** `https://api.telegram.org`
- **Postman URL:** https://www.postman.com/ton-master/workspace/ton-master/collection/32050230-fbecbfa5-8ad2-4fa3-a98d-096e41d48d1e
- **Use cases:** Send messages, manage bots, handle updates, inline keyboards, file uploads.

---

## Category: Knowledge / Source Ingestion

### Google Drive API
- **Path:** `knowledge/google-drive/collection.ref.yaml`
- **Auth:** OAuth2 (`{{google_drive_access_token}}`)
- **Base URL:** `https://www.googleapis.com/drive/v3`
- **Postman URL:** https://www.postman.com/google-api-workspace/workspace/google-api-workspace/collection/25426789-d3687c0c-577e-4558-87b7-1b4a105f74a5
- **Use cases:** List/upload/download files, manage permissions, search Drive, watch for changes.

### Notion API
- **Path:** `knowledge/notion/collection.ref.yaml`
- **Auth:** Bearer token (`{{notion_token}}`)
- **Base URL:** `https://api.notion.com/v1`
- **Postman URL:** https://www.postman.com/notionhq/workspace/notion-s-api-workspace/collection/15568543-d990f9b7-98d3-47d3-9131-4866ab9c6df2
- **Use cases:** Read/write pages and databases, query databases, manage blocks, search workspace.

### GitHub Web API Reference
- **Path:** `knowledge/github/collection.ref.yaml`
- **Auth:** Bearer token (`{{github_token}}`)
- **Base URL:** `https://api.github.com`
- **Postman URL:** https://www.postman.com/github/workspace/github/collection/35240-c446a4c9-8dd6-45c4-99f2-688a96fe76ae
- **Use cases:** Manage repos, issues, PRs, actions, releases, webhooks, and GitHub Apps.

### Confluence Cloud REST API v2
- **Path:** `knowledge/confluence/collection.ref.yaml`
- **Auth:** Basic auth (`{{confluence_email}}` + `{{confluence_api_token}}`)
- **Base URL:** `https://your-domain.atlassian.net/wiki/api/v2`
- **Postman URL:** https://www.postman.com/atlassian-cloud/workspace/atlassian-cloud/collection/42654973-3182be8e-99e9-4dec-8b51-e7ec0d6ca3f8
- **Use cases:** Create/read/update pages, manage spaces, attachments, and content hierarchy.

---

## Category: Collection / User Input

### Typeform API Reference
- **Path:** `input/typeform/collection.ref.yaml`
- **Auth:** Bearer token (`{{typeform_token}}`)
- **Base URL:** `https://api.typeform.com`
- **Postman URL:** https://www.postman.com/typeform/workspace/typeform-public-workspace/collection/7335949-8e3131a9-3313-4dee-a76c-5cf11fc1d713
- **Use cases:** Create forms, retrieve responses, manage webhooks, handle workspaces.

### Jotform REST API
- **Path:** `input/jotform/collection.ref.yaml`
- **Auth:** API key (`{{jotform_api_key}}`)
- **Base URL:** `https://api.jotform.com`
- **REST Docs:** https://api.jotform.com/docs
- **Use cases:** Manage forms, retrieve submissions, handle reports, manage users.

### Tally Forms API
- **Path:** `input/tally/collection.ref.yaml`
- **Auth:** Bearer token (`{{tally_access_token}}`)
- **Base URL:** `https://api.tally.so`
- **REST Docs:** https://tally.so/help/api
- **Use cases:** Primarily webhook-based. Receive form submissions via webhooks; REST API for form management (Pro plan required).

### Calendly API
- **Path:** `input/calendly/collection.ref.yaml`
- **Auth:** Bearer token (`{{calendly_token}}`)
- **Base URL:** `https://api.calendly.com`
- **Postman URL:** https://www.postman.com/calendly/workspace/calendly-s-api-collection/collection/32889764-b48f686b-915d-43d5-bf99-c29cf6846e52
- **Use cases:** Manage scheduling links, event types, invitees, webhook subscriptions.

---

## Category: Business Context / Workflow

### HubSpot CRM API
- **Path:** `business/hubspot/collection.ref.yaml`
- **Auth:** Bearer token (`{{hubspot_token}}`)
- **Base URL:** `https://api.hubapi.com`
- **Postman URL:** https://www.postman.com/hubspot/workspace/hubspot-public-api-workspace/collection/26126890-fa75a62c-7a82-4c9e-ad99-edb189d8a73e
- **Use cases:** Manage contacts, companies, deals, tickets, pipelines, marketing automation.

### Stripe API
- **Path:** `business/stripe/collection.ref.yaml`
- **Auth:** Basic auth with secret key (`{{stripe_secret_key}}`)
- **Base URL:** `https://api.stripe.com/v1`
- **Postman URL:** https://www.postman.com/stripedev/workspace/stripe-developers/collection/665823-7a054d2e-29d8-441a-8752-fb9b93d71384
- **Use cases:** Process payments, manage customers, subscriptions, invoices, webhooks.

### ClickUp API V2
- **Path:** `business/clickup/collection.ref.yaml`
- **Auth:** API key in Authorization header (`{{clickup_token}}`)
- **Base URL:** `https://api.clickup.com/api/v2`
- **Postman URL:** https://www.postman.com/clickup/workspace/clickup/collection/14363797-e80a0657-5775-4669-942c-c399d05ddef1
- **Use cases:** Manage tasks, spaces, lists, folders, team members, automations.

### Monday.com GraphQL API
- **Path:** `business/monday/collection.ref.yaml`
- **Auth:** API key in Authorization header (`{{monday_token}}`)
- **Base URL:** `https://api.monday.com/v2`
- **Postman URL:** https://www.postman.com/monday-com/workspace/public-testing-space/collection/22954425-fb7e3907-b0cb-4786-941f-f7d5efac52ea
- **Use cases:** Manage boards, items, columns, groups, automations via GraphQL queries/mutations.

---

## Forking Collections

To fork a collection into your workspace:

1. Open the Postman URL listed in the `collection.ref.yaml`
2. Click **Fork** in the top-right corner
3. Select your target workspace
4. Activate the `Third-Party APIs` environment
5. Fill in your credentials in the environment variables

---

## Environment

All credential variables are defined in:
```
postman/environments/third-party-apis.env.yaml
```

See [SKILL.md](../../SKILL.md) at the project root for the full agent/IDE skill guide.
