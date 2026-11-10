# opencode-sdlc

This repo is a personal OpenCode configuration, installed at `~/.config/opencode`
(`%USERPROFILE%\.config\opencode` on Windows). It defines seven agents, a global
permission baseline, and the skills those agents load.

## Principles

Machines do the work and run the checks. Humans own the verdict.

Automated tools can lint, typecheck, and run tests. They can catch syntax
errors, missing imports, and broken builds. They cannot catch a wrong
assumption, a misread requirement, or a diff that passes every check but
solves the wrong problem. That takes a person reading the change with fresh
eyes.

Every gate in this setup exists to make human review easier, not to replace
it:

- `review` checks the diff in a clean context and reports findings, but it
  does not merge.
- `ship` runs the checks and opens the PR, but it merges only after the
  wait script confirms the branch is safe.
- `ship` never uses `--admin`, so a branch protection rule that blocks the
  merge stops the run instead of being bypassed.
- The local branch stays after the merge. `ship` cannot delete it, because a
  pattern that allows `-d` also allows `-D` on Windows. The user decides
  when to clean up.

Automation handles the mechanical work: staging, committing, pushing, polling
for checks, merging, and syncing the trunk. Judgment stays with the human.

## Install

Put the repo at `~/.config/opencode`. On Windows that is
`%USERPROFILE%\.config\opencode`.

Restart OpenCode after you change an agent file. Sessions start in `plan`.
Switch agents with `tab`.

## OpenCode Go and Zen proxy

The agents call the `proxy` provider, which points at a Cloudflare Worker that
proxies OpenCode Go and Zen inference. The Worker URL, the Worker key, and the
upstream API key come from environment variables, so none enters git.

### Proxy files

| Path | Role |
| --- | --- |
| `proxy.js` | Cloudflare Worker that proxies Go inference to `https://opencode.ai/inference/go` and Zen inference to `https://opencode.ai/inference` |
| `plugins/proxy-catalog.ts` | Server plugin that loads the Go and Zen catalogs from the proxy |
| `opencode.jsonc` | Configures `proxy` against the Worker through `{env:...}` placeholders |
| `service.json` | Local, gitignored file with the service password and the `PROXY_BASE_URL`, `PROXY_KEY`, and `PROXY_OPENCODE_API_KEY` environment |
| `service.json.example` | Tracked template for `service.json` |

The provider ID is `proxy`. It is a custom provider, so `opencode.jsonc`
declares `package: "@opencode/ai/providers/openai-compatible"` as the default
runtime and `env: ["PROXY_OPENCODE_API_KEY"]`. `settings.baseURL` is
`{env:PROXY_BASE_URL}`, `headers.x-proxy-key` is `{env:PROXY_KEY}`, and
`$schema` points at `https://opencode.ai/config.json`. That is the public editor
schema; the Worker no longer proxies it.
There is no `canonical`. The plugin supplies the models, so there is no manual
`models` block.

`PROXY_OPENCODE_API_KEY` is the OpenCode Console API key, and the Worker forwards
it upstream for Go and Zen. Go requests use `/inference/go` and count against the
Go allowance. Zen requests draw from the workspace balance, not the Go
allowance.

The custom provider is deliberate: it hosts Go and Zen models from more than one
upstream under the same provider.

### Provider settings

`settings` sets three timeouts to `300000` milliseconds, which is five minutes:
`timeout`, `headerTimeout`, and `chunkTimeout`. `proxy.js` aborts the upstream
request at the same five minutes, so the client and the Worker stop at the same
point. The Worker runs on the Cloudflare free plan, which cannot be assumed to
stream longer. An earlier recommendation to use fifteen minutes does not apply
while the Worker is on the free plan.

`cache` sets `ttl: "5m"`, so the prompt cache is on with a five-minute TTL.
Warming is off: it would send extra requests and spend tokens. `compaction` sets
`type: "summary"`, which keeps a long session from growing without bound.

### Set up the proxy

