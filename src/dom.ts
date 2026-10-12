interface ElementOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.class) element.className = options.class;
  if (options.text !== undefined) element.textContent = options.text;

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
  }

  children.forEach((child) => element.append(child));

  return element;
}

export function formatClock(date: Date = new Date()): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type MessageKind = "success" | "error" | "";

export function setMessage(
  target: HTMLElement | null,
  text: string,
  kind: MessageKind,
): void {
  if (!target) return;

  target.textContent = text;
  target.className = kind ? `form-message ${kind}` : "form-message";
}
