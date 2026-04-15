import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

export type LlmTask =
  | 'coordinator'
  | 'classifier'
  | 'reply_writer'
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