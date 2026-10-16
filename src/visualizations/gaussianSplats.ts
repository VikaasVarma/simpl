import * as pc from "playcanvas";
import * as THREE from "three";
import {
  createRenderer,
  fit,
  onMountResize,
} from "../lib/visualizations/core/renderer";
import { PALETTE } from "../lib/visualizations/core/palette";
import type { VisualizationFactory, VisualizationHandle } from "./types";

const SPLAT_URL = "/assets/splats/avocado-743e07bcdfa6.sog";
const BAKE_SCENES = [
  {
    id: "cornell",
    name: "Cornell Box",
    url: "/assets/splats/bake-cornell-df02ee4c015d.sog",
    caption:
      "Cycles at 4096 samples per pixel with exposure 4.\nSplats baked with SH degree 0, 16 directions per splat, 32 samples per direction, 10% SH smoothing.",
    shDegree: 0,
  },
  {
    id: "damaged-helmet",
    name: "Damaged Helmet",
    url: "/assets/splats/bake-helmet-sh3-b023d0b69706.sog",
    caption:
      "Cycles at 4096 samples per pixel with exposure 0.\nSplats baked with SH degree 10, 128 directions per splat, 32 samples per direction.",
    shDegree: 10,
  },
  {
    id: "avocado",
    name: "Avocado",
    url: "/assets/splats/bake-avocado-c888f9f9040f.sog",
    caption:
      "Cycles at 4096 samples per pixel with exposure 0.\nSplats baked on a projected grid with SH degree 2, 16 directions per splat, 128 samples per direction.",
    shDegree: 2,
  },
  {
    id: "boombox",
    name: "Boom Box",
    url: "/assets/splats/bake-boombox-sh3-c8fb54be134a.sog",
    caption:
      "Cycles at 4096 samples per pixel with exposure 0.\nSplats baked with SH degree 8, 128 directions per splat, 16 samples per direction.",
    shDegree: 8,
  },
  {
    id: "duck",
    name: "Duck",
    url: "/assets/splats/bake-duck-b616dce876f8.sog",
    caption:
      "Phong at 1 sample per pixel.\nSplats baked with SH degree 0, 1 direction per splat, 1 sample per direction.",
    shDegree: 0,
  },
  {
    id: "fish",
    name: "Barramundi Fish",
    url: "/assets/splats/bake-fish-ebe40cc64fc1.sog",
    caption:
      "Phong at 1 sample per pixel.\nSplats baked with SH degree 0, 1 direction per splat, 1 sample per direction.",
    shDegree: 0,
  },
] as const;
const MODEL_HEIGHT = 1.8;
const SH_C0 = 0.28209479177387814;
const UPRIGHT_ROTATION = new pc.Quat(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

export const createGaussianSplats: VisualizationFactory = (canvas, mount) => {
  const slug = mount.dataset.viz ?? "gaussian-point-cloud";
  return slug === "gaussian-fuzzy-blobs"
    ? createFuzzyBlobs(canvas, mount)
    : createSplatCompare(canvas, mount, slug === "bake-scenes");
};

const ORBIT_RADIUS = 3.3;
const ORBIT_HEIGHT = 0.1;
const ORBIT_SPEED = 0.35;
const RETURN_RATE = 2.4;
const FLY_SPEED = 1.3;
const FLY_ACCEL = 10;
const FLY_MAX_RADIUS = 4.5;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = 1.45;
const FLY_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
]);

const POINTS_VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec4 aColor;
  uniform mat4 matrix_viewProjection;
  uniform mat4 matrix_model;
  varying vec4 vColor;
  void main(void) {
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
    gl_PointSize = 5.0;
    vColor = aColor;
  }
`;

const POINTS_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 vColor;
  void main(void) {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vColor;
  }
`;

