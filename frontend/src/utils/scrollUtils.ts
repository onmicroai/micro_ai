export function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight;
    if (scrollable) return node;
    node = node.parentElement;
  }
  return window;
}

export function smoothScrollToElement(
  el: HTMLElement,
  durationMs = 850,
  topOffset = 72
): () => void {
  const container = getScrollParent(el);
  const startY =
    container === window
      ? window.scrollY
      : (container as HTMLElement).scrollTop;
  const targetY =
    container === window
      ? Math.max(0, window.scrollY + el.getBoundingClientRect().top - topOffset)
      : Math.max(
          0,
          (container as HTMLElement).scrollTop +
            (el.getBoundingClientRect().top -
              (container as HTMLElement).getBoundingClientRect().top) -
            topOffset
        );
  const distance = targetY - startY;
  let rafId = 0;
  const start = performance.now();

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const step = (now: number) => {
    const elapsed = now - start;
    const p = Math.min(1, elapsed / durationMs);
    const y = startY + distance * easeInOutCubic(p);
    if (container === window) {
      window.scrollTo(0, y);
    } else {
      (container as HTMLElement).scrollTop = y;
    }
    if (p < 1) {
      rafId = window.requestAnimationFrame(step);
    }
  };

  rafId = window.requestAnimationFrame(step);
  return () => window.cancelAnimationFrame(rafId);
}
