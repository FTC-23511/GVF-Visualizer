import type { Point, Line } from "../types";

export function parseJavaCode(javaCode: string): { startPoint: Point; lines: Line[] } | null {
  try {
    // Look for Pose2d(x, y, Math.toRadians(deg))
    const pose2dPattern = /new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*Math\.toRadians\s*\(\s*([-+]?\d+\.?\d*)\s*\)\s*\)/g;
    
    // Look for new SomeSpline(start, end)
    const splinePattern = /new\s+(\w+Spline)\s*\(\s*(?:[^,]+)\s*,\s*(new\s+Pose2d\s*\([^)]+\))\s*\)/g;

    const poseMatches = [...javaCode.matchAll(pose2dPattern)];
    if (poseMatches.length < 1) return null;

    // The first Pose2d found is usually the start point
    const firstMatch = poseMatches[0];
    const startPoint: Point = {
      x: parseFloat(firstMatch[1]),
      y: parseFloat(firstMatch[2]),
      heading: "linear",
      startDeg: parseFloat(firstMatch[3]),
      endDeg: parseFloat(firstMatch[3])
    };

    const lines: Line[] = [];
    const splineMatches = [...javaCode.matchAll(splinePattern)];

    if (splineMatches.length > 0) {
      // Use the splines found
      splineMatches.forEach((match) => {
        const splineClass = match[1];
        const endPoseStr = match[2];
        const endPoseMatch = endPoseStr.match(/new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*Math\.toRadians\s*\(\s*([-+]?\d+\.?\d*)\s*\)\s*\)/);
        
        if (endPoseMatch) {
          const headingType = splineClass.toLowerCase().includes("linear") ? "linear" : "tangential";
          const endPoint: any = {
            x: parseFloat(endPoseMatch[1]),
            y: parseFloat(endPoseMatch[2]),
            heading: headingType as any,
            startDeg: parseFloat(endPoseMatch[3]),
            endDeg: parseFloat(endPoseMatch[3]),
          };

          if (headingType === "tangential") {
            endPoint.reverse = false;
          }
          
          lines.push({
            endPoint: endPoint as Point,
            controlPoints: [],
            color: getRandomColor(),
            splineClass: splineClass
          });
        }
      });
    } else if (poseMatches.length >= 2) {
      // Fallback to old behavior if no Spline classes found
      for (let i = 1; i < poseMatches.length; i++) {
        const match = poseMatches[i];
        const prevMatch = poseMatches[i - 1];
        lines.push({
          endPoint: {
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            heading: "linear",
            startDeg: parseFloat(prevMatch[3]),
            endDeg: parseFloat(match[3])
          },
          controlPoints: [],
          color: getRandomColor(),
          splineClass: "LinearSpline"
        });
      }
    }

    if (lines.length === 0) return null;

    return { startPoint, lines };
  } catch (error) {
    console.error("Error parsing Java code:", error);
    return null;
  }
}

function getRandomColor() {
  var letters = "56789ABCD";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)];
  }
  return color;
}
