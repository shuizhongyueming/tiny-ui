import { describe, it, expect, vi } from 'vitest';
import { DisplayObject } from '../../src/DisplayObject';
import type TinyUI from '../../src/TinyUI';

describe('DisplayObject', () => {
  const mockApp = {} as TinyUI;

  it('should set position properties', () => {
    const obj = new DisplayObject(mockApp);
    obj.x = 100;
    obj.y = 200;
    expect(obj.x).toBe(100);
    expect(obj.y).toBe(200);
  });

  it('should set scale properties', () => {
    const obj = new DisplayObject(mockApp);
    obj.scaleX = 2;
    obj.scaleY = 3;
    expect(obj.scaleX).toBe(2);
    expect(obj.scaleY).toBe(3);
  });

  it('should use scaleTo for uniform scaling', () => {
    const obj = new DisplayObject(mockApp);
    obj.scaleTo(2);
    expect(obj.scaleX).toBe(2);
    expect(obj.scaleY).toBe(2);
  });

  it('should use scaleToFit', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    obj.scaleToFit(200, 300);
    expect(obj.scaleX).toBe(2);
    expect(obj.scaleY).toBe(3);
  });

  it('should set anchor properties', () => {
    const obj = new DisplayObject(mockApp);
    obj.anchorX = 0.5;
    obj.anchorY = 0.5;
    expect(obj.anchorX).toBe(0.5);
    expect(obj.anchorY).toBe(0.5);
  });

  it('should calculate local transform matrix with anchor', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    obj.x = 50;
    obj.y = 50;
    obj.anchorX = 0.5;
    obj.anchorY = 0.5;
    
    const matrix = obj.getLocalTransformMatrix();
    expect(matrix.tx).toBe(0);
    expect(matrix.ty).toBe(0);
  });

  it('should calculate bounds', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    obj.x = 50;
    obj.y = 50;
    
    const bounds = obj.getBounds();
    expect(bounds.width).toBe(100);
    expect(bounds.height).toBe(100);
  });

  it('should handle hit test', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    
    expect(obj.hitTest(50, 50)).toBe(true);
    expect(obj.hitTest(150, 150)).toBe(false);
  });

  it('should respect visibility for hit test', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    obj.visible = false;
    
    expect(obj.hitTest(50, 50)).toBe(false);
  });

  it('should allow hit test when alpha is 0', () => {
    const obj = new DisplayObject(mockApp);
    obj.setWidth(100);
    obj.setHeight(100);
    obj.alpha = 0;
    
    // alpha 为 0 只是不可见，但仍然可以交互
    expect(obj.hitTest(50, 50)).toBe(true);
  });

  it('should manage event listeners', () => {
    const obj = new DisplayObject(mockApp);
    const handler = vi.fn();
    
    obj.addEventListener('touchstart' as any, handler);
    expect(obj.hasEventListener('touchstart' as any)).toBe(true);
    
    obj.removeEventListener('touchstart' as any, handler);
    expect(obj.hasEventListener('touchstart' as any)).toBe(false);
  });
});
