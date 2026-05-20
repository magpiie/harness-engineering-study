# Demo — 미니 하네스 구현

[01-what-is-harness-engineering.md](../docs/01-what-is-harness-engineering.md)에서 정의한 **하네스(harness)** 의 핵심 구성요소를 직접 코드로 구현하는 폴더다. 각 단계는 별도 파일로 두어, docs/01 4장(Anatomy)에서 정리한 구성요소가 한 단계씩 추가되는 모습을 보여준다.

## 목표

LLM API 위에 **하네스 = 시스템 프롬프트 + 도구 정의 + 도구 호출 루프 + 간단한 메모리** 가 어떻게 동작하는지 100줄 안팎의 코드로 보여준다. 그리고 같은 작업을 Claude Agent SDK로 다시 구현해 "프로덕션급 하네스가 무엇을 더 주는가" 를 비교한다.

## 사용할 SDK / 언어

**TypeScript (Node.js 20+)** 를 기본 언어로 사용한다.

- `@anthropic-ai/sdk` — 1차 SDK ([docs.claude.com/en/api/client-sdks](https://docs.claude.com/en/api/client-sdks))
- `@anthropic-ai/claude-agent-sdk` — Step 5에서 사용 ([docs.claude.com/en/api/agent-sdk/typescript](https://docs.claude.com/en/api/agent-sdk/typescript))
- 실행기는 `tsx` — 컴파일 없이 `.ts` 파일을 바로 실행 (학습 데모용)
- 패키지 매니저는 `npm` 기준으로 셋업 (필요 시 `pnpm`으로 교체 가능)

## 단계별 구현 계획

### Step 1 — Bare LLM 호출

- 파일: `step1_bare_call.ts`
- 내용: `@anthropic-ai/sdk`로 `messages.create()` 한 번만 호출. 도구 없음, 루프 없음.
- 목적: "이 단계에서는 agent가 아니라 chat 응답일 뿐" 임을 확인하는 베이스라인.

### Step 2 — Tool-use 1회

- 파일: `step2_single_tool_use.ts`
- 내용: `read_file` 같은 도구를 1개 정의하고, 모델이 `tool_use`를 반환하면 하네스가 한 번 실행해 `tool_result`를 돌려준 뒤 그대로 종료.
- 목적: 도구 호출 인터페이스(`tool_use` / `tool_result`)와 JSON Schema 도구 정의를 코드 레벨에서 익힌다.

### Step 3 — 루프 추가

- 파일: `step3_tool_use_loop.ts`
- 내용: Step 2를 `while (!done)` 루프로 감싸 모델이 `end_turn` (혹은 더 이상 `tool_use`가 없을 때) 신호를 줄 때까지 반복.
- 목적: ReAct 패턴(루프)이 추가되는 순간 시스템이 비로소 "agent" 로 동작함을 확인.
- 가드레일: `maxTurns`, 토큰 상한 정도만 최소로 추가.

### Step 4 — 메모리 추가

- 파일: `step4_with_memory.ts` (+ 예시 `CLAUDE.md`)
- 내용: 같은 폴더의 `CLAUDE.md` 를 시스템 프롬프트에 자동으로 합쳐 넣고, 한 세션의 학습 사항을 `memory/` 폴더에 저장·재로딩.
- 목적: 멀티 세션 메모리가 결과 품질에 어떻게 영향을 주는지 step 3과 비교.

### Step 5 — Claude Agent SDK 재구현

- 파일: `step5_with_agent_sdk.ts`
- 내용: Step 1~4에서 직접 구현한 기능을 `@anthropic-ai/claude-agent-sdk`로 다시 작성. 자동 컴팩션·내장 도구·권한 시스템 등 SDK가 기본 제공하는 기능이 추가된다.
- 목적: "수동 구현 vs SDK" 의 코드량·기능 차이를 한 번에 보여준다.

## 사전 준비

- `ANTHROPIC_API_KEY` 환경변수 — `.env` 파일로 관리. (`.env`는 루트 `.gitignore`에 이미 등록되어 있다.)
- **Node.js 20 이상** (현재 환경 확인: `node --version`).
- 패키지 설치는 `demo/` 폴더 안에서 진행 (루트가 아니라 `demo/`에 격리된 `package.json`).

## 폴더 구조

```
demo/
├── README.md                  # 이 파일
├── package.json               # demo 전용 의존성·실행 스크립트
├── tsconfig.json              # TypeScript 설정
├── .env.example               # ANTHROPIC_API_KEY 예시
├── step1_bare_call.ts
├── step2_single_tool_use.ts
├── step3_tool_use_loop.ts
├── step4_with_memory.ts
├── step5_with_agent_sdk.ts
├── CLAUDE.md                  # step4 데모용
└── memory/                    # step4 auto-memory 저장소
```

## 실행 방법 (예정)

```bash
cd demo
npm install
cp .env.example .env
# .env에 ANTHROPIC_API_KEY 채우기
npm run step1   # 또는 npx tsx step1_bare_call.ts
```

## 다음 작업 시작 시 체크리스트

1. Node 20+ 설치 확인 (`node --version`).
2. `demo/package.json` (`@anthropic-ai/sdk`, `tsx`, `dotenv`, `typescript`) 작성 후 `npm install`.
3. `demo/tsconfig.json` 작성 (ESM, strict 모드).
4. `demo/.env.example` 작성.
5. Step 1 코드 작성으로 시작.
