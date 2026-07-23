import { SIMULATION } from "../constants";
import { lerp, smoothstep } from "../utils/math";
import type { createForceSimulation } from "./physics";

type Simulation = ReturnType<typeof createForceSimulation>["simulation"];
export type SimulationRun =
  (typeof SIMULATION.runs)[keyof typeof SIMULATION.runs];

export function runSimulation(
  simulation: Simulation,
  run: SimulationRun,
): () => void {
  let frame = 0;
  let cancelled = false;
  const started = performance.now();
  simulation.alpha(run.alpha).alphaTarget(run.alpha).restart();

  const update = (now: number) => {
    if (cancelled) return;

    const target = runAlpha(run, now - started);
    if (target <= 0) {
      frame = 0;
      simulation.alphaTarget(0).stop();
      return;
    }

    simulation.alphaTarget(target);
    frame = requestAnimationFrame(update);
  };

  frame = requestAnimationFrame(update);
  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
}

export function settleSimulation(
  simulation: Simulation,
  seconds: number,
  run: SimulationRun = SIMULATION.runs.initial,
): void {
  const fps = 60;
  const frames = Math.max(
    1,
    Math.round(Math.min(seconds, run.durationMs / 1000) * fps),
  );

  simulation.alpha(run.alpha).alphaTarget(run.alpha).stop();
  for (let frame = 0; frame < frames; frame++) {
    simulation.alphaTarget(runAlpha(run, (frame / fps) * 1000));
    simulation.tick(SIMULATION.simSpeed);
  }
}

function runAlpha(run: SimulationRun, elapsedMs: number): number {
  const t = (elapsedMs - (run.durationMs - run.taperMs)) / run.taperMs;
  return lerp(run.alpha, 0, smoothstep(t));
}
