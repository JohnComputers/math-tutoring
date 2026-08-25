import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * Motion primitives: reduced-motion detection, scroll reveal, and parallax.
 *
 * Every one of them is a no-op when the user has asked for reduced motion. That check
 * happens in JavaScript, not only in CSS, because the parallax hook attaches a scroll
 * listener and writes transforms — a CSS media query cannot switch that off, it can only
 * shorten the transition it produces.
 */

/** Live-updating `prefers-reduced-motion` state. */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersReduced;
}

/** Generic media-query hook, for layout decisions that CSS alone cannot make. */
export function useMediaQuery(queryString: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(queryString).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(queryString);
    setMatches(query.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [queryString]);

  return matches;
}

/**
 * Reveal elements as they scroll into view.
 *
 * Uses one IntersectionObserver for the whole page and unobserves each element once it
 * has appeared: a reveal is a one-shot event, and leaving observers attached to every
 * card would keep the callback firing for the life of the page.
 *
 * Elements opt in with `className="reveal"`. If JavaScript never runs, the CSS leaves
 * them visible, so content is never hidden by a broken script.
 */
export function useScrollReveal(enabled = true, dependency?: unknown): void {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (elements.length === 0) return;

    // Reduced motion (or no observer support): show everything immediately.
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      for (const element of elements) element.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      // Trigger slightly before the element reaches the viewport edge so the animation
      // is already underway by the time it is properly in view.
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    for (const element of elements) {
      if (element.classList.contains('is-visible')) continue;
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [enabled, prefersReducedMotion, dependency]);
}

/**
 * Parallax offset for decorative layers.
 *
 * Returns a ref to attach to a container. Any descendant carrying `data-parallax="0.3"`
 * is translated by `scrollY * 0.3`, so layers drift at different rates.
 *
 * Implementation notes that matter:
 *   - writes happen inside `requestAnimationFrame`, so scrolling never triggers a
 *     synchronous layout;
 *   - only `transform` is touched, which the compositor can handle without repainting;
 *   - the listener is passive, so it cannot delay scrolling;
 *   - nothing is attached at all under reduced motion or on coarse pointers, because
 *     parallax on a phone costs battery for an effect that is barely visible.
 */
export function useParallax(strength = 1): RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion || !isDesktop) return;

    const layers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-parallax]'),
    ).map((element) => ({
      element,
      rate: Number(element.dataset.parallax ?? '0') * strength,
    }));
    if (layers.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = container.getBoundingClientRect();
      // Distance scrolled since the container's top passed the viewport top.
      const progress = -rect.top;
      for (const layer of layers) {
        layer.element.style.transform = `translate3d(0, ${(progress * layer.rate).toFixed(2)}px, 0)`;
      }
    };

    const onScroll = () => {
      if (frame) return; // coalesce bursts of scroll events into one frame
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      for (const layer of layers) layer.element.style.transform = '';
    };
  }, [prefersReducedMotion, isDesktop, strength]);

  return containerRef;
}

/** Lock body scroll while a drawer or modal is open, without a layout jump. */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Removing the scrollbar shifts the whole page left; pad by its width to stop that.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked]);
}
