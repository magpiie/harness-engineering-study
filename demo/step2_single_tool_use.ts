// Step 2 — Function calling 1회 (Gemini manual mode).
// list_directory 도구를 1개 정의하고, 모델이 functionCall을 반환하면
// 하네스가 한 번 실행해 functionResponse를 돌려준 뒤 그대로 종료한다.
// 루프는 다음 Step 3. 모델이 또 호출하려 해도 여기선 무시한다.

import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
} from '@google/genai'
import { extractText, withRetry } from './utils.ts'

const PROMPT = '지금 이 demo 폴더 안에 어떤 .ts 파일들이 있는지 알려줘.'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const listDirectory: FunctionDeclaration = {
  name: 'list_directory',
  description:
    '지정된 디렉토리 안의 파일·폴더 이름을 나열한다. 경로는 demo 폴더 루트 기준 상대경로.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: '나열할 디렉토리 경로 (예: ".", "subdir")',
      },
    },
    required: ['path'],
  },
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === 'list_directory') {
    const dir = path.resolve(import.meta.dirname, String(args.path))
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`)
      .join('\n')
  }
  return `Unknown tool: ${name}`
}

async function main() {
  console.log('--- Prompt ---')
  console.log(PROMPT)

  const contents: Content[] = [{ role: 'user', parts: [{ text: PROMPT }] }]

  // 1) 첫 호출 — 도구를 노출하여 모델이 부르도록 유도
  const first = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          tools: [{ functionDeclarations: [listDirectory] }],
          automaticFunctionCalling: { disable: true },
        },
      }),
    'turn 1',
  )

  console.log('\n--- Turn 1 finishReason ---', first.candidates?.[0]?.finishReason)

  const calls = first.functionCalls ?? []
  if (calls.length === 0) {
    console.log('\n--- Model response (no tool was called) ---')
    console.log(extractText(first))
    return
  }

  // 2) 도구를 1회 실행 — 루프 없음 (Step 3가 그 차이)
  const fc = calls[0]
  console.log(`\n--- Tool call: ${fc.name}(${JSON.stringify(fc.args)}) ---`)
  const result = await executeTool(fc.name ?? '', fc.args ?? {})
  console.log('--- Tool result ---')
  console.log(result)

  // 3) functionResponse를 주입해 한 번 더 호출
  contents.push(first.candidates![0].content!)
  contents.push({
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: fc.name,
          id: fc.id,
          response: { result },
        },
      },
    ] as Part[],
  })

  const second = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          tools: [{ functionDeclarations: [listDirectory] }],
          automaticFunctionCalling: { disable: true },
        },
      }),
    'turn 2',
  )

  console.log('\n--- Turn 2 finishReason ---', second.candidates?.[0]?.finishReason)
  console.log('--- Final model response ---')
  console.log(extractText(second))

  // 모델이 추가 도구를 호출했어도 Step 2는 1회로 끝 (루프는 Step 3)
  const more = second.functionCalls ?? []
  if (more.length > 0) {
    console.log(
      `\n(주: 모델이 추가 도구를 ${more.length}개 더 호출하려 했지만 Step 2는 1회 호출이므로 무시. 루프는 Step 3.)`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
