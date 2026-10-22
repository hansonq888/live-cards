# Azure setup: deploy one Foundry model and call it from Agent Framework

Goal for Thursday: prove that Azure works end to end before we build on it. This takes about
20–30 minutes. Portal labels move around, so if a button name differs, look for the nearest
equivalent.

## 0. Prerequisites

```bash
brew install azure-cli
az login
az account show --query "{name:name, id:id, type:user.type}"
```

`az account show` tells you which subscription you're on ("Azure for Students" or another).
We need the Azure CLI on Sunday anyway for Container Apps.

## 1. Create a Foundry project

1. Go to **https://ai.azure.com** (the Microsoft Foundry portal) and sign in with the same account.
2. **Create project** (or "New Foundry resource / project"). This creates a Foundry resource plus a
   project inside it.
   - Resource group: `livecards-rg` (new)
   - Region: **East US 2** or **Sweden Central**. Both have the widest model catalog. Avoid
     regions where your student subscription has no quota.
3. Open the project's **Overview** and copy the **Project endpoint**. It looks like
   `https://<resource>.services.ai.azure.com/api/projects/<project>`.

## 2. Deploy a small, fast model

1. In the project, open **Models + endpoints**, choose **Deploy model**, then **Deploy base model**.
2. Pick a small, fast chat model: `gpt-4.1-mini`, or the newest `*-mini` model the catalog offers.
   This is the Explainer and Personalizer tier. Later we add a stronger model for the Verifier
   and Q&A.
3. Deployment type **Global Standard**. Name the deployment `explainer-mini`. Lower the
   tokens-per-minute (TPM) setting if it complains about quota.
4. Test it once in the **Playground** to confirm the deployment works.

## 3. Let your account call it (Entra ID, no API keys)

The SDK signs in as *you*. On the Foundry resource, open **Access control (IAM)**, choose
**Add role assignment**, then grant **Azure AI User** to your account. The creator is often already
Owner, but data-plane calls still need this role. It can take 1–5 minutes to apply.

## 4. Run the smoke test

```bash
cd backend
cp .env.example .env        # paste the endpoint; FOUNDRY_MODEL=explainer-mini
uv sync --extra agents
uv run python scripts/foundry_smoke.py
```

You should see three one-sentence explanations of Varenne's goal and a latency for each. The
first call is slower because it includes token and connection setup. If the az CLI gives you
trouble, `--browser` signs in through a browser window instead.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401` / `PermissionDenied` | Step 3 role missing or not propagated yet; wait a few minutes, `az login` again |
| `DeploymentNotFound` | `FOUNDRY_MODEL` must be the **deployment** name, not the model name |
| Quota of 0 / "insufficient quota" when deploying | Try the other region or another mini model; student subscriptions get small quotas |
| Model list empty or deployment blocked by policy | The subscription blocks it; see below |

## If the student subscription blocks it: switch to the free trial

1. Go to **https://azure.microsoft.com/free** and choose **Start free**. A phone number and card
   are needed for identity verification only. You get USD 200 of credit for 30 days and aren't
   charged unless you upgrade. One trial per person, so it fails if this account has used one.
2. `az login`, then `az account list -o table` and `az account set --subscription "<free trial name>"`.
3. Redo steps 1–4 in the new subscription.
4. Either way, set a **budget alert** (Cost Management, then Budgets, then about $25 with an
   email alert) so nothing surprises us on Sunday when the Container Apps and Event Hubs go up.

## What's next on Azure (Sunday)

Local first: today's simulator and engine have no cloud dependency. Sunday we put Event
Hubs, Web PubSub, Container Apps and Application Insights behind thin interfaces
(`replay.stream()` is the in-process stand-in for the Event Hubs feed).
