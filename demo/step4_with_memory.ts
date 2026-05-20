// Step 4 — 메모리 추가.
// 시작 시 CLAUDE.md와 memory/*.md를 모두 읽어 systemInstruction에 자동 합성한다.
// 모델은 save_memory 도구로 학습한 사실을 영구 저장한다.
// 같은 스크립트를 두 번 실행하면 2회차에서 1회차 메모리를 활용한 더 풍부한 답이 나온다.
// 이게 multi-session 메모리의 효과.

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

const DEMO_ROOT = import.meta.dirname
const MEMORY_DIR = path.join(DEMO_ROOT, 'memory')

const PROMPT =
  '이 demo 폴더를 분석하고, 다른 세션에서도 유용할 핵심 인사이트 한두 개를 메모리에 저장해줘. ' +
  '이미 저장된 메모리가 있다면 그걸 활용해서 답하고, 중복 저장은 피해.'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MAX_TURNS = 10

async function buildSystemPrompt(): Promise<string> {
  const sections: string[] = []

  // CLAUDE.md — 프로젝트 영구 지식
  try {
    const claudeMd = await fs.readFile(
      path.join(DEMO_ROOT, 'CLAUDE.md'),
      'utf8',
    )
    sections.push(`## CLAUDE.md (프로젝트 영구 지식)\n\n${claudeMd}`)
  } catch {
    // CLAUDE.md 없으면 skip
  }

  // memory/*.md — 지난 세션에서 누적된 메모리
  try {
    const memFiles = (await fs.readdir(MEMORY_DIR))
      .filter((f) => f.endsWith('.md'))
      .sort()
    const memContents: string[] = []
    for (const fname of memFiles) {
      const content = await fs.readFile(path.join(MEMORY_DIR, fname), 'utf8')
      memContents.push(`### ${fname}\n${content}`)
    }
    sections.push(
      memContents.length > 0
        ? `## 지난 세션 메모리 (memory/)\n\n${memContents.join('\n\n')}`
        : `## 지난 세션 메모리 (memory/)\n\n_없음 — 이번이 첫 세션이다._`,
    )
  } catch {
    sections.push(
      `## 지난 세션 메모리 (memory/)\n\n_memory/ 폴더 없음 — 이번이 첫 세션이다._`,
    )
  }

  return `너는 우리 demo 폴더를 분석하는 어시스턴트다.

원칙:
1. 학습한 새 사실 중 다음 세션에도 유용할 것은 save_memory로 저장한다.
2. 이미 메모리에 있는 내용은 반복하지 말고 그 위에서 답한다.
3. 답 마지막에 이번 세션에서 새로 저장한 메모리(있다면)와 활용한 메모리를 명시한다.

${sections.join('\n\n---\n\n')}`
}

const tools: FunctionDeclaration[] = [
  {
    name: 'list_directory',
    description: '지정된 디렉토리 안의 파일·폴더 이름을 나열한다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: '예: ".", "memory"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: '지정된 파일의 내용을 읽는다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: '예: "step1_bare_call.ts"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'save_memory',
    description:
      '다음 세션에서도 활용할 가치 있는 사실을 memory/<filename>에 저장한다. 파일명은 소문자 kebab-case + .md 확장자.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filename: {
          type: Type.STRING,
          description: '확장자 포함 (예: "key-insight.md")',
        },
        content: { type: Type.STRING, description: '저장할 내용 (마크다운)' },
      },
      required: ['filename', 'content'],
    },
  },
]

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === 'list_directory') {
    const dir = path.resolve(DEMO_ROOT, String(args.path))
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`)
      .join('\n')
  }
  if (name === 'read_file') {
    return await fs.readFile(
      path.resolve(DEMO_ROOT, String(args.path)),
      'utf8',
    )
  }
  if (name === 'save_memory') {
    await fs.mkdir(MEMORY_DIR, { recursive: true })
    const fname = String(args.filename)
    const file = path.join(MEMORY_DIR, fname)
    await fs.writeFile(file, String(args.content), 'utf8')
    return `Saved ${fname} (${String(args.content).length} bytes)`
  }
  return `Unknown tool: ${name}`
}

function preview(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max)} ... (총 ${s.length}자)` : s
}

async function main() {
  console.log('--- Prompt ---')
  console.log(PROMPT)

  const systemPrompt = await buildSystemPrompt()
  console.log('\n--- System prompt (preview) ---')
  console.log(preview(systemPrompt, 600))

  const contents: Content[] = [{ role: 'user', parts: [{ text: PROMPT }] }]

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await withRetry(
      () =>
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: tools }],
            automaticFunctionCalling: { disable: true },
          },
        }),
      `turn ${turn}`,
    )

    console.log(
      `\n=== Turn ${turn} (finishReason: ${res.candidates?.[0]?.finishReason}) ===`,
    )
    const text = extractText(res)
    if (text.trim()) {
      console.log(`[assistant text] ${text}`)
    }

    const calls = res.functionCalls ?? []
    if (calls.length === 0) {
      console.log('\n--- 루프 종료: 모델이 도구 호출 없이 답을 마침 ---')
      return
    }

    contents.push(res.candidates![0].content!)

    const responseParts: Part[] = []
    for (const fc of calls) {
      console.log(
        `[tool call] ${fc.name}(${preview(JSON.stringify(fc.args ?? {}))})`,
      )
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
