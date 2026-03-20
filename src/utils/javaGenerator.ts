import type { Point, Line } from "../types";

export function generateJavaCode(startPoint: Point, lines: Line[]): string {
    const startPose = `new Pose2d(${startPoint.x.toFixed(3)}, ${startPoint.y.toFixed(3)}, Math.toRadians(${(startPoint.startDeg ?? 0).toFixed(3)}))`;
    
    let code = `package org.firstinspires.ftc.teamcode.opmode.Auto;

import com.seattlesolvers.solverslib.geometry.Pose2d;
import org.firstinspires.ftc.teamcode.gvf.Path;

public class Trajectory {
    public static Path getPath() {
        return new Path(${startPose})`;

    lines.forEach((line) => {
        const endPose = `new Pose2d(${line.endPoint.x.toFixed(3)}, ${line.endPoint.y.toFixed(3)}, Math.toRadians(${(line.endPoint.endDeg ?? 0).toFixed(3)}))`;
        const method = line.endPoint.heading === "linear" ? "addLinearPoint" : "addPoint";
        
        code += `\n                .${method}(${endPose})`;
    });

    code += `\n                .setDecel(true);
    }
}
`;

    return code;
}
