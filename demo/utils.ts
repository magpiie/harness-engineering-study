// step1~3 공통 헬퍼.
// (1) Gemini 무료 티어의 일시 에러(503/429)에 대비한 재시도
// (2) response.text accessor가 functionCall이 있을 때 띄우는 SDK warning을 우회하기 위한 안전한 텍스트 추출

import type { GenerateContentResponse } from '@google/genai'

const RETRY_STATUSES = new Set([429, 503])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function withRetry<T>(
  fn: () => Promise<T>,
  label = 'request',
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      const retryable =
        typeof status === 'number' && RETRY_STATUSES.has(status)
      attempt += 1
      if (!retryable || attempt > MAX_RETRIES) throw err
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1)
      console.warn(
        `[retry] ${label} status=${status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`,
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

// response.text는 getter라서 functionCall이 있을 때 SDK가 console.warn을 띄운다.
// parts에서 text part만 안전하게 모아 그 잡음을 피한다.
export function extractText(res: GenerateContentResponse): string {
  return (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
    .join('')
}
