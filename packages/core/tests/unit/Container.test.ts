import { describe, it, expect } from "vitest";
import { Container } from "../../src/Container";
import { DisplayObject } from "../../src/DisplayObject";
import type TinyUI from "../../src/TinyUI";

describe("Container", () => {
  const mockApp = {} as TinyUI;

  it("should add child and set parent", () => {
    const container = new Container(mockApp);
    const child = new DisplayObject(mockApp);

    container.addChild(child);

    expect(container.children.length).toBe(1);
    expect(child.parent).toBe(container);
  });

  it("should remove child and clear parent", () => {
    const container = new Container(mockApp);
    const child = new DisplayObject(mockApp);

    container.addChild(child);
    container.removeChild(child);

    expect(container.children.length).toBe(0);
    expect(child.parent).toBeNull();
  });

  it("should set width and height externally", () => {
    const container = new Container(mockApp);
    container.width = 200;
    container.height = 300;

    expect(container.width).toBe(200);
    expect(container.height).toBe(300);
  });

  it("should use setSize helper", () => {
    const container = new Container(mockApp);
    container.setSize({ width: 400, height: 300 });

    expect(container.width).toBe(400);
    expect(container.height).toBe(300);
  });

  it("should transfer child from one container to another", () => {
    const container1 = new Container(mockApp);
    const container2 = new Container(mockApp);
    const child = new DisplayObject(mockApp);

    container1.addChild(child);
    expect(child.parent).toBe(container1);
    expect(container1.children.length).toBe(1);

    container2.addChild(child);
    expect(child.parent).toBe(container2);
    expect(container1.children.length).toBe(0);
    expect(container2.children.length).toBe(1);
  });

  it("should hit test children", () => {
    const container = new Container(mockApp);
    container.width = 200;
    container.height = 200;
    container.x = 0;
    container.y = 0;

    const child = new DisplayObject(mockApp);
    child._setWidth(100);
    child._setHeight(100);
    child.x = 50;
    child.y = 50;

    container.addChild(child);

    expect(container.hitTest(75, 75)).toBe(true);
    expect(container.hitTest(250, 250)).toBe(false);
  });

  it("should inherit parent transformation", () => {
    const parent = new Container(mockApp);
    parent.x = 100;
    parent.y = 100;
    parent.scaleX = 2;
    parent.scaleY = 2;

    const child = new DisplayObject(mockApp);
    child._setWidth(50);
    child._setHeight(50);
    child.x = 50;
    child.y = 50;
    child.anchorX = 0; // 设置 anchor 为 0，使左上角与位置对齐
    child.anchorY = 0;

    parent.addChild(child);

    const globalMatrix = child.getGlobalTransformMatrix();
    const point = globalMatrix.transformPoint(0, 0);

    expect(point.x).toBe(200); // 100 + 50 * 2 = 200
    expect(point.y).toBe(200); // 100 + 50 * 2 = 200
  });
});
