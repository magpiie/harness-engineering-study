# Demo — 미니 하네스 구현

[../docs/01-what-is-harness-engineering.md](../docs/01-what-is-harness-engineering.md)에서 정의한 **하네스(harness)** 의 핵심 구성요소를 직접 코드로 구현하는 폴더다. 이 README는 실제 코드 구현 전 단계의 명세서이며, 코드 파일은 별도 작업에서 추가한다.

## 목표

LLM API 위에 **하네스 = 시스템 프롬프트 + 도구 정의 + 도구 호출 루프 + 간단한 메모리** 가 어떻게 동작하는지 100줄 안팎의 코드로 보여준다. 그리고 같은 작업을 Claude Agent SDK로 다시 구현해 "프로덕션급 하네스가 무엇을 더 주는가" 를 비교한다.

## 단계별 구현 계획

각 단계는 별도 파일로 분리한다. 단계가 올라갈수록 docs/01 4장(Anatomy)에서 정리한 하네스 구성요소가 하나씩 더 붙는다.

### Step 1 — Bare LLM 호출

- 파일(예정): `step1_bare_call.py`
- 내용: `anthropic` SDK로 `messages.create()` 한 번만 호출. 도구 없음, 루프 없음.
- 목적: "이 단계에서는 agent가 아니라 chat 응답일 뿐" 임을 확인하는 베이스라인.

### Step 2 — Tool-use 1회

- 파일(예정): `step2_single_tool_use.py`
- 내용: `read_file` 같은 도구를 1개 정의하고, 모델이 `tool_use`를 반환하면 하네스가 한 번 실행해 `tool_result`를 돌려준 뒤 그대로 종료.
- 목적: 도구 호출 인터페이스(`tool_use` / `tool_result`)와 JSON Schema 도구 정의를 코드 레벨에서 익힌다.

### Step 3 — 루프 추가

- 파일(예정): `step3_tool_use_loop.py`
- 내용: Step 2를 `while not done` 루프로 감싸 모델이 `end_turn` (혹은 더 이상 `tool_use`가 없을 때) 신호를 줄 때까지 반복.
- 목적: ReAct 패턴(루프)이 추가되는 순간 시스템이 비로소 "agent" 로 동작함을 확인.
- 가드레일: `max_turns`, 토큰 상한 정도만 최소로 추가.

### Step 4 — 메모리 추가

- 파일(예정): `step4_with_memory.py` (+ 예시 `CLAUDE.md`)
- 내용: 같은 폴더의 `CLAUDE.md` 를 시스템 프롬프트에 자동으로 합쳐 넣고, 한 세션의 학습 사항을 `memory/` 폴더에 저장·재로딩.
- 목적: 멀티 세션 메모리가 결과 품질에 어떻게 영향을 주는지 step 3과 비교.

### Step 5 — Claude Agent SDK 재구현

- 파일(예정): `step5_with_agent_sdk.py`
- 내용: Step 1~4에서 직접 구현한 기능을 Claude Agent SDK로 다시 작성. 자동 컴팩션·내장 도구·권한 시스템 등 SDK가 기본 제공하는 기능이 추가된다.
- 목적: "수동 구현 vs SDK" 의 코드량·기능 차이를 한 번에 보여준다.

## 사용할 SDK / 언어

기본: **Python 3.10+** + `anthropic` 패키지 + `claude-agent-sdk` 패키지.

- 1차 출처: [docs.claude.com/en/api/agent-sdk/python](https://docs.claude.com/en/api/agent-sdk/python)
- 대안: TypeScript SDK ([docs.claude.com/en/api/agent-sdk/typescript](https://docs.claude.com/en/api/agent-sdk/typescript)) — 실제 구현 시작 시 사용자 합의로 결정.

## 사전 준비

- `ANTHROPIC_API_KEY` 환경변수 — `.env` 파일로 관리. (`.gitignore`에 이미 등록되어 있다.)
- Python 3.10 이상.
- 가상환경(`.venv`) 사용 권장. (`.gitignore` 등록 완료.)
- 다음 단계 시작 시 `requirements.txt` 또는 `pyproject.toml` 추가.

## 폴더 구조 (예정)

```
demo/
├── README.md                  # 이 파일
├── requirements.txt           # 다음 단계에서 추가
├── .env.example               # 다음 단계에서 추가
├── step1_bare_call.py
├── step2_single_tool_use.py
├── step3_tool_use_loop.py
├── step4_with_memory.py
├── step5_with_agent_sdk.py
├── CLAUDE.md                  # step4 데모용
└── memory/                    # step4 auto-memory 저장소
```

## 다음 작업 시작 시 체크리스트

1. Python 3.10+ 와 가상환경 확인.
2. `requirements.txt` (`anthropic`, `claude-agent-sdk`, `python-dotenv`) 작성 후 설치.
3. `.env.example` 작성 — `ANTHROPIC_API_KEY=` 한 줄.
4. Step 1 코드 작성으로 시작.
