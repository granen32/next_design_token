/**
 * Tokens Studio → Tailwind 변환 스크립트
 *
 * 사용법: pnpm sync:tokens
 *
 * 네이밍 컨벤션:
 * - 케이스: kebab-case
 * - 사이즈: 숫자 스케일 (space-16, font-size-12)
 * - 색상: semantic (text-primary, bg-brand)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 경로 설정
const TOKENS_INPUT_CANDIDATES = [
  path.join(__dirname, "tokens.json"),
  path.join(__dirname, "../tokens.json"),
  path.join(__dirname, "../token.json"),
  path.join(__dirname, "../../token/tokens.json"),
  path.join(__dirname, "../../token/token.json"),
  path.join(__dirname, "../../tokens.json"),
  path.join(__dirname, "../../token.json"),
];
const TOKENS_INPUT =
  TOKENS_INPUT_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ??
  TOKENS_INPUT_CANDIDATES[0];
const OUTPUT_DIR = path.join(__dirname, "../styles");

// ========== Tokens Studio raw format (Figma export) ==========
/** Single token entry: { $value, $type } or { value, type } */
interface TokenValue {
  value?: string | number;
  $value?: string | number;
  type?: TokenType;
  $type?: TokenType;
  description?: string;
  $description?: string;
}

/** Token type from Design Tokens spec */
type TokenType =
  | "color"
  | "dimension"
  | "number"
  | "fontWeight"
  | "duration"
  | "cubicBezier"
  | "string"
  | "border"
  | "shadow"
  | "typography";

/** Raw tree: either a token leaf or a nested group (branch) */
type RawTokenNode = TokenValue | RawTokenGroup;
interface RawTokenGroup {
  [key: string]: RawTokenNode | undefined;
}

/** Root of tokens.json: set names as keys */
type RawTokensRoot = Record<string, RawTokenNode | undefined>;

// ========== Output (Tailwind / app) types ==========
/** Nested color map: leaf is hex/rgb string, branch is key → subtree */
type ColorValueTree = string | NestedColorMap;
/** Top-level color groups are always objects (never a bare string) */
interface NestedColorMap {
  [key: string]: ColorValueTree;
}

interface TypographyPreset {
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
  fontWeight?: string;
}

/** Dimension/size tokens: flat key → CSS value (e.g. "8px", "1") */
type DimensionMap = Record<string, string>;

interface TailwindTokens {
  colors: {
    primitive: NestedColorMap;
    text: NestedColorMap;
    bg: NestedColorMap;
    border: NestedColorMap;
    icon: NestedColorMap;
  };
  spacing: DimensionMap;
  container: DimensionMap;
  fontSize: DimensionMap;
  lineHeight: DimensionMap;
  fontWeight: DimensionMap;
  letterSpacing: DimensionMap;
  borderRadius: DimensionMap;
  borderWidth: DimensionMap;
  typography: {
    heading: Record<string, TypographyPreset>;
    body: Record<string, TypographyPreset>;
  };
}

// 경고 수집기
const warnings: string[] = [];
const unresolvedRefs: string[] = [];

function addWarning(message: string) {
  warnings.push(message);
}

function addUnresolvedRef(ref: string) {
  if (!unresolvedRefs.includes(ref)) {
    unresolvedRefs.push(ref);
  }
}

