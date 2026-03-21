import type { Point, Line } from "../types";

export function generateJavaCode(startPoint: Point, lines: Line[]): string {
    const startPose = `new Pose2d(${startPoint.x.toFixed(3)}, ${startPoint.y.toFixed(3)}, Math.toRadians(${(startPoint.startDeg ?? 0).toFixed(3)}))`;

    let code = `paths.add(new Path(${startPose})`;

    let currentReversed = false;
    lines.forEach((line) => {
        const endPose = `new Pose2d(${line.endPoint.x.toFixed(3)}, ${line.endPoint.y.toFixed(3)}, Math.toRadians(${(line.endPoint.heading === "constant" ? (line.endPoint.degrees ?? 0) : (line.endPoint.endDeg ?? 0)).toFixed(3)}))`;
        const method = line.endPoint.heading === "linear" ? "addLinearPoint" : "addPoint";
        
        if (line.endPoint.heading === "tangential") {
            if (line.endPoint.reverse !== currentReversed) {
                currentReversed = line.endPoint.reverse;
                code += `\n                .setReversed(${currentReversed})`;
            }
        }

        code += `\n                .${method}(${endPose})`;
    });

    code += `\n                .setDecel(true));`;

    return code;
}   
