# 시나리오 3단계: 하네스 엔지니어링 — 사내 Notion Q&A 봇

## 공통 시나리오 배경

[**docs/01의 5.4 흐름**](../01-what-is-harness-engineering.md#54-프롬프트--컨텍스트--하네스-엔지니어링-점진적-확장의-흐름)을 손에 잡히게 보여주기 위해, 세 시나리오는 **같은 문제**를 두고 단계만 한 칸씩 올린다.

> **문제**: 우리 회사는 Notion에 사내 위키(개발 가이드, 운영 룰, 온보딩 문서, 회의록 등)를 운영한다. 신입 개발자가 *"스테이징 환경에 어떻게 배포하나요?"*, *"코드 리뷰 룰이 어떻게 돼요?"* 같은 질문을 매번 사람에게 물어본다. 이걸 자동으로 답해주는 사내 Q&A 봇을 만들고 싶다.

세 시나리오:
- **(1단계)** [프롬프트 엔지니어링](./prompt-engineering.md)
- **(2단계)** [컨텍스트 엔지니어링](./context-engineering.md)
- **(3단계)** [하네스 엔지니어링 — 이 문서](./harness-engineering.md)

[2단계](./context-engineering.md)에서 막힌 지점은 **"여전히 1회 호출이라 봇이 능동적으로 행동할 수 없다"** 는 것이었다. 이 단계는 그걸 해결한다.

---

## 1. 이 단계가 다루는 문제

**LLM 외부 인프라 전체. 프롬프트·컨텍스트뿐 아니라 도구·루프·메모리·권한·외부 시스템 통합까지.**

- 모델이 **그때그때 능동적으로** "지금 어떤 도구를 어떤 인자로 부를지" 결정한다
- 도구 실행 결과를 보고 **다음 결정**을 한다 (재검색·교차확인·다음 액션)
- 권한·로깅·메모리 같은 운영 기능이 같이 붙는다

---

## 2. 단계별 구현 흐름

### 2.1 도구 정의 (JSON Schema)

봇이 부를 수 있는 도구 셋. 각 도구는 모델에 노출되는 `name`·`description`·`input_schema`로 선언된다.

```typescript
const tools = [
  {
    name: 'searchWiki',
    description: '사내 Notion 위키에서 의미 검색으로 관련 문서를 찾는다.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: '검색 키워드' } },
      required: ['query'],
    },
  },
  {
    name: 'searchSlack',
    description: '특정 채널에서 최근 N일간의 메시지를 검색한다.',
    input_schema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        query: { type: 'string' },
        days: { type: 'number' },
      },
      required: ['channel', 'query'],
    },
  },
  {
    name: 'searchGitHubPRs',
    description: '특정 레포의 머지된 PR을 검색한다.',
    input_schema: {
      type: 'object',
      properties: { repo: { type: 'string' }, query: { type: 'string' } },
      required: ['repo', 'query'],
    },
  },
  {
    name: 'askExpert',
    description: '사내 담당자에게 슬랙 DM으로 질문을 위임한다. 사용자 승인이 필요하다.',
    input_schema: {
      type: 'object',
      properties: { personId: { type: 'string' }, question: { type: 'string' } },
      required: ['personId', 'question'],
    },
  },
]
```

이 단계의 핵심은 **`searchWiki` 하나만 있던 2단계와 달리, 모델이 여러 도구 중 하나를 선택할 수 있다**는 것이다.

### 2.2 시스템 프롬프트 (작업 방식 정의)

```typescript
const SYSTEM = `너는 우리 회사 사내 Q&A 봇이다.
신입 개발자가 회사 운영·개발 룰·도구 사용법을 물으면 답한다.

원칙:
1. 답하기 전 항상 도구를 사용해 검증한다. 먼저 searchWiki를 시도한다.
2. 위키에 부족하면 searchSlack 또는 searchGitHubPRs로 추가 검색한다.
3. 그래도 모르면 askExpert로 사람에게 위임한다 (자동 실행 금지, 사용자 승인 후).
4. 모든 답에 출처(위키 문서 ID, 슬랙 메시지, PR 번호 등)를 명시한다.
5. 추측하지 않는다.`
```

### 2.3 도구 호출 루프 (Tool-use loop)

```typescript
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

async function agentLoop(userQ: string) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userQ }]

  for (let turn = 0; turn < 10; turn++) {           // 가드레일: 최대 10턴
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      tools,
      messages,
    })

    messages.push({ role: 'assistant', content: res.content })

    // 도구 호출이 없으면 종료
    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (toolUses.length === 0) return res.content

    // 도구들을 실행하고 결과를 다시 모델에게 주입
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      // 권한: askExpert는 사용자 승인 필요
      if (tu.name === 'askExpert' && !(await confirmWithUser(tu.input))) {
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'User denied.' })
        continue
      }
      const result = await executeTool(tu.name, tu.input)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
    }
    messages.push({ role: 'user', content: toolResults })
  }
}
```

핵심은 `for` 루프 한 줄. **모델이 "도구를 더 부를지 / 이제 답을 마무리할지" 를 매 턴마다 스스로 결정**한다. 2단계의 1회 호출과 가장 큰 차이.

### 2.4 흐름 예시 — 실제로 어떻게 도는가

사용자 질문: *"스테이징 환경에 배포하려면 어떻게 해?"*

```
[Turn 1] 모델: searchWiki({query: "스테이징 배포"}) 호출
   하네스: Chroma에서 검색 후 결과 반환
   → "Deployment Guide" 발견. 단, 마지막 업데이트가 2024년.

[Turn 2] 모델: "위키가 오래됐을 수 있다. 최근 변경분 확인해야겠다."
        searchSlack({channel: "#dev-ops", query: "스테이징 배포", days: 90}) 호출
   하네스: Slack API로 메시지 검색
   → "지난주에 워크플로우 이름이 staging-deploy로 변경됐다"는 메시지 발견

[Turn 3] 모델: "PR로도 확인하자."
        searchGitHubPRs({repo: "infra", query: "staging deploy workflow"}) 호출
   하네스: GitHub API로 PR 검색
   → PR #1234가 워크플로우 이름을 변경했음 확인

[Turn 4] 모델: 더 이상 도구 호출 없이 최종 답 생성
   "스테이징 배포는 GitHub Actions의 `staging-deploy` 워크플로우를 실행하면 됩니다.
    출처:
    - Deployment Guide (Notion)
    - #dev-ops 슬랙 메시지 (2026-04-15)
    - PR #1234"
```

[2단계 컨텍스트 엔지니어링](./context-engineering.md)에서는 turn 1에서 끝나 *"위키에는 이렇게 적혀 있어요 (2024년 기준)"* 라는 부정확한 답이 나왔을 것이다. 이 단계는 모델이 스스로 *"이건 검증이 더 필요하다"* 라고 결정해 추가 도구를 부른다.

### 2.5 권한 · 메모리 · MCP — 운영급으로 가는 추가 장치

- **권한**: `askExpert`처럼 외부에 영향 주는 도구는 사용자 승인을 거친다. 사내 정보 검색만 하는 `searchWiki/Slack/GitHub`은 자동 실행. ([docs/01 4.(5) 권한 시스템](../01-what-is-harness-engineering.md#5-권한-시스템-permissions--sandboxing))
- **메모리**: 자주 묻는 질문은 별도 파일에 저장. 다음번 같은 질문이 오면 *"지난번에 답한 게 있다"* 로 빠른 답. ([docs/01 4.(4) 메모리](../01-what-is-harness-engineering.md#4-메모리-claudemd--auto-memory--multi-session))
- **MCP**: `searchWiki`를 직접 구현하는 대신 [Notion MCP 서버](https://modelcontextprotocol.io/)를 연결. Slack/GitHub도 마찬가지. 도구 코드를 새로 짤 필요 없이 MCP 서버를 붙이기만 한다.

### 2.6 코드량 비교

| 구현 방식 | 코드량 |
|---|---|
| 1단계 프롬프트 엔지니어링 | ~30줄 |
| 2단계 컨텍스트 엔지니어링 (RAG) | ~50~80줄 |
| 3단계 하네스 엔지니어링 (직접 구현) | ~300~500줄 (루프 + 권한 + 메모리 + 로깅 + 평가) |
| 3단계 하네스 엔지니어링 (Claude Agent SDK 사용) | **~100줄** |

본 프로젝트의 [`../../demo/`](../../demo/) 폴더가 이 세 구간을 Step 1~5로 점진 구현한다.

---

## 3. 이 단계가 도달한 곳

1단계·2단계에서 막혔던 모든 것:

- ✅ 사용자가 위키를 직접 고르지 않아도 됨 (모델이 능동적으로 검색)
- ✅ 위키에 없으면 슬랙·PR로 자동 fallback
- ✅ 검색 결과를 보고 모델이 "더 검증해야겠다"고 결정 가능
- ✅ 외부 시스템에 행동 가능 (askExpert로 사람에게 핑)
- ✅ 권한·로깅·메모리 같은 운영 기능 추가 가능

이게 [docs/01의 5장](../01-what-is-harness-engineering.md#5-하네스-엔지니어링이란--심화) 에서 본 *"같은 모델, 다른 결과"* 의 정체다. 모델은 그대로지만, 그 위에 올라간 **시스템 전체 설계**가 결과를 완전히 바꾼다.

---

## 4. 핵심 메시지

> 하네스 엔지니어링은 **LLM 외부 인프라 전체** — 프롬프트·컨텍스트·도구·루프·메모리·권한·외부 시스템 통합 — 를 설계하는 일이다.
> 
> 프롬프트 엔지니어링(글쓰기) → 컨텍스트 엔지니어링(정보 큐레이션) → 하네스 엔지니어링(**시스템 설계**) 로 관심사가 확장된다.

## 5. 1차 출처

- Anthropic Engineering — *Building agents with the Claude Agent SDK*: <https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk>
- Anthropic Engineering — *Effective harnesses for long-running agents*: <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Anthropic Docs — *Tool use overview*: <https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview>
- Claude Agent SDK overview: <https://docs.claude.com/en/api/agent-sdk/overview>
- Model Context Protocol: <https://modelcontextprotocol.io/>
