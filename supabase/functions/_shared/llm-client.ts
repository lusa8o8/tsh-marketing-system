import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

export type LlmTask =
  | 'coordinator'
  | 'classifier'
  | 'reply_writer'
  | 'weekly_planner'
  | 'weekly_copywriter'
  | 'ambassador_writer'
  | 'weekly_reporter'
  | 'performance_analyst'
  | 'competitor_researcher'
  | 'campaign_strategist'
  | 'canonical_copywriter'
  | 'platform_copywriter'
  | 'design_brief_writer'
  | 'campaign_monitor'
  | 'campaign_reporter'
  | 'one_off_writer'

type TextMessage = {
  role: 'user' | 'assistant'
  content: string
}

type GenerateTextParams = {
  task: LlmTask
  system: string
  messages: TextMessage[]
  maxTokens?: number
}

type GenerateJsonParams = GenerateTextParams & {
  fallback?: string
}

const TRANSIENT_STATUS_PATTERNS = [
  'overloaded_error',
  'rate_limit_error',
  'temporarily unavailable',
  'rate limit',
  'overloaded',
  '529',
  '503',
]

const TASK_CONFIG: Record<LlmTask, { model: string; maxTokens: number; retries: number; retryDelayMs: number }> = {
  coordinator: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 600,
    retries: 2,
    retryDelayMs: 700,
  },
  classifier: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 128,
    retries: 2,
    retryDelayMs: 700,
  },
  reply_writer: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 200,
    retries: 2,
    retryDelayMs: 700,
  },
  weekly_planner: {
    model: 'claude-sonnet-4-5',
    maxTokens: 800,
    retries: 2,
    retryDelayMs: 700,
  },
  weekly_copywriter: {
    model: 'claude-sonnet-4-5',
    maxTokens: 300,
    retries: 2,
    retryDelayMs: 700,
  },
  ambassador_writer: {
    model: 'claude-sonnet-4-5',
    maxTokens: 200,
    retries: 2,
    retryDelayMs: 700,
  },
  weekly_reporter: {
    model: 'claude-sonnet-4-5',
    maxTokens: 500,
    retries: 2,
    retryDelayMs: 700,
  },
  performance_analyst: {
    model: 'claude-sonnet-4-5',
    maxTokens: 300,
    retries: 2,
    retryDelayMs: 700,
  },
  competitor_researcher: {
    model: 'claude-sonnet-4-5',
    maxTokens: 200,
    retries: 2,
    retryDelayMs: 700,
  },
  campaign_strategist: {
    model: 'claude-sonnet-4-5',
    maxTokens: 1000,
    retries: 2,
    retryDelayMs: 700,
  },
  canonical_copywriter: {
    model: 'claude-sonnet-4-5',
    maxTokens: 300,
    retries: 2,
    retryDelayMs: 700,
  },
  platform_copywriter: {
    model: 'claude-sonnet-4-5',
    maxTokens: 200,
    retries: 2,
    retryDelayMs: 700,
  },
  design_brief_writer: {
    model: 'claude-sonnet-4-5',
    maxTokens: 500,
    retries: 2,
    retryDelayMs: 700,
  },
  campaign_monitor: {
    model: 'claude-sonnet-4-5',
    maxTokens: 200,
    retries: 2,
    retryDelayMs: 700,
  },
  campaign_reporter: {
    model: 'claude-sonnet-4-5',
    maxTokens: 400,
    retries: 2,
    retryDelayMs: 700,
  },
  one_off_writer: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 300,
    retries: 2,
    retryDelayMs: 700,
  },
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error ?? 'Unknown error')
}

export function isTransientLlmError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return TRANSIENT_STATUS_PATTERNS.some((pattern) => message.includes(pattern))
}

export function createAnthropicClient(apiKey: string) {
  return new Anthropic({ apiKey })
}

export async function generateTextWithAnthropic(
  client: Anthropic,
  params: GenerateTextParams,
) {
  const taskConfig = TASK_CONFIG[params.task]
  let lastError: unknown = null

  for (let attempt = 0; attempt < taskConfig.retries; attempt += 1) {
    try {
      return await client.messages.create({
        model: taskConfig.model,
        max_tokens: params.maxTokens ?? taskConfig.maxTokens,
        system: params.system,
        messages: params.messages,
      })
    } catch (error) {
      lastError = error
      const shouldRetry = isTransientLlmError(error) && attempt < taskConfig.retries - 1
      if (!shouldRetry) {
        throw error
      }
      await sleep(taskConfig.retryDelayMs)
    }
  }

  throw lastError ?? new Error('LLM request failed')
}

export function extractJsonText(text: string, fallback = '{}') {
  try {
    const firstBrace = text.indexOf('{')
    const firstBracket = text.indexOf('[')
    const lastBrace = text.lastIndexOf('}')
    const lastBracket = text.lastIndexOf(']')

    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1) && lastBracket !== -1) {
      return text.slice(firstBracket, lastBracket + 1)
    }

    if (firstBrace !== -1 && lastBrace !== -1) {
      return text.slice(firstBrace, lastBrace + 1)
    }
  } catch (_error) {
    // Fall through to fallback below.
  }

  return fallback
}

export function parseJsonText<T>(text: string, fallback = '{}'): T {
  return JSON.parse(extractJsonText(text, fallback)) as T
}

export async function generateJsonWithAnthropic<T>(
  client: Anthropic,
  params: GenerateJsonParams,
): Promise<T> {
  const response = await generateTextWithAnthropic(client, params)
  const rawText = response.content
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text)
    .join('\n')

  return parseJsonText<T>(rawText, params.fallback ?? '{}')
}


