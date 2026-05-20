// Step 3 — Function calling 루프 (Gemini manual mode).
// Step 2를 while 루프로 감싸 모델이 더 이상 functionCall을 반환하지 않을 때까지 반복 호출.
// 이 시점부터 시스템은 비로소 "agent"로 동작한다.
// 가드레일: MAX_TURNS만 두고 그 외는 최소화 (Step 4에서 메모리, Step 5에서 SDK).

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

const PROMPT =
  '이 demo 폴더의 step 파일들이 각각 어떤 일을 하는지 한 줄씩 정리해줘.'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MAX_TURNS = 10

const tools: FunctionDeclaration[] = [
  {
    name: 'list_directory',
    description:
      '지정된 디렉토리 안의 파일·폴더 이름을 나열한다. 경로는 demo 폴더 루트 기준 상대경로.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: '예: ".", "subdir"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description:
      '지정된 파일의 내용을 읽는다. 경로는 demo 폴더 루트 기준 상대경로.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: '예: "step1_bare_call.ts"' },
      },
      required: ['path'],
    },
  },
]

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const targetPath = path.resolve(import.meta.dirname, String(args.path))
  if (name === 'list_directory') {
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    return entries
      .map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`)
      .join('\n')
  }
  if (name === 'read_file') {
    return await fs.readFile(targetPath, 'utf8')
  }
  return `Unknown tool: ${name}`
}

function preview(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max)} ... (총 ${s.length}자)` : s
}

async function main() {
  console.log('--- Prompt ---')
  console.log(PROMPT)

  const contents: Content[] = [{ role: 'user', parts: [{ text: PROMPT }] }]

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        tools: [{ functionDeclarations: tools }],
        automaticFunctionCalling: { disable: true },
      },
    })

    console.log(
      `\n=== Turn ${turn} (finishReason: ${res.candidates?.[0]?.finishReason}) ===`,
    )

    const text = res.text
    if (text && text.trim()) {
      console.log(`[assistant text] ${text}`)
    }

    const calls = res.functionCalls ?? []
    if (calls.length === 0) {
      console.log('\n--- 루프 종료: 모델이 도구 호출 없이 답을 마침 ---')
      return
    }

    // 모델 turn(functionCall 포함)을 contents에 누적
    contents.push(res.candidates![0].content!)

    // 모든 functionCall을 실행하고 한 번에 functionResponse parts로 주입
    const responseParts: Part[] = []
    for (const fc of calls) {
      console.log(`[tool call] ${fc.name}(${JSON.stringify(fc.args)})`)
      try {
        const result = await executeTool(fc.name ?? '', fc.args ?? {})
        console.log(`[tool result] ${preview(result)}`)
        responseParts.push({
          functionResponse: {
            name: fc.name,
            id: fc.id,
            response: { result },
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`[tool error] ${msg}`)
        responseParts.push({
          functionResponse: {
            name: fc.name,
            id: fc.id,
            response: { error: msg },
          },
        })
      }
    }
    contents.push({ role: 'user', parts: responseParts })
  }

  console.log(`\n--- 루프 종료: MAX_TURNS(${MAX_TURNS}) 도달, 가드레일 작동 ---`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
