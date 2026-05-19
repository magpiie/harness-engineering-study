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
9. [용어집](#9-용어집)
10. [참고 자료 (References)](#10-참고-자료-references)

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

### 3.3 왜 chat UI는 agent가 아닌가

ChatGPT 초창기 UI처럼 "한 번 묻고 한 번 답하는" 인터페이스는 agent가 아니다. **루프가 없고 도구가 없기 때문**이다. 같은 모델이라도:

- **Chat UI**: 모델이 "파일을 읽어보겠습니다"라고 말은 하지만 실제로 읽지 못한다.
- **Agent (with harness)**: 모델이 `read_file` 도구를 호출하고, 하네스가 그 도구를 실행해 결과를 다시 모델에게 돌려준다. 모델은 그 결과를 바탕으로 다음 행동을 결정한다.

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

### 5.4 "Context engineering"이라는 인접 용어

Anthropic은 "prompt engineering"을 잇는 후속 개념으로 **context engineering** 을 명시적으로 정의했다. ([anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

> *"Context engineering is the art and science of curating what will go into the limited context window from the universe of possible information."*

즉, "어떤 정보를 어느 타이밍에, 어떤 형태로 컨텍스트에 넣을 것인가"가 새로운 엔지니어링 영역이다. 하네스 엔지니어링의 핵심 하위 분야다.

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
| MCP 지원 | 1차 시민 (공식 MCP 호스트) | 지원 | 지원 (커뮤니티) | 자체 도구 셋 |
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

## 9. 용어집

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

## 10. 참고 자료 (References)

URL은 원문 그대로(영문) 보존했다. 1차 출처(공식 블로그·공식 문서)를 우선 분류했다.

### 10.1 Anthropic 공식 (1차 출처)

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

### 10.2 Cognition (Devin)

- Cognition Blog — *Don't Build Multi-Agents*: <https://cognition.ai/blog/dont-build-multi-agents>
- Cognition: <https://cognition.ai/>
- Devin (product site): <https://devin.ai/>

### 10.3 Simon Willison (1차 평론·정의)

- *How coding agents work* (Agentic engineering patterns): <https://simonwillison.net/guides/agentic-engineering-patterns/how-coding-agents-work/>
- *Coding agents* tag: <https://simonwillison.net/tags/coding-agents/>

### 10.4 swyx / Latent Space

- *Agent Engineering*: <https://www.latent.space/p/agent>
- swyx (개인 사이트): <https://www.swyx.io/>

### 10.5 Model Context Protocol (MCP)

- MCP 공식 문서: <https://modelcontextprotocol.io/>
- *Get started with MCP*: <https://modelcontextprotocol.io/docs/getting-started/intro>

### 10.6 벤치마크

- SWE-bench 공식: <https://www.swebench.com/>
- SWE-bench 논문/페이지: <https://www.swebench.com/SWE-bench/>

### 10.7 비교·분석 (보조 출처)

- *AI Coding Harness — Agents 2026 (비교 분석)*: <https://thoughts.jock.pl/p/ai-coding-harness-agents-2026>

### 10.8 대상 에이전트 공식 페이지

- Claude Code: <https://www.claude.com/product/claude-code>
- Cursor: <https://cursor.com/>
- Aider: <https://aider.chat/>
- Aider GitHub: <https://github.com/Aider-AI/aider>
- Devin: <https://devin.ai/>

### 10.9 커뮤니티 토론

- Hacker News — *Don't Build Multi-Agents* 토론: <https://news.ycombinator.com/item?id=44870384>

### 10.10 Harness.io (혼동 방지용 참고)

- Harness MCP Server 문서: <https://developer.harness.io/docs/platform/harness-ai/harness-mcp-server/>

