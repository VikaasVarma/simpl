import type { GraphConnectionGroup } from "../graph/graphTypes";
import type { SimNode } from "../graph/simulation";

export type PopupLayer = {
  element: HTMLElement;
};

export function createPopupLayer(): PopupLayer {
  const element = document.createElement("div");
  element.className = "graph-popups";
  return { element };
}

export function hidePopups(layer: PopupLayer): void {
  layer.element.querySelectorAll(".graph-popup").forEach((popup) => {
    popup.classList.add("is-closing");
    const remove = () => removePopup(popup);
    popup.addEventListener("animationend", remove, { once: true });
    window.setTimeout(remove, 220);
  });
}

export function hasPopups(layer: PopupLayer): boolean {
  return Boolean(layer.element.querySelector(".graph-popup"));
}

export function showConnectionPopups(
  layer: PopupLayer,
  group: GraphConnectionGroup,
  nodeById: Map<string, SimNode>,
  sideForTarget: (targetId: string) => "left" | "right",
  focusById: (id?: string | null) => boolean,
  onClose: () => void,
): void {
  hidePopups(layer);
  const popups = group.connections.map((connection) => {
    const target = nodeById.get(connection.target);
    if (!target) return null;
    const element = document.createElement("button");
    element.type = "button";
    element.className = "graph-popup";
    element.dataset.color = String(connection.colorIndex);
    element.dataset.side = sideForTarget(target.id);
    element.dataset.targetId = target.id;
    element.innerHTML = [
      `<span class="graph-popup__eyebrow">${escapeHtml(target.title)}</span>`,
      connection.labelHtml
        ? `<div class="graph-popup__message">${connection.labelHtml}</div>`
        : "",
    ].join("");
    element.addEventListener("click", () => {
      hidePopups(layer);
      onClose();
      focusById(target.id);
    });
    return element;
  });

  stackPopups(layer, popups.filter(Boolean) as HTMLElement[]);
}

function stackPopups(layer: PopupLayer, popups: HTMLElement[]): void {
  appendStack(layer, popups);
}

function appendStack(layer: PopupLayer, popups: HTMLElement[]): void {
  if (!popups.length) return;
  const stack = document.createElement("div");
  stack.className = "graph-popup-stack";
  // One stack assigns vertical slots; each popup's data-side owns left/right placement.
  stack.append(...popups);
  layer.element.append(stack);
}

function removePopup(popup: Element): void {
  const stack = popup.parentElement;
  popup.remove();
  if (
    stack?.classList.contains("graph-popup-stack") &&
    !stack.childElementCount
  )
    stack.remove();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