// 키 이름 정규화: kebab-case
function normalizeKey(key: string): string {
  return key
    .replace(/[/:]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[()]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** font weight 키 → 클래스 접미사 */
function fontWeightToSlug(key: string): string {
  const k = key.toLowerCase().trim();
  const map: Record<string, string> = {
    "semi bold": "semibold",
    semibold: "semibold",
    "extra bold": "extrabold",
    extrabold: "extrabold",
    bold: "bold",
    medium: "medium",
    regular: "regular",
    light: "light",
    thin: "thin",
    black: "black",
  };
  return map[k] ?? normalizeKey(key).replace(/-/g, "");
}

function isTokenValueNode(value: unknown): value is TokenValue {
  return (
    typeof value === "object" &&
    value !== null &&
    ("value" in value || "$value" in value) &&
    ("type" in value || "$type" in value)
  );
}

function getTokenValue(value: TokenValue): string | number | undefined {
  return value.value ?? value.$value;
}

function getTokenType(value: TokenValue): TokenType | string | undefined {
  return value.type ?? value.$type;
}

function resolveReference(
  value: string | number,
  allTokens: RawTokensRoot,
  visited: Set<string> = new Set()
): string | number {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith("{") || !value.endsWith("}")) {
    return value;
  }

  const refPath = value.slice(1, -1);

  if (visited.has(refPath)) {
    addWarning(`순환 참조 감지: ${refPath}`);
    return value;
  }
  visited.add(refPath);

  const resolvedValue = findValueByPath(refPath, allTokens);

  if (resolvedValue !== null && resolvedValue !== undefined) {
    return resolveReference(resolvedValue, allTokens, visited);
  }

  addUnresolvedRef(refPath);
  return value;
}

function findValueByPath(
  pathStr: string,
  tokens: RawTokensRoot
): string | number | null {
  const parts = pathStr.split(".");

  function collectSearchRoots(
    obj: RawTokenNode | undefined,
    roots: RawTokenNode[] = []
  ): RawTokenNode[] {
    if (obj === undefined) return roots;
    roots.push(obj);
    if (typeof obj !== "object" || obj === null || isTokenValueNode(obj)) {
      return roots;
    }
    for (const value of Object.values(obj)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !isTokenValueNode(value)
      ) {
        collectSearchRoots(value, roots);
      }
    }
    return roots;
  }

  const searchRoots = collectSearchRoots(tokens as RawTokenNode);

  for (const root of searchRoots) {
    let current: RawTokenNode | string | number | null | undefined = root;
    let found = true;

    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        !isTokenValueNode(current)
      ) {
        const group = current as RawTokenGroup;
        if (group[part] !== undefined) {
          current = group[part];
        } else {
          const normalizedPart = part.toLowerCase().replace(/[-_\s]/g, "");
          const matchingKey = Object.keys(group).find((k) => {
            const normalizedKey = k.toLowerCase().replace(/[-_\s]/g, "");
            return normalizedKey === normalizedPart;
          });
          if (matchingKey) {
            current = group[matchingKey];
          } else {
            found = false;
            break;
          }
        }
      } else {
        found = false;
        break;
      }
    }

    if (found && current !== undefined && current !== null) {
      if (isTokenValueNode(current)) {
        const tokenValue = getTokenValue(current);
        return tokenValue !== undefined ? tokenValue : null;
      }
      if (typeof current === "string" || typeof current === "number") {
        return current;
      }
    }
  }

  return null;
}

function extractColors(
  tokens: RawTokenGroup,
  allTokens: RawTokensRoot
): NestedColorMap {
  function processNode(
    node: RawTokenGroup,
    _path: string[] = []
  ): NestedColorMap {
    const result: NestedColorMap = {};

    for (const [key, value] of Object.entries(node)) {
      if (key === "type" || key === "description") continue;
      if (value === undefined) continue;

      const normalizedKey = normalizeKey(key);

      if (typeof value === "object" && value !== null) {
        if (isTokenValueNode(value) && getTokenType(value) === "color") {
          const resolvedValue = resolveReference(
            getTokenValue(value) ?? "",
            allTokens
          );
          result[normalizedKey] = String(resolvedValue);
        } else if (!isTokenValueNode(value)) {
          const nested = processNode(value as RawTokenGroup, [
            ..._path,
            normalizedKey,
          ]);
          if (Object.keys(nested).length > 0) {
            result[normalizedKey] = nested;
          }
        }
      }
    }

    return result;
  }

  return processNode(tokens);
}

function countNestedTokens(
  obj: NestedColorMap | DimensionMap | Record<string, unknown>
): number {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (isTokenValueNode(value)) {
      count += 1;
    } else if (typeof value === "object" && value !== null) {
      count += countNestedTokens(value as Record<string, unknown>);
    } else {
      count++;
    }
  }
  return count;
}

function formatDimensionValue(
  value: string | number,
  options: { unit?: string | null } = {}
): string {
  if (typeof value === "number") {
    if (options.unit === null) {
      return String(value);
    }
    return `${value}${options.unit ?? "px"}`;
  }

  const trimmed = value.trim();
  if (options.unit === null) {
    return trimmed;
  }

  const isNumeric = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (isNumeric) {
    return `${trimmed}${options.unit ?? "px"}`;
  }

  return trimmed;
}

