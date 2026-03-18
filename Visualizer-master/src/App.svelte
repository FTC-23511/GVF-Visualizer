<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import Two from "two.js";
  import type { Path } from "two.js/src/path";
  import type { Line as PathLine } from "two.js/src/shapes/line";
  import ControlTab from "./lib/ControlTab.svelte";
  import Navbar from "./lib/Navbar.svelte";
  import _ from "lodash";
  import {
    easeInOutQuad,
    getCurvePoint,
    getMousePos,
    getRandomColor,
    quadraticToCubic,
    radiansToDegrees,
    shortestRotation,
  } from "./utils";
  import hotkeys from 'hotkeys-js';
  import { darkMode } from "./stores";

  let two: Two;
  let twoElement: HTMLDivElement;

  let pointRadius = 1.15;
  let lineWidth = 0.57;
  let robotWidth = 16;
  let robotHeight = 16;

  let percent: number = 0;
  let fieldRotation: number = 0; // 0, 90, 180, 270 degrees

  /**
   * Converter for X axis from inches to pixels.
   */
  $: x = d3
          .scaleLinear()
          .domain([-72, 72])
          .range([-(twoElement?.clientWidth ?? 144) / 2, (twoElement?.clientWidth ?? 144) / 2]);

  /**
   * Converter for Y axis from inches to pixels.
   */
  $: y = d3
          .scaleLinear()
          .domain([-72, 72])
          .range([(twoElement?.clientHeight ?? 144) / 2, -(twoElement?.clientHeight ?? 144) / 2]);

  /**
   * Converter for lengths from inches to pixels.
   */
  $: scale = d3
          .scaleLinear()
          .domain([0, 144])
          .range([0, twoElement?.clientWidth ?? 144]);

  // Transform coordinates based on field rotation
  function transformCoordinates(point: BasePoint): BasePoint {
    const centerX = 0;
    const centerY = 0;

    // Translate to origin
    let x = point.x - centerX;
    let y = point.y - centerY;

    // Apply rotation
    switch (fieldRotation) {
      case 90:
        [x, y] = [-y, x];
        break;
      case 180:
        [x, y] = [-x, -y];
        break;
      case 270:
        [x, y] = [y, -x];
        break;
    }

    // Translate back
    return {
      x: x + centerX,
      y: y + centerY
    };
  }

  let lineGroup = new Two.Group();
  lineGroup.id = "line-group";
  let pointGroup = new Two.Group();
  pointGroup.id = "point-group";

  let startPoint: Point = {
    x: 0,
    y: -64,
    heading: "linear",
    startDeg: 90,
    endDeg: 180
  };
  let lines: Line[] = [
    {
      endPoint: { x: 0, y: 0, heading: "linear", startDeg: 90, endDeg: 180 },
      controlPoints: [],
      color: getRandomColor(),
    },
  ];

  $: points = (() => {
    let _points = [];
    let startPointElem = new Two.Circle(
            x(transformCoordinates(startPoint).x) + (twoElement?.clientWidth ?? 0) / 2,
            y(transformCoordinates(startPoint).y) + (twoElement?.clientHeight ?? 0) / 2,
            scale(pointRadius)
    );
    startPointElem.id = `point-0-0`;
    startPointElem.fill = lines[0].color;
    startPointElem.noStroke();

    _points.push(startPointElem);

    lines.forEach((line, idx) => {
      [line.endPoint, ...line.controlPoints].forEach((point, idx1) => {
        const transformedPoint = transformCoordinates(point);
        const pixelX = x(transformedPoint.x) + (twoElement?.clientWidth ?? 0) / 2;
        const pixelY = y(transformedPoint.y) + (twoElement?.clientHeight ?? 0) / 2;
        if (idx1 > 0) {
          let pointGroup = new Two.Group();
          pointGroup.id = `point-${idx + 1}-${idx1}`;

          let pointElem = new Two.Circle(
                  pixelX,
                  pixelY,
                  scale(pointRadius)
          );
          pointElem.id = `point-${idx + 1}-${idx1}-background`;
          pointElem.fill = line.color;
          pointElem.noStroke();

          let pointText = new Two.Text(
                  `${idx1}`,
                  pixelX,
                  pixelY - 0.15,
                  scale(pointRadius)
          );
          pointText.id = `point-${idx + 1}-${idx1}-text`;
          pointText.size = scale(1.55);
          pointText.leading = 1;
          pointText.family = "ui-sans-serif, system-ui, sans-serif";
          pointText.alignment = "center";
          pointText.baseline = "middle";
          pointText.fill = "white";
          pointText.noStroke();

          pointGroup.add(pointElem, pointText);
          _points.push(pointGroup);
        } else {
          let pointElem = new Two.Circle(
                  pixelX,
                  pixelY,
                  scale(pointRadius)
          );
          pointElem.id = `point-${idx + 1}-${idx1}`;
          pointElem.fill = line.color;
          pointElem.noStroke();
          _points.push(pointElem);
        }
      });
    });

    return _points;
  })();

  $: path = (() => {
    let _path: (Path | PathLine)[] = [];

    lines.forEach((line, idx) => {
      let _startPoint = idx === 0 ? startPoint : lines[idx - 1].endPoint;
      let transformedStartPoint = transformCoordinates(_startPoint);
      let transformedEndPoint = transformCoordinates(line.endPoint);
      let transformedControlPoints = line.controlPoints.map(cp => transformCoordinates(cp));

      const startPixelX = x(transformedStartPoint.x) + (twoElement?.clientWidth ?? 0) / 2;
      const startPixelY = y(transformedStartPoint.y) + (twoElement?.clientHeight ?? 0) / 2;
      const endPixelX = x(transformedEndPoint.x) + (twoElement?.clientWidth ?? 0) / 2;
      const endPixelY = y(transformedEndPoint.y) + (twoElement?.clientHeight ?? 0) / 2;

      let lineElem: Path | PathLine;
      if (line.controlPoints.length > 2) {
        // Approximate an n-degree bezier curve by sampling it at 100 points
        const samples = 100;
        const cps = [_startPoint, ...line.controlPoints, line.endPoint];
        let points = [new Two.Anchor(startPixelX, startPixelY, 0, 0, 0, 0, Two.Commands.move)];
        for (let i = 1; i <= samples; ++i) {
          const point = getCurvePoint(i / samples, cps);
          const transformedPoint = transformCoordinates(point);
          points.push(new Two.Anchor(x(transformedPoint.x) + (twoElement?.clientWidth ?? 0) / 2, y(transformedPoint.y) + (twoElement?.clientHeight ?? 0) / 2, 0, 0, 0, 0, Two.Commands.line));
        }
        points.forEach((point) => (point.relative = false));

        lineElem = new Two.Path(points);
        lineElem.automatic = false;
      } else if (line.controlPoints.length > 0) {
        let cp1 = transformedControlPoints[1]
                ? transformedControlPoints[0]
                : quadraticToCubic(_startPoint, line.controlPoints[0], line.endPoint)
                        .Q1;
        let transformedCp1 = transformCoordinates(cp1);
        let cp2 = transformedControlPoints[1] ??
                quadraticToCubic(_startPoint, line.controlPoints[0], line.endPoint)
                        .Q2;
        let transformedCp2 = transformCoordinates(cp2);

        const cp1PixelX = x(transformedCp1.x) + (twoElement?.clientWidth ?? 0) / 2;
        const cp1PixelY = y(transformedCp1.y) + (twoElement?.clientHeight ?? 0) / 2;
        const cp2PixelX = x(transformedCp2.x) + (twoElement?.clientWidth ?? 0) / 2;
        const cp2PixelY = y(transformedCp2.y) + (twoElement?.clientHeight ?? 0) / 2;

        let points = [
          new Two.Anchor(
                  startPixelX,
                  startPixelY,
                  startPixelX,
                  startPixelY,
                  cp1PixelX,
                  cp1PixelY,
                  Two.Commands.move
          ),
          new Two.Anchor(
                  endPixelX,
                  endPixelY,
                  cp2PixelX,
                  cp2PixelY,
                  endPixelX,
                  endPixelY,
                  Two.Commands.curve
          ),
        ];
        points.forEach((point) => (point.relative = false));

        lineElem = new Two.Path(points);
        lineElem.automatic = false;
      } else {
        lineElem = new Two.Line(
                startPixelX,
                startPixelY,
                endPixelX,
                endPixelY
        );
      }

      lineElem.id = `line-${idx + 1}`;
      lineElem.stroke = line.color;
      lineElem.linewidth = scale(lineWidth);
      lineElem.noFill();

      _path.push(lineElem);
    });

    return _path;
  })();

  let robotXY: BasePoint = { x: 0, y: 0 };
  let robotHeading: number = 0;

  $: {
    let totalLineProgress = (lines.length * Math.min(percent, 99.999999999)) / 100;
    let currentLineIdx = Math.min(Math.trunc(totalLineProgress), lines.length - 1);
    let currentLine = lines[currentLineIdx];

    let linePercent = easeInOutQuad(totalLineProgress - Math.floor(totalLineProgress));
    let _startPoint = currentLineIdx === 0 ? startPoint : lines[currentLineIdx - 1].endPoint;
    let robotInchesXY = getCurvePoint(linePercent, [_startPoint, ...currentLine.controlPoints, currentLine.endPoint]);
    let transformedRobotXY = transformCoordinates(robotInchesXY);
    robotXY = { x: x(transformedRobotXY.x) + (twoElement?.clientWidth ?? 0) / 2, y: y(transformedRobotXY.y) + (twoElement?.clientHeight ?? 0) / 2 };

    switch (currentLine.endPoint.heading) {
      case "linear":
        robotHeading = -shortestRotation(
                currentLine.endPoint.startDeg,
                currentLine.endPoint.endDeg,
                linePercent
        );
        break;
      case "constant":
        robotHeading = -currentLine.endPoint.degrees;
        break;
      case "tangential":
        const nextPointInches = getCurvePoint(
                linePercent + (currentLine.endPoint.reverse ? -0.01 : 0.01),
                [_startPoint, ...currentLine.controlPoints, currentLine.endPoint]
        );
        const transformedNextPoint = transformCoordinates(nextPointInches);
        const nextPoint = { x: x(transformedNextPoint.x) + (twoElement?.clientWidth ?? 0) / 2, y: y(transformedNextPoint.y) + (twoElement?.clientHeight ?? 0) / 2 };

        const dx = nextPoint.x - robotXY.x;
        const dy = nextPoint.y - robotXY.y;

        if (dx !== 0 || dy !== 0) {
          const angle = Math.atan2(dy, dx);

          robotHeading = radiansToDegrees(angle);
        }

        break;
    }
  }

  $: (() => {
    if (!two) {
      return;
    }

    two.renderer.domElement.style["z-index"] = "30";
    two.renderer.domElement.style["position"] = "absolute";
    two.renderer.domElement.style["top"] = "0px";
    two.renderer.domElement.style["left"] = "0px";
    two.renderer.domElement.style["width"] = "100%";
    two.renderer.domElement.style["height"] = "100%";

    two.clear();

    two.add(...path);
    two.add(...points);

    two.update();
  })();

  // function rotateFieldLeft() {
  //   fieldRotation = (fieldRotation - 90 + 360) % 360;
  // }
  //
  // function rotateFieldRight() {
  //   fieldRotation = (fieldRotation + 90) % 360;
  // }

  $: fieldImageSrc = $darkMode === "light" ? "/fields/decode-light.webp" : "/fields/decode.webp";

  let playing = false;

  let animationFrame: number;
  let startTime: number | null = null;
  let previousTime: number | null = null;

  function animate(timestamp: number) {
    if (!startTime) {
      startTime = timestamp;
    }

    if (previousTime !== null) {
      const deltaTime = timestamp - previousTime;

      if (percent >= 100) {
        percent = 0;
      } else {
        percent += (0.65 / lines.length) * (deltaTime * 0.1);
      }
    }

    previousTime = timestamp;

    if (playing) {
      requestAnimationFrame(animate);
    }
  }

  function play() {
    if (!playing) {
      playing = true;
      startTime = null;
      previousTime = null;
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(animationFrame);
  }

  onMount(() => {
    two = new Two({
      fitted: true,
      type: Two.Types.svg,
    }).appendTo(twoElement);

    updateRobotImage();

    let currentElem: string | null = null;
    let isDown = false;

    two.renderer.domElement.addEventListener("mousemove", (evt: MouseEvent) => {
      const elem = document.elementFromPoint(evt.clientX, evt.clientY);
      if (isDown && currentElem) {
        const line = Number(currentElem.split("-")[1]) - 1;
        const point = Number(currentElem.split("-")[2]);

        const { x: xPos, y: yPos } = getMousePos(evt, two.renderer.domElement);

        const invertedX = x.invert(xPos - (twoElement?.clientWidth ?? 0) / 2);
        const invertedY = y.invert(yPos - (twoElement?.clientHeight ?? 0) / 2);

        if (line === -1) {
          startPoint.x = invertedX;
          startPoint.y = invertedY;
        } else {
          if (point === 0) {
            lines[line].endPoint.x = invertedX;
            lines[line].endPoint.y = invertedY;
          } else {
            lines[line].controlPoints[point - 1].x = invertedX;
            lines[line].controlPoints[point - 1].y = invertedY;
          }
        }
      } else {
        if (elem?.id.startsWith("point")) {
          two.renderer.domElement.style.cursor = "pointer";
          currentElem = elem.id;
        } else {
          two.renderer.domElement.style.cursor = "auto";
          currentElem = null;
        }
      }
    });
    two.renderer.domElement.addEventListener("mousedown", () => {
      isDown = true;
    });
    two.renderer.domElement.addEventListener("mouseup", () => {
      isDown = false;
    });
  });

  document.addEventListener("keydown", function (evt) {
    if (evt.code === "Space" && document.activeElement === document.body) {
      if (playing) {
        pause();
      } else {
        play();
      }
    }
  });

  function saveFile() {
    const jsonString = JSON.stringify({ startPoint, lines });

    const blob = new Blob([jsonString], { type: "application/json" });

    const linkObj = document.createElement("a");

    const url = URL.createObjectURL(blob);

    linkObj.href = url;
    linkObj.download = "trajectory.p2p";

    document.body.appendChild(linkObj);

    linkObj.click();

    document.body.removeChild(linkObj);

    URL.revokeObjectURL(url);
  }

  function loadFile(evt: Event) {
    const elem = evt.target as HTMLInputElement;
    const file = elem.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = function (e: ProgressEvent<FileReader>) {
        try {
          const result = e.target?.result as string;

          const jsonObj: {
            startPoint: Point;
            lines: Line[];
          } = JSON.parse(result);

          startPoint = jsonObj.startPoint;
          lines = jsonObj.lines;
        } catch (err) {
          console.error(err);
        }
      };

      reader.readAsText(file);
    }
  }

  function loadRobot(evt: Event) {
    const elem = evt.target as HTMLInputElement;
    const file = elem.files?.[0];

    if (file && file.type === "image/png") {
      const reader = new FileReader();

      reader.onload = function (e: ProgressEvent<FileReader>) {
        const result = e.target?.result as string;
        localStorage.setItem('robot.png', result);
        updateRobotImage();
      };

      reader.readAsDataURL(file);
    } else {
      console.error("Invalid file type. Please upload a PNG file.");
    }
  }

  function updateRobotImage() {
    const robotImage = document.querySelector('img[alt="Robot"]') as HTMLImageElement;
    const storedImage = localStorage.getItem('robot.png');
    if (robotImage && storedImage) {
      robotImage.src = storedImage;
    }
  }

  function addNewLine() {
    lines = [
      ...lines,
      {
        endPoint: {
          x: _.random(-36, 36),
          y: _.random(-36, 36),
          heading: "tangential",
          reverse: false,
        },
        controlPoints: [],
        color: getRandomColor(),
      },
    ];
  }

  function addControlPoint() {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      lastLine.controlPoints.push({
        x: _.random(-36, 36),
        y: _.random(-36, 36),
      });
    }
  }

  function removeControlPoint() {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.controlPoints.length > 0) {
        lastLine.controlPoints.pop();
      }
    }
  }

  hotkeys('w', function(event, handler){
    event.preventDefault();
    addNewLine();
  });

  // hotkeys('a', function(event, handler){
  //   event.preventDefault();
  //   addControlPoint();
  //   points = points;
  //   path = path;
  //   if (two) two.update();
  // });

  hotkeys('s', function(event, handler){
    event.preventDefault();
    removeControlPoint();
  });
