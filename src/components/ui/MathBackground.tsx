import './MathBackground.css';

/**
 * Decorative mathematics for section backgrounds.
 *
 * Three depth layers — small equations, geometry diagrams, and oversized symbols — each
 * carrying a `data-parallax` rate so `useParallax` drifts them at different speeds.
 *
 * Non-negotiables, because decoration that fights the content is worse than none:
 *   - `aria-hidden` and `pointer-events: none`, so it is invisible to screen readers and
 *     can never swallow a tap meant for a button;
 *   - opacity low enough that body text over it still clears AA contrast;
 *   - absolutely positioned inside a `position: relative; overflow: hidden` section, so
 *     it cannot widen the page and create horizontal scroll on a phone.
 */

type Variant = 'hero' | 'dark' | 'light';

interface MathBackgroundProps {
  variant?: Variant;
  /** Hide the busiest layer where content is dense. */
  density?: 'full' | 'sparse';
}

export function MathBackground({ variant = 'light', density = 'full' }: MathBackgroundProps) {
  return (
    <div className={`math-bg math-bg--${variant}`} aria-hidden="true">
      {/* Layer 3 (deepest, slowest): oversized glyphs */}
      <div className="math-bg__layer math-bg__layer--symbols" data-parallax="0.05">
        <span className="math-bg__glyph math-bg__glyph--1">π</span>
        <span className="math-bg__glyph math-bg__glyph--2">Σ</span>
        <span className="math-bg__glyph math-bg__glyph--3">√</span>
        <span className="math-bg__glyph math-bg__glyph--4">∫</span>
        <span className="math-bg__glyph math-bg__glyph--5">∞</span>
      </div>

      {/* Layer 2: geometry diagrams */}
      <div className="math-bg__layer math-bg__layer--geometry" data-parallax="0.11">
        {/* Circle with a labelled radius — the flyer's A = πr² motif */}
        <svg className="math-bg__figure math-bg__figure--circle" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="58" stroke="currentColor" strokeWidth="2" />
          <line x1="80" y1="80" x2="138" y2="80" stroke="currentColor" strokeWidth="2" />
          <circle cx="80" cy="80" r="3" fill="currentColor" />
          <text x="104" y="72" className="math-bg__figure-label">r</text>
        </svg>

        {/* Right triangle with the right-angle marker */}
        <svg className="math-bg__figure math-bg__figure--triangle" viewBox="0 0 150 130" fill="none">
          <path d="M20 110 L130 110 L20 20 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M20 96 L34 96 L34 110" stroke="currentColor" strokeWidth="2" />
        </svg>

        {/* Coordinate axes with a parabola */}
        <svg className="math-bg__figure math-bg__figure--axes" viewBox="0 0 160 140" fill="none">
          <line x1="12" y1="120" x2="150" y2="120" stroke="currentColor" strokeWidth="2" />
          <line x1="30" y1="10" x2="30" y2="132" stroke="currentColor" strokeWidth="2" />
          <path d="M34 118 Q80 -6 140 100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        {/* Protractor-style arc */}
        <svg className="math-bg__figure math-bg__figure--arc" viewBox="0 0 140 90" fill="none">
          <path d="M12 78 A58 58 0 0 1 128 78" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="78" x2="128" y2="78" stroke="currentColor" strokeWidth="2" />
          <line x1="70" y1="78" x2="42" y2="28" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* Layer 1 (nearest, fastest): small equations */}
      {density === 'full' && (
        <div className="math-bg__layer math-bg__layer--equations" data-parallax="0.19">
          <span className="math-bg__eq math-bg__eq--1">A = πr²</span>
          <span className="math-bg__eq math-bg__eq--2">x = (-b ± √(b²-4ac)) / 2a</span>
          <span className="math-bg__eq math-bg__eq--3">a² + b² = c²</span>
          <span className="math-bg__eq math-bg__eq--4">y = mx + b</span>
          <span className="math-bg__eq math-bg__eq--5">
            <span className="math-bg__frac">
              <span className="math-bg__frac-top">dy</span>
              <span className="math-bg__frac-bottom">dx</span>
            </span>
          </span>
          <span className="math-bg__eq math-bg__eq--6">(x, y)</span>
          <span className="math-bg__eq math-bg__eq--7">f(x) = 2x + 5</span>
          <span className="math-bg__eq math-bg__eq--8">
            <span className="math-bg__frac">
              <span className="math-bg__frac-top">3</span>
              <span className="math-bg__frac-bottom">4</span>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
