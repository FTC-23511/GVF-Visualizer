export function parseJavaCode(javaCode: string): { startPoint: Point; lines: Line[] } | null {
  try {
    const pose2dPattern = /new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*Math\.toRadians\s*\(\s*([-+]?\d+\.?\d*)\s*\)\s*\)/g;

    const matches = [...javaCode.matchAll(pose2dPattern)];

    if (matches.length < 2) {
      return null;
    }

    const firstMatch = matches[0];
    const startPoint: Point = {
      x: parseFloat(firstMatch[1]),
      y: parseFloat(firstMatch[2]),
      heading: "linear",
      startDeg: parseFloat(firstMatch[3]),
      endDeg: parseFloat(firstMatch[3])
    };

    const lines: Line[] = [];

    for (let i = 1; i < matches.length; i++) {
      const match = matches[i];
      const prevMatch = matches[i - 1];

      lines.push({
        endPoint: {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          heading: "linear",
          startDeg: parseFloat(prevMatch[3]),
          endDeg: parseFloat(match[3])
        },
        controlPoints: [],
        color: getRandomColor()
      });
    }

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
