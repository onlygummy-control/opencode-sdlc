# OpenCode config

This repo is a personal OpenCode configuration, installed at `~/.config/opencode`
(`%USERPROFILE%\.config\opencode` on Windows). It defines four primary agents,
two subagents, a global permission baseline, and the skills those agents load.

## Install

Put the repo at `~/.config/opencode`. On Windows that is
`%USERPROFILE%\.config\opencode`.

Restart OpenCode after you change an agent file. Sessions start in `plan`.
Switch agents with `tab`.

## OpenCode Go proxy

The agents call the `opencode-go` provider, which points at a Cloudflare Worker
that proxies OpenCode Go inference. The Worker URL and the proxy key come from
environment variables, so neither enters git.

### Proxy files

| Path | Role |
| --- | --- |
| `worker.js` | Cloudflare Worker that proxies inference to `https://opencode.ai/inference/go` |
| `plugins/proxy-catalog.ts` | Server plugin that loads the model catalog from the proxy |
| `opencode.jsonc` | Configures `opencode-go` against the proxy through `{env:...}` placeholders |
| `service.json` | Local, gitignored file with the service password and proxy environment |
| `service.json.example` | Tracked template for `service.json` |

The provider ID stays `opencode-go`, so the existing connection and every agent
model reference keep working. Only the display name is `Proxy`. In
`opencode.jsonc`, `settings.baseURL` is `{env:PROXY_BASE_URL}`,
`headers.x-proxy-key` is `{env:PROXY_KEY}`, and `$schema` points at
`https://opencode.ai/config.json`. The plugin supplies the models, so there is
no manual `models` block.

### Set up the proxy

1. Deploy `worker.js` to the Worker bound to your custom domain. Nothing in the repo deploys it, so use the Cloudflare dashboard or Wrangler.
2. Add a `PROXY_KEY` secret to that same Worker in Cloudflare. Generate 32 random bytes:

   ```bash
   openssl rand -hex 32
   ```

   On Windows, the equivalent PowerShell expression is:

   ```powershell
   -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
   ```

3. Copy `service.json.example` to `service.json`.
4. Set `password` to the local service password.
5. Set `PROXY_BASE_URL` to the Worker base URL including `/v1`, for example `https://<worker-host>/v1`.
6. Set `PROXY_KEY` to the same value as the Cloudflare secret. `env.OPENCODE_DISABLE_FREE_MODELS` turns off the console free-model fetch.
7. Restart the service:

   ```powershell
   opencode service restart
   ```

8. Reload or restart OpenCode if the plugin does not pick up the change.

`service.json` is gitignored. Never commit it. Other config changes reload
automatically. A change to the environment in `service.json` needs a restart.

### Verify the proxy

Replace `<worker-host>` with the Worker host and set `PROXY_KEY` in your shell.

```bash
curl -i "https://<worker-host>/v1/models"
curl -i -H "x-proxy-key: $PROXY_KEY" "https://<worker-host>/v1/models"
curl -i "https://<worker-host>/config.json"
curl -i -X POST "https://<worker-host>/config.json"
curl -i -X OPTIONS "https://<worker-host>/v1/models"
```

- `/v1/models` returns 401 without a key and with a wrong key. With the right key it returns 200 and the model list.
- `/config.json` returns 200 with `cache-control: public, max-age=3600`.
- `POST /config.json` returns 405, and `OPTIONS` returns 204.
- `GET /v1/unknown` returns 401 without a key, because the key is checked before the path.

If `/config.json` still reports `max-age=0`, purge that path once at the edge.

### Worker behavior

| Rule | Behavior |
| --- | --- |
| Routes | `/v1`, `/openai/v1`, `/anthropic/v1`, and `/google/v1beta` map to `https://opencode.ai/inference/go` |
| Schema | `/config.json` is public and proxies `https://opencode.ai/config.json` with a one-hour cache |
| Auth | `x-proxy-key` must match the `PROXY_KEY` secret; a missing secret fails closed with 401 |
| Methods | `POST`, plus `GET` on paths ending in `/models`; `OPTIONS` answers 204 locally; other methods and paths are rejected |
| Limits | 32 MB request body, 5 minute upstream timeout |
| Stripped headers | `Host`, `cf-*`, `x-forwarded-*`, `x-real-ip`, `true-client-ip`, `cookie`, `origin`, `referer`, `x-opencode-client`, `x-client-version`, `x-proxy-key` |
| Upstream request | Browser User-Agent, and no CORS headers added to inference responses |

