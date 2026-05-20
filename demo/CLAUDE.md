# Demo 폴더 가이드 (CLAUDE.md)

이 폴더는 "하네스 엔지니어링" 사내 스터디 발표용 미니 하네스 구현이다. 각 step은 [docs/01의 4장(Anatomy)](../docs/01-what-is-harness-engineering.md#4-하네스의-핵심-구성요소-anatomy)에서 정의한 하네스 구성요소를 한 단계씩 보여준다.

## 단계별 의도

- **step1** — bare LLM 호출 (도구·루프 없음 — 베이스라인, agent 아님)
- **step2** — function calling 1회 (functionCall/functionResponse 인터페이스 학습)
- **step3** — function calling 루프 (능동적 다단계 탐색 — 비로소 agent)
- **step4** — 메모리 (이 파일 + `memory/*.md`를 시스템 프롬프트에 자동 합성)
- **step5** — 프로덕션 프레임워크 비교 (예정)

## 작업 컨벤션

- 모델: `gemini-2.5-flash` (Google AI Studio 무료 티어)
- 모든 LLM 호출은 `utils.ts`의 `withRetry`로 감싼다 (503/429 자동 복구)
- 텍스트 추출은 `utils.ts`의 `extractText` (functionCall 있을 때 SDK warning 회피)
- 도구 경로는 `demo/` 폴더 루트 기준 상대경로
