export type LinkComponent = {
  element: HTMLElement;
  anchor: HTMLAnchorElement;
};

export function createLinkComponent(): LinkComponent {
  const element = document.createElement("p");
  const anchor = document.createElement("a");
  element.className = "graph-dom-note__link";
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  element.append(anchor);
  return { element, anchor };
}

export function setLinkContent(link: LinkComponent, href = ""): void {
  const label = href ? `↗ ${host(href)}` : "";
  if (href && link.anchor.getAttribute("href") !== href)
    link.anchor.setAttribute("href", href);
  else if (!href) link.anchor.removeAttribute("href");
  if (link.anchor.textContent !== label) link.anchor.textContent = label;
  link.anchor.title = href;
  if (!href) link.element.hidden = true;
}

export function setLinkVisible(link: LinkComponent, visible: boolean): void {
  link.element.hidden = !link.anchor.textContent || !visible;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