### Catalog plugin

The plugin loads `GET $PROXY_BASE_URL/models` at startup and every 30 minutes,
sending `x-proxy-key`. It rewrites each catalog `api.*.base_url` path to the
proxy origin and strips the upstream `/inference/go` prefix, so no model can
bypass the Worker. The runtime package comes from `sdk.opencodeai` and maps to
openai-compatible, anthropic, openai/responses, or google. Each refresh calls
`editor.models.set("opencode-go", models)` and `ctx.provider.reload()`.

If the initial load fails, the plugin logs the error and leaves the existing
catalog alone. If `PROXY_BASE_URL` is missing, it logs and exits setup.

### Cheap model checks

| Model | Protocol | Cost per million tokens |
| --- | --- | --- |
| `beam-free` | chat-completions | free |
| `qwen3.8-flash` | Anthropic messages | 0.15 input, 0.47 output |
| `muse-spark-1.2-contributor` | OpenAI responses | 0.10 input, 0.20 output |

These three cover the three protocols at the lowest cost. Skip `qwen3.8-max`,
`gemini-4-argon`, and `grok-4.7` for cheap tests. Send test messages and read the
responses through `/models` in the TUI, because both need the stored OpenCode
credential.

### Security

- Keep `service.json` untracked. It holds the service password and the proxy key.
- Rotate `PROXY_KEY` as soon as it is exposed, then update the Cloudflare secret and `service.json`.
- Add a Cloudflare WAF rate limit, and disable the workers.dev route when you do not use it.
- Never log the proxy key or the `Authorization` header.
- The Worker sends a browser User-Agent and strips client-identifying headers. Use it only where the provider terms allow that.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| 401 `Unauthorized` | `x-proxy-key` is missing or does not match the Cloudflare secret |
| 400 `MissingSessionID` | the client did not send `x-opencode-session` |
| 404 `Not found` | the path is outside the Worker route list |
| Plugin does not load | `PROXY_BASE_URL` is missing, or the service did not restart |
| No models | `/v1/models` failed, or the plugin did not reload |
| Old schema response | `/config.json` is still cached at the edge; purge it |

Rejected alternatives: hardcoding the Worker URL and key in `opencode.jsonc`
would put both in git; keeping the manual model list would duplicate
`/v1/models`; renaming the provider ID to `proxy` would break the existing
connection and agent references. Hashing the bearer token was considered, but a
separate `x-proxy-key` rotates on its own and lets a WAF rule match on it.

## Agents

### Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| plan | Requirements, design, and work breakdown; the default agent | Plan files under `.opencode/plan/` |
| build | Writing and refactoring code and config; it also commits on its short-lived branch | Code and config, but not `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, or `docs/` |
| review | Pre-push verification and a commit message cross-check | Nothing |
| ship | Pushing and the pull request; it commits only when the tree arrives uncommitted | Nothing; it writes git and `gh` state only |

### Sub Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| branch-keeper | Creates the short-lived branch for another agent | Nothing; it writes git branch state only |
| scribe | ADRs, glossary entries, README, and pages under `docs/` | `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, and `docs/` |

## Flow

1. `plan` clarifies the request and records decisions through `scribe`. When the request is fuzzy it loads `grill-with-docs`, which runs the grilling interview and writes ADRs and glossary entries as decisions settle.
2. `build` dispatches `branch-keeper`, or cuts the short-lived branch itself when the subagent is unavailable, then edits, runs lint, and sends any docs work to `scribe`.
3. `build` commits the change. `review` loads `requesting-code-review`, verifies the commits against the trunk in a fresh context, and cross-checks the conventional commit message.
4. `ship` loads `git-workflow`, pushes without a prompt, and opens the PR on the short-lived branch. It dispatches `branch-keeper` for an unbranched clean tree and commits only when the tree arrives uncommitted.
5. You merge on the web. `ship` verifies the merge, deletes the remote branch after approval, and pulls the trunk.

## Human gates

1. `review` must pass before the push.
2. You merge the PR on the web. Merge is never automated.
3. You approve deleting the merged remote branch.

## Docs

- [GLOSSARY.md](GLOSSARY.md): terms used in this repo
- [docs/adr/](docs/adr/): decisions, numbered in sequence
- [docs/workflow.md](docs/workflow.md): what each agent does and where it stops
- [docs/permissions.md](docs/permissions.md): how the permission rules work
- [docs/contributing.md](docs/contributing.md): adding agents, skills, and docs

Design notes live under `docs/`.
