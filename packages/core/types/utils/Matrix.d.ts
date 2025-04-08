export declare class Matrix {
    values: number[];
    get a(): number;
    get b(): number;
    get c(): number;
    get d(): number;
    get tx(): number;
    get ty(): number;
    set a(value: number);
    set b(value: number);
    set c(value: number);
    set d(value: number);
    set tx(value: number);
    set ty(value: number);
    constructor(a?: number, b?: number, c?: number, d?: number, tx?: number, ty?: number);
    clone(): Matrix;
    identity(): Matrix;
    multiply(m: Matrix): Matrix;
    translate(x: number, y: number): Matrix;
    rotate(angle: number): Matrix;
    scale(x: number, y: number): Matrix;
    invert(): Matrix | null;
    transformPoint(x: number, y: number): {
        x: number;
        y: number;
    };
    toArray(): number[];
    transpose(): Matrix;
}
