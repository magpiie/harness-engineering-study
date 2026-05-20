# Demo — 미니 하네스 구현

[01-what-is-harness-engineering.md](../docs/01-what-is-harness-engineering.md)에서 정의한 **하네스(harness)** 의 핵심 구성요소를 직접 코드로 구현하는 폴더다. 각 단계는 별도 파일로 두어, docs/01 4장(Anatomy)에서 정리한 구성요소가 한 단계씩 추가되는 모습을 보여준다.

## 목표

LLM API 위에 **하네스 = 시스템 프롬프트 + 도구 정의 + 도구 호출 루프 + 간단한 메모리** 가 어떻게 동작하는지 100줄 안팎의 코드로 보여준다. 그리고 같은 작업을 프로덕션급 프레임워크로 다시 구현해 "프레임워크가 무엇을 가려주는가" 를 비교한다.

## 사용할 SDK / 언어

**TypeScript (Node.js 20+) + Google Gemini API** 를 사용한다. 스터디 발표 시연이 무료로 가능하도록 Gemini 무료 티어를 활용한다.

- `@google/genai` — Google 공식 통합 SDK ([github.com/googleapis/js-genai](https://github.com/googleapis/js-genai))
- 실행기는 `tsx` — 컴파일 없이 `.ts` 파일을 바로 실행 (학습 데모용)
- 패키지 매니저는 `npm` 기준
- 모델: `gemini-2.5-flash` (무료 티어 제공, function calling 정식 지원)

> docs/01에서 인용한 *"Anthropic 측정 72.5% vs 36%"* 같은 1차 출처는 그대로 유지한다 — 그건 하네스라는 **개념의 출처**이고, 본 demo는 그 개념을 **실증하는 미니어처**다. 어느 모델 회사 SDK로 만들어도 메시지("LLM + 하네스 = 에이전트")는 동일하다. Step 5는 프로덕션급 프레임워크와 비교하는 단계로, 모델 무관 추상화(예: Vercel AI SDK) 또는 Google ADK 중에서 선택한다.

## 단계별 구현 계획

### Step 1 — Bare LLM 호출

- 파일: `step1_bare_call.ts`
- 내용: `ai.models.generateContent()` 한 번만 호출. 도구 없음, 루프 없음.
- 목적: "이 단계에서는 agent가 아니라 chat 응답일 뿐" 임을 확인하는 베이스라인.

### Step 2 — Function calling 1회

- 파일: `step2_single_tool_use.ts`
- 내용: `list_directory` 도구 1개를 정의하고, 모델이 `functionCall`을 반환하면 하네스가 한 번 실행해 `functionResponse`를 돌려준 뒤 그대로 종료.
- 목적: function calling 인터페이스(`functionCall` / `functionResponse`)와 JSON Schema 도구 정의를 코드 레벨에서 익힌다.

### Step 3 — 루프 추가

- 파일: `step3_tool_use_loop.ts`
- 내용: Step 2를 `while (turn < MAX_TURNS)` 루프로 감싸 모델이 더 이상 `functionCall`을 반환하지 않을 때까지 반복. `read_file` 도구도 추가.
- 목적: ReAct 패턴(루프)이 추가되는 순간 시스템이 비로소 "agent" 로 동작함을 확인.
- 가드레일: `MAX_TURNS`, `is_error` 핸들링 정도만 최소로 추가.

### Step 4 — 메모리 추가

- 파일: `step4_with_memory.ts` (+ 예시 `CLAUDE.md`)
- 내용: 같은 폴더의 `CLAUDE.md` 를 시스템 프롬프트에 자동으로 합쳐 넣고, 한 세션의 학습 사항을 `memory/` 폴더에 저장·재로딩.
- 목적: 멀티 세션 메모리가 결과 품질에 어떻게 영향을 주는지 step 3과 비교.

### Step 5 — 프레임워크 재구현

- 파일: `step5_with_framework.ts`
- 내용: Step 1~4에서 직접 구현한 기능을 프로덕션급 프레임워크로 다시 작성. 후보: Vercel AI SDK(모델 무관 추상화) 또는 Google ADK.
- 목적: "수동 구현 vs 프레임워크" 의 코드량·기능 차이를 한 번에 보여준다.

## 사전 준비

- `GEMINI_API_KEY` 환경변수 — `.env` 파일로 관리. (`.env`는 루트 `.gitignore`에 이미 등록되어 있다.)
- API 키 발급: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — 무료, 카드 등록 불필요.
- **Node.js 20 이상** (현재 환경 확인: `node --version`).
- 패키지 설치는 `demo/` 폴더 안에서 진행 (루트가 아니라 `demo/`에 격리된 `package.json`).

## 폴더 구조

```
demo/
├── README.md                  # 이 파일
├── package.json               # demo 전용 의존성·실행 스크립트
├── tsconfig.json              # TypeScript 설정
├── .env.example               # GEMINI_API_KEY 예시
├── step1_bare_call.ts
├── step2_single_tool_use.ts
├── step3_tool_use_loop.ts
├── step4_with_memory.ts
├── step5_with_framework.ts
├── CLAUDE.md                  # step4 데모용
└── memory/                    # step4 auto-memory 저장소
```

## 실행 방법

```bash
cd demo
npm install                    # 최초 1회
cp .env.example .env           # PowerShell: Copy-Item .env.example .env
# .env에 GEMINI_API_KEY 채우기
npm run step1                  # 또는 npx tsx step1_bare_call.ts
npm run step2
npm run step3
```

## 무료 티어 한도 (참고)

Gemini 2.5 Flash 무료 티어 (2026 기준, 변동 가능):
- 분당 요청 10~15 RPM
- 일일 1,000~1,500 RPD
- 분당 토큰 250K~1M

발표 시연 1회 + 리허설 몇 번은 여유롭게 무료 범위 안. ⚠️ 단, 무료 티어는 Google이 학습 데이터로 사용 가능 — 사내 비밀 코드/문서는 입력하지 말 것.
