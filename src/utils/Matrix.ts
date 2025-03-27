export class Matrix {
  // 矩阵用一维数组表示 3x3 矩阵
  private values: number[] = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
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
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
    return this;
  }

  // 平移矩阵
  translate(x: number, y: number): Matrix {
    const a = this.values;
    a[2] = a[0] * x + a[1] * y + a[2];
    a[5] = a[3] * x + a[4] * y + a[5];
    a[8] = a[6] * x + a[7] * y + a[8];
    return this;
  }

  // 旋转矩阵
  rotate(angle: number): Matrix {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const a = this.values;
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];

    a[0] = a00 * cos + a01 * sin;
    a[1] = -a00 * sin + a01 * cos;
    a[3] = a10 * cos + a11 * sin;
    a[4] = -a10 * sin + a11 * cos;

    return this;
  }

  // 缩放矩阵
  scale(x: number, y: number): Matrix {
    const a = this.values;
    a[0] *= x;
    a[1] *= y;
    a[3] *= x;
    a[4] *= y;
    return this;
  }

  // 转换为数组
  toArray(): number[] {
    return this.values;
  }

  // 创建正射投影矩阵
  static projection(width: number, height: number): Matrix {
    const matrix = new Matrix();

    // WebGL 坐标系转换
    // 屏幕坐标系: 左上角(0,0)，右下角(width,height)
    // WebGL 坐标系: 左下角(-1,-1)，右上角(1,1)

    matrix.values = [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1
    ];

    return matrix;
  }
}
