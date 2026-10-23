import type { DisplayObject } from "../DisplayObject";

/* ============================================================================
   LAYOUT — 轻量 flex 排版。

   TinyUI 的 `DisplayObject` 只有 x / y / anchor，没有流式布局：想排「图标 + 文字」
   或「标签 + 数值」，只能手工算每个子节点的位置、间距、交叉轴对齐、容器尺寸。
   这段代码在业务里被重复了太多次，而且每次都容易错在一个地方 —— **垂直对齐**。

   为什么不能简单地"都设 anchorY=0 顶对齐"或"都居中对齐"：
   - 顶对齐：Text 盒顶有 topPadding，文字 ink 在盒内偏下，图标却贴盒顶 → 图标偏高；
   - 居中对齐：不同字号的**字形高度**不同，中心重合会让大字上下各溢出一截；
   - 用 `height` 算底边：Text 的 height 是**行盒**高，行高 ≠ 字形高 → 仍差几像素。
   CSS 里 inline 元素共享**基线**，所以这里也按基线对齐（`align: "baseline"`）。

   与 `components/utils/adjustTo` 的区别：adjustTo 是"把 A 摆到 B 的某个角"的单次
   对齐；这里是流式排列 —— 依次放置、统一间距、交叉轴对齐，并算出容器尺寸。

   用法：
   ```ts
   const row = app.createContainer("row");
   row.anchorX = 1;                      // 容器锚点由调用方决定
   row.addChild(icon);
   row.addChild(label);
   layoutRow(row, [icon, label], { gap: 8, align: "baseline" });
   // 内容变了（文本更新、图标显隐）→ 再调一次即可
   ```
   ============================================================================ */

/** 交叉轴对齐方式。 */
export type CrossAlign = "start" | "center" | "end" | "baseline";

export interface RowLayoutOptions {

  /** 子节点之间的间距（像素，单位为节点的本地坐标系）。默认 0。 */
  gap?: number;
  /**
   * 逐项间距，优先于 `gap`。长度应为 `children.length - 1`。
   * DOM 里相邻元素的 margin 常常不同（教程层是 6 和 14），单个 gap 表达不了。
   */
  gaps?: number[];
  /** 交叉轴对齐。row 默认 "center"，column 默认 "start"。 */
  align?: CrossAlign;
  /**
   * 间距按**视觉边界**（`visualTop` / `visualHeight`）算，而不是盒边界。
   *
   * `Text` 的盒顶有 `topPadding`、盒底只有 2px 留白，盒是"上宽下窄"的：
   * 按盒堆叠时每一行都会多出一点空隙，几行叠下来能漂 20+ 设计单位。
   * 垂直堆叠文字时应该打开这个选项。
   */
  useInk?: boolean;
  /**
   * 是否跳过 `visible === false` 的子节点。
   * 默认 true —— 隐藏的节点不该占用宽度和间距（对应 CSS 的 `display:none`）。
   */
  skipInvisible?: boolean;
}

export interface RowLayoutResult {
  /** 排列后的总宽度。 */
  width: number;
  /** 排列后的总高度（交叉轴）。 */
  height: number;
}

/* 布局只读 width/height，**不乘 scale**。
   scaleX/scaleY 是视觉变换（对应 CSS transform），改了不影响布局 ——
   这正是动画不会把排版带偏的原因。要把 Bitmap 显示成目标尺寸请用 setSize()。 */

/**
 * 把一组节点水平排成一行，写入 `container` 的 width / height。
 *
 * 子节点的 `x` / `y` 会被覆盖；**排列用的是 `pivotX` / `pivotY`** —— 它决定 `x`/`y`
 *  指向节点上的哪个点，布局要摆的是「左上角」，所以按 pivot 补偿（排列在容器本地坐标里进行
 * 子节点的本地坐标系里做，再换算成左上角），所以调用方可以自由设锚点。
 *
 * @param container 承载这些子节点的容器（必须已经 addChild 过它们）
 * @param children 参与排列的子节点（顺序 = 从左到右）
 * @param options 间距 / 交叉轴对齐
 * @returns 计算出的总宽高
 */
