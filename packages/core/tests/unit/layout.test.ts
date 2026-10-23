import { describe, it, expect } from "vitest";
import { Container } from "../../src/Container";
import { DisplayObject } from "../../src/DisplayObject";
import { layoutRow, layoutColumn } from "../../src/utils/layout";
import type TinyUI from "../../src/TinyUI";

/**
 * layoutRow / layoutColumn 的单元测试。
 *
 * 这两个函数取代了业务里反复手写的「算宽度 + 摆位置 + 对基线」，
 * 所以测试的重点不是"能排出来"，而是**几个曾经踩过的坑不再回来**：
 *
 * 1. 布局只看 width/height。如果哪天有人把 scale 乘回占位尺寸，
 *    动画期间的 scale 就会污染排版（历史 bug：punch 动画后元素停在放大位置）。
 * 2. baseline 对齐。13px 标签 + 16px 数值混排时，用中心/盒底对齐都会差几像素。
 * 3. 隐藏节点不占位（对应 CSS display:none）。
 * 4. 可重复调用 —— 内容变化后重排，结果必须跟着变。
 */

const mockApp = {} as TinyUI;

/** 造一个固定尺寸的节点 */
function node(w: number, h: number): DisplayObject {
  const n = new DisplayObject(mockApp);
  n.setSize(w, h);
  n.anchorX = 0;
  n.anchorY = 0;
  return n;
}

