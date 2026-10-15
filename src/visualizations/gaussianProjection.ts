import * as pc from "playcanvas";
import type { VisualizationFactory } from "./types";
import { PALETTE } from "../lib/visualizations/core/palette";
import { onMountResize } from "../lib/visualizations/core/renderer";

const ORBIT_RADIUS = 4;
const ORBIT_HEIGHT = 0.55;
const ORBIT_SPEED = 0.475;
const FOV = 42;
const SH_C0 = 0.28209479177387814;
const SAMPLE_SPLATS = [
  {
    p: [-0.85, -0.35, 0.15],
    s: [0.126, 0.072, 0.06],
    r: [0, 0, 0],
    color: PALETTE.SIGNAL.BLUE,
  },
  {
    p: [0.6, -0.25, -0.48],
    s: [0.078, 0.117, 0.063],
    r: [0.2, 0.65, -0.1],
    color: PALETTE.SIGNAL.CORAL,
  },
  {
    p: [-0.15, 0.6, -0.43],
    s: [0.096, 0.066, 0.108],
    r: [-0.4, 0.1, 0.3],
    color: PALETTE.SIGNAL.GREEN,
  },
  {
    p: [0.7, 0.48, 0.53],
    s: [0.072, 0.087, 0.063],
    r: [0.35, -0.3, 0.2],
    color: PALETTE.SIGNAL.VIOLET,
  },
  {
    p: [-0.53, 0.075, 0.78],
    s: [0.078, 0.072, 0.102],
    r: [0.1, 0.4, 0.5],
    color: PALETTE.SIGNAL.AMBER,
  },
] as const;
const CLEAR = new pc.Color(0, 0, 0, 0);
const FRUSTUM = new pc.Color(0.35, 0.32, 0.28, 0.72);

export const createGaussianProjection: VisualizationFactory = (
  canvas,
  mount,
) => {
  canvas.style.backgroundColor = "var(--bg)";
  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: {
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    },
  });
  const initialWidth = mount.clientWidth || 1;
  const initialHeight = mount.clientHeight || 1;
  app.setCanvasFillMode(pc.FILLMODE_NONE, initialWidth, initialHeight);
  app.setCanvasResolution(pc.RESOLUTION_FIXED, initialWidth, initialHeight);
  const splats = new pc.Layer({ name: "projection-splats" });
  const guides = new pc.Layer({ name: "projection-camera-guides" });
  app.scene.layers.insert(splats, 0);
  app.scene.layers.insert(guides, 1);

  const overview = createCamera(
    app,
    "overview",
    [splats.id, guides.id],
    [0, 0, 0.5, 1],
  );
  const raster = createCamera(
    app,
    "orbit-camera",
    [splats.id],
    [0.5, 0, 0.5, 1],
  );
  const title = createLabels(mount);
  let active = true;
  let angle = 0;

  updateViews(mount.clientWidth, mount.clientHeight);
  positionOverview(overview.entity);
  positionOrbit(raster.entity, angle);
  const stopResize = onMountResize(mount, (width, height) => {
    app.setCanvasResolution(pc.RESOLUTION_FIXED, width, height);
    app.resizeCanvas(width, height);
    updateViews(width, height);
  });

  const entity = new pc.Entity("five-sample-splats");
  entity.addComponent("gsplat", {
    resource: createSampleSplats(app),
    layers: [splats.id],
    unified: false,
  });
  app.root.addChild(entity);

  app.on("update", (dt: number) => {
    if (!active) return;
    angle = (angle + dt * ORBIT_SPEED) % (Math.PI * 2);
    positionOrbit(raster.entity, angle);
    drawCameraGuides(
      app,
      raster.entity,
      guides,
      mount.clientWidth / 2 / mount.clientHeight,
    );
  });
  app.start();

  return {
    pause() {
      active = false;
      app.autoRender = false;
    },
    resume() {
      active = true;
      app.autoRender = true;
    },
    dispose() {
      stopResize();
      title.remove();
      app.destroy();
    },
  };

  function updateViews(width: number, height: number): void {
    if (!width || !height) return;
    const aspect = width / 2 / height;
    overview.camera.orthoHeight = (1.1 * ORBIT_RADIUS) / Math.min(1, aspect);
    for (const camera of [overview.camera, raster.camera]) {
      camera.aspectRatio = aspect;
      const x = camera === overview.camera ? 0 : 0.5;
      const rect = new pc.Vec4(x, 0, 0.5, 1);
      camera.rect = rect;
      camera.scissorRect = rect.clone();
      (
        camera as unknown as { _camera: { _scissorRectClear: boolean } }
      )._camera._scissorRectClear = true;
    }
  }
};

