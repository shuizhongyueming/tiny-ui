export class Matrix {
  // 矩阵用一维数组表示 3x3 矩阵，使用列主序
  values: number[] = [
    1, 0, 0,  // 第一列
    0, 1, 0,  // 第二列
    0, 0, 1   // 第三列
  ];

  constructor() { }

  // 克隆矩阵
  clone(): Matrix {
    const matrix = new Matrix();
    matrix.values = [...this.values];
    return matrix;
  }

  // 重置为单位矩阵
  identity(): Matrix {
    this.values = [
      1, 0, 0,  // 第一列
      0, 1, 0,  // 第二列
      0, 0, 1   // 第三列
    ];
    return this;
  }

  // 矩阵乘法（列主序）
  multiply(m: Matrix): Matrix {
    const a = this.values;
    const b = m.values;

    // 列主序下矩阵 a 的元素
    const a00 = a[0], a10 = a[1], a20 = a[2]; // 第一列
    const a01 = a[3], a11 = a[4], a21 = a[5]; // 第二列
    const a02 = a[6], a12 = a[7], a22 = a[8]; // 第三列

    // 列主序下矩阵 b 的元素
    const b00 = b[0], b10 = b[1], b20 = b[2]; // 第一列
    const b01 = b[3], b11 = b[4], b21 = b[5]; // 第二列
    const b02 = b[6], b12 = b[7], b22 = b[8]; // 第三列

    // 计算结果矩阵（列主序）
    this.values = [
      // 第一列
      a00 * b00 + a01 * b10 + a02 * b20,
      a10 * b00 + a11 * b10 + a12 * b20,
      a20 * b00 + a21 * b10 + a22 * b20,

      // 第二列
      a00 * b01 + a01 * b11 + a02 * b21,
      a10 * b01 + a11 * b11 + a12 * b21,
      a20 * b01 + a21 * b11 + a22 * b21,

      // 第三列
      a00 * b02 + a01 * b12 + a02 * b22,
      a10 * b02 + a11 * b12 + a12 * b22,
      a20 * b02 + a21 * b12 + a22 * b22
    ];

    return this;
  }

  // 平移矩阵（列主序）
  translate(x: number, y: number): Matrix {
    const m = new Matrix();
    m.values = [
      1, 0, 0,  // 第一列
      0, 1, 0,  // 第二列
      x, y, 1   // 第三列（包含平移量）
    ];
    return this.multiply(m);
  }

  // 旋转矩阵（列主序）
  rotate(angle: number): Matrix {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const m = new Matrix();
    m.values = [
      cos, sin, 0,    // 第一列
      -sin, cos, 0,   // 第二列
      0, 0, 1         // 第三列
    ];
    return this.multiply(m);
  }

  // 缩放矩阵（列主序）
  scale(x: number, y: number): Matrix {
    const m = new Matrix();
    m.values = [
      x, 0, 0,  // 第一列
      0, y, 0,  // 第二列
      0, 0, 1   // 第三列
    ];
    return this.multiply(m);
  }

  // 转换为数组
  toArray(): number[] {
    return this.values;
  }

  // 添加一个转置方法，用于在需要时转换为行主序
  transpose(): Matrix {
    const [a00, a10, a20, a01, a11, a21, a02, a12, a22] = this.values;
    this.values = [
      a00, a01, a02,
      a10, a11, a12,
      a20, a21, a22
    ];
    return this;
  }
}
