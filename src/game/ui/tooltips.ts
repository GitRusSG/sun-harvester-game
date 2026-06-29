/**
 * Tooltip system using event delegation.
 *
 * Elements opt-in by setting a `data-tooltip="..."` attribute. The tooltip
 * shows on mouseenter / focusin and hides on mouseleave / focusout, so it
 * works for both pointer and keyboard users (Requirement 10.3).
 *
 * A single tooltip element is reused for the entire container, which keeps
 * the DOM lightweight. Tooltips are positioned just above the target and
 * clamped within the viewport to avoid clipping.
 *
 * Usage:
 *   const tooltips = new TooltipSystem();
 *   tooltips.attach(document.body);
 *   // <button data-tooltip="Build a coal power plant">Build</button>
 */
export class TooltipSystem {
  private container: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;

  private readonly onPointerOver = (e: Event): void => this.handleEnter(e);
  private readonly onPointerOut = (e: Event): void => this.handleLeave(e);
  private readonly onFocusIn = (e: Event): void => this.handleEnter(e);
  private readonly onFocusOut = (e: Event): void => this.handleLeave(e);
  private readonly onScroll = (): void => this.position();

  /** Attach tooltip handlers to the given container. */
  attach(container: HTMLElement): void {
    if (this.container) {
      this.detach();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'shg-tooltip';
    // Tooltips are descriptive, not interactive; role="tooltip" lets ATs
    // associate the content with the focused element.
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    container.appendChild(tooltip);

    container.addEventListener('pointerover', this.onPointerOver);
    container.addEventListener('pointerout', this.onPointerOut);
    container.addEventListener('focusin', this.onFocusIn);
    container.addEventListener('focusout', this.onFocusOut);
    window.addEventListener('scroll', this.onScroll, true);

    this.container = container;
    this.tooltipEl = tooltip;
  }

  /** Remove all listeners and the tooltip element. */
  detach(): void {
    if (!this.container) return;

    this.container.removeEventListener('pointerover', this.onPointerOver);
    this.container.removeEventListener('pointerout', this.onPointerOut);
    this.container.removeEventListener('focusin', this.onFocusIn);
    this.container.removeEventListener('focusout', this.onFocusOut);
    window.removeEventListener('scroll', this.onScroll, true);

    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }

    this.container = null;
    this.tooltipEl = null;
    this.currentTarget = null;
  }

  private handleEnter(event: Event): void {
    const target = this.findTooltipTarget(event.target);
    if (!target || target === this.currentTarget) return;

    const text = target.getAttribute('data-tooltip');
    if (!text || !this.tooltipEl) return;

    this.currentTarget = target;
    this.tooltipEl.textContent = text;
    this.tooltipEl.hidden = false;
    this.position();
  }

  private handleLeave(event: Event): void {
    const target = this.findTooltipTarget(event.target);
    // If leave event is for a different element than the one currently shown,
    // ignore it — the user is moving between unrelated elements.
    if (!target || target !== this.currentTarget) return;
    this.hide();
  }

  private hide(): void {
    if (this.tooltipEl) {
      this.tooltipEl.hidden = true;
      this.tooltipEl.textContent = '';
    }
    this.currentTarget = null;
  }

  /**
   * Walk up the DOM tree from the event target to find the nearest element
   * with a `data-tooltip` attribute. This makes tooltips work even when
   * focus or pointer events fire on nested children (e.g., an <img> inside
   * a button).
   */
  private findTooltipTarget(eventTarget: EventTarget | null): HTMLElement | null {
    let node: Node | null = eventTarget instanceof Node ? eventTarget : null;
    while (node && node !== this.container) {
      if (node instanceof HTMLElement && node.hasAttribute('data-tooltip')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  private position(): void {
    if (!this.currentTarget || !this.tooltipEl || this.tooltipEl.hidden) return;

    const rect = this.currentTarget.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();

    // Default: centered above the target with a small gap.
    const gap = 6;
    let top = rect.top - tipRect.height - gap;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;

    // Clamp horizontally within viewport.
    const margin = 4;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }

    // If there is no room above, flip below.
    if (top < margin) {
      top = rect.bottom + gap;
    }

    this.tooltipEl.style.position = 'fixed';
    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
  }
}
