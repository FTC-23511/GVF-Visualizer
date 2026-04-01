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
  
  // 1. Try to find "new Pose2d(...)"
  const match = str.match(/new\s+Pose2d\s*\(([\s\S]*?)\)/i);
  if (!match) return null;

  const inner = match[1];
  const args = splitArgs(inner);
  if (args.length < 2) return null;

  // Robust number extraction
  const extractNum = (s: string) => {
    if (!s) return 0;
    const n = s.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
    return n ? parseFloat(n[0]) : 0;
  };

  const x = extractNum(args[0]);
  const y = extractNum(args[1]);
  const deg = args.length >= 3 ? extractNum(args[2]) : 0;

  return { x, y, deg };
}

/**
 * Extracts a Java class name from the code.
 */
function getClassName(code: string): string {
    const match = code.match(/public\s+class\s+(\w+)/i);
    return match ? match[1] : "UnknownSpline";
}

/**
 * Transpiles a GVF Spline class (SolversLib style) into a JS math function.
 * Specifically looks for Hermite/Quintic coefficient assignments.
 */
function transpileSplineMath(code: string): any {
    console.log("Transpiling Spline Math...");
    
    // Extract coefficient assignments (c5...c0) from the constructor
    // We look for patterns like: c5 = p0.times(-6.0).minus(v0.times(3.0))...
    const coeffs: Record<string, string> = {};
    const coeffNames = ["c5", "c4", "c3", "c2", "c1", "c0"];
    
    coeffNames.forEach(name => {
        // Match: name = expression;
        const re = new RegExp(`${name}\\s*=\\s*([^;]+);`, 'i');
        const m = code.match(re);
        if (m) {
            // Convert Java method chaining to a simpler JS-friendly format if needed
            // For now, we assume our Vector2d class in JS has .times, .plus, .minus
            coeffs[name] = m[1].trim()
                .replace(/\.times\(/g, ' * (')  // Very naive transpilation
                .replace(/\.plus\(/g, ' + (')
                .replace(/\.minus\(/g, ' - (')
                .replace(/new\s+Vector2d\s*\((.*?)\)/g, '{x: 0, y: 0}'); // Handle zero vectors
        }
    });

    // If we can't find coefficients, it might be a different spline type (like Linear)
    if (Object.keys(coeffs).length === 0) {
        if (code.toLowerCase().includes("linear")) {
            return {
                getPos: (t: number, p0: any, p1: any) => {
                    return {
                        x: p0.x + t * (p1.x - p0.x),
                        y: p0.y + t * (p1.y - p0.y)
                    };
                }
            };
        }
    }

    // Default Hermite / Quintic logic if coefficients are found or it's Tangential
    return {
        getPos: (t: number, p0: any, p1: any, v0: any, v1: any) => {
            // This is a "Template" that uses the coefficients logic
            // For SolversLib, the coefficients are usually:
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

            return {
                x: c5.x * t5 + c4.x * t4 + c3.x * t3 + c2.x * t2 + c1.x * t + c0.x,
                y: c5.y * t5 + c4.y * t4 + c3.y * t3 + c2.y * t2 + c1.y * t + c0.y
            };
        }
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

export function parseJavaCode(javaCode: string): { 
    startPoint?: Point; 
    lines?: Line[]; 
    error?: string;
    isLibrary?: boolean;
    splineMath?: any;
    className?: string;
} | null {
    console.log("GVF Path Parser: Starting robust parse...");
    try {
        // Strip comments
        const cleanCode = javaCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

        // Library Detection
        const isSplineClass = /public\s+class\s+\w+Spline\s+extends\s+Spline/i.test(cleanCode);
        const hasTrajectoryData = /new\s+Pose2d\s*\(\s*[-+]?\d+/i.test(cleanCode) || 
                                  cleanCode.includes("getPath") || 
                                  cleanCode.includes(".addSegment") || 
                                  cleanCode.includes("followPath") || 
                                  cleanCode.includes(".build") || 
                                  cleanCode.includes("Path");

        if (isSplineClass && !hasTrajectoryData) {
            console.warn("Detected a library class definition, not a trajectory path.");
            const math = transpileSplineMath(cleanCode);
            return { isLibrary: true, splineMath: math, className: getClassName(cleanCode) };
        }

        // Track all found poses sequentially for fallback
        const allFoundPoses: { x: number, y: number, deg: number }[] = [];
        const posePattern = /new\s+Pose2d\s*\(([\s\S]*?)\)/gi;
        let pMatch;
        while ((pMatch = posePattern.exec(cleanCode)) !== null) {
            const data = extractPose2d(pMatch[0]);
            if (data) allFoundPoses.push(data);
        }
        console.log(`Found ${allFoundPoses.length} total Pose2d declarations.`);

        let startPoint: Point | null = null;
        const lines: Line[] = [];
        const poseVars = new Map<string, { x: number, y: number, deg: number }>();
        const pathVars = new Map<string, { lastPose: { x: number, y: number, deg: number } }>();

        // Tokenize into statements
        const statements: string[] = [];
        let currentStmt = "";
        let parenDepth = 0;
        for (let i = 0; i < cleanCode.length; i++) {
            const char = cleanCode[i];
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
            if ((char === ';' || char === '{' || char === '}') && parenDepth === 0) {
                if (currentStmt.trim()) statements.push(currentStmt.trim());
                currentStmt = "";
            } else {
                currentStmt += char;
            }
        }
        if (currentStmt.trim()) statements.push(currentStmt.trim());

        statements.forEach((stmt) => {
            const poseAssignMatch = stmt.match(/(?:Pose2d\s+)?(\w+)\s*=\s*(new\s+Pose2d\s*\(.*?\))/i);
            if (poseAssignMatch) {
                const varName = poseAssignMatch[1];
                const data = extractPose2d(poseAssignMatch[2]);
                if (data) poseVars.set(varName, data);
                return;
            }

            const pathMatch = stmt.match(/(?:Path\s+)?(\w+)\s*=\s*new\s+Path\s*\((.*?)\)/i);
            if (pathMatch) {
                const varName = pathMatch[1];
                const startArg = pathMatch[2].trim();
                const startData = extractPose2d(startArg) || poseVars.get(startArg);
                if (startData) {
                    pathVars.set(varName, { lastPose: startData });
                    if (!startPoint) {
                        startPoint = { x: startData.x, y: startData.y, heading: "linear", startDeg: startData.deg, endDeg: startData.deg };
                    }
                }
            }

            // C. Path Method Calls
            const pathVarMatch = stmt.match(/^(\w+)\s*[=.]/);
            const activePathVar = pathVarMatch ? pathVarMatch[1] : null;
            const pathCtx = activePathVar ? pathVars.get(activePathVar) : null;

            // Track reversed/decel flags for the current path variable
            if (stmt.includes(".setReversed(true)")) {
                if (pathCtx) (pathCtx as any).reversed = true;
            } else if (stmt.includes(".setReversed(false)")) {
                if (pathCtx) (pathCtx as any).reversed = false;
            }

            const methods = /\.(addPoint|addLinearPoint|addTangentialPoint)\s*\((.*?)\)/gi;
            let m;
            while ((m = methods.exec(stmt)) !== null) {
                const method = m[1];
                const argArgs = splitArgs(m[2]);
                if (argArgs.length === 0) continue;
                
                const arg = argArgs[0].trim();
                const endData = extractPose2d(arg) || poseVars.get(arg);
                const tangentMag = argArgs.length >= 2 ? parseFloat(argArgs[1]) : 1.0;

                if (endData) {
                    const prevPose = pathCtx ? pathCtx.lastPose : (lines.length > 0 ? { x: lines[lines.length-1].endPoint.x, y: lines[lines.length-1].endPoint.y, deg: lines[lines.length-1].endPoint.endDeg } : (startPoint ? { x: startPoint.x, y: startPoint.y, deg: startPoint.startDeg } : null));
                    if (prevPose) {
                        const type = method === "addLinearPoint" ? "linear" : "tangential";
                        lines.push({
                            endPoint: { x: endData.x, y: endData.y, heading: type as any, startDeg: prevPose.deg, endDeg: endData.deg } as Point,
                            controlPoints: [],
                            color: getRandomColor(),
                            splineClass: method === "addLinearPoint" ? "LinearSpline" : "TangentialSpline",
                            tangentMag: tangentMag,
                            reversed: (pathCtx as any)?.reversed || false
                        });
                        if (activePathVar && pathCtx) pathCtx.lastPose = endData;
                    }
                }
            }

            const classic = /new\s+(\w+Spline)\s*\((.*?)\)/gi;
            while ((m = classic.exec(stmt)) !== null) {
                const splineClass = m[1];
                const args = splitArgs(m[2]);
                if (args.length >= 2) {
                    const startData = extractPose2d(args[0]) || poseVars.get(args[0]);
                    const endData = extractPose2d(args[args.length - 1]) || poseVars.get(args[args.length - 1]);
                    if (endData) {
                        const actualStart = startData || (lines.length > 0 ? { x: lines[lines.length-1].endPoint.x, y: lines[lines.length-1].endPoint.y, deg: lines[lines.length-1].endPoint.endDeg } : (startPoint ? {x: startPoint.x, y: startPoint.y, deg: startPoint.startDeg} : null));
                        if (actualStart) {
                            if (!startPoint) startPoint = { x: actualStart.x, y: actualStart.y, heading: "linear", startDeg: actualStart.deg, endDeg: actualStart.deg };
                            const type = splineClass.toLowerCase().includes("linear") ? "linear" : "tangential";
                            lines.push({
                                endPoint: { x: endData.x, y: endData.y, heading: type as any, startDeg: actualStart.deg, endDeg: endData.deg } as Point,
                                controlPoints: [],
                                color: getRandomColor(),
                                splineClass: splineClass
                            });
                        }
                    }
                }
            }
        });

        // 4. Fallback: Sequential Pose2ds
        if (lines.length === 0 && allFoundPoses.length >= 2) {
            const p0 = allFoundPoses[0];
            startPoint = { x: p0.x, y: p0.y, heading: "linear", startDeg: p0.deg, endDeg: p0.deg };
            for (let i = 1; i < allFoundPoses.length; i++) {
                const p = allFoundPoses[i];
                const prev = allFoundPoses[i-1];
                lines.push({
                    endPoint: { x: p.x, y: p.y, heading: "linear", startDeg: prev.deg, endDeg: p.deg },
                    controlPoints: [],
                    color: getRandomColor(),
                    splineClass: "LinearSpline"
                });
            }
        }

        if (!startPoint || lines.length === 0) return null;
        return { startPoint, lines };

    } catch (e: any) {
        console.error("GVF Parser Error:", e);
        return { error: e.message };
    }
}
