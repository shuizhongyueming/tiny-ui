import { test, expect } from "@playwright/test";

/**
 * VAO / GL 状态污染测试。
 *
 * 场景用裸 WebGL2 精确复刻 three.js 的 VAO 使用方式，而不是 Pixi ——
 * Pixi 8 每次 draw 前都重新 bindVertexArray，即使状态被污染也会自己修好，
 * 复现不出问题。three 的 WebGLBindingStates 绑上 VAO 后**在 draw 结束不解绑**，
 * 并假设其中的 attrib 布局一直有效，这才是会出事的用法。
 *
 * 测的不是「有没有报 GL 错误」，而是**不变量**：
 * TinyUI 绘制完成后，引擎视角的 GL 状态必须和绘制前一模一样。
 * 等错误报出来太被动（buffer 恰好够大就永远不报，但画面已经错了）。
 */

async function bootScene(page: import("@playwright/test").Page) {
  await page.goto("/tests/integration/engine-coexistence/vao-scene.html");
  await page.waitForFunction(
    () => {
      const ts = (window as any).testScenario;
      return ts && ts.getFrameCount() > 20;
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** 把状态快照转成可比较的纯数据（GL 对象换成序号）。 */
async function snapshotEngineState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const ts = (window as any).testScenario;
    const s = ts.captureState();
    const ids = new Map<any, number>();
    const id = (o: any) => {
      if (o === null || o === undefined) return "null";
      if (!ids.has(o)) ids.set(o, ids.size + 1);
      return "#" + ids.get(o);
    };
    return {
      vao: id(s.vao),
      elementArrayBuffer: id(s.elementArrayBuffer),
      arrayBuffer: id(s.arrayBuffer),
      program: id(s.program),
      attribs: s.attribs.map((a: any) =>
        a.enabled ? { ...a, buffer: id(a.buffer) } : a,
      ),
      blend: s.blend,
      depthTest: s.depthTest,
      cullFace: s.cullFace,
      scissorTest: s.scissorTest,
      activeTexture: s.activeTexture,
      // 顺便带上对象身份，方便断言「element buffer 还是引擎那个」
      engineIndexBufferIsBound: s.elementArrayBuffer === ts.indexBuffer,
      enginePositionBufferInAttrib0: (() => {
        const a0 = s.attribs.find((x: any) => x.i === 0 && x.enabled);
        return !!a0 && a0.buffer === ts.positionBuffer;
      })(),
    };
  });
}