export function layoutRow(
  container: DisplayObject,
  children: DisplayObject[],
  options: RowLayoutOptions = {},
): RowLayoutResult {
  const gap = options.gap ?? 0;
  const gaps = options.gaps;
  const align = options.align ?? "center";
  const skipInvisible = options.skipInvisible !== false;

  const items = skipInvisible
    ? children.filter((c) => c && c.visible !== false)
    : children.filter(Boolean);

  if (items.length === 0) {
    container._setWidth(0);
    container._setHeight(0);
    return { width: 0, height: 0 };
  }

  /* ---- 1. 交叉轴尺寸与基线 ----
     基线对齐要先知道「行内最大基线偏移」和「基线以下最深的部分」，
     容器高 = 二者之和；否则行会短一截、下方内容溢出容器。 */
  let maxHeight = 0;
  let maxBaseline = 0;
  let belowBaseline = 0;
  for (const it of items) {
    const h = it.height;
    const b = it.baselineOffset;
    if (h > maxHeight) maxHeight = h;
    if (b > maxBaseline) maxBaseline = b;
    if (h - b > belowBaseline) belowBaseline = h - b;
  }
  const rowHeight =
    align === "baseline" ? maxBaseline + belowBaseline : maxHeight;

  /* ---- 2. 水平依次放置 ---- */
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const w = it.width;
    /* x 是锚点位置：要让节点**左缘**落在 cursor，
       需要 x = cursor + pivotX * 显示宽度（pivot = x/y 指向节点上哪个点） */
    it.x = cursor + it.pivotX * w;

    /* ---- 3. 交叉轴 ---- */
    const h = it.height;
    switch (align) {
      case "start":
        /* 顶边对齐：y = pivotY * h */
        it.y = it.pivotY * h;
        break;
      case "end":
        it.y = rowHeight - h + it.pivotY * h;
        break;
      case "baseline": {
        /* 让节点的基线落在 maxBaseline 这条线上 */
        const b = it.baselineOffset;
        it.y = maxBaseline - b + it.pivotY * h;
        break;
      }
      case "center":
      default:
        it.y = (rowHeight - h) / 2 + it.pivotY * h;
        break;
    }

    /* 最后一项后面不再加间距，否则宽度会多算一个 step */
    if (i < items.length - 1) {
      cursor += w + (gaps ? gaps[i] ?? gap : gap);
    } else {
      cursor += w;
    }
  }

  const width = cursor;
  container._setWidth(width);
  container._setHeight(rowHeight);
  return { width, height: rowHeight };
}

/**
 * 把一组节点垂直排成一列（纵向 flex）。
 *
 * 交叉轴对齐语义与 `layoutRow` 一致，只是轴线互换。
 */
export function layoutColumn(
  container: DisplayObject,
  children: DisplayObject[],
  options: RowLayoutOptions = {},
): RowLayoutResult {
  const gap = options.gap ?? 0;
  const gaps = options.gaps;
  const align = options.align ?? "start";
  const skipInvisible = options.skipInvisible !== false;
  const useInk = options.useInk === true;

  const items = skipInvisible
    ? children.filter((c) => c && c.visible !== false)
    : children.filter(Boolean);

  if (items.length === 0) {
    container._setWidth(0);
    container._setHeight(0);
    return { width: 0, height: 0 };
  }

  let maxWidth = 0;
  for (const it of items) maxWidth = Math.max(maxWidth, it.width);

  /* useInk：按视觉边界堆叠。
     视觉顶 = 盒顶 + visualTop，所以子节点的 y（盒顶位置）要减去 visualTop，
     让"视觉顶"落在游标处；步进用 visualHeight 而不是盒高。 */
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const inkTop = useInk ? it.visualTop : 0;
    const inkH = useInk ? it.visualHeight : it.height;
    it.y = cursor - inkTop + it.pivotY * it.height;

    const w = it.width;
    switch (align) {
      case "center":
        it.x = (maxWidth - w) / 2 + it.pivotX * w;
        break;
      case "end":
        it.x = maxWidth - w + it.pivotX * w;
        break;
      case "start":
      case "baseline":
      default:
        it.x = it.pivotX * w;
        break;
    }

    if (i < items.length - 1) {
      cursor += inkH + (gaps ? gaps[i] ?? gap : gap);
    } else {
      cursor += inkH;
    }
  }

  const height = cursor;
  container._setWidth(maxWidth);
  container._setHeight(height);
  return { width: maxWidth, height };
}
