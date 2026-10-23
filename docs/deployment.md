# Azure deployment

**Live:** https://livecards.mangorock-d6a7d3f2.northcentralus.azurecontainerapps.io
(`/api/status` shows which backend is live for each concern; `/?view=console` is the console.)

```
simulator ──publish──▶ Event Hubs (match-feed) ──ingest──▶ stats engine
                                                              │ moments
              ┌──────── Agent Framework workflows ────────────┤
              │ Explainer → Verifier → Reviewer → Publish      │ (models: Microsoft Foundry,
              │ Personalizer fan-out · Q&A agent with tools    │  gpt-4.1-mini + gpt-5-mini)
              └─────────────────────────────────────────────────┘
viewers ◀── WebSocket (frames, cards, cues) ── Container Apps ──▶ Cosmos DB (audit log)
consoles ◀── Azure Web PubSub (audit, approvals, controls) ──┘     App Insights (traces)
```

| Resource | Name | Region | Notes |
|---|---|---|---|
| Foundry project + 2 deployments | `livecards-resource/livecards` | North Central US | `explainer-mini` (gpt-4.1-mini), `reasoner-mini` (gpt-5-mini) |
| Container Apps environment + app | `livecards-env` / `livecards` | North Central US | 1 vCPU, 2 GiB, 1 replica (the console's control plane is in memory) |
| Container Registry | `livecardsacr72b7` | North Central US | Basic |
| Event Hubs | `livecards-eh-72b7` / `match-feed` | North Central US | Basic, 2 partitions, 24 h retention |
| Cosmos DB (serverless) | `livecards-audit-w-72b7` / `livecards` / `audit` | West US | North Central and Canada Central had no capacity |
| Web PubSub | `livecards-wps-72b7`, hub `console` | North Central US | Free tier |
| Application Insights + Log Analytics | `livecards-insights`, `livecards-logs` | North Central US | Agent Framework spans + per-moment spans |

Everything is in resource group `rg-hansonq888-1273`. Deleting it removes everything.

## Identity: no keys in code

The app signs in as service principal `livecards-app-sp` (client secret stored as an encrypted
Container Apps secret), with narrowly scoped roles: Foundry User (Foundry resource), Event Hubs
Data Sender + Receiver (namespace), Web PubSub Service Owner, and the Cosmos DB Built-in Data
Contributor role (data plane only; the database and container are created by the deployment).

Why not managed identity: this subscription only allows Container Apps **express**
environments, which can create an app with a managed identity but reject every later update to
it. The credential chain is `EnvironmentCredential → ManagedIdentityCredential →
AzureCliCredential`, so the same code uses managed identity on a standard environment and
`az login` on a laptop.

Other constraints we hit: Student subscriptions block ACR Tasks (images are built locally
with `docker buildx --platform linux/amd64`), allow only 5 regions, and have no quota for
gpt-5.4-mini.

## Fallbacks (the demo never depends on the cloud)

| Concern | Cloud | Without its setting |
|---|---|---|
| Match feed | Event Hubs (publish if empty, then ingest) | local simulator |
| Audit log | Cosmos DB (async writes) | SQLite |
| Console fan-out | Web PubSub | the app's `/ws/console` socket |
| Tracing | Application Insights | off |
| Models | Foundry | template lines only |

## Redeploy

```bash
deploy/redeploy.sh v5
```
