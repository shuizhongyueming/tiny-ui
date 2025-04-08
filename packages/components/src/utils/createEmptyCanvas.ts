
export const createEmptyCanvas = (width: number = 8, height?: number) => {
  height = height || width;
  const cvs = document.createElement('canvas');
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  return cvs;
}
