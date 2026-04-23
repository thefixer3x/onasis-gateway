# Onasis Gateway — Agent & IDE Skill Guide

> **Read this file first.** This guide is the primary reference for AI agents (Claude, Cursor, Copilot, etc.) and developers working with the Onasis Gateway API integration repository. It covers all 16 third-party API integrations, Postman MCP setup, auth patterns, environment variables, and recommended workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Postman MCP Integration](#postman-mcp-integration)
3. [16 API Integrations](#16-api-integrations)
   - [Integration Table](#integration-table)
   - [Messaging](#category-messaging)
   - [Knowledge / Source Ingestion](#category-knowledge--source-ingestion)
   - [Collection / User Input](#category-collection--user-input)
   - [Business Context / Workflow](#category-business-context--workflow)
4. [Recommended Integration Order](#recommended-integration-order)
5. [Auth Patterns](#auth-patterns)
6. [Using Postman Environments & Variables](#using-postman-environments--variables)
7. [Agent Usage Guidelines](#agent-usage-guidelines)
8. [Repo Structure](#repo-structure)

---

## Overview

**Onasis Gateway** is a comprehensive API service warehouse that prevents costly omissions through upfront cataloging of all available APIs. It provides:

- **MCP (Model Context Protocol) server interfaces** for AI agents to discover and invoke API tools
- **REST API endpoints** for application-level integration
- **Postman collection references** for all 16 third-party APIs, organized by category

The 16 APIs span four functional categories:

| Category | Purpose | APIs |
|----------|---------|------|
| **Messaging** | Send/receive communications | Slack, WhatsApp, Gmail, Telegram |
| **Knowledge** | Ingest and manage structured data | Google Drive, Notion, GitHub, Confluence |
| **Input** | Collect user data and schedule events | Typeform, Jotform, Tally, Calendly |
| **Business** | CRM, payments, project management | HubSpot, Stripe, ClickUp, Monday.com |

All Postman collection references live in `postman/collections/{category}/{api}/collection.ref.yaml`. Credentials are managed via `postman/environments/third-party-apis.env.yaml`.

---

## Postman MCP Integration

### What is Postman MCP?

Postman MCP (Model Context Protocol) is a server that exposes your Postman workspace — collections, environments, request history, API specs — as tools that AI agents can query and invoke directly from your IDE (Cursor, VS Code Copilot, etc.).

With Postman MCP you can:
- Ask your AI assistant to find and run API requests from your collections
- Query environment variables and collection structures
- Generate and test API calls without leaving your editor
- Access request history and response data

### Getting a Postman API Key

1. Log in to [postman.com](https://www.postman.com)
2. Click your avatar → **Settings** → **API keys**
3. Click **Generate API Key**, give it a name, and copy the key
4. Store it securely — you'll need it for MCP config

### MCP Config for Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postman": {
      "command": "npx",
      "args": ["-y", "@postman/mcp-server@latest"],
      "env": {
        "POSTMAN_API_KEY": "your-postman-api-key-here"
      }
    }
  }
}
```

After saving, restart Cursor. The Postman MCP tools will appear in your agent's tool list.

### MCP Config for VS Code Copilot

Add to your VS Code `settings.json` (or `.vscode/mcp.json` in the workspace):

```json
{
  "mcp": {
    "servers": {
      "postman": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@postman/mcp-server@latest"],
        "env": {
          "POSTMAN_API_KEY": "your-postman-api-key-here"
        }
      }
    }
  }
}
```

### What You Can Query via MCP

Once connected, your AI agent can:

- **List collections** — "Show me all collections in my workspace"
- **Find requests** — "Find the Stripe payment creation request"
- **Read environments** — "What variables are in the Third-Party APIs environment?"
- **Run requests** — "Send the HubSpot create contact request with this data"
- **Read specs** — "Show me the OpenAPI spec for the gateway"
- **Check request history** — "What was the last response from the Notion API?"

### Example Prompts for Your IDE

```
# Discover APIs
"List all collection.ref.yaml files in postman/collections/"
"What auth type does the Confluence API use?"
"Show me all variables in the third-party-apis environment"

# Work with specific APIs
"Find the Slack send message request and show me the required parameters"
"What is the base URL for the WhatsApp Cloud API?"
"Show me the Stripe collection and list all payment-related endpoints"

# Environment management
"What environment variables do I need to set for HubSpot?"
"Show me all secret-type variables in the third-party-apis environment"

# Integration guidance
"How do I authenticate with the GitHub API in this project?"
"What is the recommended order to integrate these 16 APIs?"
```

---

## 16 API Integrations

### Integration Table

| API | Category | Auth Type | Key Variable | Base URL | Postman Collection ID |
|-----|----------|-----------|--------------|----------|-----------------------|
| Slack Web API | messaging | bearer | `slack_token` | `https://slack.com/api` | `13509546-993e3b18-d277-4189-8ce5-af45df38e336` |
| WhatsApp Cloud API | messaging | bearer | `whatsapp_token` | `https://graph.facebook.com/v18.0` | `13382743-84d01ff8-4253-4720-b454-af661f36acc2` |
| Gmail REST API | messaging | oauth2 | `gmail_access_token` | `https://gmail.googleapis.com` | _(no collection)_ |
| Telegram Bot API | messaging | bot_token | `telegram_bot_token` | `https://api.telegram.org` | `32050230-fbecbfa5-8ad2-4fa3-a98d-096e41d48d1e` |
| Google Drive API | knowledge | oauth2 | `google_drive_access_token` | `https://www.googleapis.com/drive/v3` | `25426789-d3687c0c-577e-4558-87b7-1b4a105f74a5` |
| Notion API | knowledge | bearer | `notion_token` | `https://api.notion.com/v1` | `15568543-d990f9b7-98d3-47d3-9131-4866ab9c6df2` |
| GitHub Web API Reference | knowledge | bearer | `github_token` | `https://api.github.com` | `35240-c446a4c9-8dd6-45c4-99f2-688a96fe76ae` |
| Confluence Cloud REST API v2 | knowledge | basic | `confluence_api_token` | `https://{domain}.atlassian.net/wiki/api/v2` | `42654973-3182be8e-99e9-4dec-8b51-e7ec0d6ca3f8` |
| Typeform API Reference | input | bearer | `typeform_token` | `https://api.typeform.com` | `7335949-8e3131a9-3313-4dee-a76c-5cf11fc1d713` |
| Jotform REST API | input | api_key | `jotform_api_key` | `https://api.jotform.com` | _(no collection)_ |
| Tally Forms API | input | bearer | `tally_access_token` | `https://api.tally.so` | _(no collection)_ |
| Calendly API | input | bearer | `calendly_token` | `https://api.calendly.com` | `32889764-b48f686b-915d-43d5-bf99-c29cf6846e52` |
| HubSpot CRM API | business | bearer | `hubspot_token` | `https://api.hubapi.com` | `26126890-fa75a62c-7a82-4c9e-ad99-edb189d8a73e` |
| Stripe API | business | basic | `stripe_secret_key` | `https://api.stripe.com/v1` | `665823-7a054d2e-29d8-441a-8752-fb9b93d71384` |
| ClickUp API V2 | business | api_key | `clickup_token` | `https://api.clickup.com/api/v2` | `14363797-e80a0657-5775-4669-942c-c399d05ddef1` |
| Monday.com GraphQL API | business | api_key | `monday_token` | `https://api.monday.com/v2` | `22954425-fb7e3907-b0cb-4786-941f-f7d5efac52ea` |

---

### Category: Messaging

#### Slack Web API
- **Collection ref:** `postman/collections/messaging/slack/collection.ref.yaml`
- **Auth:** Bearer token — obtain from your Slack App's OAuth & Permissions page
- **Key variables:** `slack_token`, `slack_base_url`
- **Use cases:** Send messages to channels, list users, manage channels, post rich blocks, handle Slack Events API webhooks
- **Auth notes:** Requires a Slack App with appropriate OAuth scopes (e.g. `chat:write`, `channels:read`). Use a Bot Token (`xoxb-...`) for most operations. User tokens (`xoxp-...`) for user-context actions.
- **Postman collection:** [Fork here](https://www.postman.com/slackhq/workspace/slack-api/collection/13509546-993e3b18-d277-4189-8ce5-af45df38e336) — 34,679 forks

#### WhatsApp Cloud API
- **Collection ref:** `postman/collections/messaging/whatsapp/collection.ref.yaml`
- **Auth:** Bearer token — use a permanent system user token for production
- **Key variables:** `whatsapp_token`, `whatsapp_base_url`, `whatsapp_phone_number_id`
- **Use cases:** Send text/media/template messages, manage message templates, handle webhooks for incoming messages, manage phone numbers
- **Auth notes:** Requires a Meta Business account and a WhatsApp Business App. The `whatsapp_phone_number_id` is required for sending messages — find it in your Meta Business Manager.
- **Postman collection:** [Fork here](https://www.postman.com/meta/workspace/whatsapp-business-platform/collection/13382743-84d01ff8-4253-4720-b454-af661f36acc2) — 264,203 forks

#### Gmail REST API
- **Collection ref:** `postman/collections/messaging/gmail/collection.ref.yaml`
- **Auth:** OAuth2 — requires Google OAuth2 flow with Gmail scopes
- **Key variables:** `gmail_access_token`, `gmail_base_url`, `gmail_user_id`
- **Use cases:** Read emails, send emails, manage labels, search messages, handle drafts, watch for new messages
- **Auth notes:** No official Postman collection. Use [Google OAuth2 Playground](https://developers.google.com/oauthplayground) to obtain tokens for testing. Required scopes: `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.readonly`. The `gmail_user_id` is typically `me` (authenticated user).
- **REST docs:** https://developers.google.com/gmail/api/reference/rest

#### Telegram Bot API
- **Collection ref:** `postman/collections/messaging/telegram/collection.ref.yaml`
- **Auth:** Bot token embedded in URL path — `https://api.telegram.org/bot{token}/method`
- **Key variables:** `telegram_bot_token`, `telegram_base_url`, `telegram_chat_id`
- **Use cases:** Send messages, photos, documents, manage bot commands, handle updates via polling or webhooks, inline keyboards
- **Auth notes:** Obtain a bot token from [@BotFather](https://t.me/BotFather) on Telegram. The token is passed directly in the URL path, not as a header. The `telegram_chat_id` is the target chat/channel ID.
- **Postman collection:** [Fork here](https://www.postman.com/ton-master/workspace/ton-master/collection/32050230-fbecbfa5-8ad2-4fa3-a98d-096e41d48d1e) — 294 forks

---

### Category: Knowledge / Source Ingestion

#### Google Drive API
- **Collection ref:** `postman/collections/knowledge/google-drive/collection.ref.yaml`
- **Auth:** OAuth2 — requires Google OAuth2 flow with Drive scopes
- **Key variables:** `google_drive_access_token`, `google_drive_base_url`
- **Use cases:** List files and folders, upload/download files, manage sharing permissions, search Drive, watch for file changes
- **Auth notes:** Requires OAuth2 with Drive scopes (`drive.readonly`, `drive.file`, `drive`). Service account credentials can be used for server-to-server access without user interaction.
- **Postman collection:** [Fork here](https://www.postman.com/google-api-workspace/workspace/google-api-workspace/collection/25426789-d3687c0c-577e-4558-87b7-1b4a105f74a5) — 373 forks

#### Notion API
- **Collection ref:** `postman/collections/knowledge/notion/collection.ref.yaml`
- **Auth:** Bearer token — Internal Integration Token
- **Key variables:** `notion_token`, `notion_base_url`, `notion_version`
- **Use cases:** Read/write pages and databases, query databases with filters, manage blocks and content, search workspace, manage users
- **Auth notes:** Use an Internal Integration Token for server-side access (create at [notion.so/my-integrations](https://www.notion.so/my-integrations)). Always set the `Notion-Version` header — use `{{notion_version}}` (default: `2022-06-28`). Pages must be shared with the integration to be accessible.
- **Postman collection:** [Fork here](https://www.postman.com/notionhq/workspace/notion-s-api-workspace/collection/15568543-d990f9b7-98d3-47d3-9131-4866ab9c6df2) — 65,160 forks

#### GitHub Web API Reference
- **Collection ref:** `postman/collections/knowledge/github/collection.ref.yaml`
- **Auth:** Bearer token — Personal Access Token (classic or fine-grained)
- **Key variables:** `github_token`, `github_base_url`, `github_owner`, `github_repo`
- **Use cases:** Manage repositories, issues, pull requests, GitHub Actions, releases, webhooks, GitHub Apps, code search
- **Auth notes:** Use a fine-grained Personal Access Token for production (more secure, scoped to specific repos). Classic tokens use `Authorization: Bearer {token}` or `Authorization: token {token}`. Set `github_owner` (username/org) and `github_repo` for repo-specific operations.
- **Postman collection:** [Fork here](https://www.postman.com/github/workspace/github/collection/35240-c446a4c9-8dd6-45c4-99f2-688a96fe76ae) — 466 forks

#### Confluence Cloud REST API v2
- **Collection ref:** `postman/collections/knowledge/confluence/collection.ref.yaml`
- **Auth:** Basic auth — Atlassian account email + API token
- **Key variables:** `confluence_email`, `confluence_api_token`, `confluence_base_url`, `confluence_domain`
- **Use cases:** Create/read/update pages, manage spaces, upload attachments, manage content hierarchy, search content
- **Auth notes:** Use Basic Auth with your Atlassian account email as username and an API token (not your password) as password. Generate tokens at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens). Set `confluence_domain` to your Atlassian subdomain (e.g. `mycompany`).
- **Postman collection:** [Fork here](https://www.postman.com/atlassian-cloud/workspace/atlassian-cloud/collection/42654973-3182be8e-99e9-4dec-8b51-e7ec0d6ca3f8) — 136 forks

---

### Category: Collection / User Input

#### Typeform API Reference
- **Collection ref:** `postman/collections/input/typeform/collection.ref.yaml`
- **Auth:** Bearer token — Personal Access Token
- **Key variables:** `typeform_token`, `typeform_base_url`
- **Use cases:** Create and manage forms, retrieve form responses, manage webhooks for real-time submissions, handle workspaces and themes
- **Auth notes:** Generate a Personal Access Token from your Typeform account under **Settings → Personal tokens**. Token is passed as `Authorization: Bearer {token}`.
- **Postman collection:** [Fork here](https://www.postman.com/typeform/workspace/typeform-public-workspace/collection/7335949-8e3131a9-3313-4dee-a76c-5cf11fc1d713) — 141 forks

#### Jotform REST API
- **Collection ref:** `postman/collections/input/jotform/collection.ref.yaml`
- **Auth:** API key — passed as query parameter or header
- **Key variables:** `jotform_api_key`, `jotform_base_url`
- **Use cases:** Manage forms, retrieve submissions, generate reports, manage users and folders
- **Auth notes:** No official Postman collection. Pass the API key as `?apiKey={key}` query parameter or as the `APIKEY` header. Generate your key at [jotform.com/myaccount/api](https://www.jotform.com/myaccount/api).
- **REST docs:** https://api.jotform.com/docs

#### Tally Forms API
- **Collection ref:** `postman/collections/input/tally/collection.ref.yaml`
- **Auth:** Bearer token — OAuth2 access token
- **Key variables:** `tally_access_token`, `tally_base_url`
- **Use cases:** Primarily webhook-based — receive form submission events via webhooks. REST API for form management requires a Tally Pro account.
- **Auth notes:** No official Postman collection. Tally is primarily webhook-driven; configure webhook endpoints in your Tally form settings to receive submission events. REST API access requires a Pro plan. Use `Authorization: Bearer {token}`.
- **REST docs:** https://tally.so/help/api

#### Calendly API
- **Collection ref:** `postman/collections/input/calendly/collection.ref.yaml`
- **Auth:** Bearer token — Personal Access Token or OAuth2
- **Key variables:** `calendly_token`, `calendly_base_url`, `calendly_user_uri`
- **Use cases:** Manage scheduling links, event types, retrieve invitee data, manage webhook subscriptions, handle scheduling events
- **Auth notes:** Use a Personal Access Token from your Calendly account under **Integrations → API & Webhooks**. OAuth2 is also supported for multi-user apps. The `calendly_user_uri` is your user's URI (e.g. `https://api.calendly.com/users/{uuid}`) — retrieve it from the `/users/me` endpoint.
- **Postman collection:** [Fork here](https://www.postman.com/calendly/workspace/calendly-s-api-collection/collection/32889764-b48f686b-915d-43d5-bf99-c29cf6846e52) — 419 forks

---

### Category: Business Context / Workflow

#### HubSpot CRM API
- **Collection ref:** `postman/collections/business/hubspot/collection.ref.yaml`
- **Auth:** Bearer token — Private App access token
- **Key variables:** `hubspot_token`, `hubspot_base_url`
- **Use cases:** Manage contacts, companies, deals, tickets, pipelines, marketing automation, email campaigns, forms, and analytics
- **Auth notes:** Use a Private App access token (recommended over legacy API keys). Create a Private App in your HubSpot account under **Settings → Integrations → Private Apps**. Scopes are configured per Private App.
- **Postman collection:** [Fork here](https://www.postman.com/hubspot/workspace/hubspot-public-api-workspace/collection/26126890-fa75a62c-7a82-4c9e-ad99-edb189d8a73e) — 4,533 forks

#### Stripe API
- **Collection ref:** `postman/collections/business/stripe/collection.ref.yaml`
- **Auth:** Basic auth — secret key as username (no password)
- **Key variables:** `stripe_secret_key`, `stripe_base_url`
- **Use cases:** Process payments, manage customers, subscriptions, invoices, refunds, webhooks, Connect accounts, and the full Stripe product suite
- **Auth notes:** Use your Stripe Secret Key (`sk_test_...` for testing, `sk_live_...` for production). The collection uses HTTP Basic Auth with the secret key as the username and an empty password. Never expose secret keys in client-side code.
- **Postman collection:** [Fork here](https://www.postman.com/stripedev/workspace/stripe-developers/collection/665823-7a054d2e-29d8-441a-8752-fb9b93d71384) — 5,089 forks

#### ClickUp API V2
- **Collection ref:** `postman/collections/business/clickup/collection.ref.yaml`
- **Auth:** API key — passed as `Authorization` header (no "Bearer" prefix)
- **Key variables:** `clickup_token`, `clickup_base_url`, `clickup_team_id`
- **Use cases:** Manage tasks, spaces, lists, folders, team members, time tracking, automations, and custom fields
- **Auth notes:** Use a Personal API Token from **ClickUp Settings → Apps**. Pass as `Authorization: {token}` header (no "Bearer" prefix). The `clickup_team_id` (workspace ID) is required for most operations — find it in your ClickUp URL or via the `/team` endpoint. **Note:** ClickUp collections may already exist in your SEFTEC workspace — check before forking to avoid duplication.
- **Postman collection:** [Fork here](https://www.postman.com/clickup/workspace/clickup/collection/14363797-e80a0657-5775-4669-942c-c399d05ddef1) — 246 forks

#### Monday.com GraphQL API
- **Collection ref:** `postman/collections/business/monday/collection.ref.yaml`
- **Auth:** API key — passed as `Authorization` header
- **Key variables:** `monday_token`, `monday_base_url`
- **Use cases:** Manage boards, items, columns, groups, automations, users, and workspaces via GraphQL queries and mutations
- **Auth notes:** Use a Monday.com API token from your profile settings under **Developers → My Access Tokens**. Pass as `Authorization: {token}` header. All requests are POST to a single GraphQL endpoint (`https://api.monday.com/v2`). Include the `API-Version` header for versioned access. This is a **GraphQL API** — use POST with `query` or `mutation` in the request body.
- **Postman collection:** [Fork here](https://www.postman.com/monday-com/workspace/public-testing-space/collection/22954425-fb7e3907-b0cb-4786-941f-f7d5efac52ea) — 20 forks

---

## Recommended Integration Order

When building out integrations, follow this order for maximum efficiency:

### Phase 1: Business Context (Foundation)
**HubSpot → Stripe → ClickUp → Monday.com**

Start with business systems because they define your core data model — contacts, deals, tasks, and projects. These APIs provide the "who" and "what" context that all other integrations reference.

- **HubSpot** first: establishes your contact/company/deal data model
- **Stripe** second: links financial transactions to HubSpot contacts
- **ClickUp** third: connects tasks and projects to business context
- **Monday.com** fourth: adds workflow and board management

### Phase 2: Knowledge / Source Ingestion
**GitHub → Notion → Google Drive → Confluence**

Once business context is established, connect knowledge sources. These APIs let you ingest, store, and retrieve structured information.

- **GitHub** first: code and documentation are often the primary knowledge source
- **Notion** second: internal wikis and databases
- **Google Drive** third: file storage and documents
- **Confluence** fourth: enterprise documentation (if applicable)

### Phase 3: Collection / User Input
**Typeform → Calendly → Jotform → Tally**

With business context and knowledge in place, add input collection to capture new data from users.

- **Typeform** first: most feature-rich form API with good Postman support
- **Calendly** second: scheduling is often tied to form submissions
- **Jotform** third: alternative form solution
- **Tally** fourth: webhook-based, simpler to set up

### Phase 4: Messaging / Notifications
**Slack → WhatsApp → Telegram → Gmail**

Finally, add messaging to notify stakeholders and users about events from all previous integrations.

- **Slack** first: internal team notifications
- **WhatsApp** second: customer-facing messaging (highest reach)
- **Telegram** third: bot-based notifications
- **Gmail** fourth: email notifications (requires OAuth2 setup)

---

## Auth Patterns

### Bearer Token
Used by: Slack, WhatsApp, Gmail, Notion, GitHub, Typeform, Tally, Calendly, HubSpot

```
Authorization: Bearer {{token_variable}}
```

The token is passed in the `Authorization` header with the `Bearer` prefix. Tokens are typically long-lived (API keys) or short-lived (OAuth2 access tokens).

**In Postman:** Set the collection/request auth type to **Bearer Token** and reference `{{token_variable}}`.

### API Key (Header)
Used by: ClickUp, Monday.com

```
Authorization: {{token_variable}}
```

Similar to Bearer Token but **without** the `Bearer` prefix. The raw token is passed directly in the `Authorization` header.

**In Postman:** Use **API Key** auth type with key `Authorization` and value `{{token_variable}}`, or set it as a custom header.

### API Key (Query Parameter)
Used by: Jotform, Telegram (bot token in URL path)

```
GET https://api.jotform.com/forms?apiKey={{jotform_api_key}}
GET https://api.telegram.org/bot{{telegram_bot_token}}/sendMessage
```

The key is embedded in the URL. For Telegram, the bot token is part of the URL path itself.

**In Postman:** Use **API Key** auth type with key `apiKey` and "Add to: Query Params", or embed directly in the URL.

### OAuth2
Used by: Gmail, Google Drive

OAuth2 requires a multi-step flow:
1. Redirect user to Google's authorization URL
2. User grants permission
3. Exchange authorization code for access token
4. Use access token in `Authorization: Bearer {token}` header
5. Refresh token when access token expires

**In Postman:** Use the **OAuth 2.0** auth type. Configure the authorization URL, token URL, client ID, client secret, and scopes. Use the **Get New Access Token** button to complete the flow.

**For testing:** Use [Google OAuth2 Playground](https://developers.google.com/oauthplayground) to obtain tokens manually.

### Basic Auth
Used by: Confluence, Stripe

```
Authorization: Basic base64(username:password)
```

- **Confluence:** username = your Atlassian email, password = API token
- **Stripe:** username = secret key, password = (empty)

**In Postman:** Use the **Basic Auth** auth type. Enter username and password — Postman handles the Base64 encoding automatically.

### Bot Token (URL Path)
Used by: Telegram

```
https://api.telegram.org/bot{{telegram_bot_token}}/sendMessage
```

The token is embedded directly in the URL path after `/bot`. This is unique to the Telegram Bot API.

**In Postman:** Include `{{telegram_bot_token}}` directly in the URL. No separate auth configuration needed.

---

## Using Postman Environments & Variables

### Variable Syntax

In Postman, variables are referenced using double curly braces:

```
{{variable_name}}
```

Examples:
- URL: `{{slack_base_url}}/chat.postMessage`
- Header value: `Bearer {{slack_token}}`
- Body: `{"channel": "{{slack_channel_id}}"}`

### Setting Up the Third-Party APIs Environment

1. Open Postman and navigate to **Environments**
2. The `Third-Party APIs` environment is defined in `postman/environments/third-party-apis.env.yaml`
3. In Postman Desktop, this environment will be available in your workspace
4. Click the environment to edit it and fill in your actual credential values
5. **Never commit real credentials** — the YAML file stores empty values as placeholders

### Variable Types

| Type | Description | Use for |
|------|-------------|---------|
| `default` | Plain text, visible | Base URLs, non-sensitive config |
| `secret` | Masked in UI | API keys, tokens, passwords |

### Switching Environments

- Use the environment dropdown in the top-right of Postman to switch between environments
- For local development: use the `Third-Party APIs` environment
- For production: create a separate environment with production credentials

### Collection-Level Variables

Some collections define their own variables in `postman/collections/{category}/.resources/definition.yaml`. These take lower precedence than environment variables — environment variables always win.

### Variable Precedence (highest to lowest)

1. Local variables (set in scripts)
2. Data variables (from collection runner)
3. Environment variables ← **use these for credentials**
4. Collection variables
5. Global variables

---

## Agent Usage Guidelines

When an AI agent (Claude, Cursor, Copilot, etc.) is working with this repository, follow these guidelines:

### Step 1: Read SKILL.md First
Always read this file (`SKILL.md`) at the project root before performing any API integration work. It contains the authoritative reference for all 16 APIs, auth patterns, and variable names.

### Step 2: Check collection.ref.yaml for API Specs
For any specific API, read the corresponding `collection.ref.yaml`:

```
postman/collections/{category}/{api}/collection.ref.yaml
```

Example:
```
postman/collections/messaging/slack/collection.ref.yaml
postman/collections/business/stripe/collection.ref.yaml
postman/collections/knowledge/notion/collection.ref.yaml
```

The ref file contains:
- `postman_collection_id` — use to fork the collection
- `auth_type` — how to authenticate
- `base_url_var` — the `{{variable}}` to use for the base URL
- `token_var` — the `{{variable}}` to use for the auth token
- `notes` — important caveats and setup instructions

### Step 3: Use Environment Variables for Credentials
Always reference credentials via `{{variable_name}}` syntax. Never hardcode API keys, tokens, or secrets.

The canonical variable names are defined in:
```
postman/environments/third-party-apis.env.yaml
```

### Step 4: Fork Collections from Postman API Network
When setting up a new API integration:

1. Get the `postman_collection_id` from the `collection.ref.yaml`
2. Construct the Postman URL: `https://www.postman.com/{workspace}/collection/{id}`
3. Fork the collection into the active workspace
4. Activate the `Third-Party APIs` environment
5. Fill in the required variables

For APIs without a `postman_collection_id` (Gmail, Jotform, Tally), use the `rest_api_docs` URL to build requests manually.

### Step 5: Never Hardcode Credentials
```yaml
# ✅ CORRECT — use variable syntax
url: '{{slack_base_url}}/chat.postMessage'
headers:
  - key: Authorization
    value: 'Bearer {{slack_token}}'

# ❌ WRONG — never hardcode
url: 'https://slack.com/api/chat.postMessage'
headers:
  - key: Authorization
    value: 'Bearer xoxb-1234567890-abcdefghij'
```

### Step 6: Follow the Integration Order
When building new integrations, follow the [Recommended Integration Order](#recommended-integration-order):
1. Business (HubSpot, Stripe, ClickUp, Monday)
2. Knowledge (GitHub, Notion, Google Drive, Confluence)
3. Input (Typeform, Calendly, Jotform, Tally)
4. Messaging (Slack, WhatsApp, Telegram, Gmail)

### Common Agent Tasks

```bash
# Find which variable to use for a specific API
grep -r "token_var" postman/collections/messaging/

# Check all APIs in a category
ls postman/collections/business/

# Find all OAuth2 APIs
grep -r "auth_type: oauth2" postman/collections/

# Find all APIs without a Postman collection
grep -r "postman_collection_id: null" postman/collections/

# Check what variables are needed for an API
cat postman/collections/knowledge/notion/collection.ref.yaml
```

---

## Repo Structure

```
onasis-gateway/
├── SKILL.md                          ← You are here — agent/IDE skill guide
├── CLAUDE.md                         ← Claude Code guidance
├── postman/
│   ├── collections/
│   │   ├── README.md                 ← Master index of all 16 APIs
│   │   ├── messaging/
│   │   │   ├── slack/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── whatsapp/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── gmail/
│   │   │   │   └── collection.ref.yaml
│   │   │   └── telegram/
│   │   │       └── collection.ref.yaml
│   │   ├── knowledge/
│   │   │   ├── google-drive/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── notion/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── github/
│   │   │   │   └── collection.ref.yaml
│   │   │   └── confluence/
│   │   │       └── collection.ref.yaml
│   │   ├── input/
│   │   │   ├── typeform/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── jotform/
│   │   │   │   └── collection.ref.yaml
│   │   │   ├── tally/
│   │   │   │   └── collection.ref.yaml
│   │   │   └── calendly/
│   │   │       └── collection.ref.yaml
│   │   └── business/
│   │       ├── hubspot/
│   │       │   └── collection.ref.yaml
│   │       ├── stripe/
│   │       │   └── collection.ref.yaml
│   │       ├── clickup/
│   │       │   └── collection.ref.yaml
│   │       └── monday/
│   │           └── collection.ref.yaml
│   ├── environments/
│   │   └── third-party-apis.env.yaml ← All 16 API credential variables
│   ├── flows/                        ← Postman Flows (visual API workflows)
│   ├── globals/
│   │   └── workspace.globals.yaml
│   ├── mocks/                        ← Local mock servers
│   ├── sdks/                         ← Generated SDKs
│   └── specs/                        ← OpenAPI specifications
├── src/
│   └── adapters/                     ← Generated API adapters
├── services/                         ← Extracted service configurations
├── mcp-server/                       ← MCP protocol server
├── core/                             ← Base client and utilities
└── database/                         ← Migration files
```

### Key Files for Agents

| File | Purpose |
|------|---------|
| `SKILL.md` | This file — primary agent reference |
| `CLAUDE.md` | Claude Code specific guidance |
| `postman/collections/README.md` | Master index with all API links |
| `postman/environments/third-party-apis.env.yaml` | All credential variable names |
| `postman/collections/{category}/{api}/collection.ref.yaml` | Per-API specs and auth info |

---

## Quick Reference

### Most-Used Variable Names

```bash
# Messaging
slack_token, slack_base_url
whatsapp_token, whatsapp_base_url, whatsapp_phone_number_id
gmail_access_token, gmail_base_url, gmail_user_id
telegram_bot_token, telegram_base_url, telegram_chat_id

# Knowledge
google_drive_access_token, google_drive_base_url
notion_token, notion_base_url, notion_version
github_token, github_base_url, github_owner, github_repo
confluence_email, confluence_api_token, confluence_base_url, confluence_domain

# Input
typeform_token, typeform_base_url
jotform_api_key, jotform_base_url
tally_access_token, tally_base_url
calendly_token, calendly_base_url, calendly_user_uri

# Business
hubspot_token, hubspot_base_url
stripe_secret_key, stripe_base_url
clickup_token, clickup_base_url, clickup_team_id
monday_token, monday_base_url
```

### APIs Requiring OAuth2 (More Complex Setup)
- **Gmail** — Google OAuth2 with Gmail scopes
- **Google Drive** — Google OAuth2 with Drive scopes

### APIs Without Official Postman Collections
- **Gmail** — use REST docs: https://developers.google.com/gmail/api/reference/rest
- **Jotform** — use REST docs: https://api.jotform.com/docs
- **Tally** — use REST docs: https://tally.so/help/api (primarily webhook-based)

### GraphQL APIs
- **Monday.com** — all requests are POST to `https://api.monday.com/v2` with GraphQL query/mutation in body

---

*Last updated: 2025 | Onasis Gateway v1*
