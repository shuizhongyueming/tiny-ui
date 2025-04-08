export function nextPowerOfTwo(n: number): number {
  // 确保输入为正数
  if (n <= 0) return 1;

  // 计算大于等于n的最小2的幂
  // 将n-1后得到的二进制数全部位变为1，再加1得到2的幂
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
}