describe("layoutRow", () => {
  it("按顺序水平排列，间距用 gap", () => {
    const row = new Container(mockApp);
    const a = node(100, 20);
    const b = node(50, 20);
    const c = node(30, 20);
    row.addChild(a);
    row.addChild(b);
    row.addChild(c);

    const r = layoutRow(row, [a, b, c], { gap: 10 });

    expect(a.x).toBe(0);
    expect(b.x).toBe(110);
    expect(c.x).toBe(170);
    expect(r.width).toBe(200);
    expect(row.width).toBe(200);
  });

  it("gaps 支持逐项不同间距（DOM 的 margin 常不同）", () => {
    const row = new Container(mockApp);
    const a = node(10, 10);
    const b = node(10, 10);
    const c = node(10, 10);
    [a, b, c].forEach((n) => row.addChild(n));

    layoutRow(row, [a, b, c], { gaps: [5, 20] });

    expect(a.x).toBe(0);
    expect(b.x).toBe(15); // 10 + 5
    expect(c.x).toBe(45); // 15 + 10 + 20
    expect(row.width).toBe(55);
  });

  it("跳过 visible=false 的节点（对应 display:none）", () => {
    const row = new Container(mockApp);
    const a = node(100, 20);
    const hidden = node(999, 20);
    const c = node(50, 20);
    hidden.visible = false;
    [a, hidden, c].forEach((n) => row.addChild(n));

    const r = layoutRow(row, [a, hidden, c], { gap: 10 });

    expect(c.x).toBe(110); // hidden 完全没参与
    expect(r.width).toBe(160);
  });

  it("skipInvisible=false 时隐藏节点也占位", () => {
    const row = new Container(mockApp);
    const a = node(100, 20);
    const hidden = node(50, 20);
    hidden.visible = false;
    [a, hidden].forEach((n) => row.addChild(n));

    const r = layoutRow(row, [a, hidden], { gap: 10, skipInvisible: false });

    expect(r.width).toBe(160);
  });

  it("align=start 顶对齐，align=end 底对齐", () => {
    const mk = () => {
      const row = new Container(mockApp);
      const short = node(10, 10);
      const tall = node(10, 40);
      [short, tall].forEach((n) => row.addChild(n));
      return { row, short, tall };
    };

    const s = mk();
    layoutRow(s.row, [s.short, s.tall], { align: "start" });
    expect(s.short.y).toBe(0);
    expect(s.tall.y).toBe(0);

    const e = mk();
    layoutRow(e.row, [e.short, e.tall], { align: "end" });
    expect(e.short.y).toBe(30); // 40 - 10
    expect(e.tall.y).toBe(0);
  });

  it("align=center 垂直居中，容器高取最高项", () => {
    const row = new Container(mockApp);
    const short = node(10, 10);
    const tall = node(10, 40);
    [short, tall].forEach((n) => row.addChild(n));

    const r = layoutRow(row, [short, tall], { align: "center" });

    expect(r.height).toBe(40);
    expect(short.y).toBe(15); // (40-10)/2
    expect(tall.y).toBe(0);
  });

  it("align=baseline 让不同高度节点的基线落在同一条线上", () => {
    const row = new Container(mockApp);
    const small = node(10, 20);
    const big = node(10, 50);
    [small, big].forEach((n) => row.addChild(n));
    // 手设基线：容器默认基线是底边，显式覆盖成"距顶 15 / 40"
    small.baselineOverride = 15;
    big.baselineOverride = 40;

    const r = layoutRow(row, [small, big], { align: "baseline" });

    const smallBaseline = small.y + small.baselineOffset;
    const bigBaseline = big.y + big.baselineOffset;
    expect(smallBaseline).toBe(bigBaseline);
    // 基线以下还要放得下最高的后半段：max(20-15, 50-40) = 10
    expect(r.height).toBe(50); // 40 + 10
  });

  it("可重复调用：内容变化后重排结果跟着变", () => {
    const row = new Container(mockApp);
    const a = node(100, 20);
    const b = node(50, 20);
    row.addChild(a);
    row.addChild(b);

    layoutRow(row, [a, b], { gap: 10 });
    expect(row.width).toBe(160);

    b.setSize(200, 20);
    layoutRow(row, [a, b], { gap: 10 });
    expect(row.width).toBe(310);
    expect(b.x).toBe(110);
  });

  it("🚨 布局只读 width，不乘 scale —— 动画改 scale 不能影响排版", () => {
    const row = new Container(mockApp);
    const a = node(100, 20);
    const b = node(50, 20);
    row.addChild(a);
    row.addChild(b);

    layoutRow(row, [a, b], { gap: 10 });
    const before = { w: row.width, bx: b.x };

    // 模拟脉冲动画：把 a 视觉放大 2 倍
    a.scaleX = 2;
    a.scaleY = 2;
    layoutRow(row, [a, b], { gap: 10 });

    expect(row.width).toBe(before.w);
    expect(b.x).toBe(before.bx);
  });

  it("空数组时把容器尺寸归零", () => {
    const row = new Container(mockApp);
    const r = layoutRow(row, [], { gap: 10 });
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
    expect(row.width).toBe(0);
  });

  it("从右往左排列时仍然正确（anchorX=1）", () => {
    const row = new Container(mockApp);
    const a = node(10, 10);
    const b = node(10, 10);
    // anchorX=1 的节点要让左缘落在游标处，x 需要加回整个宽度
    a.anchorX = 1;
    b.anchorX = 1;
    [a, b].forEach((n) => row.addChild(n));

    layoutRow(row, [a, b], { gap: 5 });

    // 左上角 = x - anchorX*width
    expect(a.x - a.width).toBe(0);
    expect(b.x - b.width).toBe(15);
  });
});