function createSplatCompare(
  canvas: HTMLCanvasElement,
  mount: HTMLElement,
  sceneSelector = false,
): VisualizationHandle {
  let bakedScene: (typeof BAKE_SCENES)[number] | undefined = sceneSelector
    ? BAKE_SCENES.find(({ id }) => id === "avocado")
    : undefined;
  const singleScene = sceneSelector;
  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: true, antialias: true },
  });
  const initialWidth = mount.clientWidth || 1;
  const initialHeight = mount.clientHeight || 1;
  app.setCanvasFillMode(pc.FILLMODE_NONE, initialWidth, initialHeight);
  app.setCanvasResolution(pc.RESOLUTION_FIXED, initialWidth, initialHeight);
  canvas.style.cursor = "grab";

  const pauseButton = document.createElement("button");
  pauseButton.className = "gaussian-pause";
  pauseButton.type = "button";
  pauseButton.ariaLabel = "Pause animation";
  pauseButton.title = "Pause animation";
  pauseButton.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg>`;
  mount.append(pauseButton);

  const selector = sceneSelector ? document.createElement("select") : null;
  if (selector) {
    selector.className = "gaussian-scene-selector";
    selector.setAttribute("aria-label", "Example scene");
    selector.innerHTML = BAKE_SCENES.map(
      ({ id, name }) => `<option value="${id}">${name}</option>`,
    ).join("");
    selector.value = bakedScene?.id ?? "";
    mount.append(selector);
  }
  const caption = mount.closest("figure")?.querySelector<HTMLElement>(".viz-caption");
  function setSceneCaption(scene: (typeof BAKE_SCENES)[number]): void {
    if (!caption) return;
    caption.textContent =
      scene.caption +
      (scene.shDegree > 3
        ? `\nNot full SH resolution: viewer uses degree 3 (source degree ${scene.shDegree}).`
        : "");
  }
  if (bakedScene) setSceneCaption(bakedScene);

  const loading = document.createElement("div");
  loading.className = "gaussian-loading";
  loading.setAttribute("role", "status");
  loading.textContent = `Loading ${bakedScene?.name ?? "Avocado"}`;
  mount.append(loading);

  const pointsLayer = new pc.Layer({ name: "points" });
  const splatsLayer = new pc.Layer({ name: "splats" });
  app.scene.layers.insert(pointsLayer, 0);
  app.scene.layers.insert(splatsLayer, 0);

  const cameraRig = new pc.Entity("camera-rig");
  app.root.addChild(cameraRig);
  const cameras = (singleScene ? [splatsLayer] : [pointsLayer, splatsLayer]).map((layer) => {
    const entity = new pc.Entity(`camera-${layer.name}`);
    entity.addComponent("camera", {
      layers: [layer.id],
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.02,
      farClip: 20,
      fov: 42,
      aspectRatioMode: pc.ASPECT_MANUAL,
    });
    entity.camera!.rect = new pc.Vec4(0, 0, 1, 1);
    cameraRig.addChild(entity);
    return entity.camera!;
  });
  // PlayCanvas 2.23 only applies scissorRect when this internal flag is enabled.
  for (const camera of cameras) {
    (camera as unknown as { _camera: { _scissorRectClear: boolean } })
      ._camera._scissorRectClear = true;
  }

  function applyAspect(width: number, height: number): void {
    const aspect = width / height;
    for (const camera of cameras) camera.aspectRatio = aspect;
  }
  applyAspect(mount.clientWidth || 1, mount.clientHeight || 1);

  function applyRects(): void {
    if (singleScene) return;
    cameras[0].scissorRect = new pc.Vec4(0, 0, 0.5, 1);
    cameras[1].scissorRect = new pc.Vec4(0.5, 0, 0.5, 1);
  }
  applyRects();

  let disposed = false;
  const density = singleScene ? null : document.createElement("input");
  if (density) {
    density.className = "gaussian-density";
    density.type = "range";
    density.min = "0";
    density.max = "1000";
    density.value = "1000";
    density.setAttribute("aria-label", "Visible point density");
    mount.parentElement?.insertBefore(density, mount.nextElementSibling);
  }
  let totalPoints = 0;
  let pointPrimitive: { count: number } | undefined;
  let pointOrder: Uint32Array | undefined;
  let mappedPointCount = 0;
  let splatInstance: pc.GSplatInstance | null = null;
  let pointEntity: pc.Entity | null = null;
  let splatEntity: pc.Entity | null = null;
  let pointMesh: pc.Mesh | null = null;
  let pointMaterial: pc.ShaderMaterial | null = null;
  let splatAsset: pc.Asset | null = null;
  let loadSequence = 0;
  function selectedPointCount(): number {
    return Math.max(
      1,
      Math.round(Math.exp(((Number(density?.value) || 0) / 1000) * Math.log(totalPoints))),
    );
  }
  function updatePointCount(): void {
    if (!totalPoints) return;
    const count = selectedPointCount();
    if (pointPrimitive) pointPrimitive.count = count;
    const sorter = splatInstance?.sorter;
    if (sorter && pointOrder && count !== mappedPointCount) {
      mappedPointCount = count;
      sorter.setMapping(pointOrder.slice(0, count));
    }
  }
  density?.addEventListener("input", updatePointCount);

  async function loadScene(scene: (typeof BAKE_SCENES)[number] | undefined): Promise<void> {
    const sequence = ++loadSequence;
    const url = scene?.url ?? SPLAT_URL;
    const name = scene?.name ?? "Avocado";
    loading.classList.remove("gaussian-loading--error");
    loading.textContent = `Loading ${name}`;
    loading.hidden = false;
    const asset = new pc.Asset(`${name}-splat`, "gsplat", { url });
    app.assets.add(asset);
    try {
      await new Promise<void>((resolve, reject) => {
        asset.once("load", resolve);
        asset.once("error", reject);
        app.assets.load(asset);
      });
    } catch (error) {
      app.assets.remove(asset);
      asset.unload();
      if (sequence === loadSequence) {
        loading.classList.add("gaussian-loading--error");
        loading.textContent = `Could not load ${name}`;
      }
      console.error(`Could not load baked scene: ${name}`, error);
      return;
    }
    const data = (asset.resource as pc.GSplatResource)
      .gsplatData as pc.GSplatSogData;
    let decoded: Awaited<ReturnType<typeof data.decompress>>;
    try {
      decoded = await data.decompress();
    } catch (error) {
      app.assets.remove(asset);
      asset.unload();
      if (sequence === loadSequence) {
        loading.classList.add("gaussian-loading--error");
        loading.textContent = `Could not decode ${name}`;
      }
      console.error(`Could not decode baked scene: ${name}`, error);
      return;
    }
    if (disposed || sequence !== loadSequence) {
      app.assets.remove(asset);
      asset.unload();
      return;
    }
    if (pointEntity) app.root.removeChild(pointEntity);
    if (splatEntity) app.root.removeChild(splatEntity);
    pointEntity?.destroy();
    splatEntity?.destroy();
    pointMesh?.destroy();
    pointMaterial?.destroy();
    if (splatAsset) {
      app.assets.remove(splatAsset);
      splatAsset.unload();
    }
    splatAsset = asset;
    mappedPointCount = 0;
    totalPoints = data.numSplats;
    const x = decoded.getProp("x");
    const y = decoded.getProp("y");
    const z = decoded.getProp("z");
    const red = decoded.getProp("f_dc_0");
    const green = decoded.getProp("f_dc_1");
    const blue = decoded.getProp("f_dc_2");
    const opacity = decoded.getProp("opacity");
    const sourcePositions = singleScene ? null : new Float32Array(totalPoints * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < totalPoints; i++) {
      sourcePositions?.set([x[i], y[i], z[i]], i * 3);
      min[0] = Math.min(min[0], x[i]);
      min[1] = Math.min(min[1], y[i]);
      min[2] = Math.min(min[2], z[i]);
      max[0] = Math.max(max[0], x[i]);
      max[1] = Math.max(max[1], y[i]);
      max[2] = Math.max(max[2], z[i]);
    }
    const center = min.map((value, axis) => (value + max[axis]) / 2);
    const scale = MODEL_HEIGHT / Math.max(...max.map((value, axis) => value - min[axis]));
    const modelPosition = new pc.Vec3(
      -center[0] * scale,
      -center[2] * scale,
      center[1] * scale,
    );
    if (sourcePositions) {
      // One stable permutation drives both renderers' prefixes.
      const pointOrderData = Uint32Array.from({ length: totalPoints }, (_, i) => i);
      let seed = 0x6d2b79f5;
      for (let i = totalPoints - 1; i > 0; i--) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const j = (seed >>> 0) % (i + 1);
        [pointOrderData[i], pointOrderData[j]] = [pointOrderData[j], pointOrderData[i]];
      }
      pointOrder = pointOrderData;

      const positions = new Float32Array(totalPoints * 3);
      const colors = new Uint8Array(totalPoints * 4);
      const colorByte = (value: number) =>
        Math.max(0, Math.min(255, Math.round((value * SH_C0 + 0.5) * 255)));
      for (let i = 0; i < totalPoints; i++) {
        const source = pointOrderData[i];
        positions.set(sourcePositions.subarray(source * 3, source * 3 + 3), i * 3);
        colors[i * 4] = colorByte(red[source]);
        colors[i * 4 + 1] = colorByte(green[source]);
        colors[i * 4 + 2] = colorByte(blue[source]);
        const alpha = decoded.activated
          ? opacity[source]
          : 1 / (1 + Math.exp(-opacity[source]));
        colors[i * 4 + 3] = Math.round(alpha * 255);
      }

      pointMesh = new pc.Mesh(app.graphicsDevice);
      pointMesh.setPositions(positions);
      pointMesh.setColors32(colors);
      pointMesh.update(pc.PRIMITIVE_POINTS);
      pointPrimitive = pointMesh.primitive[0];
      pointMaterial = new pc.ShaderMaterial({
        uniqueName: `${name}Points`,
        attributes: { aPosition: pc.SEMANTIC_POSITION, aColor: pc.SEMANTIC_COLOR },
        vertexGLSL: POINTS_VERTEX_SHADER,
        fragmentGLSL: POINTS_FRAGMENT_SHADER,
      });
      pointMaterial.blendType = pc.BLEND_NORMAL;
      pointMaterial.depthWrite = false;
      pointEntity = new pc.Entity(`${name}-points`);
      pointEntity.addComponent("render", {
        meshInstances: [new pc.MeshInstance(pointMesh, pointMaterial)],
        layers: [pointsLayer.id],
      });
      pointEntity.setLocalScale(scale, scale, scale);
      pointEntity.setPosition(modelPosition);
      pointEntity.setRotation(UPRIGHT_ROTATION);
      app.root.addChild(pointEntity);
    }

    splatEntity = new pc.Entity(`${name}-splat`);
    splatEntity.addComponent("gsplat", {
      asset,
      layers: [splatsLayer.id],
      unified: false,
    });
    splatEntity.setLocalScale(scale, scale, scale);
    splatEntity.setPosition(modelPosition);
    splatEntity.setRotation(UPRIGHT_ROTATION);
    app.root.addChild(splatEntity);
    splatInstance = splatEntity.gsplat!.instance;
    updatePointCount();
    loading.hidden = true;
  }
  void loadScene(bakedScene);
  selector?.addEventListener("change", () => {
    bakedScene = BAKE_SCENES.find(({ id }) => id === selector.value);
    if (!bakedScene) return;
    setSceneCaption(bakedScene);
    void loadScene(bakedScene);
  });

  const stopResize = onMountResize(mount, (width, height) => {
    app.setCanvasResolution(pc.RESOLUTION_FIXED, width, height);
    app.resizeCanvas(width, height);
    applyAspect(width, height);
  });

  const dividerEl = singleScene ? null : document.createElement("div");
  if (dividerEl) {
    Object.assign(dividerEl.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      width: "20px",
      marginLeft: "-10px",
      cursor: "ew-resize",
      left: "50%",
      zIndex: "2",
    });
    const line = document.createElement("div");
    Object.assign(line.style, {
      position: "absolute",
      left: "50%",
      top: "0",
      bottom: "0",
      width: "1px",
      marginLeft: "-0.5px",
      background: "rgba(44,40,37,0.3)",
    });
    const handle = document.createElement("div");
    Object.assign(handle.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "14px",
      height: "14px",
      marginLeft: "-7px",
      marginTop: "-7px",
      borderRadius: "50%",
      background: "rgba(252,251,245,0.92)",
      border: "1px solid rgba(44,40,37,0.4)",
    });
    dividerEl.append(line, handle);
    mount.append(dividerEl);
  }
  let draggingDivider = false;
  function onDividerPointerDown(event: PointerEvent): void {
    if (!dividerEl) return;
    event.stopPropagation();
    draggingDivider = true;
    dividerEl.setPointerCapture(event.pointerId);
  }
  function onDividerPointerMove(event: PointerEvent): void {
    if (!draggingDivider || !dividerEl) return;
    event.stopPropagation();
    const rect = mount.getBoundingClientRect();
    const divider = Math.max(
      0.04,
      Math.min(0.96, (event.clientX - rect.left) / rect.width),
    );
    dividerEl.style.left = `${divider * 100}%`;
    cameras[0].scissorRect = new pc.Vec4(0, 0, divider, 1);
    cameras[1].scissorRect = new pc.Vec4(divider, 0, 1 - divider, 1);
  }
  function onDividerPointerUp(event: PointerEvent): void {
    if (!draggingDivider || !dividerEl) return;
    event.stopPropagation();
    draggingDivider = false;
    dividerEl.releasePointerCapture(event.pointerId);
  }
  dividerEl?.addEventListener("pointerdown", onDividerPointerDown);
  dividerEl?.addEventListener("pointermove", onDividerPointerMove);
  dividerEl?.addEventListener("pointerup", onDividerPointerUp);
  dividerEl?.addEventListener("pointercancel", onDividerPointerUp);

  let orbitAngle = 0;
  let locked = false;
  let yaw = 0;
  let pitch = 0;
  let active = true;
  let userPaused = false;
  const camPos = new THREE.Vector3(0, ORBIT_HEIGHT, ORBIT_RADIUS);
  const camQuat = new THREE.Quaternion();
  const velocity = new THREE.Vector3();
  const keys = new Set<string>();
  const orbitPos = new THREE.Vector3();
  const orbitMatrix = new THREE.Matrix4();
  const orbitQuat = new THREE.Quaternion();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const origin = new THREE.Vector3(0, 0, 0);
  const moveDir = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  function updatePlayback(): void {
    app.autoRender = active;
  }
  function setPaused(paused: boolean): void {
    userPaused = paused;
    pauseButton.ariaLabel = paused ? "Resume animation" : "Pause animation";
    pauseButton.title = pauseButton.ariaLabel;
    pauseButton.innerHTML = paused
      ? `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z"/></svg>`
      : `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg>`;
  }
  function togglePause(): void {
    setPaused(!userPaused);
    updatePlayback();
  }
  pauseButton.addEventListener("click", togglePause);

  function orbitPose(angle: number): {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } {
    orbitPos.set(
      Math.sin(angle) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.cos(angle) * ORBIT_RADIUS,
    );
    orbitMatrix.lookAt(orbitPos, origin, worldUp);
    orbitQuat.setFromRotationMatrix(orbitMatrix);
    return { position: orbitPos, quaternion: orbitQuat };
  }

  function onClick(): void {
    if (document.pointerLockElement === canvas) return;
    const request = canvas.requestPointerLock() as unknown;
    (request as Promise<void> | undefined)?.catch?.(() => {});
  }
  canvas.addEventListener("click", onClick);

  function onPointerDownCapture(event: PointerEvent): void {
    event.stopPropagation();
  }
  canvas.addEventListener("pointerdown", onPointerDownCapture);

  function onPointerLockChange(): void {
    locked = document.pointerLockElement === canvas;
    if (locked) {
      setPaused(true);
      const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");
      yaw = euler.y;
      pitch = euler.x;
      canvas.style.cursor = "none";
    } else {
      keys.clear();
      velocity.set(0, 0, 0);
      canvas.style.cursor = "grab";
    }
  }
  document.addEventListener("pointerlockchange", onPointerLockChange);

  function onMouseMove(event: MouseEvent): void {
    if (!locked) return;
    yaw -= event.movementX * MOUSE_SENSITIVITY;
    pitch -= event.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  }
  document.addEventListener("mousemove", onMouseMove);

  function onKeyDown(event: KeyboardEvent): void {
    if (!locked || !FLY_KEYS.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  }
  function onKeyUp(event: KeyboardEvent): void {
    if (!FLY_KEYS.has(event.code)) return;
    keys.delete(event.code);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function releaseLock(): void {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  const euler = new THREE.Euler();
  function onUpdate(dt: number): void {
    if (!active) return;

    if (locked) {
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      moveDir.set(0, 0, 0);
      if (keys.has("KeyW")) moveDir.add(forward);
      if (keys.has("KeyS")) moveDir.sub(forward);
      if (keys.has("KeyD")) moveDir.add(right);
      if (keys.has("KeyA")) moveDir.sub(right);
      if (keys.has("Space")) moveDir.y += 1;
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) moveDir.y -= 1;
      if (moveDir.lengthSq() > 0) moveDir.normalize();
      const targetVelocity = moveDir.multiplyScalar(FLY_SPEED);
      velocity.lerp(targetVelocity, 1 - Math.exp(-FLY_ACCEL * dt));
      camPos.addScaledVector(velocity, dt);
      if (camPos.length() > FLY_MAX_RADIUS) camPos.setLength(FLY_MAX_RADIUS);
      euler.set(pitch, yaw, 0, "YXZ");
      camQuat.setFromEuler(euler);
    } else if (!userPaused) {
      orbitAngle += dt * ORBIT_SPEED;
      const { position, quaternion } = orbitPose(orbitAngle);
      const t = 1 - Math.exp(-RETURN_RATE * dt);
      camPos.lerp(position, t);
      camQuat.slerp(quaternion, t);
    }

    cameraRig.setPosition(camPos.x, camPos.y, camPos.z);
    cameraRig.setRotation(camQuat.x, camQuat.y, camQuat.z, camQuat.w);
  }
  app.on("update", onUpdate);
  app.start();

  return {
    pause() {
      if (!active) return;
      active = false;
      updatePlayback();
      releaseLock();
    },
    resume() {
      if (active) return;
      active = true;
      updatePlayback();
    },
    dispose() {
      disposed = true;
      active = false;
      releaseLock();
      stopResize();
      pauseButton.removeEventListener("click", togglePause);
      pauseButton.remove();
      selector?.remove();
      loading.remove();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDownCapture);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dividerEl?.removeEventListener("pointerdown", onDividerPointerDown);
      dividerEl?.removeEventListener("pointermove", onDividerPointerMove);
      dividerEl?.removeEventListener("pointerup", onDividerPointerUp);
      dividerEl?.removeEventListener("pointercancel", onDividerPointerUp);
      dividerEl?.remove();
      density?.removeEventListener("input", updatePointCount);
      density?.remove();
      if (splatAsset) {
        app.assets.remove(splatAsset);
        splatAsset.unload();
      }
      app.destroy();
    },
  };
}

