export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Physics {
  static checkAABB(a: Box, b: Box): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  static clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }
}
