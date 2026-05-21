# 03. 실전 케이스 스터디 — revfactory/harness-100

[docs/01](./01-what-is-harness-engineering.md)이 정의한 "하네스(harness)"가 실제 production 수준으로 어떻게 구현돼 공개되어 있는지를 보여주는 한국 발 사례. 이 문서는 GitHub 레포 [revfactory/harness-100](https://github.com/revfactory/harness-100) 의 README와 두 개 샘플 하네스(`01-youtube-production`, `16-fullstack-webapp`)를 직접 분석한 결과를 정리한다.

## 목차

1. [개요](#1-개요)
2. [왜 이 레포를 케이스 스터디로 다루는가](#2-왜-이-레포를-케이스-스터디로-다루는가)
3. [표준 하네스 구조 (Anatomy)](#3-표준-하네스-구조-anatomy)
4. [핵심 설계 개념 7가지](#4-핵심-설계-개념-7가지)
5. [샘플 deep-dive ① — youtube-production](#5-샘플-deep-dive--youtube-production)
6. [샘플 deep-dive ② — fullstack-webapp](#6-샘플-deep-dive--fullstack-webapp)
7. [docs/01 8개 구성요소와의 매칭](#7-docs01-8개-구성요소와의-매칭)
8. [멀티에이전트 논쟁에서의 위치](#8-멀티에이전트-논쟁에서의-위치)
9. [발표 활용 포인트](#9-발표-활용-포인트)
10. [참고 자료](#10-참고-자료)

---

## 1. 개요

레포의 한 줄 자기소개:

> _"Production-grade agent team harness collection for Claude Code"_  
> — [github.com/revfactory/harness-100](https://github.com/revfactory/harness-100)

**100개 하네스의 도메인 분류** (각 도메인의 대표 하네스 한 개씩):

| 번호   | 도메인              | 대표 하네스                                         | 내장 프레임워크 (일부)           |
| ------ | ------------------- | --------------------------------------------------- | -------------------------------- |
| 01–15  | 콘텐츠 창작         | `01-youtube-production`                             | AIDA, Pattern Interrupt, SEO     |
| 16–30  | 소프트웨어 개발     | `16-fullstack-webapp`, `21-code-reviewer`           | SOLID, DDD, OWASP Top 10         |
| 31–42  | 데이터 & AI/ML      | `41-llm-app-builder`                                | Star Schema, SHAP/LIME           |
| 43–55  | 비즈니스 & 전략     | `43-startup-launcher`, `53-financial-modeler`       | BMC, Porter's 5 Forces, OKR, DCF |
| 56–65  | 교육 & 학습         | `56-language-tutor`, `58-thesis-advisor`            | Bloom's Taxonomy, ADDIE, CEFR    |
| 66–72  | 법률 & 규정         | `66-contract-analyzer`, `69-privacy-engineer`       | IRAC, GDPR/PIPA                  |
| 73–80  | 건강 & 라이프스타일 | `73-meal-planner`, `74-fitness-program`             | BMR/TDEE, ACSM Guidelines        |
| 81–88  | 커뮤니케이션 & 문서 | `81-technical-writer`, `83-sop-writer`              | Diataxis, PREP, MADR             |
| 89–95  | 운영 & 프로세스     | `90-hiring-pipeline`, `91-onboarding-system`        | SIPOC/RACI, SMART                |
| 96–100 | 전문 도메인         | `96-real-estate-analyst`, `99-sustainability-audit` | GHG Protocol, Cap Rate/IRR       |

---

## 2. 왜 이 레포를 케이스 스터디로 다루는가

세 가지 이유:

1. **이론 ↔ 실전의 1:1 매핑**. [docs/01](./01-what-is-harness-engineering.md)에서 추상적으로 정의한 하네스의 8개 구성요소(시스템 프롬프트, 도구, 루프, 컨텍스트, 메모리, 권한, sub-agent, 가드레일)가 실제로 1,800+ 마크다운 파일 단위로 구현돼 있다. 발표에서 _"이런 게 정말 가능한가요?"_ 라는 질문에 가장 빠르게 답할 수 있는 자료.

2. **청중 친숙도**. 작성자는 한국 개발자(revfactory)이고 [한국어 README](https://github.com/revfactory/harness-100/blob/main/README_ko.md)가 영문과 동일 수준으로 정비되어 있다. 사내 청중이 발표 후 직접 따라가기 쉽다.

3. **즉시 사용 가능**. `cp -r en/01-youtube-production/.claude/ /path/to/my-project/.claude/` 한 줄로 자기 프로젝트에 붙여 쓸 수 있다(Apache 2.0). 발표 메시지 _"하네스 엔지니어링은 먼 미래가 아니라 이미 공개 자산이다"_ 의 가장 강한 근거.

---

## 3. 표준 하네스 구조 (Anatomy)

100개 하네스 전체가 동일한 디렉토리 구조를 따른다:

```
{NN}-{harness-name}/
└── .claude/
    ├── CLAUDE.md                  # 프로젝트 개요, 사용법, 산출물 리스트
    ├── agents/
    │   ├── {specialist-1}.md      # 전문가 에이전트 (시스템 프롬프트)
    │   ├── {specialist-2}.md
    │   ├── {specialist-3}.md
    │   ├── {specialist-4}.md
    │   └── {reviewer}.md          # 마지막 교차 검증 담당
    └── skills/
        ├── {orchestrator}/
        │   └── skill.md           # 팀 조율 + 워크플로 정의
        ├── {domain-skill-1}/
        │   └── skill.md           # 에이전트 확장 지식
        └── {domain-skill-2}/
            └── skill.md
```

### Agent 파일 — YAML frontmatter + 마크다운 본문

```markdown
---
name: architect
description: "System architect. Analyzes requirements and performs system architecture..."
---

# Architect — System Architect

You are a fullstack web app system design expert...

## Core Responsibilities

1. Requirements Analysis
2. Architecture Design
   ...
```

- `name` / `description` 은 Claude Code 런타임이 에이전트를 식별·호출할 때 쓰는 메타데이터.
- 본문은 그 에이전트의 **시스템 프롬프트** 역할.

### Skill 파일 — Workflow 선언서

```markdown
---
name: fullstack-webapp
description: "A full development pipeline where..."
---

# Fullstack Web App — Fullstack Web App Development Pipeline

## Execution Mode

**Agent Team** — 5 agents communicate directly via SendMessage and cross-verify.

## Agent Composition

[테이블로 에이전트 목록]

## Workflow

### Phase 1: Preparation

1. Extract user input
2. Create \_workspace/ directory
   ...

## Scale-Based Modes

[모드별 에이전트 선택 로직]

## Error Handling

[에러 타입별 대응 전략]

## Test Scenarios

[3가지 테스트 시나리오]
```

Orchestrator skill은 **실행 가능한 코드가 아니라 워크플로 선언서**다. Claude Code 런타임이 이 파일을 읽어 어떤 에이전트를 언제·어떤 순서·어떤 병렬로 호출할지 결정한다.

---

## 4. 핵심 설계 개념 7가지

README가 강조하는 품질 기준 7가지. 각 항목은 [docs/01의 핵심 구성요소(4장)](./01-what-is-harness-engineering.md#4-하네스의-핵심-구성요소-anatomy)와 직접 대응된다.

### (1) Agent Team Mode — SendMessage peer-to-peer

> _"SendMessage direct communication, cross-validation"_

중앙 조정자 없이 4~5명의 specialist agent가 `SendMessage` 도구로 직접 메시지를 주고받는다. 마지막 reviewer/qa 에이전트가 교차 검증.

### (2) Domain Expertise — 실전 프레임워크 내장

> _"Real frameworks (OWASP, Bloom's Taxonomy, Porter's 5 Forces, DCF, etc.)"_

각 도메인의 표준 방법론이 시스템 프롬프트와 sub-skill에 임베드. 예: `fullstack-webapp`의 architect는 KISS·Scalability·Security First 원칙 + 규모별 기본 스택(MVP: Next.js + SQLite, Medium: Next.js + Prisma + PostgreSQL)을 명시.

### (3) Structured Outputs

각 에이전트의 산출물 포맷이 정해진 템플릿. `youtube-production`의 scriptwriter는 `(hook, segments, CTA, visual cues)` 를 포함한 타임코드 기반 스크립트를, architect는 `Architecture Design / API Specification / DB Schema` 를 마크다운으로 구조화.

### (4) Dependency DAG — Workflow 선언

각 skill.md의 "Workflow" 섹션이 명시적으로 작업 순서·병렬을 정의. `youtube-production` 의 예:

```
Task 1 (strategy)        ── 의존 없음
Task 2a (script)         ── Task 1 의존
Task 2b (thumbnail)      ── Task 1 의존     (2a, 2b 병렬)
Task 3 (SEO)             ── Task 1, 2a 의존
Task 4 (review)          ── Task 2a, 2b, 3 의존
```

### (5) Scale Modes — 적응형 에이전트 배포

> _"Full pipeline / reduced / single-agent"_

사용자 요청 범위에 따라 어떤 에이전트를 띄울지 선택. `fullstack-webapp`은 5종 모드 (Full Pipeline / Backend / Frontend / Refactoring / DevOps).

### (6) Error Handling — Retry / Skip / Fallback

각 skill.md에 에러 타입별 대응 정책이 명시. 도구 호출 실패, 모호한 요구사항, 검색 무결과 등 경우별.

### (7) Test Scenarios — 3가지 흐름 사전 정의

각 하네스가 다음 3가지 흐름을 미리 적어둔다:

1. **Happy Path** — 정상 사용
2. **Existing File Flow** — 사용자가 기존 파일(스크립트, 코드)을 제공했을 때
3. **Error Flow** — 모호한 요구사항·검색 실패 시 폴백

---

## 5. 샘플 deep-dive ① — `01-youtube-production`

**도메인**: 콘텐츠 창작. 청중에게 직관적으로 와닿는 도메인.

### 에이전트 5명

| 에이전트              | 역할                                |
| --------------------- | ----------------------------------- |
| `content-strategist`  | 주제 분석, 경쟁 벤치마킹, 컨셉 설계 |
| `scriptwriter`        | 훅 작성, 세그먼트 구성, 자막 지시   |
| `thumbnail-designer`  | 썸네일 컨셉 + Gemini 이미지 생성    |
| `seo-optimizer`       | 제목/설명/태그/자막/챕터            |
| `production-reviewer` | 전체 교차 검증                      |

### 확장 스킬 2개

- `hook-writing` — 15개 훅 패턴(_Shock Stat_, _Contrarian Statement_, _Result First_ 등), 시청자 심리학, "Hook–Thumbnail–Title Triangle Alignment"
- `thumbnail-psychology` — 색상 심리학, 7개 구성 패턴, 텍스트 가독성

### 워크플로

```
[Strategy]
    │
    ├──► [Script]   ─┐
    │                ├──► [SEO] ──► [Review]
    └──► [Thumbnail] ┘
        (병렬 실행)
```

### 산출물

`_workspace/` 디렉토리에 6개 마크다운(strategy/script/thumbnail brief/seo/...) + 1개 SRT 자막.

---

## 6. 샘플 deep-dive ② — `16-fullstack-webapp`

**도메인**: 소프트웨어 개발. 우리 [demo/](../demo/) 폴더의 미니 하네스와 가장 가까운 영역.

### 에이전트 5명

| 에이전트          | 역할                                            |
| ----------------- | ----------------------------------------------- |
| `architect`       | 요구사항 분석, 시스템 설계, DB 모델링, API 설계 |
| `frontend-dev`    | React/Next.js, UI 컴포넌트, 상태 관리           |
| `backend-dev`     | API 구현, DB 통합, 인증/인가, 비즈니스 로직     |
| `qa-engineer`     | 테스트 전략, 단위/통합/E2E 테스트, 코드 리뷰    |
| `devops-engineer` | CI/CD, 인프라, 배포, 모니터링                   |

### 확장 스킬 2개

- `component-patterns` — Compound / Render Props / HOC / Custom Hooks, 상태 관리 가이드, Next.js 폴더 구조
- `api-security-checklist` — OWASP Top 10, 인증 방식, 보안 헤더

### Scale Modes 5종

| 모드             | 배포되는 에이전트                                                      |
| ---------------- | ---------------------------------------------------------------------- |
| Full Pipeline    | architect + frontend-dev + backend-dev + qa-engineer + devops-engineer |
| Backend Mode     | architect + backend-dev + qa-engineer                                  |
| Frontend Mode    | architect + frontend-dev + qa-engineer                                 |
| Refactoring Mode | architect + 해당 영역 dev + qa-engineer                                |
| DevOps Mode      | devops-engineer (단독)                                                 |

### 워크플로

```
[Architecture]
      │
      ├──► [Frontend] ─┐
      ├──► [Backend]  ─┼──► [Testing & Review]
      └──► [DevOps]   ─┘
          (병렬 실행)
```

### 산출물

`_workspace/` 디렉토리의 설계 문서 6종 + `src/` 안의 실제 코드.

### 두 샘플의 공통점·차이점

- **공통**: `Phase 1 (입력 정리) → Phase 2 (팀 조율) → Phase 3 (최종 통합)` 구조. SendMessage peer-to-peer 통신, reviewer 교차 검증.
- **차이**: youtube-production 산출물은 전부 문서. fullstack-webapp은 설계 문서 + 실제 소스 코드. 후자의 Scale Modes는 기존 코드 분석 후 필요한 에이전트만 배포하는 적응성을 가짐.

---

## 7. docs/01 8개 구성요소와의 매칭

[docs/01 4장](./01-what-is-harness-engineering.md#4-하네스의-핵심-구성요소-anatomy) 의 8개 구성요소 × harness-100에서 어떻게 구현됐는지:

| 구성요소                       | harness-100 구현                                                                                                     | 상태           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| (1) 시스템 프롬프트            | `agents/{name}.md` 본문 (YAML frontmatter 제외)                                                                      | ✅ 명시적      |
| (2) 도구 정의                  | 명시적 도구 목록 없음, Claude Code 내장 도구(WebSearch, WebFetch, Gemini image gen 등) 사용                          | ⚠️ 암묵적      |
| (3) tool-use loop              | Claude Code 런타임에 위임 (하네스 외부)                                                                              | ✅ 런타임 처리 |
| (4) 컨텍스트 관리              | `_workspace/` 공유 디렉토리에 Phase 1의 `00_input.md` 등 공유 파일                                                   | ✅ 파일 기반   |
| (5) 메모리                     | `CLAUDE.md` (프로젝트 전역) + `agents/{name}.md` (역할 메모리)                                                       | ✅ 명시적      |
| (6) 권한                       | 명시적 `.claude/settings.json` 없음. agent "Working Principles" 섹션에 암묵적 (예: thumbnail-designer만 이미지 생성) | ⚠️ 암묵적      |
| (7) sub-agent / 오케스트레이션 | **핵심 강점**: skill.md의 Workflow + Scale Modes로 어떤 에이전트를 언제 호출할지 선언적 정의                         | ✅ 핵심        |
| (8) 가드레일                   | Error Handling + Test Scenarios + Trigger Boundaries(should-trigger / NOT-trigger)                                   | ✅ 다층        |

**누락·보완 여지**:

- 권한 정책이 명시적으로 분리돼 있지 않음 → 사내 production 도입 시 `.claude/settings.json` 추가 필요.
- MCP(Model Context Protocol) 도구 통합은 보이지 않음. 외부 시스템(Slack/GitHub/Jira)을 붙이려면 별도 작업.

---

## 8. 멀티에이전트 논쟁에서의 위치

[docs/01 7장](./01-what-is-harness-engineering.md#7-현재-논쟁--멀티에이전트는-정말-좋은가) 에서 다룬 Cognition vs Anthropic 논쟁에서 harness-100은 **명확한 Anthropic 진영**.

### 4가지 증거

1. **컨텍스트 격리 + 공유**. 각 에이전트는 독립적인 시스템 프롬프트(`agents/{name}.md`)를 가지지만, `_workspace/` 파일을 통해 컨텍스트를 공유. Cognition이 비판한 _"단일 거대 프롬프트"_ 와 다르고 _"각자 잘리는 컨텍스트"_ 도 아닌, **명시적 공유 영역**을 사이에 둔 구조.
2. **SendMessage 순차·명시적 메시지**. 에이전트 간 통신이 _"모든 정보가 한 번에 프롬프트에 들어간다"_ 가 아니라 명시적 메시지 단위.
3. **Reviewer 교차 검증**. Anthropic이 권장하는 "여러 관점에서 검증"을 마지막 reviewer 에이전트로 구현.
4. **Workflow 선언적 정의**. _"복잡한 조율"_ 을 무릅쓰고 **명시성**을 택함. Phase·Task·의존성을 사람이 읽고 검증할 수 있게 마크다운으로 노출.

### docs/01 7장 결론과의 정합

[docs/01 7장 결론](./01-what-is-harness-engineering.md#73-두-입장이-모순되는가) — _"문제가 본질적으로 병렬화 가능한가, 그리고 오케스트레이터가 결정의 일관성을 보장할 수 있는가의 두 조건이 채택 여부를 가른다"_ — 을 harness-100이 어떻게 만족하는지:

- **병렬화 가능성**: 각 도메인의 작업을 frontend/backend/devops 또는 script/thumbnail 같이 본질적으로 독립적인 부분 작업으로 쪼개 둠.
- **결정 일관성 보장**: orchestrator skill의 Workflow 선언이 결정 순서를 못박고, reviewer가 마지막에 충돌을 잡는 구조.

---

## 9. 발표 활용 포인트

### 슬라이드 한 장 제안 — "이론 ↔ 실전" 매핑

7장의 8개 구성요소 매칭표를 슬라이드 한 장으로 옮긴다. 청중에게 _"docs/01이 추상이 아니라 production-grade로 실재한다"_ 를 한눈에 전달.

### 시연 거리 1 — 한 줄 설치

```bash
git clone https://github.com/revfactory/harness-100
cp -r harness-100/en/01-youtube-production/.claude/ /path/to/my-project/.claude/
# 이제 my-project 폴더에서 Claude Code를 켜면 5명 에이전트가 활성화
```

라이브로 보여주면 "오늘 사내에서 하네스 만들기"가 결코 SF가 아님이 증명된다.

### 시연 거리 2 — agent.md 한 개 열어보기

`agents/architect.md` 를 IDE에서 열어 _YAML frontmatter + 시스템 프롬프트_ 구조를 청중에게 직접 보여준다. docs/01의 4(1) "시스템 프롬프트" 개념이 마크다운 파일 하나로 끝난다는 사실이 전달된다.

### Q&A 대비

- **"Claude Code 없이도 쓸 수 있나요?"** → 마크다운 파일들이라 다른 런타임으로 포팅 이론적으로 가능. 단, `SendMessage` 같은 도구는 Claude Code 종속이라 그 부분은 자체 구현 필요.
- **"100개를 다 외워야 하나요?"** → 아니. 자기 도메인 1~2개만 가져다 쓰고 나머지는 참고 사전.
- **"보안적으로 괜찮나요?"** → `.claude/settings.json` 권한 정책은 사용자가 추가해야 함. 도구 접근·bash 실행 등은 별도 검토 필요. ([docs/01 4.(5) 권한 시스템](./01-what-is-harness-engineering.md#5-권한-시스템-permissions--sandboxing) 참고)

---

## 10. 참고 자료

- 레포: <https://github.com/revfactory/harness-100>
- 한국어 README: <https://github.com/revfactory/harness-100/blob/main/README_ko.md>
- 영문 README: <https://github.com/revfactory/harness-100/blob/main/README.md>
- 라이선스 (Apache 2.0): <https://github.com/revfactory/harness-100/blob/main/LICENSE>

### 본 문서와 연결되는 docs/01 섹션

- [4장: 하네스의 핵심 구성요소 (Anatomy)](./01-what-is-harness-engineering.md#4-하네스의-핵심-구성요소-anatomy)
- [5장: 하네스 엔지니어링이란 — 심화](./01-what-is-harness-engineering.md#5-하네스-엔지니어링이란--심화)
- [7장: 현재 논쟁 — 멀티에이전트는 정말 좋은가](./01-what-is-harness-engineering.md#7-현재-논쟁--멀티에이전트는-정말-좋은가)
- [scenarios/harness-engineering.md](./scenarios/harness-engineering.md) — 같은 도메인(사내 Q&A 봇)에 도구·루프·메모리·권한·MCP를 적용한 가상 시나리오. harness-100의 production-grade 사례와 비교해 읽으면 도움이 된다.
