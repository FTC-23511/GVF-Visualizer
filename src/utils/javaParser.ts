import type { Point, Line } from "../types";
import { getRandomColor } from "./draw";

/**
 * Extracts Pose2d data from a string.
 * Supports:
 * - new Pose2d(x, y, Math.toRadians(deg))
 * - new Pose2d(x, y, deg)
 * - new Pose2d(x, y, new Rotation2d(deg))
 */
function extractPose2d(str: string): { x: number; y: number; deg: number } | null {
  if (!str) return null;
  
  // A number regex that handles decimals, signs, and scientific notation
  const num = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.source;
  
  // 1. Try to find the X, Y, and Heading arguments
  // We match "new Pose2d(" then anything that looks like 3 arguments
  const poseRegex = /new\s+Pose2d\s*\(([\s\S]*?)\)/i;
  const match = str.match(poseRegex);
  if (!match) return null;

  const inner = match[1];
  const args = splitArgs(inner);
  if (args.length < 2) return null;

  const xPart = args[0];
  const yPart = args[1];
  const hPart = args.length >= 3 ? args[2] : "0";

  // Try to parse X and Y as floats. If they are variables/expressions, this might fail (return NaN)
  const x = parseFloat(xPart.match(/[-+]?\d+\.?\d*/)?.[0] || "0");
  const y = parseFloat(yPart.match(/[-+]?\d+\.?\d*/)?.[0] || "0");
  
  // Try to find a degree/radian value in the 3rd arg
  let deg = 0;
  const degMatch = hPart.match(new RegExp(num));
  if (degMatch) {
      deg = parseFloat(degMatch[0]);
  }

  return { x, y, deg };
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
    console.log("GVF Path Parser: Starting...");
    try {
        // 1. Pre-process: Strip comments and keep track of line numbers for debugging
        javaCode = javaCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

        let startPoint: Point | null = null;
        const lines: Line[] = [];
        
        // Track variables
        const poseVars = new Map<string, { x: number, y: number, deg: number }>();
        const pathVars = new Map<string, { lastPose: { x: number, y: number, deg: number } }>();

        // 2. Tokenize into statements. We need to handle the fluent API where a statement
        // might span multiple lines (e.g., path = new Path().addPoint().addPoint();)
        const statements: string[] = [];
        let currentStmt = "";
        let parenDepth = 0;
        
        for (let i = 0; i < javaCode.length; i++) {
            const char = javaCode[i];
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
            
            // Treat semicolons as statement ends, but also handle blocks for context
            if ((char === ';' || char === '{' || char === '}') && parenDepth === 0) {
                if (currentStmt.trim()) statements.push(currentStmt.trim());
                currentStmt = "";
            } else {
                currentStmt += char;
            }
        }
        if (currentStmt.trim()) statements.push(currentStmt.trim());

        // 3. Process each statement
        statements.forEach((stmt) => {
            // A. Pose2d Variable Assignments
            // e.g., Pose2d start = new Pose2d(0, 0, 0);
            const poseAssignMatch = stmt.match(/(?:Pose2d\s+)?(\w+)\s*=\s*(new\s+Pose2d\s*\(.*?\))/i);
            if (poseAssignMatch) {
                const varName = poseAssignMatch[1];
                const data = extractPose2d(poseAssignMatch[2]);
                if (data) {
                    poseVars.set(varName, data);
                    console.log(`Pose Var: ${varName} = (${data.x}, ${data.y}, ${data.deg})`);
                }
                return;
            }

            // B. Path Builder Initialization
            // e.g., path = new Path(startPose) or paths.add(new Path(startPose))
            const pathMatch = stmt.match(/(?:(?:Path\s+)?(\w+)\s*=\s*|(\w+)\.add\s*\()?\s*new\s+Path\s*\((.*?)\)/i);
            if (pathMatch) {
                const varName = pathMatch[1] || pathMatch[2] || "paths";
                const startArg = pathMatch[2].trim();
                const startData = extractPose2d(startArg) || poseVars.get(startArg);
                
                if (startData) {
                    pathVars.set(varName, { lastPose: startData });
                    if (!startPoint) {
                        startPoint = {
                            x: startData.x,
                            y: startData.y,
                            heading: "linear",
                            startDeg: startData.deg,
                            endDeg: startData.deg
                        };
                    }
                    console.log(`Path Var Started: ${varName} at (${startData.x}, ${startData.y}, ${startData.deg})`);
                }
                
                // Continue to check for chained calls in the same statement
                // e.g., path = new Path(start).addPoint(...)
            }

            // C. Path Method Calls (Fluent API)
            // We look for .addPoint, .addLinearPoint, .addTangentialPoint
            // We also handle cases like splines.add(new LinearSpline(last, end))
            
            // First, find which path variable or if it's an anonymous new Path()
            const pathVarMatch = stmt.match(/^(\w+)\s*[=.]/);
            const activePathVar = pathVarMatch ? pathVarMatch[1] : null;

            // Pattern for .addPoint(new Pose2d(...)) or .addPoint(someVar)
            const addPointRegex = /\.(addPoint|addLinearPoint|addTangentialPoint)\s*\((.*?)\)/gi;
            let m;
            
            // Per-statement reverse flag
            const isReversed = stmt.includes(".setReversed(true)");

            while ((m = addPointRegex.exec(stmt)) !== null) {
                const method = m[1];
                const arg = m[2].trim();
                const endData = extractPose2d(arg) || poseVars.get(arg);
                
                if (endData) {
                    const pathCtx = activePathVar ? pathVars.get(activePathVar) : null;
                    const lastLine = lines[lines.length - 1];
                    const prevPose = pathCtx ? pathCtx.lastPose : (lastLine ? { x: lastLine.endPoint.x, y: lastLine.endPoint.y, deg: lastLine.endPoint.endDeg } : (startPoint ? { x: startPoint.x, y: startPoint.y, deg: startPoint.startDeg } : null));
                    
                    if (prevPose) {
                        const type = method === "addLinearPoint" ? "linear" : "tangential";
                        const splineClass = method === "addLinearPoint" ? "LinearSpline" : "TangentialSpline";
                        
                        lines.push({
                            endPoint: {
                                x: endData.x,
                                y: endData.y,
                                heading: type as any,
                                startDeg: prevPose.deg,
                                endDeg: endData.deg,
                                ...(type === "tangential" ? { reverse: isReversed } : {})
                            } as Point,
                            controlPoints: [],
                            color: getRandomColor(),
                            splineClass: splineClass
                        });
                        
                        if (activePathVar && pathCtx) {
                            pathCtx.lastPose = endData;
                        }
                        console.log(`Segment Added via ${method}: to (${endData.x}, ${endData.y}, ${endData.deg}) ${isReversed ? '(Reversed)' : ''}`);
                    }
                }
            }

            // D. Classic Spline Constructor Fallback
            // e.g., splines.add(new LinearSpline(p1, p2))
            const classicSplineRegex = /new\s+(\w+Spline)\s*\((.*?)\)/gi;
            while ((m = classicSplineRegex.exec(stmt)) !== null) {
                const splineClass = m[1];
                const inner = m[2];
                const args = splitArgs(inner);
                
                if (args.length >= 2) {
                    const startArg = args[0].trim();
                    const endArg = args[args.length - 1].trim();
                    
                    const startData = extractPose2d(startArg) || poseVars.get(startArg);
                    const endData = extractPose2d(endArg) || poseVars.get(endArg);
                    
                    if (endData) {
                        if (!startPoint && startData) {
                            startPoint = {
                                x: startData.x,
                                y: startData.y,
                                heading: "linear",
                                startDeg: startData.deg,
                                endDeg: startData.deg
                            };
                        }
                        
                        const lastLine = lines[lines.length - 1];
                        const actualStart: {x: number, y: number, deg: number} | null = startData || (lastLine ? { x: lastLine.endPoint.x, y: lastLine.endPoint.y, deg: lastLine.endPoint.endDeg } : null);
                        if (actualStart) {
                            const type = splineClass.toLowerCase().includes("linear") ? "linear" : "tangential";
                            lines.push({
                                endPoint: {
                                    x: endData.x,
                                    y: endData.y,
                                    heading: type as any,
                                    startDeg: actualStart.deg,
                                    endDeg: endData.deg
                                } as Point,
                                controlPoints: [],
                                color: getRandomColor(),
                                splineClass: splineClass
                            });
                            console.log(`Segment Added via Constructor: ${splineClass} to (${endData.x}, ${endData.y}, ${endData.deg})`);
                        }
                    }
                }
            }
        });

        // 4. Final Fallback: Pure Poses
        if (lines.length === 0) {
            const posePattern = /new\s+Pose2d\s*\(\s*[-+]?(?:\d+\.?\d*)\s*,\s*[-+]?(?:\d+\.?\d*)\s*,\s*(?:Math\.toRadians\s*\(\s*[-+]?(?:\d+\.?\d*)\s*\)|[-+]?(\d+\.?\d*))\s*\)/gi;
            const allPoses = [...javaCode.matchAll(posePattern)];
            if (allPoses.length >= 2) {
                const p0 = extractPose2d(allPoses[0][0])!;
                startPoint = { x: p0.x, y: p0.y, heading: "linear", startDeg: p0.deg, endDeg: p0.deg };
                for (let i = 1; i < allPoses.length; i++) {
                    const p = extractPose2d(allPoses[i][0])!;
                    lines.push({
                        endPoint: { x: p.x, y: p.y, heading: "linear", startDeg: startPoint.endDeg, endDeg: p.deg },
                        controlPoints: [],
                        color: getRandomColor(),
                        splineClass: "LinearSpline"
                    });
                }
            }
        }

        if (!startPoint || lines.length === 0) return null;
        return { startPoint, lines };

    } catch (e) {
        console.error("GVF Parser Error:", e);
        return null;
    }
}


