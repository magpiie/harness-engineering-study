# 시나리오 2단계: 컨텍스트 엔지니어링 — 사내 Notion Q&A 봇

## 공통 시나리오 배경

[**docs/01의 5.4 흐름**](../01-what-is-harness-engineering.md#54-프롬프트--컨텍스트--하네스-엔지니어링-점진적-확장의-흐름)을 손에 잡히게 보여주기 위해, 세 시나리오는 **같은 문제**를 두고 단계만 한 칸씩 올린다.

> **문제**: 우리 회사는 Notion에 사내 위키(개발 가이드, 운영 룰, 온보딩 문서, 회의록 등)를 운영한다. 신입 개발자가 *"스테이징 환경에 어떻게 배포하나요?"*, *"코드 리뷰 룰이 어떻게 돼요?"* 같은 질문을 매번 사람에게 물어본다. 이걸 자동으로 답해주는 사내 Q&A 봇을 만들고 싶다.

세 시나리오:
- **(1단계)** [프롬프트 엔지니어링](./prompt-engineering.md)
- **(2단계)** [컨텍스트 엔지니어링 — 이 문서](./context-engineering.md)
- **(3단계)** [하네스 엔지니어링](./harness-engineering.md)

[1단계](./prompt-engineering.md)에서 막힌 지점은 **"사용자가 위키 문서를 매번 직접 골라 붙여야 한다"** 는 것이었다. 이 단계는 그걸 자동화한다.

---

## 1. 이 단계가 다루는 문제

**한정된 자원: 컨텍스트 윈도우. 무한한 정보 중 무엇을 어떤 형태로 채울지.**

- 도구도 루프도 여전히 없다 (그건 [다음 단계](./harness-engineering.md))
- 단, **사용자 질문에 따라 어떤 문서를 컨텍스트에 넣을지** 를 시스템이 자동으로 결정한다
- 이게 RAG (Retrieval-Augmented Generation)의 핵심 아이디어

Anthropic의 정의를 그대로 인용하면:

> *"Context engineering is the art and science of curating what will go into the limited context window from the universe of possible information."*  
> — Anthropic, *Effective context engineering for AI agents* ([anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

---

## 2. 단계별 구현 흐름

### 2.1 사전 작업 — 위키를 임베딩해서 벡터 DB에 적재

```
[Notion 위키 200개 페이지]
        ↓
[페이지를 적당한 단위(chunk)로 쪼개기]   예: 500 토큰씩
        ↓
[각 chunk를 임베딩 모델로 벡터화]        예: voyage-2, text-embedding-3
        ↓
[벡터 DB에 저장]                         예: Chroma, Pinecone, pgvector
```

이 인덱싱 파이프라인은 매일 또는 매시간 백그라운드로 한 번씩 돌려서 위키 변경분을 반영한다.

### 2.2 사용자 질문이 오면 (검색 + 답변)

```
"스테이징 환경에 배포하려면 어떻게 해?"
        ↓
[이 질문도 같은 임베딩 모델로 벡터화]
        ↓
[벡터 DB에서 의미상 가장 가까운 chunk top-5 검색]
        ↓
[검색된 chunk들을 LLM 프롬프트의 컨텍스트로 자동 주입]
        ↓
[LLM이 답 생성]
```

이제 사용자는 위키 문서를 직접 고르거나 복사할 필요가 없다. 질문만 던지면 시스템이 알아서 관련 부분을 찾아 모델에게 넣어준다.

### 2.3 코드 (TypeScript, ~50줄 핵심 발췌)

```typescript
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { ChromaClient } from 'chromadb'

const client = new Anthropic()
const chroma = new ChromaClient()
const collection = await chroma.getCollection({ name: 'company-wiki' })

const SYSTEM = `너는 사내 Q&A 봇이다.
아래 [관련 위키 문서]의 내용으로만 답한다.
컨텍스트에 없으면 "모르겠다"고 답한다.
답은 JSON 포맷으로: {"answer":"...","sources":[...],"confidence":"..."}`

async function answer(userQ: string) {
  // 1) 의미적으로 가까운 위키 chunk 5개 검색
  const results = await collection.query({
    queryTexts: [userQ],
    nResults: 5,
  })
  const context = results.documents[0].join('\n---\n')

  // 2) 그 결과를 컨텍스트로 넣어 LLM 1회 호출
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `[관련 위키 문서]\n${context}\n\n질문: ${userQ}`,
    }],
  })
  return res.content
}
```

코드량은 1단계의 30줄에서 50~80줄로 늘었다. 주요 추가:
- **임베딩 인덱싱 파이프라인** (위키 → chunk → 벡터 DB)
- **검색 단계** (질문 임베딩 → DB 쿼리)
- **컨텍스트 조립 단계** (검색 결과를 프롬프트에 자동 주입)

### 2.4 컨텍스트 엔지니어링의 다른 기법들

RAG가 가장 유명하지만, 같은 분야에 속하는 패턴이 더 있다.

- **Hierarchical summarization** — 긴 문서를 "요약본 + 원본 청크"로 계층화해서 필요한 만큼만 펼친다
- **Context pruning** — 검색된 청크 중에서 정말 관련 있는 것만 LLM에 넘긴다 (재정렬, re-ranking)
- **Automatic compaction** — 누적된 대화·도구 결과를 요약으로 압축해 컨텍스트 윈도우를 비운다 (Claude Code가 사용)
- **Cache control** — 자주 쓰이는 프롬프트 prefix를 캐싱해 토큰 비용을 절감 (Anthropic의 prompt caching)

이 기법들은 모두 "한정된 컨텍스트 윈도우에 무엇을 어떻게 채울지" 라는 같은 질문을 다른 각도에서 푸는 것이다.

---

## 3. 이 단계가 도달한 곳 / 막힌 곳

**도달**:
- 사용자가 위키 문서를 직접 고르지 않아도 된다
- 200개 위키여도 의미 검색으로 알아서 관련 부분을 가져온다
- 답에 출처가 명확히 붙는다

**막힘**:
1. **여전히 1회 호출이다.** LLM이 답을 만든 뒤 *"이 답이 부족하니 더 검색해야겠다"* 라고 결정할 수 없다.
2. **검색 도구가 미리 정해져 있다.** 사용자 질문이 슬랙 채널 내용이 필요한 거였다면? 코드베이스의 PR 내용이 필요했다면? 매번 새로운 검색 파이프라인이 필요하다.
3. **교차 검증·재검색 못 함.** LLM이 답을 만들어도 그 답이 정말 맞는지 다른 출처로 다시 확인할 수 없다.
4. **외부 시스템에 행동 못 함.** 답만 줄 뿐, 슬랙에 공지 올리거나, Jira 티켓 생성하거나, GitHub PR에 코멘트 다는 같은 능동적 행동은 못 한다.

→ 다음 단계 [하네스 엔지니어링](./harness-engineering.md): 모델이 도구를 능동적으로 선택해 호출하는 **루프 구조**로 확장한다.

---

## 4. 핵심 메시지

> 컨텍스트 엔지니어링은 **"한정된 컨텍스트 윈도우에 무엇을 어떤 형태로 채울지"** 를 설계하는 일이다. RAG가 가장 유명한 기법이지만, 컴팩션·재정렬·요약 계층화·캐싱 등 여러 패턴이 포함된다.
>
> 프롬프트 엔지니어링이 **글쓰기 기술**이었다면, 컨텍스트 엔지니어링은 **정보 큐레이션 기술**이다.

## 5. 1차 출처

- Anthropic Engineering — *Effective context engineering for AI agents*: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Anthropic Docs — *Prompt caching*: <https://docs.claude.com/en/docs/build-with-claude/prompt-caching>
- Anthropic Docs — *Embeddings*: <https://docs.claude.com/en/docs/build-with-claude/embeddings>
- Chroma docs: <https://docs.trychroma.com/>
- Pinecone — *Retrieval Augmented Generation*: <https://www.pinecone.io/learn/retrieval-augmented-generation/>