1. Deploy `proxy.js` to the Worker bound to your custom domain. Nothing in the repo deploys it, so use the Cloudflare dashboard or Wrangler.
2. Add a `PROXY_KEY` secret to that same Worker in Cloudflare. Generate 32 random bytes:

   ```bash
   openssl rand -hex 32
   ```

   On Windows, the equivalent PowerShell expression is:

   ```powershell
   -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
   ```

3. Copy `service.json.example` to `service.json`. The example lists `PROXY_BASE_URL`, `PROXY_KEY`, and `PROXY_OPENCODE_API_KEY`.
4. Set `password` to the local service password.
5. Set `PROXY_BASE_URL` to the Worker base URL including `/v1`, for example `https://<worker-host>/v1`.
6. Set `PROXY_KEY` to the same value as the Cloudflare secret.
7. Set `PROXY_OPENCODE_API_KEY` to the OpenCode Console API key the Worker forwards upstream for both Go and Zen.
8. Restart the service:

   ```powershell
   opencode service restart
   ```

9. Reload or restart OpenCode if the plugin does not pick up the change.

`PROXY_KEY` is the Worker access key; `PROXY_OPENCODE_API_KEY` is the upstream
key. `OPENCODE_DISABLE_FREE_MODELS` turns off the console free-model fetch.

`service.json` is gitignored. Never commit it. Other config changes reload
automatically. A change to the environment in `service.json` needs a restart.

### Verify the proxy

Replace `<worker-host>` with the Worker host and set `PROXY_KEY` in your shell.

```bash
curl -i "https://<worker-host>/v1/models"
curl -i -H "x-proxy-key: $PROXY_KEY" "https://<worker-host>/v1/models"
curl -i -X OPTIONS "https://<worker-host>/v1/models"
```

- `/v1/models` returns 401 without a key and with a wrong key. With the right key it returns 200 and the model list.
- `OPTIONS` returns 204.
- `GET /v1/unknown` returns 401 without a key, because the key is checked before the path.

Then check the provider in the TUI:

- `/models` shows `Proxy` with `[GO]` and `[ZEN]` entries.
- A `proxy/deepseek-v4.1-flash` prompt works.
- `proxy/qwen3.8-flash` exercises Anthropic Messages, and
  `proxy/muse-spark-1.2-contributor` exercises OpenAI Responses.
- `proxy/zen-glm-5.3-flash` exercises chat, `proxy/zen-qwen3.8-flash` exercises
  Anthropic Messages, and `proxy/zen-gpt-5-nano` exercises OpenAI Responses.
- A 401 means `PROXY_OPENCODE_API_KEY` is missing or wrong, or the Worker
  key does not match.
- No models means `/v1/models` failed or the plugin did not reload.

Optional direct Zen check. The provider already lists the Zen models, so use this
only to see a raw upstream status instead of a TUI error. It needs workspace
credits and the Console key. First list the Zen catalog:

```bash
curl -i -H "x-proxy-key: $PROXY_KEY" \
  -H "Authorization: Bearer $PROXY_OPENCODE_API_KEY" \
  "https://<worker-host>/zen/v1/models"
```

Then pick a paid model from that catalog and send it through `/zen`, which needs
both keys:

```bash
curl -i -X POST "https://<worker-host>/zen/openai/v1/chat/completions" \
  -H "x-proxy-key: $PROXY_KEY" \
  -H "Authorization: Bearer $PROXY_OPENCODE_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"<paid-model-id>","messages":[{"role":"user","content":"ping"}]}'
```

- 200 means the key can reach the paid model and the workspace has credits.
- 402 means the workspace needs credits.
- 403 means the key permission or the model rule blocks the call; check both.
- 429 with `FreeUsageLimitError` means a free Zen model hit the free usage
  limit through the proxy. Use a paid Zen model or a Go free model instead.

For other protocols, send the request through the matching Worker path:

- `/zen/openai/v1/chat/completions`
- `/zen/openai/v1/responses`
- `/zen/anthropic/v1/messages`
- `/zen/google/v1beta/models/<model>:generateContent`

The `/zen` route takes direct paid-model calls. The provider lists the same Zen
models, so these paths are only needed for a manual check or a protocol the TUI
does not cover.