type FuzzyBlob = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  angle: number;
  color: number;
  alpha: number;
};

const FUZZY_BLOBS: readonly FuzzyBlob[] = [
  { x: -0.55, y: 0.25, z: 0.1, sx: 0.62, sy: 0.4, angle: -0.35, color: PALETTE.SIGNAL.BLUE, alpha: 0.75 },
  { x: -0.15, y: 0.42, z: -0.15, sx: 0.5, sy: 0.34, angle: 0.5, color: PALETTE.SIGNAL.AMBER, alpha: 0.7 },
  { x: 0.3, y: 0.3, z: 0.2, sx: 0.58, sy: 0.4, angle: -0.6, color: PALETTE.SIGNAL.CORAL, alpha: 0.72 },
  { x: 0.5, y: -0.05, z: -0.1, sx: 0.46, sy: 0.3, angle: 0.2, color: PALETTE.SIGNAL.GREEN, alpha: 0.7 },
  { x: 0.1, y: -0.2, z: 0.25, sx: 0.64, sy: 0.42, angle: 0.15, color: PALETTE.SIGNAL.VIOLET, alpha: 0.68 },
  { x: -0.35, y: -0.3, z: -0.05, sx: 0.5, sy: 0.32, angle: -0.2, color: PALETTE.SIGNAL.TEAL, alpha: 0.72 },
  { x: -0.1, y: 0.05, z: 0.05, sx: 0.4, sy: 0.4, angle: 0, color: PALETTE.SIGNAL.ROSE, alpha: 0.6 },
  { x: 0.2, y: 0.05, z: -0.3, sx: 0.55, sy: 0.36, angle: 0.4, color: PALETTE.SIGNAL.BLUE, alpha: 0.6 },
];

