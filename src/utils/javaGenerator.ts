import type { Point, Line } from "../types";

export function generateJavaCode(startPoint: Point, lines: Line[]): string {
    const startPose = `new Pose2d(${startPoint.x.toFixed(3)}, ${startPoint.y.toFixed(3)}, Math.toRadians(${(startPoint.startDeg ?? 0).toFixed(3)}))`;
    
    let code = `package org.firstinspires.ftc.teamcode.gvf;

import com.seattlesolvers.solverslib.geometry.Pose2d;
import java.util.ArrayList;
import java.util.List;

public class Trajectory {
    public static List<Spline> getPath() {
        List<Spline> splines = new ArrayList<>();
        Pose2d lastPose = ${startPose};
        
`;

    lines.forEach((line, idx) => {
        const endPose = `new Pose2d(${line.endPoint.x.toFixed(3)}, ${line.endPoint.y.toFixed(3)}, Math.toRadians(${(line.endPoint.endDeg ?? 0).toFixed(3)}))`;
        const splineClass = line.splineClass || (line.endPoint.heading === "linear" ? "LinearSpline" : "TangentialSpline");
        
        code += `        splines.add(new ${splineClass}(lastPose, ${endPose}));\n`;
        code += `        lastPose = ${endPose};\n\n`;
    });

    code += `        return splines;
    }
}
`;

    return code;
}