describe("layoutColumn", () => {
  it("按顺序垂直排列", () => {
    const col = new Container(mockApp);
    const a = node(10, 20);
    const b = node(10, 30);
    [a, b].forEach((n) => col.addChild(n));

    const r = layoutColumn(col, [a, b], { gap: 5 });

    expect(a.y).toBe(0);
    expect(b.y).toBe(25);
    expect(r.height).toBe(55);
  });

  it("align=center 用最宽项做容器宽并居中各项", () => {
    const col = new Container(mockApp);
    const narrow = node(20, 10);
    const wide = node(100, 10);
    [narrow, wide].forEach((n) => col.addChild(n));

    const r = layoutColumn(col, [narrow, wide], { align: "center" });

    expect(r.width).toBe(100);
    expect(narrow.x).toBe(40); // (100-20)/2
    expect(wide.x).toBe(0);
  });

  it("gaps 支持逐项不同间距", () => {
    const col = new Container(mockApp);
    const a = node(10, 10);
    const b = node(10, 10);
    const c = node(10, 10);
    [a, b, c].forEach((n) => col.addChild(n));

    layoutColumn(col, [a, b, c], { gaps: [6, 14] });

    expect(a.y).toBe(0);
    expect(b.y).toBe(16); // 10 + 6
    expect(c.y).toBe(40); // 16 + 10 + 14
  });

  it("🚨 useInk：按视觉边界堆叠，不用盒边界", () => {
    // 造一个"盒 100 高、但视觉内容只占中间 40"的节点（类似 Text 的 topPadding）
    class InkNode extends DisplayObject {
      get visualTop() {
        return 30;
      }
      get visualHeight() {
        return 40;
      }
    }
    const col = new Container(mockApp);
    const ink = new InkNode(mockApp);
    ink.setSize(10, 100);
    ink.anchorX = 0;
    ink.anchorY = 0;
    const plain = node(10, 20);
    col.addChild(ink);
    col.addChild(plain);

    // 不用 useInk：按 100 的盒高走，间距从盒底开始
    layoutColumn(col, [ink, plain], { gap: 10 });
    expect(plain.y).toBe(110);

    // useInk：游标按"视觉顶/视觉高"推进，于是 ink 的盒顶被推到 -30，
    // 让它的视觉内容从容器顶开始；下一个节点从视觉底 40 再加 10 开始。
    layoutColumn(col, [ink, plain], { gap: 10, useInk: true });
    expect(ink.y).toBe(-30); // 视觉顶 = -30 + 30 = 0
    expect(plain.y).toBe(50); // 视觉高 40 + gap 10
    expect(col.height).toBe(70); // 50 + 20
  });
});

describe("DisplayObject 的布局契约", () => {
  it("setSize 只改布局尺寸，不动 scale", () => {
    const n = node(100, 50);
    expect(n.scaleX).toBe(1);
    n.setSize(20, 10);
    expect(n.width).toBe(20);
    expect(n.height).toBe(10);
    expect(n.scaleX).toBe(1);
    expect(n.scaleY).toBe(1);
  });

  it("setSize 省略 height 时取 width", () => {
    const n = node(1, 1);
    n.setSize(64);
    expect(n.width).toBe(64);
    expect(n.height).toBe(64);
  });

  it("scaleTo 不改布局尺寸（视觉变换与布局分离）", () => {
    const n = node(100, 100);
    n.scaleTo(0.5);
    expect(n.width).toBe(100);
    expect(n.height).toBe(100);
    expect(n.scaleX).toBe(0.5);
  });

  it("scaleToFit 不改布局尺寸", () => {
    const n = node(256, 256);
    n.scaleToFit(20, 20);
    expect(n.width).toBe(256);
    expect(n.scaleX).toBeCloseTo(20 / 256);
  });

  it("默认基线是底边", () => {
    const n = node(10, 40);
    expect(n.baselineOffset).toBe(40);
  });

  it("baselineOverride 优先于默认基线", () => {
    const n = node(10, 40);
    n.baselineOverride = 25;
    expect(n.baselineOffset).toBe(25);
    n.baselineOverride = null;
    expect(n.baselineOffset).toBe(40);
  });

  it("默认视觉边界等于盒边界（图形类节点）", () => {
    const n = node(10, 40);
    expect(n.visualTop).toBe(0);
    expect(n.visualHeight).toBe(40);
    expect(n.visualBottom).toBe(40);
  });

  it("getBounds 含 scale（矩阵里已经算了，不能重复乘）", () => {
    const n = node(100, 100);
    n.scaleX = 0.5;
    n.scaleY = 0.5;
    const b = n.getBounds();
    // 曾经有个 isScaleAffectedSize 开关会再乘一次，得到 25 —— 那是错的
    expect(b.width).toBe(50);
    expect(b.height).toBe(50);
  });
});
