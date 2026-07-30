export type LinkComponent = {
  element: HTMLElement;
  anchor: HTMLAnchorElement;
  code: HTMLButtonElement;
  hasHref: boolean;
  hasCode: boolean;
  onCodeToggle: () => void;
};

export function createLinkComponent(): LinkComponent {
  const element = document.createElement("p");
  const anchor = document.createElement("a");
  const code = document.createElement("button");
  element.className = "graph-dom-note__link";
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  code.type = "button";
  code.className = "graph-dom-note__code-toggle";
  const link = {
    element,
    anchor,
    code,
    hasHref: false,
    hasCode: false,
    onCodeToggle: () => {},
  };
  code.addEventListener("click", (event) => {
    event.stopPropagation();
    link.onCodeToggle();
  });
  element.append(anchor, code);
  return link;
}

export function setLinkContent(link: LinkComponent, href = ""): void {
  link.hasHref = !!href;
  if (href && link.anchor.getAttribute("href") !== href)
    link.anchor.setAttribute("href", href);
  else if (!href) link.anchor.removeAttribute("href");
  if (href && link.anchor.dataset.href !== href) {
    link.anchor.dataset.href = href;
    link.anchor.replaceChildren(
      linkIcon(),
      document.createTextNode(host(href)),
    );
  } else if (!href) {
    link.anchor.replaceChildren();
    delete link.anchor.dataset.href;
  }
  link.anchor.title = href;
  link.anchor.hidden = !href;
  if (!href && !link.hasCode) link.element.hidden = true;
}

export function setCodeToggle(
  link: LinkComponent,
  hasCode: boolean,
  active: boolean,
  onToggle: () => void,
): void {
  link.hasCode = hasCode;
  link.onCodeToggle = onToggle;
  link.code.hidden = !hasCode;
  link.code.textContent = active ? "note" : "</code>";
  link.code.setAttribute("aria-pressed", String(active));
  if (!link.hasHref && !hasCode) link.element.hidden = true;
}

export function setLinkVisible(link: LinkComponent, visible: boolean): void {
  link.element.hidden = (!link.hasHref && !link.hasCode) || !visible;
}

function linkIcon(): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("graph-dom-note__link-icon");
  icon.innerHTML =
    '<path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L10.9 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1l1.2-1.2"/>';
  return icon;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
