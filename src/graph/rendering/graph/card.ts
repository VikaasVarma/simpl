import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from "three";
import { FLOW, NOTE, NOTE_CARD, NOTE_LAYER, PALETTE } from "../../constants";
import type { GraphPalette } from "../../constants";
import type { NoteView } from "./types";

type NoteCardSize = { w: number; h: number };

export function createNoteCard(size: NoteCardSize): Mesh {
  return new Mesh(cardGeometry(size), cardMaterial(size));
}

export function updateNoteCardTheme(
  note: NoteView,
  palette: GraphPalette,
): void {
  const material = note.panel.material as ShaderMaterial;
  material.uniforms.uFill.value.set(palette[NOTE_CARD.background]);
  material.uniforms.uBorder.value.set(palette[NOTE_CARD.border]);
  material.uniforms.uShadow.value.set(palette[NOTE_CARD.shadow]);
}

export function renderNoteCard(
  note: NoteView,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
  radius = NOTE.radius,
  z: number = NOTE_LAYER.cardZ,
  renderOrder: number = NOTE_LAYER.cardOrder,
): void {
  note.panel.position.set(x, y, z);
  note.panel.renderOrder = renderOrder;
  const material = note.panel.material as ShaderMaterial;
  material.uniforms.uHalfSize.value.set(w / 2, h / 2);
  material.uniforms.uRadius.value = radius;
  material.uniforms.uOpacity.value = opacity;
}

export function updateNoteCardHalos(note: NoteView): void {
  const material = note.panel.material as ShaderMaterial;
  material.uniforms.uHaloCount.value = note.haloCount;
  material.uniforms.uHaloPoints.value = note.haloPoints;
}

function cardGeometry(size: NoteCardSize): PlaneGeometry {
  const pad = NOTE.shadowSpread;
  return new PlaneGeometry(size.w + pad * 2, size.h + pad * 2);
}

function cardMaterial(size: NoteCardSize): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uHalfSize: { value: new Vector2(size.w / 2, size.h / 2) },
      uOpacity: { value: 1 },
      uRadius: { value: NOTE.radius },
      uFill: { value: new Color(PALETTE[NOTE_CARD.background]) },
      uBorder: { value: new Color(PALETTE[NOTE_CARD.border]) },
      uShadow: { value: new Color(PALETTE[NOTE_CARD.shadow]) },
      uShadowBlur: { value: NOTE.shadowBlur },
      uShadowAlpha: { value: NOTE.shadowAlpha },
      uHaloCount: { value: 0 },
      uHaloPoints: {
        value: Array.from({ length: FLOW.haloSlots }, () => new Vector2()),
      },
      uHaloRadius: { value: FLOW.haloRadius },
    },
    vertexShader: `
      varying vec2 vLocal;

      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 uHalfSize;
      uniform float uOpacity;
      uniform float uRadius;
      uniform vec3 uFill;
      uniform vec3 uBorder;
      uniform vec3 uShadow;
      uniform float uShadowBlur;
      uniform float uShadowAlpha;
      uniform int uHaloCount;
      uniform vec2 uHaloPoints[${FLOW.haloSlots}];
      uniform float uHaloRadius;
      varying vec2 vLocal;

      float roundedRectSdf(vec2 p, vec2 halfSize, float radius) {
        vec2 q = abs(p) - halfSize + vec2(radius);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      float haloMask(vec2 p) {
        if (uHaloCount == 0) return 0.0;
        float mask = 0.0;
        for (int i = 0; i < ${FLOW.haloSlots}; i++) {
          if (i >= uHaloCount) break;
          float d = distance(p, uHaloPoints[i]);
          mask = max(mask, 1.0 - smoothstep(uHaloRadius * 0.45, uHaloRadius, d));
        }
        return mask;
      }

      void main() {
        float panelDist = roundedRectSdf(vLocal, uHalfSize, uRadius);
        float panel = 1.0 - smoothstep(0.0, 1.0, panelDist);
        float shadow = (1.0 - smoothstep(0.0, uShadowBlur, panelDist)) * uShadowAlpha * haloMask(vLocal) * (1.0 - panel);
        float border = panel * (1.0 - smoothstep(0.0, 1.4, abs(panelDist)));
        float alpha = max(shadow, panel);
        vec3 panelColor = mix(uFill, uBorder, border);
        vec3 color = alpha <= 0.0 ? uFill : (panelColor * panel + uShadow * shadow) / alpha;

        if (alpha < 0.001) discard;
        gl_FragColor = vec4(color, alpha * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
}
