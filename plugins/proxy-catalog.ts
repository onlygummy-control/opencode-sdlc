import { Model, Plugin, Provider } from "@opencode/plugin"

const PROVIDER_ID = "proxy"
const REFRESH_MS = 30 * 60 * 1000

type CatalogModel = {
  id: string
  name: string
  family?: string
  release_date?: string
  capabilities?: {
    tools?: { supported?: boolean }
    temperature?: boolean
  }
  modalities?: { input?: string[]; output?: string[] }
  limit?: { context?: number; input?: number; output?: number }
  cost?: {
    text?: {
      input?: { price?: number; cache?: { read?: number; write?: number } }
      output?: { price?: number }
    }
  }
  api?: Record<
    string,
    {
      base_url?: string
      sdk?: { opencodeai?: string }
      compatibility?: { reasoning_field?: string }
    }
  >
}

type Catalog = { data: CatalogModel[] }

const PACKAGE_BY_API: Record<string, string> = {
  "chat-completions": "@opencode/ai/providers/openai-compatible",
  messages: "@opencode/ai/providers/anthropic",
  responses: "@opencode/ai/providers/openai/responses",
  "generate-content": "@opencode/ai/providers/google",
}

// The catalog advertises absolute opencode.ai URLs. Strip the Go or Zen prefix,
// then point the protocol path at the proxy origin so requests stay on the Worker.
function proxyBase(origin: string, upstream: string | undefined, zen: boolean) {
  const prefix = zen ? "/zen" : ""
  if (!upstream) return `${origin}${prefix}/openai/v1`
  const pattern = zen ? /^\/inference/ : /^\/inference\/go/
  const path = new URL(upstream).pathname.replace(pattern, "")
  return `${origin}${prefix}${path}`
}

function toModel(
  providerID: Provider.ID,
  origin: string,
  entry: CatalogModel,
  zen: boolean
): Model.Info {
  const [protocol, api] = Object.entries(entry.api ?? {})[0] ?? ["chat-completions", undefined]
  const packageName =
    api?.sdk?.opencodeai ??
    PACKAGE_BY_API[protocol] ??
    PACKAGE_BY_API["chat-completions"]

  const text = entry.cost?.text
  const released = entry.release_date ? Date.parse(entry.release_date) : NaN
  const id = zen ? `zen-${entry.id}` : entry.id

  return {
    ...Model.Info.default(providerID, Model.ID.make(id)),
    modelID: Model.ID.make(entry.id),
    name: `[${zen ? "ZEN" : "GO"}] ${entry.name}`,
    family: entry.family,
    package: packageName,
    settings: { baseURL: proxyBase(origin, api?.base_url, zen) },
    compatibility: api?.compatibility?.reasoning_field
      ? { reasoningField: api.compatibility.reasoning_field }
      : undefined,
    capabilities: {
      tools: entry.capabilities?.tools?.supported ?? true,
      input: entry.modalities?.input ?? ["text"],
      output: entry.modalities?.output ?? ["text"],
      temperature: entry.capabilities?.temperature ?? true,
    },
    time: { released: Number.isFinite(released) ? released : Date.now() },
    cost: text
      ? [
          {
            input: text.input?.price ?? 0,
            output: text.output?.price ?? 0,
            cache: {
              read: text.input?.cache?.read ?? 0,
              write: text.input?.cache?.write ?? 0,
            },
          },
        ]
      : [],
    limit: {
      context: entry.limit?.context ?? 128_000,
      input: entry.limit?.input,
      output: entry.limit?.output ?? 8_192,
    },
    status: "active",
    enabled: true,
  } as unknown as Model.Info
}

async function loadCatalog(url: string, apiKey?: string): Promise<Catalog> {
  const headers: Record<string, string> = {}
  const proxyKey = process.env.PROXY_KEY
  if (proxyKey) headers["x-proxy-key"] = proxyKey
  if (apiKey) headers.authorization = `Bearer ${apiKey}`

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) throw new Error(`catalog ${response.status}`)
  return response.json() as Promise<Catalog>
}

export default Plugin.define({
  id: "proxy.catalog",
  async setup(ctx) {
    const providerID = Provider.ID.make(PROVIDER_ID)
    const baseURL = process.env.PROXY_BASE_URL
    if (!baseURL) {
      console.error("proxy catalog: PROXY_BASE_URL is not set")
      return
    }
    let origin: string
    try {
      origin = new URL(baseURL).origin
    } catch {
      console.error("proxy catalog: PROXY_BASE_URL is invalid")
      return
    }

    const goURL = `${baseURL.replace(/\/+$/, "")}/models`
    const zenURL = `${origin}/zen/v1/models`
    const zenKey = process.env.PROXY_OPENCODE_API_KEY
    if (!zenKey) {
      console.error("proxy catalog: PROXY_OPENCODE_API_KEY is not set; Zen models are skipped")
    }

    const load = async (): Promise<Model.Info[]> => {
      const models: Model.Info[] = []

      try {
        const go = await loadCatalog(goURL)
        models.push(...go.data.map((entry) => toModel(providerID, origin, entry, false)))
      } catch (error) {
        console.error("proxy catalog: Go load failed", error)
      }

      if (zenKey) {
        try {
          const zen = await loadCatalog(zenURL, zenKey)
          models.push(...zen.data.map((entry) => toModel(providerID, origin, entry, true)))
        } catch (error) {
          console.error("proxy catalog: Zen load failed", error)
        }
      }

      return models
    }

    const initial = await load()
    if (initial.length === 0) {
      console.error("proxy catalog: catalog is empty")
      return
    }

    const state = { models: initial }

    await ctx.provider.transform((editor) => {
      editor.remove("opencode-go")
      editor.update(PROVIDER_ID, (provider) => {
        provider.package ??= "@opencode/ai/providers/openai-compatible"
        provider.activation = "enabled"
      })
      editor.models.set(PROVIDER_ID, state.models)
    })

    const refresh = async () => {
      try {
        const next = await load()
        if (next.length === 0) return
        state.models = next
        await ctx.provider.reload()
      } catch (error) {
        console.error("proxy catalog: refresh failed", error)
      }
    }

    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  },
})
