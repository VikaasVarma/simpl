declare module "troika-three-text" {
  import { Mesh } from "three";

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: number | string;
    anchorX: "left" | "center" | "right" | number | string;
    anchorY: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom" | number | string;
    depthOffset: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