test.describe("VAO 状态不被 TinyUI 污染", () => {
  test.beforeEach(async ({ page }) => {
    await bootScene(page);
  });

  test("场景就绪：正好停在「引擎绑着自己的 VAO」这个状态", async ({ page }) => {
    const state = await snapshotEngineState(page);
    // 前提条件本身就要断言，否则后面的测试可能在一个无效场景上空转
    expect(state.vao, "引擎应该绑着自己的 VAO").not.toBe("null");
    expect(
      state.engineIndexBufferIsBound,
      "引擎 VAO 的 element buffer 应该是它自己的 indexBuffer",
    ).toBe(true);
    expect(
      state.enginePositionBufferInAttrib0,
      "引擎 VAO 的 attrib 0 应该指向它自己的 positionBuffer",
    ).toBe(true);
  });

  test("TinyUI 绘制后，引擎的 GL 状态完全不变", async ({ page }) => {
    const result = await page.evaluate(() => {
      const ts = (window as any).testScenario;
      const gl = ts.gl;

      // 让引擎处在「刚画完、VAO 还绑着」的状态
      ts.drawEngineOnly();
      const before = ts.captureState();

      // TinyUI 在同一个 context 上画一帧
      ts.tinyUI.patchRender();

      const after = ts.captureState();

      const idOf = (() => {
        const ids = new Map<any, number>();
        return (o: any) => {
          if (o === null || o === undefined) return "null";
          if (!ids.has(o)) ids.set(o, ids.size + 1);
          return "#" + ids.get(o);
        };
      })();

      return {
        before: {
          vao: idOf(before.vao),
          eab: idOf(before.elementArrayBuffer),
          program: idOf(before.program),
          attribs: before.attribs.map((a: any) =>
            a.enabled ? { ...a, buffer: idOf(a.buffer) } : a,
          ),
        },
        after: {
          vao: idOf(after.vao),
          eab: idOf(after.elementArrayBuffer),
          program: idOf(after.program),
          attribs: after.attribs.map((a: any) =>
            a.enabled ? { ...a, buffer: idOf(a.buffer) } : a,
          ),
        },
        eabIsStillEngineBuffer: after.elementArrayBuffer === ts.indexBuffer,
        attrib0IsStillEngineBuffer:
          after.attribs.find((x: any) => x.i === 0 && x.enabled)?.buffer ===
          ts.positionBuffer,
        glError: gl.getError(),
      };
    });

    expect(
      result.after.vao,
      "TinyUI 把 VAO 绑定改掉了（引擎下次 draw 会用错顶点布局）",
    ).toBe(result.before.vao);

    expect(
      result.after.eab,
      "TinyUI 把引擎 VAO 的 element buffer 换掉了 —— 引擎下次 drawElements 会按自己的 index 数去读 TinyUI 的小 buffer，报 Vertex buffer is not big enough",
    ).toBe(result.before.eab);

    expect(result.eabIsStillEngineBuffer, "element buffer 必须还是引擎自己的").toBe(
      true,
    );

    expect(
      result.attrib0IsStillEngineBuffer,
      "attrib 0 的指针被改到 TinyUI 的 buffer 上了",
    ).toBe(true);

    // 顶点属性布局（size/type/stride/offset）也要原样
    expect(result.after.attribs).toEqual(result.before.attribs);

    expect(result.after.program, "TinyUI 把 program 换掉后没还回来").toBe(
      result.before.program,
    );

    expect(result.glError, "绘制过程中产生了 GL 错误").toBe(0);
  });

  test("连续多帧交替绘制也不漂移", async ({ page }) => {
    const bad = await page.evaluate(async () => {
      const ts = (window as any).testScenario;

      /* 断言绝对条件，不做「前后两帧互相比较」。
         早期版本把第一帧的状态当基线，结果状态一旦从一开始就是脏的，
         后续帧跟脏基线一致 —— 测试反而绿了（实测过）。
         这里每帧都直接问：引擎自己的 buffer 还在位吗？ */
      const bad: Array<{ frame: number; why: string }> = [];
      for (let i = 0; i < 30; i++) {
        ts.step(); // engineDraw + patchRender
        const s = ts.captureState();
        if (s.elementArrayBuffer !== ts.indexBuffer) {
          bad.push({ frame: i, why: "element buffer 不是引擎自己的" });
          break;
        }
        const a0 = s.attribs.find((x: any) => x.i === 0 && x.enabled);
        if (!a0 || a0.buffer !== ts.positionBuffer) {
          bad.push({ frame: i, why: "attrib 0 指向了 TinyUI 的 buffer" });
          break;
        }
        if (s.vao !== ts.vao) {
          bad.push({ frame: i, why: "VAO 绑定被改掉" });
          break;
        }
      }
      return bad;
    });

    expect(bad, "有帧在交替绘制后状态被污染").toEqual([]);
  });

  test("两个引擎的画面都在", async ({ page }) => {
    // 冻结循环，避免截到不同帧
    await page.evaluate(() => {
      const ts = (window as any).testScenario;
      ts.drawEngineOnly();
      ts.tinyUI.patchRender();
    });

    await expect(page.locator("canvas#game")).toHaveScreenshot(
      "vao-scene.png",
      { maxDiffPixelRatio: 0.02 },
    );
  });
});
