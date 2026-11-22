export function containSize(
  boxWidth: number,
  boxHeight: number,
  aspect: number,
): { width: number; height: number } {
  if (boxWidth <= 0 || boxHeight <= 0 || aspect <= 0) {
    return { width: 0, height: 0 };
  }
  if (boxWidth / boxHeight > aspect) {
    return { width: boxHeight * aspect, height: boxHeight };
  }
  return { width: boxWidth, height: boxWidth / aspect };
}