### Worker behavior

| Rule | Behavior |
| --- | --- |
| Routes | `/v1`, `/openai/v1`, `/anthropic/v1`, and `/google/v1beta` map to `https://opencode.ai/inference/go`; `/zen/...` maps to `https://opencode.ai/inference` |
| Zen catalog | `/zen/v1/models` maps to the Zen catalog endpoint, `https://opencode.ai/inference/v1/models` |
| Auth | `x-proxy-key` must match the `PROXY_KEY` secret; a missing secret fails closed with 401 |
| Methods | `POST`, plus `GET` on paths ending in `/models`; `OPTIONS` answers 204 locally; other methods and paths are rejected |
| Limits | 32 MB request body, 5 minute upstream timeout |
| Stripped headers | `Host`, `cf-*`, `x-forwarded-*`, `x-real-ip`, `true-client-ip`, `cookie`, `origin`, `referer`, `x-opencode-client`, `x-client-version`, `x-proxy-key` |
| Upstream request | Browser User-Agent, and no CORS headers added to inference responses |

`proxy.js` aborts the upstream request after five minutes. A stream longer than
five minutes is cut by design on the free plan. To raise the limit, raise the
Worker timeout and the provider timeouts in the same change. The Worker copies
the upstream response headers and drops only `set-cookie`, so `Retry-After` still
reaches the client.

### Catalog plugin

The plugin loads two catalogs at startup and every 30 minutes. The Go catalog
comes from `GET $PROXY_BASE_URL/models` with `x-proxy-key`. The Zen catalog comes
from `GET /zen/v1/models` on the same origin, with `x-proxy-key` plus
`Authorization: Bearer $PROXY_OPENCODE_API_KEY`. Both are merged into the one
`proxy` provider. The Zen side depends on the key and workspace, so the total is
the Go catalog plus the Zen models that key can see.

It rewrites each catalog `api.*.base_url` path to the proxy origin and strips the
upstream `/inference/go` or `/inference` prefix, so no model can bypass the
Worker. Go entries appear as `[GO] <catalog name>`, Zen entries as
`[ZEN] <catalog name>`. A Go model keeps its catalog ID, for example
`proxy/deepseek-v4.1-flash`. A Zen model gets a `zen-` ID prefix, for example
`proxy/zen-glm-5.3-flash`, and its upstream `modelID` stays the original catalog
ID. Because of the prefix, a Go and a Zen model with the same name, such as
`qwen3.8-flash`, can both appear.

`PROVIDER_ID` is `proxy`. The plugin sets each model's `package` from
`sdk.opencodeai`: OpenAI Chat Completions uses
`@opencode/ai/providers/openai-compatible`, Anthropic Messages uses
`@opencode/ai/providers/anthropic`, OpenAI Responses uses
`@opencode/ai/providers/openai/responses`, and Google uses
`@opencode/ai/providers/google`. The provider-level package is only the default
for models without an override. On transform the plugin also ensures that
default and sets `activation: "enabled"` before `editor.models.set("proxy",
models)`. On the same transform it calls `editor.remove("opencode-go")`, so the
model picker shows only `proxy` and cannot fall back to the built-in provider's
blocked direct endpoint. Each refresh calls `ctx.provider.reload()`.

On each catalog entry the plugin copies the full compatibility block: reasoning
field, require reasoning, max token field, require finish reason, require
assistant after tool, supports prompt cache key, stream usage, cache format,
thinking block binding, effort updates, and media input. The max token field and
the cache fields keep requests stable and prompt caching effective, and stream
usage reports usage on streamed responses.

If `PROXY_OPENCODE_API_KEY` is missing, the plugin logs and skips the Zen catalog
but still loads Go. If the initial load returns nothing, it logs the error and
leaves the existing catalog alone. If `PROXY_BASE_URL` is missing, it logs and
exits setup.

### Cheap model checks

| Model | Protocol | Cost per million tokens |
| --- | --- | --- |
| `beam-free` | chat-completions | free |
| `qwen3.8-flash` | Anthropic messages | 0.15 input, 0.47 output |
| `muse-spark-1.2-contributor` | OpenAI responses | 0.10 input, 0.20 output |