</script>

<Navbar bind:lines bind:startPoint {saveFile} {loadFile} {loadRobot} />
<div
        class="w-screen h-screen pt-20 p-2 flex flex-row justify-center items-center gap-4"
>
  <div class="flex h-full justify-center items-center flex-1">
    <div
            bind:this={twoElement}
            class="h-full aspect-square rounded-lg shadow-md bg-neutral-50 dark:bg-neutral-900 relative overflow-clip"
            style="transform: rotate({fieldRotation}deg);"
    >
      <img
              src={fieldImageSrc}
              alt="Field"
              class="absolute top-0 left-0 w-full h-full rounded-lg z-10 pointer-events-none"
      />
      <img
              src={"/robot.png"}
              width={scale(robotWidth)}
              height={scale(robotHeight)}
              alt="Robot"
              style={`position: absolute; top: ${robotXY.y}px; left: ${robotXY.x}px; transform: translate(-50%, -50%) rotate(${robotHeading}deg); z-index: 20; width: ${scale(robotWidth)}px; height: ${scale(robotHeight)}px;`}
      />
    </div>
  </div>

  <ControlTab
          bind:playing
          {play}
          {pause}
          bind:startPoint
          bind:lines
          bind:robotWidth
          bind:robotHeight
          bind:percent
          bind:robotXY
          bind:robotHeading
          {x}
          {y}
  />
</div>