function extractDimensions(
  tokens: RawTokenGroup,
  allTokens: RawTokensRoot,
  options: { unit?: string | null } = {}
): DimensionMap {
  const result: DimensionMap = {};

  function processDimensionGroup(group: RawTokenGroup, prefix: string = "") {
    for (const [key, value] of Object.entries(group)) {
      if (key === "type" || key === "description") continue;

      const normalizedKey = normalizeKey(key);
      const fullKey = prefix ? `${prefix}-${normalizedKey}` : normalizedKey;

      if (typeof value === "object" && value !== null) {
        if (isTokenValueNode(value)) {
          const tokenType = getTokenType(value);
          if (tokenType === "dimension" || tokenType === "number") {
            const resolvedValue = resolveReference(
              getTokenValue(value) ?? "",
              allTokens
            );
            if (resolvedValue !== undefined && resolvedValue !== null) {
              result[fullKey] = formatDimensionValue(
                resolvedValue as string | number,
                options
              );
            }
          }
        } else {
          processDimensionGroup(value as RawTokenGroup, fullKey);
        }
      }
    }
  }

  processDimensionGroup(tokens);
  return result;
}

function extractTypographyPresets(
  tokens: RawTokenGroup,
  allTokens: RawTokensRoot,
  _options: { fontWeightPreference?: string[] } = {}
): Record<string, TypographyPreset> {
  const result: Record<string, TypographyPreset> = {};
  let groupLetterSpacing: string | undefined;
  let groupFontWeightSingle: string | undefined;
  const groupFontWeightMap: Record<string, string> = {};

  const groupLetterSpacingNode = tokens["letter spacing"] as
    | TokenValue
    | undefined;
  if (groupLetterSpacingNode && isTokenValueNode(groupLetterSpacingNode)) {
    const resolved = resolveReference(
      getTokenValue(groupLetterSpacingNode) ?? "",
      allTokens
    );
    groupLetterSpacing = formatDimensionValue(resolved as string | number);
  }

  const groupFontWeightNode = tokens["font weight"] as
    | TokenValue
    | RawTokenGroup
    | undefined;
  if (groupFontWeightNode) {
    if (isTokenValueNode(groupFontWeightNode)) {
      const resolved = resolveReference(
        getTokenValue(groupFontWeightNode) ?? "",
        allTokens
      );
      groupFontWeightSingle = formatDimensionValue(
        resolved as string | number,
        { unit: null }
      );
    } else if (
      typeof groupFontWeightNode === "object" &&
      groupFontWeightNode !== null &&
      !isTokenValueNode(groupFontWeightNode)
    ) {
      const fwGroup = groupFontWeightNode as RawTokenGroup;
      for (const [fwKey, fwVal] of Object.entries(fwGroup)) {
        if (fwVal && isTokenValueNode(fwVal)) {
          const resolved = resolveReference(
            getTokenValue(fwVal) ?? "",
            allTokens
          );
          groupFontWeightMap[fwKey] = formatDimensionValue(
            resolved as string | number,
            { unit: null }
          );
        }
      }
    }
  }

  const hasMultipleWeights = Object.keys(groupFontWeightMap).length > 0;

  for (const [key, value] of Object.entries(tokens)) {
    if (key === "letter spacing" || key === "font weight") continue;
    if (typeof value !== "object" || value === null) continue;

    const presetGroup = value as RawTokenGroup;
    const normalizedKey = normalizeKey(key);
    const basePreset: TypographyPreset = {};

    if (
      presetGroup["font size"] &&
      isTokenValueNode(presetGroup["font size"])
    ) {
      const resolved = resolveReference(
        getTokenValue(presetGroup["font size"]) ?? "",
        allTokens
      );
      basePreset.fontSize = formatDimensionValue(resolved as string | number);
    }
    if (
      presetGroup["line height"] &&
      isTokenValueNode(presetGroup["line height"])
    ) {
      const resolved = resolveReference(
        getTokenValue(presetGroup["line height"]) ?? "",
        allTokens
      );
      basePreset.lineHeight = formatDimensionValue(resolved as string | number);
    }
    if (
      presetGroup["letter spacing"] &&
      isTokenValueNode(presetGroup["letter spacing"])
    ) {
      const resolved = resolveReference(
        getTokenValue(presetGroup["letter spacing"]) ?? "",
        allTokens
      );
      basePreset.letterSpacing = formatDimensionValue(
        resolved as string | number
      );
    }
    if (!basePreset.letterSpacing && groupLetterSpacing) {
      basePreset.letterSpacing = groupLetterSpacing;
    }

    const presetHasOwnWeight =
      presetGroup["font weight"] &&
      isTokenValueNode(presetGroup["font weight"]);
    if (presetHasOwnWeight) {
      const weightNode = presetGroup["font weight"] as TokenValue | undefined;
      if (!weightNode) continue;
      const weight = resolveReference(
        getTokenValue(weightNode) ?? "",
        allTokens
      );
      basePreset.fontWeight = formatDimensionValue(weight as string | number, {
        unit: null,
      });
    }

    if (Object.keys(basePreset).length === 0) continue;

    if (presetHasOwnWeight) {
      result[normalizedKey] = basePreset;
      continue;
    }

    if (hasMultipleWeights) {
      for (const [fwKey, fwValue] of Object.entries(groupFontWeightMap)) {
        const slug = fontWeightToSlug(fwKey);
        const compositeKey = normalizedKey.endsWith(`-${slug}`)
          ? normalizedKey
          : `${normalizedKey}-${slug}`;
        result[compositeKey] = { ...basePreset, fontWeight: fwValue };
      }
    } else if (groupFontWeightSingle) {
      basePreset.fontWeight = groupFontWeightSingle;
      result[normalizedKey] = basePreset;
    } else {
      result[normalizedKey] = basePreset;
    }
  }

  return result;
}

