export class Matrix {
  // 矩阵用一维数组表示 3x3 矩阵，使用列主序
  values: number[] = [
    1, 0, 0,  // 第一列
    0, 1, 0,  // 第二列
    0, 0, 1   // 第三列
  ];

  // 添加属性访问器，便于访问矩阵中的元素
  get a(): number { return this.values[0]; } // a (0,0)
  get b(): number { return this.values[1]; } // b (1,0)
  get c(): number { return this.values[3]; } // c (0,1)
  get d(): number { return this.values[4]; } // d (1,1)
  get tx(): number { return this.values[6]; } // tx (0,2)
  get ty(): number { return this.values[7]; } // ty (1,2)

  set a(value: number) { this.values[0] = value; }
  set b(value: number) { this.values[1] = value; }
  set c(value: number) { this.values[3] = value; }
  set d(value: number) { this.values[4] = value; }
  set tx(value: number) { this.values[6] = value; }
  set ty(value: number) { this.values[7] = value; }

  constructor(a?: number, b?: number, c?: number, d?: number, tx?: number, ty?: number) {
    if (a !== undefined) this.a = a;
    if (b !== undefined) this.b = b;
    if (c !== undefined) this.c = c;
    if (d !== undefined) this.d = d;
    if (tx !== undefined) this.tx = tx;
    if (ty !== undefined) this.ty = ty;
  }

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

  // 矩阵求逆
  invert(): Matrix | null {
    const [a00, a10, a20, a01, a11, a21, a02, a12, a22] = this.values;

    // 计算行列式
    const det = a00 * (a11 * a22 - a21 * a12) -
      a01 * (a10 * a22 - a20 * a12) +
      a02 * (a10 * a21 - a20 * a11);

    // 如果行列式为零，矩阵不可逆
    if (Math.abs(det) < 1e-8) {
      return null;
    }

    const invDet = 1 / det;

    // 计算伴随矩阵的转置，然后乘以行列式的倒数
    const result = new Matrix();
    result.values = [
      (a11 * a22 - a21 * a12) * invDet,
      (a20 * a12 - a10 * a22) * invDet,
      (a10 * a21 - a20 * a11) * invDet,

      (a21 * a02 - a01 * a22) * invDet,
      (a00 * a22 - a20 * a02) * invDet,
      (a20 * a01 - a00 * a21) * invDet,

      (a01 * a12 - a11 * a02) * invDet,
      (a10 * a02 - a00 * a12) * invDet,
      (a00 * a11 - a10 * a01) * invDet
    ];

    return result;
  }

  // 转换点坐标
  transformPoint(x: number, y: number): { x: number, y: number } {
    const a = this.values;
    return {
      x: a[0] * x + a[3] * y + a[6],
      y: a[1] * x + a[4] * y + a[7]
    };
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