These are Go IDs; the Zen versions carry the `zen-` prefix and draw from the
workspace balance. These three cover the three protocols at the lowest cost. Skip
`qwen3.8-max`, `gemini-4-argon`, and `grok-4.7` for cheap tests. Send test
messages and read the responses through `/models` in the TUI, because both need
the stored OpenCode credential.

### Security

- Keep `service.json` untracked. It holds the service password, the Worker key, and the upstream API key.
- Rotate `PROXY_KEY` as soon as it is exposed, then update the Cloudflare secret and `service.json`.
- Add a Cloudflare WAF rate limit, and disable the workers.dev route when you do not use it.
- Never log the proxy key, the upstream API key, or the `Authorization` header.
- The Worker sends a browser User-Agent and strips client-identifying headers. Use it only where the provider terms allow that.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| 401 `Unauthorized` | `x-proxy-key` is missing or does not match the Cloudflare secret, or the upstream key is missing or wrong |
| 400 `MissingSessionID` | the client did not send `x-opencode-session` |
| 404 `Not found` | the path is outside the Worker route list |
| Plugin does not load | `PROXY_BASE_URL` is missing, or the service did not restart |
| No models | `/v1/models` failed, or the plugin did not reload |

Rejected alternatives: hardcoding the Worker URL and key in `opencode.jsonc`
would put both in git; keeping the manual model list would duplicate
`/v1/models`; keeping only the built-in `opencode-go` provider cannot host
models from more than one upstream. Hashing the bearer token was considered,
but a separate `x-proxy-key` rotates on its own and lets a WAF rule match on it.

## Agents

### Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| plan | Requirements, design, and work breakdown; the default agent | Plan files under `.opencode/plan/` |
| build | Writing and refactoring code and config; it also commits on its short-lived branch | Code and config, but not `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, or `docs/` |
| review | Pre-push verification and a commit message cross-check | Nothing |
| ship | Pushing, the pull request, the wait for checks, the squash merge, and the trunk sync; it commits only when the tree arrives uncommitted | Nothing; it writes git and `gh` state only |

### Sub Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| branchwright | Creates the short-lived branch for another agent | Nothing; it writes git branch state only |
| verify | Runs lint, typecheck, and the test suite on demand and reports the evidence | Nothing |
| scribe | ADRs, glossary entries, README, and pages under `docs/` | `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, and `docs/` |

## Flow

1. `plan` clarifies the request and records decisions through `scribe`. When the request is fuzzy it loads `grill-with-docs`, which runs the grilling interview and writes ADRs and glossary entries as decisions settle.
2. `build` dispatches `branchwright`, or cuts the short-lived branch itself when the subagent is unavailable, then edits, runs lint, and sends any docs work to `scribe`. When a change needs a test run, `build` can dispatch `verify`; the pre-push test gate still belongs to `review`.
3. `build` commits the change. `review` loads `requesting-code-review`, verifies the commits against the trunk in a fresh context, and cross-checks the conventional commit message.
4. `ship` loads `git-delivery`, pushes without a prompt, and opens the PR on the short-lived branch. It dispatches `branchwright` for an unbranched clean tree and commits only when the tree arrives uncommitted. It then waits for checks, squash-merges, deletes the merged branch, and syncs the trunk.
5. The merge is automated by `ship` with a squash merge and no `--admin`. A branch protection rule that blocks the merge stops the run instead of being bypassed.

## Human gates

1. `review` must pass before the push.
2. `ship` merges automatically with squash after the wait script returns ready.
3. A branch protection rule that blocks the merge stops the run.

## Docs

- [docs/workflow.md](docs/workflow.md): what each agent does and where it stops
- [docs/permissions.md](docs/permissions.md): how the permission rules work
- [docs/contributing.md](docs/contributing.md): adding agents, skills, and docs

`GLOSSARY.md` and `docs/adr/` are local-only development docs. They stay on disk
and are not in git.

Design notes live under `docs/`.
