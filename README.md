# Next Design Tokens

Next.js 14 (App Router) + Tailwind v4 + **Design Tokens** (Figma Tokens Studio 연동) 기본 보일러플레이트입니다.  
개인 레포나 새 프로젝트 시작용으로 사용할 수 있습니다.

## 포함 내용

- **Next.js 14** (App Router)
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Design Tokens**: Token Studio JSON → CSS 변수 + TypeScript 자동 생성
  - `src/token/tokens.json` — 토큰 정의 (Figma Tokens Studio export 형식)
  - `src/token/sync-tokens-studio.ts` — 변환 스크립트
  - `src/styles/design-tokens.css` — 자동 생성 (CSS 변수)
  - `src/styles/design-tokens.ts` — 자동 생성 (TS 객체/export)

## 시작하기

```bash
pnpm install
pnpm sync:tokens   # tokens.json → design-tokens.css / design-tokens.ts 생성
pnpm dev
```

빌드:

```bash
pnpm build
pnpm start
```

## 토큰 수정 흐름

1. **Figma Tokens Studio**에서 토큰 수정 후 **Single file + All token sets**로 Export
2. 내보낸 파일을 `src/token/tokens.json`으로 저장 (기존 파일 교체)
3. 터미널에서 `pnpm sync:tokens` 실행
4. `src/styles/design-tokens.css`, `design-tokens.ts`가 갱신됨

## 사용 예시

- **CSS/Tailwind**: `globals.css`에서 `design-tokens.css`를 import하므로, 생성된 유틸리티 클래스 사용 가능
  - 예: `text-primary`, `bg-brand`, `bg-secondary`, `text-inverse`, `border-primary`
- **TypeScript**: `import { textColors, bgColors, tailwindColors } from '@/styles/design-tokens';`

## 디렉터리 구조

```
src/
├── app/
│   ├── globals.css      # tailwind + design-tokens.css import
│   ├── layout.tsx
│   └── page.tsx
├── token/
│   ├── tokens.json      # Token Studio export (직접 편집/교체)
│   └── sync-tokens-studio.ts
└── styles/
    ├── design-tokens.css  # 자동 생성
    └── design-tokens.ts   # 자동 생성
```

`design-tokens.css` / `design-tokens.ts`는 **자동 생성 파일**이므로 직접 수정하지 말고, 토큰은 `tokens.json`에서만 관리한 뒤 `pnpm sync:tokens`로 다시 생성하세요.
# next_design_token