function createSampleSplats(app: pc.Application): pc.GSplatResource {
  const names = [
    "x",
    "y",
    "z",
    "rot_0",
    "rot_1",
    "rot_2",
    "rot_3",
    "scale_0",
    "scale_1",
    "scale_2",
    "f_dc_0",
    "f_dc_1",
    "f_dc_2",
    "opacity",
  ];
  const values = Object.fromEntries(
    names.map((name) => [name, new Float32Array(SAMPLE_SPLATS.length)]),
  );
  SAMPLE_SPLATS.forEach(({ p, s, r, color }, i) => {
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map(
      (v) => v / 255,
    );
    ["x", "y", "z"].forEach((key, axis) => (values[key][i] = p[axis]));
    ["rot_1", "rot_2", "rot_3"].forEach(
      (key, axis) => (values[key][i] = r[axis]),
    );
    values.rot_0[i] = 1;
    ["scale_0", "scale_1", "scale_2"].forEach(
      (key, axis) => (values[key][i] = s[axis]),
    );
    ["f_dc_0", "f_dc_1", "f_dc_2"].forEach(
      (key, axis) => (values[key][i] = (rgb[axis] - 0.5) / SH_C0),
    );
    values.opacity[i] = 0.8;
  });
  const properties = names.map((name) => ({
    name,
    type: "float",
    byteSize: 4,
    storage: values[name],
  }));
  const data = new pc.GSplatData([
    { name: "vertex", count: SAMPLE_SPLATS.length, properties },
  ]);
  data.activated = true;
  return new pc.GSplatResource(app.graphicsDevice, data);
}

function createCamera(
  app: pc.Application,
  name: string,
  layers: number[],
  rect: [number, number, number, number],
): { entity: pc.Entity; camera: pc.CameraComponent } {
  const entity = new pc.Entity(name);
  entity.addComponent("camera", {
    layers,
    clearColor: CLEAR,
    nearClip: 0.02,
    farClip: 30,
    projection:
      name === "overview"
        ? pc.PROJECTION_ORTHOGRAPHIC
        : pc.PROJECTION_PERSPECTIVE,
    orthoHeight: 4.1,
    fov: FOV,
    aspectRatioMode: pc.ASPECT_MANUAL,
  });
  entity.camera!.rect = new pc.Vec4(...rect);
  entity.camera!.priority = name === "overview" ? 0 : 1;
  app.root.addChild(entity);
  return { entity, camera: entity.camera! };
}

function createLabels(mount: HTMLElement): HTMLElement {
  mount.style.position = "relative";
  const labels = document.createElement("div");
  labels.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:1;color:#8f877c;font:10px 'IBM Plex Mono',monospace";
  const divider = document.createElement("span");
  divider.style.cssText =
    "position:absolute;left:50%;top:0;bottom:0;border-left:1px solid rgba(157,148,136,.35)";
  labels.append(divider);
  mount.append(labels);
  return labels;
}

function positionOverview(entity: pc.Entity): void {
  entity.setPosition(3.8, 2.7, 4.8);
  entity.lookAt(0, ORBIT_HEIGHT / 2, 0);
}

function positionOrbit(entity: pc.Entity, angle: number): void {
  entity.setPosition(
    ORBIT_RADIUS * Math.cos(angle),
    ORBIT_HEIGHT,
    ORBIT_RADIUS * Math.sin(angle),
  );
  entity.lookAt(0, 0, 0);
}

function drawCameraGuides(
  app: pc.Application,
  entity: pc.Entity,
  layer: pc.Layer,
  aspect: number,
): void {
  const origin = entity.getPosition();
  const forward = entity.forward;
  const right = entity.right;
  const up = entity.up;
  const distance = 1.25;
  const halfHeight = Math.tan((FOV * Math.PI) / 360) * distance;
  const halfWidth = halfHeight * aspect;
  const center = origin.clone().add(forward.clone().mulScalar(distance));
  const corners = [
    corner(center, right, up, -halfWidth, halfHeight),
    corner(center, right, up, halfWidth, halfHeight),
    corner(center, right, up, halfWidth, -halfHeight),
    corner(center, right, up, -halfWidth, -halfHeight),
  ];
  const bodyCenter = origin.clone().sub(forward.clone().mulScalar(0.05));
  const body = [
    corner(bodyCenter, right, up, -0.07, 0.05),
    corner(bodyCenter, right, up, 0.07, 0.05),
    corner(bodyCenter, right, up, 0.07, -0.05),
    corner(bodyCenter, right, up, -0.07, -0.05),
  ];
  for (let i = 0; i < 4; i++)
    app.scene.drawLine(body[i], body[(i + 1) % 4], FRUSTUM, false, layer);
  for (let i = 0; i < 4; i++) {
    app.scene.drawLine(origin, corners[i], FRUSTUM, false, layer);
    app.scene.drawLine(corners[i], corners[(i + 1) % 4], FRUSTUM, false, layer);
  }

  const orbitColor = new pc.Color(0.55, 0.51, 0.45, 0.58);
  for (let i = 0; i < 64; i += 2) {
    const a = (i / 64) * Math.PI * 2;
    const b = ((i + 1) / 64) * Math.PI * 2;
    app.scene.drawLine(
      new pc.Vec3(
        ORBIT_RADIUS * Math.cos(a),
        ORBIT_HEIGHT,
        ORBIT_RADIUS * Math.sin(a),
      ),
      new pc.Vec3(
        ORBIT_RADIUS * Math.cos(b),
        ORBIT_HEIGHT,
        ORBIT_RADIUS * Math.sin(b),
      ),
      orbitColor,
      false,
      layer,
    );
  }
}

function corner(
  center: pc.Vec3,
  right: Readonly<pc.Vec3>,
  up: Readonly<pc.Vec3>,
  x: number,
  y: number,
): pc.Vec3 {
  return center
    .clone()
    .add(right.clone().mulScalar(x))
    .add(up.clone().mulScalar(y));
}
