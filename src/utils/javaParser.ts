import type { Point, Line } from "../types";

/**
 * Extracts Pose2d data from a string.
 */
function extractPose2d(str: string): { x: number; y: number; deg: number } | null {
  if (!str) return null;
  // Improved number regex: supports .5, -1.2, 1e-3, etc.
  const num = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.source;
  const poseRegex = new RegExp(`new\\s+Pose2d\\s*\\(\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(?:Math\\.toRadians\\s*\\(\\s*(${num})\\s*\\)|(${num}))\\s*\\)`, "i");
  
  const match = str.match(poseRegex);
  if (!match) return null;
  
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    deg: parseFloat(match[3] || match[4])
  };
}

/**
 * Finds the matching closing parenthesis for a starting one.
 */
function findClosingParen(str: string, startIndex: number): number {
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Splits a string by commas, but only at the top level (ignoring commas inside parentheses).
 */
function splitArgs(str: string): string[] {
    const args: string[] = [];
    let currentArg = "";
    let depth = 0;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        
        if (char === ',' && depth === 0) {
            args.push(currentArg.trim());
            currentArg = "";
        } else {
            currentArg += char;
        }
    }
    
    if (currentArg.trim()) {
        args.push(currentArg.trim());
    }
    
    return args;
}

export function parseJavaCode(javaCode: string): { startPoint: Point; lines: Line[] } | null {
    console.log("Variable Tracking Parser: Starting...");
    try {
        // Strip comments
        javaCode = javaCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

        if (javaCode.includes("public class") && !javaCode.includes("getPath")) {
            console.warn("Detected a library class definition, not a trajectory path.");
        }
        
        const lines: Line[] = [];
        let startPoint: Point | null = null;
        
        // Track Pose2d variables
        const poseVars = new Map<string, { x: number, y: number, deg: number }>();

        // 1. Split code into lines/statements to process sequentially
        // We use a more careful split that doesn't break inside Pose2d or Spline constructors
        const statements: string[] = [];
        let currentStmt = "";
        let parenDepth = 0;
        for (let i = 0; i < javaCode.length; i++) {
            const char = javaCode[i];
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
            
            if ((char === ';' || char === '{' || char === '}') && parenDepth === 0) {
                statements.push(currentStmt.trim());
                currentStmt = "";
            } else {
                currentStmt += char;
            }
        }
        if (currentStmt.trim()) statements.push(currentStmt.trim());

        statements.forEach((stmt, idx) => {
            stmt = stmt.trim();
            if (!stmt) return;
            
            // 1. Look for Pose2d assignments: [Pose2d] name = new Pose2d(...)
            const newPoseMatch = stmt.match(/(?:Pose2d\s+)?(\w+)\s*=\s*(new\s+Pose2d\s*\(.*?\))/i);
            if (newPoseMatch) {
                const varName = newPoseMatch[1];
                const poseData = extractPose2d(newPoseMatch[2]);
                if (poseData) {
                    console.log(`Variable Track (New): ${varName} = (${poseData.x}, ${poseData.y}, ${poseData.deg})`);
                    poseVars.set(varName, poseData);
                }
                return;
            }

            // 2. Look for Variable-to-Variable assignments: [Pose2d] name1 = name2
            const varToVarMatch = stmt.match(/(?:Pose2d\s+)?(\w+)\s*=\s*(\w+)/i);
            if (varToVarMatch) {
                const targetVar = varToVarMatch[1];
                const sourceVar = varToVarMatch[2];
                if (poseVars.has(sourceVar)) {
                    const poseData = poseVars.get(sourceVar)!;
                    console.log(`Variable Track (Copy): ${targetVar} = ${sourceVar} (${poseData.x}, ${poseData.y}, ${poseData.deg})`);
                    poseVars.set(targetVar, poseData);
                }
                return;
            }

            // Look for Spline additions: [splines.add(] new ...Spline(...)
            // We search for the "new ...Spline(" pattern regardless of where it appears in the statement
            const splineStartRegex = /new\s+(\w+Spline)\s*\(/gi;
            let m;
            while ((m = splineStartRegex.exec(stmt)) !== null) {
                const splineClass = m[1];
                const openParenIndex = m.index + m[0].length - 1;
                const closeParenIndex = findClosingParen(stmt, openParenIndex);
                
                if (openParenIndex !== -1 && closeParenIndex !== -1) {
                    const innerContent = stmt.substring(openParenIndex + 1, closeParenIndex);
                    const args = splitArgs(innerContent);
                    
                    if (args.length >= 2) {
                        const startArg = args[0];
                        const endArg = args[args.length - 1];
                        
                        let startData = extractPose2d(startArg) || poseVars.get(startArg);
                        let endData = extractPose2d(endArg) || poseVars.get(endArg);
                        
                        if (endData) {
                            if (!startPoint && startData) {
                                startPoint = {
                                    x: startData.x,
                                    y: startData.y,
                                    heading: "linear",
                                    startDeg: startData.deg,
                                    endDeg: startData.deg
                                };
                                console.log(`Path Start: (${startPoint.x}, ${startPoint.y}, ${startPoint.startDeg})`);
                            }
                            
                            const headingType = splineClass.toLowerCase().includes("linear") ? "linear" : "tangential";
                            const prevPoseDeg = lines.length > 0 ? lines[lines.length - 1].endPoint.endDeg : (startPoint?.endDeg ?? 0);
                            
                            const controlPoints: {x: number, y: number}[] = [];
                            for (let i = 1; i < args.length - 1; i++) {
                                const arg = args[i];
                                const cpData = extractPose2d(arg) || poseVars.get(arg);
                                if (cpData) {
                                    controlPoints.push({ x: cpData.x, y: cpData.y });
                                }
                            }

                            console.log(`Spline Added: ${splineClass} to (${endData.x}, ${endData.y}, ${endData.deg}) with ${controlPoints.length} CPs`);

                            lines.push({
                                endPoint: {
                                    x: endData.x,
                                    y: endData.y,
                                    heading: headingType as any,
                                    startDeg: prevPoseDeg,
                                    endDeg: endData.deg,
                                    ...(headingType === "tangential" ? { reverse: false } : {})
                                } as Point,
                                controlPoints: controlPoints,
                                color: getRandomColor(),
                                splineClass: splineClass
                            });
                        } else {
                            console.warn(`Could not resolve end pose for spline: ${stmt}`);
                        }
                    }
                }
            }
        });

    if (lines.length === 0) {
      console.log("No splines found, checking for Pose2d list fallback...");
      const posePattern = /new\s+Pose2d\s*\(\s*[-+]?\d+\.?\d*\s*,\s*[-+]?\d+\.?\d*\s*,\s*(?:Math\.toRadians\s*\(\s*[-+]?\d+\.?\d*\s*\)|[-+]?\d+\.?\d*)\s*\)/gi;
      const allPosesMatch = [...javaCode.matchAll(posePattern)];

      if (allPosesMatch.length >= 2) {
        const firstPoseData = extractPose2d(allPosesMatch[0][0])!;
        startPoint = {
          x: firstPoseData.x,
          y: firstPoseData.y,
          heading: "linear",
          startDeg: firstPoseData.deg,
          endDeg: firstPoseData.deg
        };

        for (let i = 1; i < allPosesMatch.length; i++) {
          const poseData = extractPose2d(allPosesMatch[i][0])!;
          const prevPoseData = extractPose2d(allPosesMatch[i-1][0])!;
          lines.push({
            endPoint: {
              x: poseData.x,
              y: poseData.y,
              heading: "linear",
              startDeg: prevPoseData.deg,
              endDeg: poseData.deg
            },
            controlPoints: [],
            color: getRandomColor(),
            splineClass: "LinearSpline"
          });
        }
      }
    }

    if (!startPoint || lines.length === 0) {
        console.warn("Parse failed: No start point or segments found.");
        return null;
    }

    console.log(`Parse success: ${lines.length} segments.`);
    return { startPoint, lines };
  } catch (error) {
    console.error("Error in Variable Tracking Parser:", error);
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
