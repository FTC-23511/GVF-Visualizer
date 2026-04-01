import type { BasePoint } from "../types";

export function quadraticToCubic(
  P0: BasePoint,
  P1: BasePoint,
  P2: BasePoint
): { Q1: BasePoint; Q2: BasePoint } {
  const Q1 = {
    x: P0.x + (2 / 3) * (P1.x - P0.x),
    y: P0.y + (2 / 3) * (P1.y - P0.y),
  };

  const Q2 = {
    x: P2.x + (2 / 3) * (P1.x - P2.x),
    y: P2.y + (2 / 3) * (P1.y - P2.y),
  };

  return { Q1, Q2 };
}

export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function getMousePos(evt: MouseEvent, canvas: any) {
  let rect = canvas.getBoundingClientRect();
  return {
    x:
      ((evt.clientX - rect.left) / (rect.right - rect.left)) *
      canvas.width.baseVal.value,
    y:
      ((evt.clientY - rect.top) / (rect.bottom - rect.top)) *
      canvas.height.baseVal.value,
  };
}

export function vh(percent: number) {
  var h = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  );
  return (percent * h) / 100;
}

export function vw(percent: number) {
  var w = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0
  );
  return (percent * w) / 100;
}

export function transformAngle(angle: number) {
  return ((angle + 180) % 360) - 180;
}

export function shortestRotation(
  startAngle: number,
  endAngle: number,
  percentage: number
) {
  // Normalize the angles to the range 0 to 360
  startAngle = (startAngle + 360) % 360;
  endAngle = (endAngle + 360) % 360;

  // Calculate the difference between the angles
  let difference = endAngle - startAngle;

  // Adjust the difference to take the shortest path
  if (difference > 180) {
    difference -= 360;
  } else if (difference < -180) {
    difference += 360;
  }

  // Calculate the interpolated angle
  let result = startAngle + difference * percentage;

  // Normalize the result to the range 0 to 360
  return result;
}

export function radiansToDegrees(radians: number) {
  return radians * (180 / Math.PI);
}

export function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

export function lerp(ratio: number, start: number, end: number) {
  return start + (end - start) * ratio;
}

export function lerp2d(ratio: number, start: BasePoint, end: BasePoint) {
  return {
    x: lerp(ratio, start.x, end.x),
    y: lerp(ratio, start.y, end.y)
  };
}

export function getCurvePoint(t: number, points: BasePoint[]): BasePoint {
  if (points.length === 1) return points[0];
  var newpoints = [];
  for (var i = 0, j = 1; j < points.length; i++, j++) {
    newpoints[i] = lerp2d(t, points[i], points[j]);
  }
  return getCurvePoint(t,newpoints);
}

export function getHermitePoint(t: number, p0: any, h0: number, p1: any, h1: number, tangentMag: number = 1.0): any {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const scale = dist * 1.2 * tangentMag;

  const v0 = { x: Math.cos(h0) * scale, y: Math.sin(h0) * scale };
  const v1 = { x: Math.cos(h1) * scale, y: Math.sin(h1) * scale };

  // Quintic coefficients
  const c5 = {
    x: p0.x * -6 - v0.x * 3 + p1.x * 6 - v1.x * 3,
    y: p0.y * -6 - v0.y * 3 + p1.y * 6 - v1.y * 3
  };
  const c4 = {
    x: p0.x * 15 + v0.x * 8 - p1.x * 15 + v1.x * 7,
    y: p0.y * 15 + v0.y * 8 - p1.y * 15 + v1.y * 7
  };
  const c3 = {
    x: p0.x * -10 - v0.x * 6 + p1.x * 10 - v1.x * 4,
    y: p0.y * -10 - v0.y * 6 + p1.y * 10 - v1.y * 4
  };
  const c2 = { x: 0, y: 0 };
  const c1 = v0;
  const c0 = p0;

  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const pos = {
    x: c5.x * t5 + c4.x * t4 + c3.x * t3 + c2.x * t2 + c1.x * t + c0.x,
    y: c5.y * t5 + c4.y * t4 + c3.y * t3 + c2.y * t2 + c1.y * t + c0.y
  };

  // Calculate velocity (derivative) for heading
  const vel = {
    x: 5 * c5.x * t4 + 4 * c4.x * t3 + 3 * c3.x * t2 + 2 * c2.x * t + c1.x,
    y: 5 * c5.y * t4 + 4 * c4.y * t3 + 3 * c3.y * t2 + 2 * c2.y * t + c1.y
  };

  return { ...pos, heading: Math.atan2(vel.y, vel.x) };
}

export function getPointFromRegistry(
  t: number, 
  p0: any, 
  p1: any, 
  splineClass: string, 
  registry: Record<string, any>,
  tangentMag: number = 1.0,
  reversed: boolean = false
): any {
  const customMath = registry[splineClass];
  let result: any;

  if (customMath && customMath.getPos) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = dist * 1.2 * tangentMag;
    
    // Heading in radians
    const h0 = (p0.endDeg !== undefined ? p0.endDeg : 0) * (Math.PI / 180);
    const h1 = (p1.endDeg !== undefined ? p1.endDeg : 0) * (Math.PI / 180);

    const v0 = { x: Math.cos(h0) * scale, y: Math.sin(h0) * scale };
    const v1 = { x: Math.cos(h1) * scale, y: Math.sin(h1) * scale };

    try {
      const pos = customMath.getPos(t, p0, p1, v0, v1);
      // For custom math, we approximate heading via a small delta
      const deltaT = 1e-3;
      const pos2 = customMath.getPos(Math.min(1, t + deltaT), p0, p1, v0, v1);
      const heading = (t >= 1) ? Math.atan2(pos.y - p0.y, pos.x - p0.x) : Math.atan2(pos2.y - pos.y, pos2.x - pos.x);
      result = { ...pos, heading };
    } catch (e) {
      console.error(`Error in custom spline math for ${splineClass}:`, e);
      result = getHermitePoint(t, p0, h0, p1, h1, tangentMag);
    }
  } else if (splineClass.toLowerCase().includes("linear")) {
    const pos = {
      x: p0.x + t * (p1.x - p0.x),
      y: p0.y + t * (p1.y - p0.y)
    };
    // Linear interpolation for heading
    const h0 = (p0.endDeg !== undefined ? p0.endDeg : 90);
    const h1 = (p1.endDeg !== undefined ? p1.endDeg : 90);
    const headingDeg = shortestRotation(h0, h1, t);
    result = { ...pos, heading: degreesToRadians(headingDeg) };
  } else {
    // Default to hardcoded Hermite
    const h0 = (p0.endDeg !== undefined ? p0.endDeg : 0) * (Math.PI / 180);
    const h1 = (p1.endDeg !== undefined ? p1.endDeg : 0) * (Math.PI / 180);
    result = getHermitePoint(t, p0, h0, p1, h1, tangentMag);
  }

  // Handle reversed flag
  if (reversed) {
    result.heading = (result.heading + Math.PI) % (2 * Math.PI);
  }

  return result;
}
