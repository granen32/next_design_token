/**
 * Design Tokens - Auto-generated from Figma (Tokens Studio)
 * Generated at: 2026-02-05T00:39:26.274Z
 *
 * ⚠️ 이 파일은 자동 생성됩니다. 직접 수정하지 마세요.
 * 수정이 필요하면 Figma에서 변경 후 pnpm sync:tokens 실행
 */

export const designTokens = {
  "colors": {
    "primitive": {
      "base": {
        "white": "#ffffff",
        "black": "#18181b"
      },
      "neutral": {
        "100": "#f8f8f8",
        "500": "#b4b4b4",
        "700": "#565656",
        "900": "#2f2f2f"
      },
      "blue": {
        "500": "#387adf"
      },
      "purple": {
        "500": "#604fed",
        "600": "#5746e2"
      },
      "red": {
        "500": "#ff3757"
      }
    },
    "text": {
      "primary": "#18181b",
      "secondary": "#565656",
      "inverse": "#ffffff"
    },
    "bg": {
      "primary": "#ffffff",
      "secondary": "#f8f8f8",
      "brand": "#604fed"
    },
    "border": {
      "primary": "#b4b4b4"
    },
    "icon": {}
  },
  "spacing": {
    "size-unit-0": "0px",
    "size-unit-4": "4px",
    "size-unit-8": "8px",
    "size-unit-16": "16px",
    "size-unit-24": "24px",
    "space-0": "0px",
    "space-4": "4px",
    "space-8": "8px",
    "space-16": "16px",
    "space-24": "24px"
  },
  "container": {},
  "fontSize": {},
  "lineHeight": {},
  "fontWeight": {},
  "letterSpacing": {},
  "borderRadius": {},
  "borderWidth": {},
  "typography": {
    "heading": {},
    "body": {}
  }
} as const;

export const textColors = designTokens.colors.text;
export const bgColors = designTokens.colors.bg;
export const borderColors = designTokens.colors.border;
export const iconColors = designTokens.colors.icon;
export const primitiveColors = designTokens.colors.primitive;
export const spacing = designTokens.spacing;
export const container = designTokens.container;
export const fontSize = designTokens.fontSize;
export const lineHeight = designTokens.lineHeight;
export const fontWeight = designTokens.fontWeight;
export const letterSpacing = designTokens.letterSpacing;
export const borderRadius = designTokens.borderRadius;
export const borderWidth = designTokens.borderWidth;
export const headingTypography = designTokens.typography.heading;
export const bodyTypography = designTokens.typography.body;

export const tailwindColors = {
  text: textColors,
  bg: bgColors,
  border: borderColors,
  icon: iconColors,
  ...primitiveColors,
};

export default designTokens;