function createGaussianTexture(sigmaFraction: number): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const image = ctx.createImageData(size, size);
  const center = (size - 1) / 2;
  const sigma = size * sigmaFraction;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const alpha = Math.exp(-0.5 * (dx * dx + dy * dy) / (sigma * sigma));
      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(255 * alpha);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createFuzzyBlobs(
  canvas: HTMLCanvasElement,
  mount: HTMLElement,
): VisualizationHandle {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
  camera.position.set(0, 0, 2.3);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const texture = createGaussianTexture(0.16);
  const materials: THREE.SpriteMaterial[] = [];
  for (const blob of FUZZY_BLOBS) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: blob.color,
      opacity: blob.alpha,
      rotation: blob.angle,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(blob.x, blob.y, blob.z);
    sprite.scale.set(blob.sx, blob.sy, 1);
    materials.push(material);
    group.add(sprite);
  }

  const stopResize = onMountResize(mount, (width, height) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fit(renderer, canvas);
  });

  let raf = 0;
  let running = true;
  let last = performance.now();
  const tick = (time: number) => {
    if (!running) return;
    const dt = (time - last) / 1000;
    last = time;
    group.rotation.y += dt * 0.22;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      stopResize();
      texture.dispose();
      materials.forEach((material) => material.dispose());
      renderer.dispose();
    },
  };
}
