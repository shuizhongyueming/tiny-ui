import { describe, it, expect } from 'vitest';
import { Matrix } from '../../src/utils/Matrix';

describe('Matrix', () => {
  it('should create identity matrix', () => {
    const m = new Matrix();
    expect(m.values).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('should translate correctly', () => {
    const m = new Matrix().translate(100, 200);
    expect(m.tx).toBe(100);
    expect(m.ty).toBe(200);
  });

  it('should rotate correctly', () => {
    const m = new Matrix().rotate(Math.PI / 2);
    expect(Math.abs(m.a)).toBeCloseTo(0, 10);
    expect(m.b).toBeCloseTo(1, 10);
    expect(m.c).toBeCloseTo(-1, 10);
    expect(Math.abs(m.d)).toBeCloseTo(0, 10);
  });

  it('should scale correctly', () => {
    const m = new Matrix().scale(2, 3);
    expect(m.a).toBe(2);
    expect(m.d).toBe(3);
  });

  it('should combine transformations', () => {
    const m = new Matrix()
      .translate(100, 100)
      .rotate(Math.PI / 4)
      .scale(2, 2);
    
    expect(m.tx).not.toBe(0);
    expect(m.ty).not.toBe(0);
  });

  it('should invert correctly', () => {
    const m = new Matrix().translate(100, 200).scale(2, 3);
    const inverted = m.invert();
    
    expect(inverted).not.toBeNull();
    if (inverted) {
      const point = { x: 100, y: 200 };
      const transformed = m.transformPoint(point.x, point.y);
      const back = inverted.transformPoint(transformed.x, transformed.y);
      expect(back.x).toBeCloseTo(point.x, 5);
      expect(back.y).toBeCloseTo(point.y, 5);
    }
  });

  it('should return null for singular matrix', () => {
    const m = new Matrix().scale(0, 0);
    expect(m.invert()).toBeNull();
  });

  it('should transform points correctly', () => {
    const m = new Matrix().translate(50, 50);
    const point = m.transformPoint(10, 20);
    expect(point.x).toBe(60);
    expect(point.y).toBe(70);
  });
});
