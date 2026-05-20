// Step 1 — Bare LLM 호출.
// 도구도 없고 루프도 없다. 그래서 "현재 폴더의 .ts 파일을 알려달라"는 질문에
// 모델은 실제 파일을 보지 못한 채 추측하거나 답할 수 없다고 말한다.
// 이 한계가 Step 2부터 도구·루프를 붙여야 하는 이유다.

import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'

const PROMPT = '지금 이 demo 폴더 안에 어떤 .ts 파일들이 있는지 알려줘.'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

async function main() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: PROMPT,
  })

  console.log('--- Prompt ---')
  console.log(PROMPT)

  console.log('\n--- Model response ---')
  console.log(response.text)

  console.log('\n--- finishReason ---', response.candidates?.[0]?.finishReason)
  console.log('--- usageMetadata ---', response.usageMetadata)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
