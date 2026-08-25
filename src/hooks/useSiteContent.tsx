import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  LegalSettings,
  SchedulingSettings,
  SiteSettings,
  Subject,
  Testimonial,
} from '@/types';
import { isFirebaseConfigured } from '@/firebase/config';
import {
  DEFAULT_LEGAL,
  DEFAULT_SCHEDULING,
  DEFAULT_SITE,
  DEFAULT_SUBJECTS,
} from '@/services/defaults';
import { getLegalSettings, getSchedulingSettings, getSiteSettings } from '@/services/settings';
import { getSubjects } from '@/services/subjects';
import { getTestimonials } from '@/services/testimonials';
import { handleError } from '@/utils/errors';

/**
 * One provider owns all public content.
 *
 * The alternative — each section fetching what it needs — would fire five or six
 * Firestore reads per visitor and make the page pop in section by section. Loading the
 * bundle once keeps reads at a flat five per visit and lets the whole page settle
 * together.
 */

interface SiteContentValue {
  site: SiteSettings;
  scheduling: SchedulingSettings;
  legal: LegalSettings;
  subjects: Subject[];
  testimonials: Testimonial[];
  loading: boolean;
  /** Set when the initial load failed outright; defaults are being shown. */
  error: string | null;
  /** True when Firebase env vars are absent — triggers the setup screen. */
  configured: boolean;
  refresh: () => Promise<void>;
}

const FALLBACK: Omit<SiteContentValue, 'refresh'> = {
  site: DEFAULT_SITE,
  scheduling: DEFAULT_SCHEDULING,
  legal: DEFAULT_LEGAL,
  subjects: DEFAULT_SUBJECTS as Subject[],
  testimonials: [],
  loading: true,
  error: null,
  configured: true,
};

const SiteContentContext = createContext<SiteContentValue | null>(null);

/** Push the admin-chosen palette into the CSS custom properties. */
function applyTheme(theme: SiteSettings['theme']): void {
  const root = document.documentElement;
  const mapping: Record<string, string> = {
    '--brand-primary': theme.primary,
    '--brand-cream': theme.cream,
    '--brand-coral': theme.coral,
    '--brand-light': theme.light,
    '--brand-dark': theme.dark,
  };
  for (const [property, value] of Object.entries(mapping)) {
    // Only accept hex colours: a rogue value here would otherwise be injected
    // straight into a style attribute.
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) root.style.setProperty(property, value);
  }
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [state, setState] = useState<Omit<SiteContentValue, 'refresh'>>({
    ...FALLBACK,
    configured,
    loading: configured,
  });

  const load = useCallback(async () => {
    if (!configured) {
      setState((prev) => ({ ...prev, loading: false, configured: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Parallel: these are independent documents, and doing them in sequence would
      // stack five round trips before anything renders.
      const [site, scheduling, legal, subjects, testimonials] = await Promise.all([
        getSiteSettings(),
        getSchedulingSettings(),
        getLegalSettings(),
        getSubjects(),
        getTestimonials(),
      ]);
      setState({
        site,
        scheduling,
        legal,
        subjects,
        testimonials,
        loading: false,
        error: null,
        configured: true,
      });
    } catch (error) {
      setState({
        ...FALLBACK,
        loading: false,
        configured: true,
        error: handleError(
          'useSiteContent.load',
          error,
          'Could not load the latest site content. Showing the default version.',
        ),
      });
    }
  }, [configured]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    applyTheme(state.site.theme);
  }, [state.site.theme]);

  const value = useMemo<SiteContentValue>(() => ({ ...state, refresh: load }), [state, load]);

  return (
    <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
  );
}

export function useSiteContent(): SiteContentValue {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error('useSiteContent must be used inside <SiteContentProvider>.');
  }
  return context;
}