function deepMerge<T extends NestedColorMap | DimensionMap>(
  target: T,
  source: T
): T {
  const result = { ...target } as T;

  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        existing as NestedColorMap,
        value as NestedColorMap
      );
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

function transformTokens(rawTokens: RawTokensRoot): TailwindTokens {
  const result: TailwindTokens = {
    colors: {
      primitive: {},
      text: {},
      bg: {},
      border: {},
      icon: {},
    },
    spacing: {},
    container: {},
    fontSize: {},
    lineHeight: {},
    fontWeight: {},
    letterSpacing: {},
    borderRadius: {},
    borderWidth: {},
    typography: { heading: {}, body: {} },
  };

  const ts = rawTokens["TokenStudio"] as RawTokenGroup | undefined;
  const prim = ts?.primitive as RawTokenGroup | undefined;
  const sem = ts?.semantic as RawTokenGroup | undefined;

  const primitiveColorSources: RawTokenGroup[] = [
    prim?.color,
    ts?.color,
    (rawTokens[""] as RawTokenGroup | undefined)?.["Primitive: Color/Mode 1"],
    rawTokens[".Primitive: Color/Mode 1"] as RawTokenGroup | undefined,
  ].filter((s): s is RawTokenGroup => typeof s === "object" && s !== null);

  for (const source of primitiveColorSources) {
    const extracted = extractColors(source, rawTokens);
    result.colors.primitive = deepMerge(result.colors.primitive, extracted);
  }

  const semanticColorSource =
    (sem?.color as RawTokenGroup | undefined) ??
    (rawTokens["Semantic: Color/Mode 1"] as RawTokenGroup | undefined);
  if (semanticColorSource) {
    const semColor = semanticColorSource as Record<
      string,
      RawTokenGroup | undefined
    >;
    if (semColor.text)
      result.colors.text = extractColors(semColor.text, rawTokens);
    if (semColor.bg) result.colors.bg = extractColors(semColor.bg, rawTokens);
    if (semColor.border)
      result.colors.border = extractColors(semColor.border, rawTokens);
    if (semColor.icon)
      result.colors.icon = extractColors(semColor.icon, rawTokens);
    if (semColor.etc)
      result.colors.primitive.etc = extractColors(semColor.etc, rawTokens);
  }

  const primitiveSizeSource = prim;
  const semanticSizeSource = sem?.size as RawTokenGroup | undefined;
  const legacySizeSource = rawTokens["Primitive: Size/Mode 1"] as
    | RawTokenGroup
    | undefined;

  const sizeUnitSource = (primitiveSizeSource?.["size-unit"] ??
    legacySizeSource?.["size-unit"]) as RawTokenGroup | undefined;
  if (sizeUnitSource) {
    result.spacing = extractDimensions(
      { "size-unit": sizeUnitSource },
      rawTokens
    );
  }

  const spaceSource = (semanticSizeSource?.space ?? legacySizeSource?.space) as
    | RawTokenGroup
    | undefined;
  if (spaceSource) {
    const spaceTokens = extractDimensions({ space: spaceSource }, rawTokens);
    result.spacing = deepMerge(result.spacing, spaceTokens);
  }

  const borderRadiusSource = (semanticSizeSource?.["border-radius"] ??
    legacySizeSource?.["border-radius"]) as RawTokenGroup | undefined;
  if (borderRadiusSource) {
    result.borderRadius = extractDimensions(
      { "border-radius": borderRadiusSource },
      rawTokens
    );
  }

  const borderWidthSource = (semanticSizeSource?.["border-width"] ??
    legacySizeSource?.["border-width"]) as RawTokenGroup | undefined;
  if (borderWidthSource) {
    result.borderWidth = extractDimensions(
      { "border-width": borderWidthSource },
      rawTokens
    );
  }

  const containerSource = semanticSizeSource?.container as
    | RawTokenGroup
    | undefined;
  if (containerSource) {
    result.container = extractDimensions(
      { container: containerSource },
      rawTokens
    );
  }

  const typographySource =
    (prim?.typography as RawTokenGroup | undefined) ??
    ((rawTokens[""] as RawTokenGroup | undefined)?.[
      "Primitive: Typography/Mode 1"
    ] as RawTokenGroup | undefined) ??
    (rawTokens[".Primitive: Typography/Mode 1"] as RawTokenGroup | undefined);

  if (typographySource) {
    const typ = typographySource as Record<string, RawTokenNode | undefined>;
    if (typ["font size"]) {
      result.fontSize = extractDimensions(
        { "font-size": typ["font size"] as RawTokenGroup },
        rawTokens
      );
    }
    if (typ["line height"]) {
      result.lineHeight = extractDimensions(
        { "line-height": typ["line height"] as RawTokenGroup },
        rawTokens
      );
    }
    if (typ["letter spacing"]) {
      result.letterSpacing = extractDimensions(
        { "letter-spacing": typ["letter spacing"] as RawTokenGroup },
        rawTokens
      );
    }
    if (typ["font weight"]) {
      result.fontWeight = extractDimensions(
        { "font-weight": typ["font weight"] as RawTokenGroup },
        rawTokens,
        { unit: null }
      );
    }
  }

  const semanticTypography =
    (sem?.typography as RawTokenGroup | undefined) ??
    (rawTokens["Semantic: Typography/Mode 1"] as RawTokenGroup | undefined);
  if (semanticTypography) {
    const semTyp = semanticTypography as Record<
      string,
      RawTokenGroup | undefined
    >;
    if (semTyp.Heading) {
      result.typography.heading = extractTypographyPresets(
        semTyp.Heading,
        rawTokens,
        {
          fontWeightPreference: [
            "bold",
            "extra bold",
            "semibold",
            "semi bold",
            "medium",
            "regular",
          ],
        }
      );
    }
    if (semTyp.Body) {
      result.typography.body = extractTypographyPresets(
        semTyp.Body,
        rawTokens,
        {
          fontWeightPreference: [
            "medium",
            "regular",
            "semibold",
            "semi bold",
            "bold",
          ],
        }
      );
    }
  }

  return result;
}

