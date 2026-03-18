<script lang="ts">
  import { getRandomColor } from "../utils";
  import _ from "lodash";

  export let playing: boolean;
  export let play: () => void;
  export let pause: () => void;
  export let startPoint: Point;
  export let lines: Line[];
  export let robotWidth: number;
  export let robotHeight: number;
  export let percent: number;
  export let robotXY: BasePoint;
  export let robotHeading: number;
  export let x: any;
  export let y: any;

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

  function insertLineAfter(idx: number) {
    const newLine = {
      endPoint: {
        x: _.random(-36, 36),
        y: _.random(-36, 36),
        heading: "tangential" as const, // <-- Fix is here
        reverse: false,
      },
      controlPoints: [],
      color: getRandomColor(),
    };
    lines.splice(idx + 1, 0, newLine);
    lines = lines;
  }

  function removeLine(idx: number) {
    if (lines.length > 1) {
      lines.splice(idx, 1);
      lines = lines;
    }
  }

  function addControlPoint(idx: number) {
    lines[idx].controlPoints.push({
      x: _.random(-36, 36),
      y: _.random(-36, 36),
    });
    lines = lines;
  }

  function removeControlPoint(idx: number) {
    if (lines[idx].controlPoints.length > 0) {
      lines[idx].controlPoints.pop();
      lines = lines;
    }
  }
</script>

<div class="w-96 h-full bg-white dark:bg-neutral-800 rounded-lg shadow-md p-4 overflow-y-auto">
  <div class="flex flex-col gap-4">
    <!-- Play/Pause Controls -->
    <div class="flex flex-col gap-2">
      <h3 class="font-semibold text-lg">Animation</h3>
      <div class="flex gap-2">
        {#if playing}
          <button
                  on:click={pause}
                  class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Pause
          </button>
        {:else}
          <button
                  on:click={play}
                  class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Play
          </button>
        {/if}
      </div>

      <!-- Progress Slider -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Progress: {percent.toFixed(1)}%</label>
        <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                bind:value={percent}
                class="slider w-full"
        />
      </div>
    </div>

    <!-- Robot Settings -->
    <div class="flex flex-col gap-2">
      <h3 class="font-semibold text-lg">Robot</h3>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-sm font-medium">Width</label>
          <input
                  type="number"
                  bind:value={robotWidth}
                  class="w-full px-2 py-1 border rounded dark:bg-neutral-700 dark:border-neutral-600"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Height</label>
          <input
                  type="number"
                  bind:value={robotHeight}
                  class="w-full px-2 py-1 border rounded dark:bg-neutral-700 dark:border-neutral-600"
          />
        </div>
      </div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Position: ({robotXY.x.toFixed(1)}, {robotXY.y.toFixed(1)})
        <br />
        Heading: {robotHeading.toFixed(1)}°
      </div>
    </div>

    <!-- Start Point -->
    <div class="flex flex-col gap-2">
      <h3 class="font-semibold text-lg">Start Point</h3>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-sm font-medium">X</label>
          <input
                  type="number"
                  step="0.001"
                  bind:value={startPoint.x}
                  class="w-full px-2 py-1 border rounded dark:bg-neutral-700 dark:border-neutral-600 text-sm"
          />
        </div>
        <div>
          <label class="text-sm font-medium">Y</label>
          <input
                  type="number"
                  step="0.001"
                  bind:value={startPoint.y}
                  class="w-full px-2 py-1 border rounded dark:bg-neutral-700 dark:border-neutral-600 text-sm"
          />
        </div>
      </div>
    </div>

    <!-- Lines -->
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center">
        <h3 class="font-semibold text-lg">Lines</h3>
        <button
                on:click={addNewLine}
                class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        >
          Add Line
        </button>
      </div>

      {#each lines as line, idx}
        <div class="border rounded p-3 dark:border-neutral-600">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
              <div
                      class="w-4 h-4 rounded-full"
                      style="background-color: {line.color}"
              ></div>
              <span class="font-medium">Line {idx + 1}</span>
            </div>
            <div class="flex gap-1">
              <button
                      on:click={() => insertLineAfter(idx)}
                      title="Insert Line After This One"
                      class="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                </svg>
              </button>
              {#if lines.length > 1}
                <button
                        on:click={() => removeLine(idx)}
                        title="Remove Line"
                        class="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                  </svg>
                </button>
              {/if}
            </div>
          </div>

          <!-- End Point -->
          <div class="mb-2">
            <label class="text-sm font-medium">End Point</label>
            <div class="grid grid-cols-2 gap-2">
              <input
                      type="number"
                      step="0.001"
                      bind:value={line.endPoint.x}
                      placeholder="X"
                      class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
              />
              <input
                      type="number"
                      step="0.001"
                      bind:value={line.endPoint.y}
                      placeholder="Y"
                      class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
              />
            </div>
          </div>

          <!-- Control Points -->
          {#if line.controlPoints.length > 0}
            <div class="mb-2">
              <div class="flex justify-between items-center">
                <label class="text-sm font-medium">Control Points</label>
                <button
                        on:click={() => removeControlPoint(idx)}
                        class="text-xs text-red-600 hover:text-red-800"
                >
                  Remove Last
                </button>
              </div>
              {#each line.controlPoints as cp, cpIdx}
                <div class="grid grid-cols-2 gap-2 mt-1">
                  <input
                          type="number"
                          step="0.001"
                          bind:value={cp.x}
                          placeholder="X"
                          class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
                  />
                  <input
                          type="number"
                          step="0.001"
                          bind:value={cp.y}
                          placeholder="Y"
                          class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
                  />
                </div>
              {/each}
            </div>
          {/if}

          <!-- Heading Type -->
          <div>
            <label class="text-sm font-medium">Heading</label>
            <select
                    bind:value={line.endPoint.heading}
                    class="w-full px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600"
            >
              <option value="tangential">Tangential</option>
              <option value="linear">Linear</option>
              <option value="constant">Constant</option>
            </select>

            {#if line.endPoint.heading === "linear"}
              <div class="grid grid-cols-2 gap-2 mt-1">
                <input
                        type="number"
                        step="0.001"
                        bind:value={line.endPoint.startDeg}
                        placeholder="Start Deg"
                        class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
                />
                <input
                        type="number"
                        step="0.001"
                        bind:value={line.endPoint.endDeg}
                        placeholder="End Deg"
                        class="px-2 py-1 border rounded text-sm dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
                />
              </div>
            {:else if line.endPoint.heading === "constant"}
              <input
                      type="number"
                      step="0.001"
                      bind:value={line.endPoint.degrees}
                      placeholder="Degrees"
                      class="w-full px-2 py-1 border rounded text-sm mt-1 dark:bg-neutral-700 dark:border-neutral-600 min-w-0"
              />
            {:else if line.endPoint.heading === "tangential"}
              <label class="flex items-center mt-1">
                <input
                        type="checkbox"
                        bind:checked={line.endPoint.reverse}
                        class="mr-2"
                />
                <span class="text-sm">Reverse</span>
              </label>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>