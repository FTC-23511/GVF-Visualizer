import type { Point, Line } from "../types";

export function generateJavaCode(startPoint: Point, lines: Line[], format: "add" | "assign" = "add"): string {
    const formatNum = (n: number) => Number(n.toFixed(3)).toString();
    const startPose = `new Pose2d(${formatNum(startPoint.x)}, ${formatNum(startPoint.y)}, Math.toRadians(${formatNum(startPoint.startDeg ?? 0)}))`;
    
    let code = format === "add" ? `paths.add(new Path(${startPose})` : `path = new Path(${startPose})`;

    let currentReversed = false;
    lines.forEach((line) => {
        const h = line.endPoint.heading === "constant" ? (line.endPoint.degrees ?? 0) : (line.endPoint.endDeg ?? 0);
        const endPose = `new Pose2d(${formatNum(line.endPoint.x)}, ${formatNum(line.endPoint.y)}, Math.toRadians(${formatNum(h)}))`;
        const method = line.endPoint.heading === "linear" ? "addLinearPoint" : "addPoint";
        
        if (line.endPoint.heading === "tangential") {
            if (line.endPoint.reverse !== currentReversed) {
                currentReversed = line.endPoint.reverse;
                code += `\n                .setReversed(${currentReversed})`;
            }
        }

        code += `\n                .${method}(${endPose})`;
    });

    code += format === "add" ? `\n                .setDecel(true));` : `\n                .setDecel(true);`;

    return code;
}