function generateCSSVariables(tokens: TailwindTokens): string {
  const timestamp = new Date().toISOString();
  let css = `/**
 * Design Token CSS Variables - Auto-generated from Figma (Tokens Studio)
 * Generated at: ${timestamp}
 *
 * ⚠️ 이 파일은 자동 생성됩니다. 직접 수정하지 마세요.
 * 수정이 필요하면 Figma에서 변경 후 pnpm sync:tokens 실행
 *
 * 사용법: globals.css에서 @import './design-tokens.css';
 */

@theme inline {
`;

  function addColorVars(obj: NestedColorMap, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        addColorVars(value as NestedColorMap, `${prefix}-${key}`);
      } else if (typeof value === "string") {
        css += `  --color${prefix}-${key}: ${value};\n`;
      }
    }
  }

  css += "\n  /* Primitive Colors */\n";
  for (const [colorName, shades] of Object.entries(tokens.colors.primitive)) {
    if (typeof shades === "object" && shades !== null) {
      for (const [shade, value] of Object.entries(shades as NestedColorMap)) {
        if (typeof value === "string") {
          css += `  --color-${colorName}-${shade}: ${value};\n`;
        } else if (typeof value === "object" && value !== null) {
          for (const [subKey, subValue] of Object.entries(
            value as NestedColorMap
          )) {
            if (typeof subValue === "string") {
              css += `  --color-${colorName}-${shade}-${subKey}: ${subValue};\n`;
            }
          }
        }
      }
    }
  }

  css += "\n  /* Text Colors */\n";
  addColorVars(tokens.colors.text, "-text");
  css += "\n  /* Background Colors */\n";
  addColorVars(tokens.colors.bg, "-bg");
  css += "\n  /* Border Colors */\n";
  addColorVars(tokens.colors.border, "-border");
  css += "\n  /* Icon Colors */\n";
  addColorVars(tokens.colors.icon, "-icon");

  css += "\n  /* Spacing */\n";
  for (const [key, value] of Object.entries(tokens.spacing)) {
    css += `  --spacing-${key}: ${value};\n`;
  }
  css += "\n  /* Container Sizes */\n";
  for (const [key, value] of Object.entries(tokens.container)) {
    const containerKey = key.replace(/^container-/, "");
    css += `  --container-${containerKey}: ${value};\n`;
  }
  css += "\n  /* Font Sizes */\n";
  for (const [key, value] of Object.entries(tokens.fontSize)) {
    css += `  --font-size-${key}: ${value};\n`;
  }
  css += "\n  /* Line Heights */\n";
  for (const [key, value] of Object.entries(tokens.lineHeight)) {
    css += `  --line-height-${key}: ${value};\n`;
  }
  css += "\n  /* Border Radius */\n";
  for (const [key, value] of Object.entries(tokens.borderRadius)) {
    css += `  --radius-${key}: ${value};\n`;
  }

  css += "\n  /* Typography - Heading */\n";
  for (const [key, preset] of Object.entries(tokens.typography.heading)) {
    if (preset.fontSize)
      css += `  --typography-heading-${key}-font-size: ${preset.fontSize};\n`;
    if (preset.lineHeight)
      css += `  --typography-heading-${key}-line-height: ${preset.lineHeight};\n`;
    if (preset.letterSpacing)
      css += `  --typography-heading-${key}-letter-spacing: ${preset.letterSpacing};\n`;
    if (preset.fontWeight)
      css += `  --typography-heading-${key}-font-weight: ${preset.fontWeight};\n`;
  }
  css += "\n  /* Typography - Body */\n";
  for (const [key, preset] of Object.entries(tokens.typography.body)) {
    if (preset.fontSize)
      css += `  --typography-body-${key}-font-size: ${preset.fontSize};\n`;
    if (preset.lineHeight)
      css += `  --typography-body-${key}-line-height: ${preset.lineHeight};\n`;
    if (preset.letterSpacing)
      css += `  --typography-body-${key}-letter-spacing: ${preset.letterSpacing};\n`;
    if (preset.fontWeight)
      css += `  --typography-body-${key}-font-weight: ${preset.fontWeight};\n`;
  }

  css += "}\n";

  css += "\n@layer utilities {\n";
  function addTypographyUtilities(
    prefix: "heading" | "body",
    presets: Record<string, TypographyPreset>
  ) {
    for (const [key, preset] of Object.entries(presets)) {
      css += `  .text-${prefix}-${key} {\n`;
      if (preset.fontSize) css += `    font-size: ${preset.fontSize};\n`;
      if (preset.lineHeight) css += `    line-height: ${preset.lineHeight};\n`;
      if (preset.letterSpacing)
        css += `    letter-spacing: ${preset.letterSpacing};\n`;
      if (preset.fontWeight) css += `    font-weight: ${preset.fontWeight};\n`;
      css += "  }\n";
    }
  }
  addTypographyUtilities("heading", tokens.typography.heading);
  addTypographyUtilities("body", tokens.typography.body);

  function addColorUtilityClasses(
    prefix: string,
    obj: NestedColorMap,
    property: "color" | "background-color" | "border-color",
    pathPrefix: string = ""
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const segment = pathPrefix ? `${pathPrefix}-${key}` : key;
      if (typeof value === "object" && value !== null) {
        addColorUtilityClasses(
          prefix,
          value as NestedColorMap,
          property,
          segment
        );
      } else if (typeof value === "string") {
        const varName = `--color-${prefix}-${segment}`;
        const className = `${prefix}-${segment}`;
        css += `  .${className} {\n`;
        css += `    ${property}: var(${varName});\n`;
        css += "  }\n";
      }
    }
  }
  addColorUtilityClasses("text", tokens.colors.text, "color");
  addColorUtilityClasses("bg", tokens.colors.bg, "background-color");
  addColorUtilityClasses("border", tokens.colors.border, "border-color");
  addColorUtilityClasses("icon", tokens.colors.icon, "color");

  for (const [key, value] of Object.entries(tokens.spacing)) {
    if (key.startsWith("space-")) {
      const classKey = key.replace(/^space-/, "");
      css += `  .space-${classKey} {\n`;
      css += `    gap: ${value};\n`;
      css += "  }\n";
    }
  }
  for (const [key, value] of Object.entries(tokens.container)) {
    const classKey = key.replace(/^container-/, "");
    css += `  .container-${classKey} {\n`;
    css += `    width: 100%;\n`;
    css += `    max-width: ${value};\n`;
    css += "  }\n";
  }

  css += "}\n";
  return css;
}

