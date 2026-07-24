import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [graphDebugSeedPlugin()],
  build: {
    outDir: process.env.PUBLISHED_BUILD === "1" ? "dist" : ".local-build",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/three/")) {
            if (id.includes("/three/src/renderers/"))
              return "vendor-three-renderers";
            if (id.includes("/three/src/math/")) return "vendor-three-math";
            if (id.includes("/three/src/core/")) return "vendor-three-core";
            if (id.includes("/three/src/materials/"))
              return "vendor-three-materials";
            if (id.includes("/three/src/geometries/"))
              return "vendor-three-geometries";
            if (id.includes("/three/src/textures/"))
              return "vendor-three-textures";
            if (id.includes("/three/src/objects/"))
              return "vendor-three-objects";
            if (id.includes("/three/src/extras/")) return "vendor-three-extras";
            return "vendor-three";
          }
          if (id.includes("/troika-three-text/")) return "vendor-troika-text";
          if (id.includes("/d3-")) return "vendor-d3";
        },
      },
    },
  },
});

function graphDebugSeedPlugin() {
  return {
    name: "graph-debug-seed",
    configureServer(server) {
      server.middlewares.use("/__graph-debug/seed", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const seedPositions = parseSeedBody(body);
            writeSeedFiles(process.cwd(), seedPositions);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain");
            res.end(error instanceof Error ? error.message : String(error));
          }
        });
      });
    },
  };
}

type SeedPositions = Record<string, [number, number]>;

function parseSeedBody(body: string): SeedPositions {
  const parsed = JSON.parse(body) as {
    nodes?: Array<{ id?: unknown; x?: unknown; y?: unknown }>;
  };
  if (!Array.isArray(parsed.nodes)) throw new Error("Missing nodes array.");

  const entries: Array<[string, [number, number]]> = parsed.nodes.map(
    (node) => {
      if (typeof node.id !== "string" || !node.id)
        throw new Error("Node is missing an id.");
      if (typeof node.x !== "number" || typeof node.y !== "number")
        throw new Error(`Node ${node.id} has invalid coordinates.`);
      return [node.id, [round(node.x), round(node.y)] as [number, number]];
    },
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function writeSeedFiles(root: string, seedPositions: SeedPositions): void {
  const graphDir = path.join(root, "generated/graph");
  fs.mkdirSync(graphDir, { recursive: true });
  const json = `${JSON.stringify(seedPositions, null, 2)}\n`;
  const ts = `export const seedPositions = ${JSON.stringify(
    seedPositions,
    null,
    2,
  )} as const;\n`;

  fs.writeFileSync(path.join(graphDir, "seedPositions.json"), json);
  fs.writeFileSync(path.join(graphDir, "seedPositions.ts"), ts);
  fs.mkdirSync(path.join(graphDir, "published"), { recursive: true });
  fs.writeFileSync(path.join(graphDir, "published/seedPositions.ts"), ts);
  fs.mkdirSync(path.join(graphDir, "unofficial"), { recursive: true });
  fs.writeFileSync(path.join(graphDir, "unofficial/seedPositions.ts"), ts);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
