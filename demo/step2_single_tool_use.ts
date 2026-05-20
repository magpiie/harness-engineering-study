// Step 2 — Tool-use 1회.
// list_directory 도구를 1개 정의하고, 모델이 tool_use를 반환하면
// 하네스가 한 번 실행해 tool_result를 돌려준 뒤 그대로 종료한다.
// 루프는 다음 Step 3. 모델이 또 도구를 호출하려 해도 여기선 무시한다.

import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = '지금 이 demo 폴더 안에 어떤 .ts 파일들이 있는지 알려줘.'

const client = new Anthropic()

const tools: Anthropic.Tool[] = [
  {
    name: 'list_directory',
    description:
      '지정된 디렉토리 안의 파일·폴더 이름을 나열한다. 경로는 demo 폴더 루트 기준 상대경로.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '나열할 디렉토리 경로 (예: ".", "subdir")',
        },
      },
      required: ['path'],
    },
  },
]

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === 'list_directory') {
    const dir = path.resolve(import.meta.dirname, String(input.path))
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

  // 1) 첫 LLM 호출 — 도구를 노출하여 모델이 부르도록 유도
  const first = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools,
    messages: [{ role: 'user', content: PROMPT }],
  })

  console.log('\n--- Turn 1 stop_reason ---', first.stop_reason)

  const toolUses = first.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )

  if (toolUses.length === 0) {
    console.log('\n--- Model response (no tool was called) ---')
    for (const block of first.content) {
      if (block.type === 'text') console.log(block.text)
    }
    return
  }

  // 2) 도구를 1회 실행 — 루프 없음 (Step 3가 그 차이)
  const tu = toolUses[0]
  console.log(`\n--- Tool call: ${tu.name}(${JSON.stringify(tu.input)}) ---`)
  const result = await executeTool(
    tu.name,
    tu.input as Record<string, unknown>,
  )
  console.log('--- Tool result ---')
  console.log(result)

  // 3) tool_result를 주입해 한 번 더 LLM 호출
  const second = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools,
    messages: [
      { role: 'user', content: PROMPT },
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: tu.id, content: result },
        ],
      },
    ],
  })

  console.log('\n--- Turn 2 stop_reason ---', second.stop_reason)
  console.log('--- Final model response ---')
  for (const block of second.content) {
    if (block.type === 'text') console.log(block.text)
  }

  // 모델이 추가 도구 호출을 했어도 Step 2는 1회만 처리하고 무시한다 (Step 3에서 루프).
  const more = second.content.filter((b) => b.type === 'tool_use')
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
