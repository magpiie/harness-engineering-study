// Step 3 — tool-use 루프 추가.
// Step 2를 while 루프로 감싸 모델이 end_turn(혹은 더 이상 tool_use가 없음)을 줄 때까지
// 반복 호출한다. 이 시점부터 시스템은 비로소 "agent"로 동작한다.
// 가드레일: max_turns만 두고 그 외는 최소화 (Step 4에서 메모리, Step 5에서 SDK).

import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT =
  '이 demo 폴더의 step 파일들이 각각 어떤 일을 하는지 한 줄씩 정리해줘.'

const client = new Anthropic()
const MAX_TURNS = 10

const tools: Anthropic.Tool[] = [
  {
    name: 'list_directory',
    description:
      '지정된 디렉토리 안의 파일·폴더 이름을 나열한다. 경로는 demo 폴더 루트 기준 상대경로.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '예: ".", "subdir"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description:
      '지정된 파일의 내용을 읽는다. 경로는 demo 폴더 루트 기준 상대경로.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '예: "step1_bare_call.ts"' },
      },
      required: ['path'],
    },
  },
]

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const targetPath = path.resolve(import.meta.dirname, String(input.path))
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

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: PROMPT },
  ]

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools,
      messages,
    })

    console.log(`\n=== Turn ${turn} (stop_reason: ${res.stop_reason}) ===`)
    for (const block of res.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`[assistant text] ${block.text}`)
      }
    }
    messages.push({ role: 'assistant', content: res.content })

    // tool_use가 없으면 모델이 답을 마쳤다는 뜻 — 루프 종료
    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) {
      console.log('\n--- 루프 종료: 모델이 도구 호출 없이 답을 마침 ---')
      return
    }

    // 모든 tool_use를 실행하고 한 번에 tool_result로 주입 (Anthropic API 규약)
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      console.log(`[tool call] ${tu.name}(${JSON.stringify(tu.input)})`)
      try {
        const result = await executeTool(
          tu.name,
          tu.input as Record<string, unknown>,
        )
        console.log(`[tool result] ${preview(result)}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`[tool error] ${msg}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: `Error: ${msg}`,
          is_error: true,
        })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  console.log(`\n--- 루프 종료: MAX_TURNS(${MAX_TURNS}) 도달, 가드레일 작동 ---`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