function generateOutput(tokens: TailwindTokens): string {
  const timestamp = new Date().toISOString();

  return `/**
 * Design Tokens - Auto-generated from Figma (Tokens Studio)
 * Generated at: ${timestamp}
 *
 * ⚠️ 이 파일은 자동 생성됩니다. 직접 수정하지 마세요.
 * 수정이 필요하면 Figma에서 변경 후 pnpm sync:tokens 실행
 */

export const designTokens = ${JSON.stringify(tokens, null, 2)} as const;

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
`;
}

function main() {
  console.log("🎨 Tokens Studio → Tailwind 동기화");
  console.log("=".repeat(50));
  console.log(`📂 입력: ${TOKENS_INPUT}`);
  console.log(`📂 출력: ${OUTPUT_DIR}`);
  console.log("");

  if (!TOKENS_INPUT || !fs.existsSync(TOKENS_INPUT)) {
    console.error(`❌ 토큰 파일을 찾을 수 없습니다: ${TOKENS_INPUT}`);
    console.log(
      "\n💡 Tokens Studio에서 Export → tokens.json을 src/token/ 에 저장 후 pnpm sync:tokens"
    );
    process.exit(1);
  }

  const rawContent = fs.readFileSync(TOKENS_INPUT, "utf-8");
  let rawTokens: RawTokensRoot;
  try {
    rawTokens = JSON.parse(rawContent) as RawTokensRoot;
  } catch (e) {
    console.error("❌ JSON 파싱 오류:", (e as Error).message);
    process.exit(1);
  }
  console.log("✅ tokens.json 읽기 완료");

  const transformedTokens = transformTokens(rawTokens);
  console.log("✅ 토큰 변환 완료");

  console.log("\n📊 변환 결과:");
  console.log(
    `   - text: ${countNestedTokens(transformedTokens.colors.text)}개`
  );
  console.log(`   - bg: ${countNestedTokens(transformedTokens.colors.bg)}개`);
  console.log(
    `   - primitive: ${countNestedTokens(transformedTokens.colors.primitive)}개`
  );
  console.log(
    `   - spacing: ${countNestedTokens(transformedTokens.spacing)}개`
  );

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const tsPath = path.join(OUTPUT_DIR, "design-tokens.ts");
  fs.writeFileSync(tsPath, generateOutput(transformedTokens), "utf-8");
  console.log(`\n✅ TypeScript: ${tsPath}`);

  const cssPath = path.join(OUTPUT_DIR, "design-tokens.css");
  fs.writeFileSync(cssPath, generateCSSVariables(transformedTokens), "utf-8");
  console.log(`✅ CSS: ${cssPath}`);

  if (unresolvedRefs.length > 0) {
    console.log(
      "\n⚠️  미해석 참조:",
      unresolvedRefs.map((r) => `{${r}}`).join(", ")
    );
  }
  console.log("\n🎉 동기화 완료!");
}

main();
