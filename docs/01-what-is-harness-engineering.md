# 01. 하네스(harness)란 무엇이고, 하네스 엔지니어링(harness engineering)이란 무엇인가

## 목차

1. [개요](#1-개요)
2. ["Harness"라는 단어의 세 가지 맥락](#2-harness라는-단어의-세-가지-맥락)
3. [하네스란 무엇인가 — 기초](#3-하네스란-무엇인가--기초)
4. [하네스의 핵심 구성요소 (Anatomy)](#4-하네스의-핵심-구성요소-anatomy)
5. ["하네스 엔지니어링"이란? — 심화](#5-하네스-엔지니어링이란--심화)
6. [대표 사례 비교 — Claude Code / Cursor / Aider / Devin](#6-대표-사례-비교--claude-code--cursor--aider--devin)
7. [현재 논쟁 — 멀티에이전트는 정말 좋은가?](#7-현재-논쟁--멀티에이전트는-정말-좋은가)
8. [Claude Agent SDK 개요](#8-claude-agent-sdk-개요)
9. [자주 묻는 질문 (FAQ)](#9-자주-묻는-질문-faq)
10. [용어집](#10-용어집)
11. [참고 자료 (References)](#11-참고-자료-references)

---

## 1. 개요

이 문서는 **하네스(harness)** 와 **하네스 엔지니어링(harness engineering)** 이라는 용어를 정의하고, 그 핵심 구성요소·사례·현재 논쟁을 정리한다. 모든 비자명한 주장에는 1차 출처(공식 문서·1차 블로그) URL을 inline citation으로 명시했다.

---

## 2. "Harness"라는 단어의 세 가지 맥락

같은 단어가 세 가지 다른 의미로 쓰이고 있어서, 먼저 구분해 둔다.

### (a) AI Agent Harness — **이 문서의 주제**

LLM(Large Language Model) 위에 올라가는 소프트웨어 인프라. 모델 자체와 분리된, **도구 호출 루프(tool-use loop) · 컨텍스트/메모리 관리 · 권한 · 외부 통합** 등을 묶어 부르는 용어다. Claude Code, Cursor, Aider, Devin 같은 코딩 에이전트들이 이 하네스 위에서 돌아간다. ([anthropic.com/engineering/building-agents-with-the-claude-agent-sdk](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk))

### (b) Test Harness — 전통적 의미 (이 문서의 주제 아님)

JUnit, TestNG 같은 자동화 테스트 프레임워크 맥락에서의 "테스트 하네스"다. 본 문서의 주제와는 다른 갈래이며, 여기서는 구분 목적으로만 언급한다.

### (c) Harness.io — CI/CD 회사 (혼동 주의)

`harness.io`는 CI/CD·feature flag·플랫폼 엔지니어링을 제공하는 회사다. 이 회사명 때문에 "harness engineering"을 검색하면 노이즈가 섞이는데, 본 문서에서 다루는 "harness engineering"은 이 회사와 무관하다. (참고: harness.io는 자사 MCP 서버 등 AI 통합도 제공한다 — [developer.harness.io/docs/platform/harness-ai/harness-mcp-server](https://developer.harness.io/docs/platform/harness-ai/harness-mcp-server/) — 하지만 "harness engineering"이라는 일반 개념과 동일시할 수는 없다.)

> **요약**: 이 문서에서 "하네스"는 (a) **AI Agent Harness** 만을 가리킨다.

---

## 3. 하네스란 무엇인가 — 기초

### 3.1 정의

가장 자주 인용되는 정의는 Simon Willison의 한 문장이다:

> *"An LLM agent runs tools in a loop to achieve a goal."*  
> — Simon Willison, "How coding agents work" ([simonwillison.net/guides/agentic-engineering-patterns/how-coding-agents-work](https://simonwillison.net/guides/agentic-engineering-patterns/how-coding-agents-work/))

여기서 핵심은 세 단어다: **tools(도구), loop(루프), goal(목표)**. LLM 한 번 호출로 끝나는 게 아니라, 모델이 도구를 부르고 결과를 읽고 다시 부르는 과정을 목표 달성 때까지 반복한다. 그 반복을 가능하게 하는 외부 인프라 — 도구 정의, 루프 실행기, 상태 관리, 안전장치 — 가 바로 **하네스(harness)** 다.

Anthropic은 더 직접적으로 표현한다:

> *"Agents are LLMs running in a loop with tools."*  
> — Anthropic, "Building agents with the Claude Agent SDK" ([anthropic.com/engineering/building-agents-with-the-claude-agent-sdk](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk))

### 3.2 LLM 단독 vs LLM + 하네스

텍스트 다이어그램으로 비교해 보자.

```
[ LLM 단독 — Chat UI ]
  사용자 입력 ──► [LLM 1회 호출] ──► 응답 텍스트
  (상태 없음, 도구 없음, 외부 세계와 격리)

[ LLM + 하네스 — Agent ]
  사용자 목표 ──► ┌──────────────────────────────────────┐
                  │  System Prompt + 도구 정의           │
                  │  ┌─ LLM 호출                        │
                  │  │   └─ tool_use 출력             │
                  │  │       └─ 하네스가 도구 실행      │
                  │  │           └─ tool_result 주입  │
                  │  └─ (목표 달성 시까지 반복)         │
                  │  + 컨텍스트 압축 / 메모리 / 권한    │
                  └──────────────────────────────────────┘
                                  │
                                  ▼
                            완료된 작업
```

### 3.3 왜 (초기) chat UI는 agent가 아닌가

> 여기서 "chat UI"는 **2022~2023년 초기 ChatGPT**처럼 도구가 붙어 있지 않은 단순 chat completion 인터페이스를 가리킨다. **현재의 ChatGPT / Claude.ai는 이미 에이전트화됐다** — web search·code interpreter·file analysis·computer use·MCP 등의 도구가 붙어 tool-use 루프가 돈다. 즉 "오늘 내가 쓰는 채팅 UI는 agent가 아니다"는 말이 아니라, "도구·루프가 없는 chat completion 한 번은 agent가 아니다"는 의미다.

루프가 없고 도구가 없을 때 같은 모델이 어떻게 다른지:

- **Chat completion 한 번**: 모델이 "파일을 읽어보겠습니다"라고 말은 하지만 실제로 디스크의 파일을 보러 가지 못한다.
- **Agent (with harness)**: 모델이 `read_file` 도구를 호출하고, 하네스가 그 도구를 실행해 결과를 다시 모델에게 돌려준다. 모델은 그 결과를 바탕으로 다음 행동을 결정한다.

**"파일을 읽지 못한다"는 첨부 파일이 아니라 도구 호출에 대한 이야기다.** 두 가지는 메커니즘이 다르다:

| 구분 | 첨부 (passive input) | 도구 호출 (active access) |
|---|---|---|
| 시작 주체 | 사용자가 미리 줌 | 모델이 능동적으로 요청 |
| 형태 | 텍스트로 변환되어 컨텍스트에 미리 들어감 | `read_file({"path": "..."})` 같은 호출 → 하네스가 실행 → 결과를 다시 컨텍스트에 주입 |
| 새 파일 가능? | 사용자가 다시 첨부해야 함 | 모델이 그때그때 새 경로를 결정해 요청 가능 |

첨부는 "주어진 입력", 도구 호출은 "외부 세계로 손 뻗기"다. chat completion 한 번만으로는 후자가 불가능하다.

즉, **하네스는 모델을 "대화 상대"에서 "행동하는 주체"로 변환하는 장치**다.

---

## 4. 하네스의 핵심 구성요소 (Anatomy)

Anthropic 엔지니어링 블로그와 Claude Agent SDK 문서를 토대로 정리한, 현재 주류로 자리잡은 하네스의 8개 구성요소다. ([anthropic.com/engineering/building-agents-with-the-claude-agent-sdk](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk), [docs.claude.com/en/api/agent-sdk/overview](https://docs.claude.com/en/api/agent-sdk/overview))

### (1) 시스템 프롬프트 (System Prompt)

에이전트의 "성격·역할·작업 방식"을 정의하는 긴 지시문. Claude Code의 시스템 프롬프트는 수천 토큰 분량이며 — 작업 흐름, 도구 사용 규칙, 코드 작성 컨벤션, 안전 정책이 모두 들어 있다. 시스템 프롬프트의 품질이 곧 에이전트의 품질을 결정하는 1차 요인이다.

### (2) 도구 정의와 도구 호출 루프 (Tool definitions / Tool-use loop)

ReAct(Reasoning + Acting) 패턴이라고도 부르는 핵심 루프다.

```
while not done:
    response = model.call(messages + tools)   # LLM이 다음 행동 결정
    if response.has_tool_use:
        result = execute_tool(response.tool_use)  # 하네스가 실제 실행
        messages.append(tool_result=result)        # 결과 다시 모델에게
    else:
        done = True                                 # 모델이 마침을 선언
```

도구는 보통 JSON Schema로 선언되며, Anthropic의 tool-use 표준 인터페이스는 `tool_use`/`tool_result` 블록으로 메시지 안에 직렬화된다. ([docs.claude.com/en/docs/agents-and-tools/tool-use/overview](https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview))

### (3) 컨텍스트 관리와 컴팩션 (Context management / Compaction)

장시간 실행되는 에이전트는 컨텍스트 윈도우가 빠르게 가득 찬다. Anthropic은 "context engineering"이라는 별도 글에서 이 문제를 다루며, **automatic compaction(자동 압축)** 을 핵심 기법으로 든다 — 누적된 대화·도구 결과를 요약본으로 압축하고, 작업 핵심만 남겨 다음 단계로 가져가는 방식이다. ([anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

Claude Code는 세션이 길어지면 자동으로 컴팩션을 수행하고, 사용자가 명시적으로 `/compact` 를 호출할 수도 있다.

### (4) 메모리 (CLAUDE.md / Auto-memory / Multi-session)

세션 사이를 잇는 영구 지식 저장소다. Claude Code의 두 가지 메모리 메커니즘:

- **CLAUDE.md** — 프로젝트 루트(또는 사용자 홈)에 두는 마크다운 파일. 빌드 명령, 코드 컨벤션, 도메인 규칙 같은 "프로젝트 영구 지식"을 기록한다. 매 세션 시작 시 자동 로드된다. ([docs.claude.com/en/docs/claude-code/memory](https://docs.claude.com/en/docs/claude-code/memory))
- **Auto memory** — Claude가 세션 중에 학습한 사실(사용자 선호, 발견한 버그 원인, 결정 사항 등)을 별도 파일들로 저장해 다음 세션에 다시 끌어쓰는 메커니즘.

### (5) 권한 시스템 (Permissions / Sandboxing)

에이전트가 어떤 도구를, 어떤 인자로, 어떤 상황에서 쓸 수 있는지를 통제한다. Claude Agent SDK는 `permission_mode`(예: `acceptEdits`, `bypassPermissions`)와 도구별 `allow`/`deny` 룰, hook 기반 동적 승인까지 제공한다. ([docs.claude.com/en/api/agent-sdk/permissions](https://docs.claude.com/en/api/agent-sdk/permissions))

권한 시스템이 없으면 "터미널을 가진 LLM"은 곧 보안 사고다. 그래서 production 하네스에서는 권한이 **선택사항이 아니라 필수**다.

### (6) 외부 통합 — MCP (Model Context Protocol)

Anthropic이 2024년 11월 발표한 개방형 표준. 에이전트와 외부 시스템(Slack, GitHub, DB, 사내 API 등)을 연결하기 위한 "USB-C 같은" 인터페이스다. 도구를 매번 직접 코딩하지 않고, MCP 서버를 붙이기만 하면 에이전트가 그 시스템을 쓸 수 있게 된다. ([modelcontextprotocol.io/docs/getting-started/intro](https://modelcontextprotocol.io/docs/getting-started/intro), [anthropic.com/news/model-context-protocol](https://www.anthropic.com/news/model-context-protocol))

추가로 Anthropic은 2025년에 "Code execution with MCP" 패턴을 제안하며, 도구를 일일이 직접 호출하기보다 **에이전트가 코드를 작성해 도구를 호출하게 하면 토큰을 극적으로 절감** 할 수 있다고 보고했다 (사례 측정에서 150,000 → 2,000 토큰으로 약 98.7% 절감). ([anthropic.com/engineering/code-execution-with-mcp](https://www.anthropic.com/engineering/code-execution-with-mcp))

### (7) 서브에이전트와 오케스트레이션 (Sub-agents / Multi-agent)

복잡한 작업을 한 모델이 처음부터 끝까지 다루는 대신, **오케스트레이터 + 서브에이전트** 구조로 분할한다. Anthropic의 자체 멀티에이전트 리서치 시스템 사례에서는 오케스트레이터가 Opus를, 서브에이전트들이 Sonnet을 사용해 단일 에이전트 Opus 대비 **90.2% 성능 향상**을 보고했다. ([anthropic.com/engineering/built-multi-agent-research-system](https://www.anthropic.com/engineering/built-multi-agent-research-system))

다만 이 구조에 대한 반론도 있다 — 7장에서 따로 다룬다.

### (8) 가드레일 (Token budget / Loop limits / Error handling)

- **토큰 예산**: 한 작업당 사용 가능한 토큰 상한
- **루프 횟수 상한**: 무한 루프 방지 (예: `max_turns`)
- **에러 처리**: 도구 실패 시 재시도·우회·중단 정책
- **타임아웃**: 장시간 응답 없음 시 차단

이 가드레일들은 "잘 동작할 때"보다 "잘못 동작할 때" 빛난다.

---

## 5. "하네스 엔지니어링"이란? — 심화

### 5.1 패러다임 전환: "모델" 에서 "모델 + 하네스" 로

2024년까지의 통념은 **"더 강한 모델 = 더 좋은 결과"** 였다. 2025년 들어 업계 흐름은 명확히 바뀌었다: **같은 모델이라도 하네스가 결과를 좌우한다**.

Anthropic은 이 차이를 자사 블로그에서 직접 수치로 공개했다 — 동일한 Claude 모델을 두고:

> *"Claude scores 72.5% on the SWE-bench Verified benchmark, but only 36% when used with the bare API and no harness."*  
> — Anthropic, "Building agents with the Claude Agent SDK" ([anthropic.com/engineering/building-agents-with-the-claude-agent-sdk](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk))

**같은 모델 · 같은 벤치마크 · 하네스 유무 차이만으로 72.5% vs 36%** 다. 이 한 줄의 수치는 "harness engineering"이라는 직무 카테고리가 왜 부상했는지를 가장 단적으로 보여준다.

이 관점을 한 줄 비유로 자주 표현한다: **"모델은 뇌, 하네스는 신체."** 뇌만 있고 손발이 없으면 세상에 영향을 줄 수 없다.

### 5.2 SWE-bench와 하네스 경쟁

SWE-bench는 실제 GitHub 이슈를 해결하는 능력을 평가하는 벤치마크다. SWE-bench Verified(인간 검수 부분집합)는 현재 사실상 코딩 에이전트의 표준 리그가 됐다. ([swebench.com](https://www.swebench.com/), [swebench.com/SWE-bench/](https://www.swebench.com/SWE-bench/))

리더보드를 보면 같은 베이스 모델 위에 서로 다른 하네스가 올라가 경쟁한다 — 즉, 점수 차이의 상당 부분이 **하네스 설계 차이**에서 온다. 이것이 "harness engineering"이 별도의 전문 영역으로 인정받게 된 배경이다.

### 5.3 사례: Cursor팀이 매 모델 출시마다 시스템 프롬프트를 다시 쓴다

Cursor 같은 IDE형 에이전트는 새 프론티어 모델이 나올 때마다 시스템 프롬프트·도구 설명·루프 흐름을 **전면 재작성**한다는 사실이 업계 인터뷰들에서 반복적으로 등장한다. ([thoughts.jock.pl/p/ai-coding-harness-agents-2026](https://thoughts.jock.pl/p/ai-coding-harness-agents-2026)) 모델이 바뀌면 모델이 잘 따르는 지시 스타일도 바뀌기 때문이다. 결과적으로 "하네스를 만드는 사람"은 모델 출시 사이클에 맞춰 지속적으로 튜닝하는 전담 역할이 된다.

### 5.4 프롬프트 → 컨텍스트 → 하네스 엔지니어링: 점진적 확장의 흐름

세 용어는 시간순으로 등장했고, **포함 관계** 다. 더 나중에 등장한 용어가 더 큰 범위를 다룬다.

```
프롬프트 엔지니어링  ⊂  컨텍스트 엔지니어링  ⊂  하네스 엔지니어링
   (2022~2023)            (2024~)                (2025~)
```

각 단계를 비교하면:

| 단계 | 무엇을 설계? | 대표 기법 | 예시 |
|---|---|---|---|
| **프롬프트 엔지니어링** | 1회 LLM 호출의 **텍스트 자체** | zero-shot, few-shot, chain-of-thought, role prompt, 출력 포맷 지정 | *"다음 문장을 영어로 번역해줘. 단계별로 생각하고 JSON으로 답해."* |
| **컨텍스트 엔지니어링** | 한정된 컨텍스트 윈도우에 **무엇을 어떤 형태로** 채울지 | RAG, automatic compaction, hierarchical summarization, context pruning | 큰 코드베이스에서 RAG로 관련 함수만 추출해 넣기 / 긴 세션을 자동 압축 |
| **하네스 엔지니어링** | LLM **외부 인프라 전체** (프롬프트·컨텍스트 포함 + 도구·루프·메모리·권한·MCP·sub-agent) | tool-use loop, permission system, MCP, hooks, sub-agent | Cursor가 모델 출시마다 시스템 프롬프트 + 도구 인터페이스 전체 재작성 / 사내 봇에 Jira 도구 + 권한 + 로그 붙이기 |

Anthropic은 이 흐름을 자사 엔지니어링 블로그에서 명시적으로 정의했다:

> *"Context engineering is the art and science of curating what will go into the limited context window from the universe of possible information."*  
> — Anthropic, *Effective context engineering for AI agents* ([anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

같은 회사는 한 단계 더 확장된 *Effective harnesses for long-running agents* ([anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))를 별도로 발행하면서 "하네스"라는 단어를 자사 공식 용어로 채택했다.

핵심 메시지 한 줄: **"잘 짠 한 문장(프롬프트) → 잘 짠 컨텍스트 윈도우(컨텍스트) → 잘 짠 LLM 외부 시스템 전체(하네스)"** 로 엔지니어의 관심사가 확장돼 왔다. 컨텍스트 엔지니어링은 하네스 엔지니어링의 한 하위 분야다.

> 같은 도메인 문제("사내 Notion Q&A 봇")를 두고 세 단계가 어떻게 점진적으로 확장되는지 코드 스니펫까지 풀어낸 시나리오 문서를 별도로 두었다:
> - [scenarios/prompt-engineering.md](./scenarios/prompt-engineering.md)
> - [scenarios/context-engineering.md](./scenarios/context-engineering.md)
> - [scenarios/harness-engineering.md](./scenarios/harness-engineering.md)

### 5.5 "Effective harnesses for long-running agents"

Anthropic이 직접 사용하는 용어가 바로 **harness** 다. 장기 실행 에이전트(코딩, 리서치, 운영 자동화)를 만들 때 효과적인 하네스를 어떻게 설계하느냐를 별도의 엔지니어링 글로 다룬다. ([anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))

핵심 메시지: **에이전트가 "오래 잘 돌아가게"** 만드는 것은 모델 능력이 아니라 하네스 설계 — 명확한 작업 분해, 좋은 도구 추상화, 견고한 컨텍스트 관리, 적절한 권한 — 의 결과다.

### 5.6 정리: "하네스 엔지니어링"의 작업 분류

위 논의를 종합하면, 하네스 엔지니어링은 대략 다음 작업들로 구성된다:

| 영역 | 구체적 작업 예시 |
|---|---|
| 프롬프트 설계 | 시스템 프롬프트 작성·반복 튜닝, 모델 출시마다 재작성 |
| 도구 설계 | 도구 인터페이스 정의, JSON Schema, 좋은 도구 설명문 작성 |
| 루프 제어 | tool-use loop 구현, max_turns·token_budget·에러 정책 |
| 컨텍스트 엔지니어링 | 컴팩션 전략, 무엇을 남기고 무엇을 버릴지 |
| 메모리 설계 | CLAUDE.md 스키마, auto-memory 정책, 세션 간 인덱싱 |
| 권한·안전 | permission_mode, allow/deny 룰, hook, 샌드박싱 |
| 외부 통합 | MCP 서버 도입·작성, 사내 시스템 연결 |
| 오케스트레이션 | 서브에이전트 분할, 파이프라인 설계 |
| 평가·벤치마크 | SWE-bench 등 자동 평가, 회귀 테스트 |

---

## 6. 대표 사례 비교 — Claude Code / Cursor / Aider / Devin

네 가지 코딩 에이전트는 모두 "LLM + 하네스" 조합이지만, **하네스의 형태**가 매우 다르다.

| 항목 | **Claude Code** | **Cursor** | **Aider** | **Devin** |
|---|---|---|---|---|
| 형태 | CLI 기반 에이전트 (터미널·IDE 확장) | IDE (VSCode fork) | 터미널 페어 프로그래머 | 클라우드 자율 에이전트 |
| 1차 출처 | [claude.com/claude-code](https://www.claude.com/product/claude-code), [docs.claude.com/en/docs/claude-code/overview](https://docs.claude.com/en/docs/claude-code/overview) | [cursor.com](https://cursor.com/) | [aider.chat](https://aider.chat/), [github.com/Aider-AI/aider](https://github.com/Aider-AI/aider) | [devin.ai](https://devin.ai/), [cognition.ai](https://cognition.ai/) |
| 아키텍처 | 단일 메인 루프 + 서브에이전트 + 도구 + 메모리(CLAUDE.md) + 권한 + hooks + MCP | IDE 통합형 멀티 컴포저, 인라인 편집·탭 완성·채팅·agent 모드 | "Architect/Editor" 두 역할로 분리, git에 자동 커밋하며 진행 | 클라우드 VM에서 자율 실행, 브라우저·터미널·에디터 일체 |
| 자율성 | 사용자 옆에서 단계별 보고 + 권한 승인 | 키 입력 단위로 빠르게 적용, 사용자 주도 | 대화로 한 번에 1~수 파일 편집, 사용자 주도 | 작업을 통째 위임 (장시간 자율) |
| 컨텍스트 메커니즘 | CLAUDE.md + auto-memory + automatic compaction | IDE가 본 코드·열린 파일 인덱싱 + 채팅 컨텍스트 | 대화 기록 + repo map + 명시적 `/add` | 세션 자체가 컨텍스트, 장기 작업 기록 |
| MCP 지원 | 정식 지원 (공식 MCP 호스트) | 지원 | 지원 (커뮤니티) | 자체 도구 셋 |
| 가격 모델 (2025년 기준) | Claude Pro/Max 구독 또는 API 사용량 | 구독($20~/월) | 무료(OSS) + API 사용량 | 유료 ($20/월~ + ACU 과금) |

핵심 관찰:

- **Cursor와 Claude Code는 "IDE 통합" vs "CLI 우선" 이라는 1차원 차이지만, 깊이 들어가면 하네스 철학 자체가 다르다.** Cursor는 인간 옆에서 키 입력을 가속하는 방향(low-latency, inline)이고, Claude Code는 한 번 위임하면 다단계 작업을 끝까지 진행하는 방향이다.
- **Aider는 OSS라 하네스 내부를 가장 잘 들여다볼 수 있다.** ([github.com/Aider-AI/aider](https://github.com/Aider-AI/aider))
- **Devin은 자율성이 가장 높은 대신 사람이 들여다보기 가장 어렵다.** 자율성 ↔ 통제 트레이드오프의 한쪽 극단이다.

> ⚠️ 위 표의 가격·세부 기능은 변동이 잦다. 최신 정보는 각 공식 사이트로 확인.

---

## 7. 현재 논쟁 — 멀티에이전트는 정말 좋은가?

2025년 중반 업계에서 가장 큰 하네스 논쟁은 **"멀티에이전트(multi-agent)를 써야 하는가"** 였다.

### 7.1 Cognition: "Don't Build Multi-Agents"

Devin을 만드는 Cognition은 2025년 블로그 글에서 멀티에이전트 구조의 함정을 정면 비판했다 — **에이전트들 사이에 컨텍스트가 끊기면 결정이 어긋난다**는 것이 핵심 주장이다. ([cognition.ai/blog/dont-build-multi-agents](https://cognition.ai/blog/dont-build-multi-agents))

원문 요지:
> *"Principle 1: Share context, and share full agent traces, not just individual messages. Principle 2: Actions carry implicit decisions, and conflicting decisions carry bad results."*

즉 "병렬 멀티에이전트로 일 나누면 빨라 보이지만, 결정의 일관성이 깨져서 결과가 더 나빠진다"는 입장이다.

### 7.2 Anthropic: "How we built our multi-agent research system"

같은 시기 Anthropic은 정반대의 사례를 공개했다 — **오케스트레이터(Opus) + 서브에이전트(Sonnet)** 구조가 단일 에이전트 대비 큰 성능 향상을 보였다는 보고다. ([anthropic.com/engineering/built-multi-agent-research-system](https://www.anthropic.com/engineering/built-multi-agent-research-system))

원문에서 강조하는 조건:
- 강력한 오케스트레이터가 작업을 명확히 분할할 것
- 서브에이전트 결과가 잘 통합될 수 있는 형태일 것
- 본질적으로 **병렬 가능한 작업**(예: 광범위한 리서치)에 한정

### 7.3 두 입장이 모순되는가?

표면적으로는 정반대지만, 자세히 보면 두 글이 가리키는 작업 유형이 다르다.

- **Cognition (반대)**: 단일 코딩 작업 안에서 결정들이 서로 의존적인 경우 → 멀티에이전트가 컨텍스트를 잘라먹어서 위험.
- **Anthropic (찬성)**: 리서치처럼 독립적·병렬적 탐색 작업 → 멀티에이전트로 분할이 이득.

정리하면 멀티에이전트는 하나의 도구이며, **문제가 본질적으로 병렬화 가능한가**, **오케스트레이터가 결정의 일관성을 보장할 수 있는가**의 두 조건이 채택 여부를 가른다.

관련 커뮤니티 토론: [news.ycombinator.com/item?id=44870384](https://news.ycombinator.com/item?id=44870384) (Cognition 글 HN 토론)

> 실전 사례: 본 논쟁의 "Anthropic 진영"에 가까운 구현이 한국 개발자에 의해 100개 묶음으로 공개돼 있다. [03 케이스 스터디](./03-case-study-harness-100.md)에서 표준 구조·설계 개념·docs/01 8개 구성요소 매칭을 정리했다.

---

## 8. Claude Agent SDK 개요

Claude Agent SDK는 Anthropic이 Claude Code 내부에서 검증한 하네스 패턴을 외부 개발자가 자기 에이전트를 만들 때 쓸 수 있도록 패키징한 것이다. ([docs.claude.com/en/api/agent-sdk/overview](https://docs.claude.com/en/api/agent-sdk/overview), [docs.claude.com/en/api/agent-sdk/python](https://docs.claude.com/en/api/agent-sdk/python), [docs.claude.com/en/api/agent-sdk/typescript](https://docs.claude.com/en/api/agent-sdk/typescript))

핵심 제공 기능:

| 기능 | 내용 |
|---|---|
| 에이전트 루프 | tool-use loop, 스트리밍, 자동 에러 복구 |
| 내장 도구 | bash·read·write·edit·glob·grep·web·browser 등 |
| 컨텍스트 관리 | 자동 컴팩션, CLAUDE.md 자동 로드 |
| 메모리 | auto-memory 시스템 |
| 권한 | permission_mode, allow/deny, hooks |
| MCP 통합 | MCP 클라이언트·서버 표준 지원 |
| 서브에이전트 | sub-agent / task 위임 |
| Python · TypeScript | 두 언어로 1차 SDK 제공 |

즉 4장에서 정리한 하네스의 8개 구성요소 중 대부분을 라이브러리 형태로 즉시 사용 가능하게 만들어 준다.

---

## 9. 자주 묻는 질문 (FAQ)

발표 청중이 자주 던지는 질문과 답변. 이미 본문에서 다룬 내용은 anchor로 연결한다.

### Q1. Claude Code, Cursor, Codex 같은 제품을 "하네스"라고 불러도 되나요?

**한 줄로: 엄밀히는 '하네스를 포함한 에이전트 제품'이지만, 업계에서는 그냥 '하네스'라고 줄여 부른다.**

이유는 단순하다. 같은 모델(예: Claude Sonnet 4.6)을 두고 제품마다 결과가 천차만별이라면, 그 차이의 거의 전부는 "LLM이 아닌 부분" = 하네스에서 온다. 그래서 제품을 비교한다는 건 실질적으로 하네스를 비교하는 일이다.

```
Claude Code  =  Claude(모델, Anthropic 클라우드)  +  Claude Code의 하네스
                                                    (시스템 프롬프트·도구·루프·메모리·권한·MCP·hooks·sub-agent)
```

업계 일상 표현 예:
- *"Cursor 하네스보다 Claude Code 하네스가 더 자율적이다"*
- *"Devin 하네스는 자율성이 가장 높지만 통제가 어렵다"*

→ 모두 "그 제품에서 LLM이 아닌 부분 전체"를 가리킨다. 본 문서 [4장 8개 구성요소](#4-하네스의-핵심-구성요소-anatomy)가 그 "LLM이 아닌 부분"이다. 발표에서도 편의상 "Claude Code 하네스", "Cursor 하네스"라고 줄여 부르겠다 — 의미 전달이 더 빠르다.

### Q2. ChatGPT, Claude.ai, Gemini 같은 일반 챗봇은 agent인가요?

**한 줄로: 우리가 지금 매일 쓰는 ChatGPT, Claude.ai, Gemini는 이미 agent다.**

이 질문이 헷갈리는 이유는 머릿속에 "챗봇 = agent 아님" 이미지가 너무 강하게 남아 있기 때문이다. 본 문서 3.3에서 "chat UI는 agent가 아니다"라고 한 건 **2022~2023년 초창기 ChatGPT** — 도구 하나 없이 사용자가 메시지를 던지면 1회 chat completion으로 답하고 끝나던 시점 — 의 모습이고, 그때는 정말 agent가 아니었다.

그 이후 챗봇 제품들은 다음 도구들을 차례로 붙여 왔다:

- **web search** — 실시간 웹 정보 조회
- **code interpreter** — Python 코드를 샌드박스에서 실행
- **file analysis** — 첨부 파일·이미지를 도구로 처리
- **computer use** — 가상 데스크톱에서 마우스·키보드 조작
- **MCP** — 외부 시스템(Slack, GitHub, Notion, ...) 연결

이 도구들 위에서 tool-use 루프가 돌기 시작하는 순간, 그 챗봇은 **하네스 위에 올라간 agent** 가 된다. 외형은 여전히 "입력창 + 응답 풍선"이라 옛 챗봇처럼 보이지만 내부 구조는 완전히 다르다.

그래서 발표에서 "chat UI vs agent"를 대비할 때 경계는 **시대**가 아니라 **구조**로 그어야 한다:

- ❌ 옛 ChatGPT vs 지금 ChatGPT (시대 비교 — 청중이 "지금 ChatGPT는 agent 아냐?"로 즉시 반박)
- ✅ 도구·루프 없는 1회 호출 vs 도구·루프가 있는 시스템 (본질적 경계)

**부수 질문 — "그럼 채팅창에 첨부한 파일을 모델이 직접 읽는 건 도구 호출 아닌가요?"**  
둘은 메커니즘이 다르다. 첨부는 사용자가 올린 파일을 미리 텍스트로 변환해 컨텍스트에 넣어주는 *passive input*, 도구 호출은 모델이 그때그때 능동적으로 새 파일·새 경로를 요청하는 *active access* 다. 자세한 비교표는 [3.3 첨부 vs 도구 호출](#33-왜-초기-chat-ui는-agent가-아닌가) 참고.

### Q3. 지금 이 문서를 작성한 Claude Code도 결국 하네스인가요?

**한 줄로: Claude Code는 하네스고, 그 위에 올라타 답을 만드는 Claude(모델)는 모델이다. 둘이 합쳐진 게 지금 보고 있는 에이전트다.**

```
지금 사용자와 대화 중인 "에이전트" =
   Claude Opus 4.7 (모델 = 뇌, Anthropic 클라우드에서 실행)
 + Claude Code 하네스 (시스템 프롬프트, Read/Write/Bash/Edit/Grep 도구,
                     tool-use loop, .claude/ 메모리, 권한 모드, hooks, sub-agent)
```

발표에서 가장 강력한 데모 포인트가 된다 — **이 자료조사 문서 자체가 그 협업의 산물이다.** 클라우드의 Claude(모델)가 문장을 만들고, 로컬의 Claude Code(하네스)가 Read/Write/Edit 도구로 실제 `docs/01-what-is-harness-engineering.md` 파일을 건드린다. 화면 옆에 두 박스를 그려놓고 *"여기 보이는 텍스트는 모델이 만들고, 파일 저장·git 커밋은 하네스가 한다"* 라고 분리해 설명할 수 있다.

### Q4. 그럼 일반 개발자가 "하네스를 만든다"는 게 실제로 어떤 작업인가요?

**한 줄로: 자기 회사의 도메인 도구를 SDK + 시스템 프롬프트 + tool-use 루프 위에 얹는 일.** 어려운 ML 기술이 아니라 **글쓰기(시스템 프롬프트) + 통합(도구 정의)** 의 결합에 가깝다.

두 갈래로 나뉘고, **대다수 개발자는 (a)** 를 한다.

**(a) 자기 회사 제품 / 사내 도구에 에이전트 기능 붙이기** ← 일반적
- 예: 사내 코드 리뷰 봇, 고객 지원 챗봇, 사내 DB 자연어 검색, Jira/Linear 자동 정리, 마케팅 데이터 분석 어시스턴트
- 실제 작업 흐름:
  1. Anthropic / OpenAI / Gemini API 호출 코드
  2. 사내 도구를 JSON Schema로 정의 (예: `searchJiraTickets(query)`, `getCustomerInfo(id)`)
  3. tool-use 루프 작성
  4. 시스템 프롬프트로 역할·작업 방식·안전 정책 작성
  5. 권한·로깅·평가·모니터링 추가

**(b) 새 에이전트 제품 만들기** ← 소수
- Cursor·Aider·Devin 같은 새 형태의 개발자 도구를 만드는 경우

본 프로젝트의 [`../demo/`](../demo/) 폴더가 정확히 (a)의 미니어처다. Step 1~5를 거치면서 사내 봇을 만들 때 필요한 패턴(bare 호출 → tool-use → 루프 → 메모리 → SDK 재구현)을 작은 코드량으로 손에 익힌다.

### Q5. LLM 자체만으로는 agent가 될 수 없나요? 꼭 하네스가 있어야 하나요?

**한 줄로: 정의상 그렇다. LLM은 텍스트 토큰을 뱉을 뿐, 외부 세계에 손을 뻗으려면 그 손이 되어줄 외부 코드(=하네스)가 반드시 필요하다.**

두 정의가 상호 의존적이다:

- **Agent** = LLM이 도구를 루프 안에서 호출하며 목표를 달성하는 시스템
- **Harness** = 그 "도구·루프·메모리·권한 등 LLM이 아닌 부분" 전체

⇒ **Agent = LLM + Harness** (둘 다 있어야 agent)

미묘한 점은 하네스의 **크기**다.

| 상황 | 하네스 크기 | Agent 여부 |
|---|---|---|
| 도구 0개 + 루프 0회 (chat completion 한 번) | 0 | ❌ agent 아님 |
| 도구 1개를 한 번 호출하고 끝 | 도구 정의·실행 로직 한 줌 | ✅ 가장 작은 agent |
| 수십 개 도구 + 루프 + 메모리 + 권한 + MCP + sub-agent | 풀스케일 | ✅ 풀스케일 agent (Claude Code 등) |

즉 "하네스가 거의 없다"는 있어도, **"하네스가 0이면서 agent"는 정의상 불가능**하다 — 도구를 실행하는 외부 코드가 없으면 모델은 텍스트 토큰을 뱉을 뿐 외부 세계에 닿지 못하기 때문이다. [`../demo/`](../demo/) Step 1(도구 0개, chat 응답) vs Step 2(도구 1개, 실제 폴더를 읽어옴)가 정확히 이 경계를 손으로 보여준다.

### Q6. 이거 결국 RAG와 무슨 차이인가요?

**한 줄로: RAG는 하네스의 한 부분(컨텍스트 엔지니어링 영역)일 뿐. 하네스는 RAG보다 훨씬 큰 그릇이다.**

- **RAG (Retrieval-Augmented Generation)**: 사용자 질문이 오면 벡터 DB에서 관련 문서를 검색 → 컨텍스트에 붙임 → LLM에 답하게 함. 보통 한 사이클로 끝난다.
- **하네스**: RAG도 포함되지만, 거기에 **도구 호출 루프, 능동적 행동, 메모리, 권한, 외부 시스템 통합(MCP), 서브에이전트** 까지 다 들어간다.

가장 큰 차이는 **능동성**이다. RAG는 시스템이 미리 정한 검색을 한 번 하고 끝내지만, 에이전트는 모델이 그때그때 *"지금 더 검색해야겠다", "이 함수 정의를 봐야겠다", "다른 도구를 써야겠다"* 라고 결정하며 도구를 반복 호출한다.

RAG는 [5.4 컨텍스트 엔지니어링](#54-프롬프트--컨텍스트--하네스-엔지니어링-점진적-확장의-흐름) 단계의 대표 기법이며, 하네스 엔지니어링은 그 위 단계까지 포함한다.

### Q7. LangChain, LangGraph, AutoGen 같은 프레임워크는 하네스인가요?

**한 줄로: 하네스 자체가 아니라, 하네스를 만들기 위한 프레임워크/툴킷이다.**

- **LangChain / LangGraph / AutoGen / Claude Agent SDK** = 도구 호출 루프·메모리·멀티에이전트 같은 패턴을 **재사용 가능한 컴포넌트**로 제공하는 라이브러리
- **하네스** = 그 컴포넌트들을 조합해 만든 **구체적인 시스템**

비유: React가 "UI 만드는 도구"라면 우리가 짜는 어떤 앱은 "React로 만든 UI"다. LangChain / Claude Agent SDK가 React라면, 사내 봇은 그걸로 만든 하네스다.

본 [`../demo/`](../demo/)는 의도적으로 (Step 1~4) **프레임워크 없이 직접** 하네스를 만들어 내부 구조를 손에 익힌 뒤, (Step 5) Claude Agent SDK로 같은 작업을 다시 만들어 프레임워크가 무엇을 가려주는지 비교한다.

### Q8. 작은 모델 + 좋은 하네스 vs 큰 모델 + 빈약한 하네스, 어느 쪽이 이기나요?

**한 줄로: 좋은 하네스 쪽이 거의 항상 이긴다. Anthropic 자체 측정에서 같은 Claude 모델이 좋은 하네스(Claude Code)에서는 72.5%, 하네스 없는 bare API에서는 36% — 두 배 차이가 났다.**

상세 근거는 [5.1 패러다임 전환](#51-패러다임-전환-모델-에서-모델--하네스-로) 참고. "모델은 뇌, 하네스는 신체" 비유의 핵심 메시지가 이거다 — 뇌만 좋고 손발이 없으면 세상에 영향을 주지 못한다.

다만 **모델이 어느 수준 이상은 돼야 좋은 하네스가 의미가 있다.** 도구 호출 능력이 약한 모델은 아무리 하네스가 좋아도 도구를 제대로 못 부른다. 그래서 실제 선택은 *"모델은 frontier급으로 두고, 하네스는 그 위에서 정성껏 만든다"* 가 표준이 됐다.

### Q9. AI가 내 파일시스템·터미널에 마음대로 접근하는데 보안적으로 위험하지 않나요?

**한 줄로: 매우 위험하다. 그래서 하네스의 8가지 구성요소 중 하나가 통째로 권한 시스템이다.**

자세한 내용은 [4.(5) 권한 시스템](#5-권한-시스템-permissions--sandboxing) 참고. Claude Code의 기본 정책:

- 파일 **읽기** — 대부분 자동 허용
- 파일 **쓰기·편집** / **bash 실행** — 사용자 승인이 기본 (또는 사전에 허용 목록 등록)
- 위험 명령(`rm -rf`, `git push --force`, 외부 네트워크 호출 등) — 명시적으로 차단할 수 있게 hook 제공

production 하네스에서는 권한 시스템이 **선택이 아니라 필수**다. "터미널을 쥔 LLM"은 권한 없으면 곧 보안 사고로 직결된다. 발표에서 *"Claude Code가 매번 '이 명령 실행해도 되나요?' 묻는 게 귀찮을 수 있지만, 그게 바로 권한 시스템이 일하고 있는 거다"* 라는 메시지를 줄 수 있다.

### Q10. 비용은 얼마나 나오나요?

**한 줄로: 작업에 따라 천차만별이다. 단순 챗 한 번은 수십 원, 긴 코딩 세션은 수천~수만 원까지 갈 수 있다.**

비용 구조:
- 모델 호출 = **입력 토큰 + 출력 토큰** 과금 (모델·tier마다 단가 다름)
- tool-use 루프가 길어질수록 누적 (도구 결과까지 토큰)
- 컨텍스트 컴팩션·메모리·하위 에이전트가 잘 설계된 하네스일수록 같은 작업을 적은 토큰으로 끝낸다

비용 절감 기법의 대표 사례 — Anthropic이 보고한 **"Code execution with MCP"** 패턴은 같은 작업의 토큰 사용을 **150,000 → 2,000 (약 98.7% 절감)** 으로 줄였다 ([anthropic.com/engineering/code-execution-with-mcp](https://www.anthropic.com/engineering/code-execution-with-mcp)). 사내 봇을 만들 때 비용 최적화도 하네스 엔지니어링의 중요한 영역이다.

---

## 10. 용어집

| 용어 | 뜻 |
|---|---|
| **Agent** | LLM이 도구를 루프 안에서 호출하며 목표를 달성하는 시스템. |
| **Harness** | Agent를 가능하게 하는 LLM 외부의 모든 소프트웨어 인프라(시스템 프롬프트, 도구, 루프, 컨텍스트 관리, 메모리, 권한 등). |
| **Tool use** | 모델이 정의된 도구를 호출하도록 하는 API 패턴. Anthropic에서는 `tool_use`/`tool_result` 메시지 블록으로 직렬화된다. ([docs.claude.com/en/docs/agents-and-tools/tool-use/overview](https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview)) |
| **ReAct** | "Reason + Act"의 약자. 모델이 추론과 도구 호출을 번갈아 수행하는 루프 패턴. (Yao et al., 2022) |
| **MCP (Model Context Protocol)** | 에이전트와 외부 시스템을 잇는 개방형 표준. Anthropic이 2024년 11월 공개. ([modelcontextprotocol.io](https://modelcontextprotocol.io/)) |
| **Context engineering** | 한정된 컨텍스트 윈도우에 무엇을 어떤 형태로 넣을지 설계하는 작업. ([anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)) |
| **Compaction** | 누적된 대화·도구 결과를 요약본으로 압축해 컨텍스트 윈도우를 비우는 기법. |
| **Sub-agent** | 메인 에이전트(오케스트레이터)가 위임한 부분 작업을 수행하는 별도의 에이전트. |
| **System prompt** | 에이전트의 역할·작업 방식을 정의하는 긴 지시문. |
| **SWE-bench / SWE-bench Verified** | 실제 GitHub 이슈로 코딩 에이전트를 평가하는 표준 벤치마크. Verified는 인간이 검수한 부분집합. ([swebench.com](https://www.swebench.com/)) |

---

## 11. 참고 자료 (References)

URL은 원문 그대로(영문) 보존했다. 1차 출처(공식 블로그·공식 문서)를 우선 분류했다.

### 11.1 Anthropic 공식 (1차 출처)

- Anthropic Engineering — *Building agents with the Claude Agent SDK*: <https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk>
- Anthropic Engineering — *Effective harnesses for long-running agents*: <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Anthropic Engineering — *Effective context engineering for AI agents*: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Anthropic Engineering — *How we built our multi-agent research system*: <https://www.anthropic.com/engineering/built-multi-agent-research-system>
- Anthropic Engineering — *Code execution with MCP: Building more efficient AI agents*: <https://www.anthropic.com/engineering/code-execution-with-mcp>
- Anthropic News — *Introducing the Model Context Protocol*: <https://www.anthropic.com/news/model-context-protocol>
- Claude Docs — *Claude Agent SDK overview*: <https://docs.claude.com/en/api/agent-sdk/overview>
- Claude Docs — *Claude Agent SDK (Python)*: <https://docs.claude.com/en/api/agent-sdk/python>
- Claude Docs — *Claude Agent SDK (TypeScript)*: <https://docs.claude.com/en/api/agent-sdk/typescript>
- Claude Docs — *Claude Agent SDK Permissions*: <https://docs.claude.com/en/api/agent-sdk/permissions>
- Claude Docs — *Tool use overview*: <https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview>
- Claude Docs — *Claude Code overview*: <https://docs.claude.com/en/docs/claude-code/overview>
- Claude Docs — *Manage Claude's memory (CLAUDE.md)*: <https://docs.claude.com/en/docs/claude-code/memory>

### 11.2 Cognition (Devin)

- Cognition Blog — *Don't Build Multi-Agents*: <https://cognition.ai/blog/dont-build-multi-agents>
- Cognition: <https://cognition.ai/>
- Devin (product site): <https://devin.ai/>

### 11.3 Simon Willison (1차 평론·정의)

- *How coding agents work* (Agentic engineering patterns): <https://simonwillison.net/guides/agentic-engineering-patterns/how-coding-agents-work/>
- *Coding agents* tag: <https://simonwillison.net/tags/coding-agents/>

### 11.4 swyx / Latent Space

- *Agent Engineering*: <https://www.latent.space/p/agent>
- swyx (개인 사이트): <https://www.swyx.io/>

### 11.5 Model Context Protocol (MCP)

- MCP 공식 문서: <https://modelcontextprotocol.io/>
- *Get started with MCP*: <https://modelcontextprotocol.io/docs/getting-started/intro>

### 11.6 벤치마크

- SWE-bench 공식: <https://www.swebench.com/>
- SWE-bench 논문/페이지: <https://www.swebench.com/SWE-bench/>

### 11.7 비교·분석 (보조 출처)

- *AI Coding Harness — Agents 2026 (비교 분석)*: <https://thoughts.jock.pl/p/ai-coding-harness-agents-2026>

### 11.8 대상 에이전트 공식 페이지

- Claude Code: <https://www.claude.com/product/claude-code>
- Cursor: <https://cursor.com/>
- Aider: <https://aider.chat/>
- Aider GitHub: <https://github.com/Aider-AI/aider>
- Devin: <https://devin.ai/>

### 11.9 커뮤니티 토론

- Hacker News — *Don't Build Multi-Agents* 토론: <https://news.ycombinator.com/item?id=44870384>

### 11.10 Harness.io (혼동 방지용 참고)

- Harness MCP Server 문서: <https://developer.harness.io/docs/platform/harness-ai/harness-mcp-server/>

