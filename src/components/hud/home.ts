export function createHomeButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "graph-hud__home";
  button.type = "button";
  button.textContent = "home";
  return button;
}
