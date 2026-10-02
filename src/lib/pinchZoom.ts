export type TouchPoint = Pick<Touch, "clientX" | "clientY">;

export function pinchDistance(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function clampZoom(z: number, min = 0.6, max = 3): number {
  return Math.max(min, Math.min(max, z));
}
