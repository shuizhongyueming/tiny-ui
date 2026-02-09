import type { BBCodeTag } from "./BBCodeParser";

export interface TextStyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  visible: boolean;
  background?: string;
  offsetX: number;
  offsetY: number;
  offsetYIsPercentage: boolean;
  stroke: boolean;
  outline?: string;
  outlineBack?: string;
  lineThickness: number;
}

export interface RenderUnit {
  text: string;
  style: TextStyleState;
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  lineIndex: number;
}

export interface LineInfo {
  units: RenderUnit[];
  width: number;
  height: number;
  baseline: number;
}

export function createDefaultStyle(
  baseFontSize: number,
  baseFontFamily: string,
  baseColor: string
): TextStyleState {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    fontSize: baseFontSize,
    fontFamily: baseFontFamily,
    color: baseColor,
    opacity: 100,
    visible: true,
    background: undefined,
    offsetX: 0,
    offsetY: 0,
    offsetYIsPercentage: false,
    stroke: false,
    outline: undefined,
    outlineBack: undefined,
    lineThickness: 0.05,
  };
}

export function applyTagToStyle(
  style: TextStyleState,
  tag: BBCodeTag,
  baseFontSize: number
): TextStyleState {
  const newStyle = { ...style };

  switch (tag.name) {
    case "b":
      newStyle.bold = true;
      break;
    case "i":
      newStyle.italic = true;
      break;
    case "u":
      newStyle.underline = true;
      break;
    case "s":
      newStyle.strikethrough = true;
      break;
    case "size":
      if (tag.value) {
        const ratio = parseFloat(tag.value);
        if (!isNaN(ratio)) {
          const clampedRatio = Math.max(0.1, Math.min(5, ratio));
          newStyle.fontSize = baseFontSize * clampedRatio;
        }
      }
      break;
    case "font":
      if (tag.value) {
        newStyle.fontFamily = tag.value;
      }
      break;
    case "color":
      if (tag.value) {
        newStyle.color = tag.value;
      }
      break;
    case "opacity":
      if (tag.value) {
        const opacity = parseFloat(tag.value);
        if (!isNaN(opacity)) {
          newStyle.opacity = Math.max(0, Math.min(100, opacity));
        }
      }
      break;
    case "hide":
      newStyle.visible = false;
      break;
    case "background":
      if (tag.value) {
        newStyle.background = tag.value;
      }
      break;
    case "offsetx":
      if (tag.value) {
        newStyle.offsetX = parseFloat(tag.value) || 0;
      }
      break;
    case "offsety":
      if (tag.value) {
        const value = tag.value;
        if (value.endsWith("%")) {
          // Store percentage value, will be resolved during layout
          newStyle.offsetY = parseFloat(value) / 100;
          newStyle.offsetYIsPercentage = true;
        } else {
          newStyle.offsetY = parseFloat(value) || 0;
          newStyle.offsetYIsPercentage = false;
        }
      }
      break;
    case "stroke":
      newStyle.stroke = true;
      break;
    case "outline":
      if (tag.value) {
        newStyle.outline = tag.value;
      }
      break;
    case "outlineback":
      if (tag.value) {
        newStyle.outlineBack = tag.value;
      }
      break;
    case "lineThickness":
      if (tag.value) {
        const thickness = parseFloat(tag.value);
        if (!isNaN(thickness)) {
          newStyle.lineThickness = Math.max(0.01, Math.min(1, thickness));
        }
      }
      break;
  }

  return newStyle;
}

export function buildFontString(style: TextStyleState): string {
  const weight = style.bold ? "bold" : "normal";
  const styleStr = style.italic ? "italic" : "normal";
  return `${styleStr} ${weight} ${style.fontSize}px ${style.fontFamily}`;
}
