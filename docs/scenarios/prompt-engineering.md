# 시나리오 1단계: 프롬프트 엔지니어링 — 사내 Notion Q&A 봇

## 공통 시나리오 배경

[**docs/01의 5.4 흐름**](../01-what-is-harness-engineering.md#54-프롬프트--컨텍스트--하네스-엔지니어링-점진적-확장의-흐름)을 손에 잡히게 보여주기 위해, 세 시나리오는 **같은 문제**를 두고 단계만 한 칸씩 올린다.

> **문제**: 우리 회사는 Notion에 사내 위키(개발 가이드, 운영 룰, 온보딩 문서, 회의록 등)를 운영한다. 신입 개발자가 *"스테이징 환경에 어떻게 배포하나요?"*, *"코드 리뷰 룰이 어떻게 돼요?"* 같은 질문을 매번 사람에게 물어본다. 이걸 자동으로 답해주는 사내 Q&A 봇을 만들고 싶다.

세 시나리오:
- **(1단계)** [프롬프트 엔지니어링 — 이 문서](./prompt-engineering.md)
- **(2단계)** [컨텍스트 엔지니어링](./context-engineering.md)
- **(3단계)** [하네스 엔지니어링](./harness-engineering.md)

---

## 1. 이 단계가 다루는 문제

**한정된 자원: 1회 LLM 호출의 텍스트 자체.**

- 도구 없음
- 외부 검색 없음
- 루프 없음
- 엔지니어가 LLM에 줄 수 있는 건 **한 번의 프롬프트(텍스트)** 뿐이다

엔지니어의 모든 고민이 그 한 덩어리 프롬프트 안에 들어간다.

---

## 2. 단계별 구현 흐름

### 2.1 출발점 — 그냥 물어보기

```
사용자가 ChatGPT / Claude.ai 채팅창에 직접 묻는다:
> "스테이징 환경에 배포하려면 어떻게 해?"
```

당연히 LLM은 모른다. 우리 회사 위키에 적힌 내용이 모델 학습 데이터에 없기 때문이다. 모델은 환각으로 일반론을 답한다 (*"보통 staging 브랜치에 push하면..."* 같은).

### 2.2 위키 문서를 사용자가 직접 복사해 넣기

```
> "다음 문서를 기반으로 답해줘.
> 
> [Notion 위키 'Deployment Guide' 페이지 본문 약 3000 토큰 분량 복사 붙여넣기]
> 
> 질문: 스테이징 환경에 배포하려면 어떻게 해?"
```

이제 LLM이 답할 수 있다. 단, 사용자가 매번 **어떤 문서를 골라 붙여야 하는지** 를 직접 알아야 한다. 위키가 200개라면 어디 있는지 찾는 데만 시간이 든다. 그리고 답은 단답이고, 부족하면 끝.

### 2.3 프롬프트 엔지니어링이 시작되는 지점

엔지니어가 할 수 있는 일은 **그 한 번의 프롬프트의 품질**을 끌어올리는 것이다. 대표 기법 네 가지를 한꺼번에 묶어 보자.

**(a) Role prompt — 역할 지정**
```
너는 우리 회사 사내 Q&A 봇이다.
신입 개발자를 도와주는 친절한 답변자다.
모르는 건 "모르겠다"고 답한다. 절대 추측하지 않는다.
```

**(b) Few-shot examples — 예시 주입**
```
다음은 답변 예시들이다.

Q: 코드 리뷰 룰?
A: 최소 1명 승인 + CI 통과 + 컨플릭트 해결. (출처: Code Review Guide)

Q: 휴가는 며칠?
A: 모르겠다. 사내 위키에 명시되지 않음.

이제 실제 질문에 답해줘.
```

**(c) Output format 지정 — 구조화된 출력**
```
답은 다음 JSON 포맷으로만:
{
  "answer": "...",
  "sources": ["문서 제목"],
  "confidence": "high" | "medium" | "low"
}
```

**(d) Chain-of-thought — 단계적 추론 유도**
```
Step by step으로 생각하고 답해줘.
1. 문서에서 관련된 부분을 먼저 인용
2. 그 인용을 바탕으로 답
3. 답이 부족하면 어떤 정보가 더 필요한지 명시
```

### 2.4 코드 (TypeScript, ~30줄)

```typescript
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM = `너는 우리 회사 사내 Q&A 봇이다.
모르는 건 "모르겠다"고 답한다. 절대 추측하지 않는다.

답은 다음 JSON 포맷으로만:
{ "answer": "...", "sources": [...], "confidence": "high"|"medium"|"low" }

다음은 예시다.
Q: 코드 리뷰 룰?
A: {"answer":"최소 1명 승인 + CI 통과 + 컨플릭트 해결","sources":["Code Review Guide"],"confidence":"high"}
`

async function answer(userQ: string, wikiDoc: string) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `[위키 문서]\n${wikiDoc}\n\n질문: ${userQ}`,
    }],
  })
  return res.content
}
```

LLM 호출은 **딱 한 번.** 사용자가 위키 문서(`wikiDoc`)와 질문(`userQ`)을 둘 다 미리 줘야 한다.

---

## 3. 이 단계가 도달한 곳 / 막힌 곳

**도달**: 같은 모델·같은 질문이어도 응답 품질이 눈에 띄게 좋아진다. JSON 출력이라 후속 코드에서 다루기 쉽고, 추측이 줄고, 출처가 붙는다.

**막힘**:
1. **위키가 200개일 때 어떤 걸 골라야 할지 모름.** 사용자가 매번 직접 찾아 붙여야 한다.
2. **컨텍스트 윈도우 한계.** 위키 전체를 한 번에 넣을 수 없다 (모델 한도가 200K 토큰이어도 토큰당 비용이 든다).
3. **여러 출처 결합 불가.** Notion + Slack + GitHub PR 같은 다양한 정보를 한 번에 못 다룬다.
4. **답이 부족할 때 더 검색 못 함.** 1회 호출로 끝.

→ 다음 단계 [컨텍스트 엔지니어링](./context-engineering.md): "어떤 문서를 어떻게 컨텍스트에 자동으로 채울지" 설계로 확장한다.

---

## 4. 핵심 메시지

> 프롬프트 엔지니어링은 **"한 번의 LLM 호출의 텍스트 자체"** 를 잘 짜는 일이다. 도구도 루프도 없고, 외부 시스템과의 연결도 없다. **글쓰기 기술**에 가깝다.

## 5. 1차 출처

- Anthropic Docs — *Prompt engineering overview*: <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview>
- Anthropic Docs — *Be clear and direct*: <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct>
- Anthropic Docs — *Use examples (multishot prompting)*: <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting>
- Anthropic Docs — *Chain of thought*: <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought>
- Anthropic Docs — *Increase output consistency (JSON)*: <https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/increase-consistency>
