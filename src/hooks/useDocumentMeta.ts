import { useEffect } from 'react';

/**
 * Manage `<title>` and the meta/Open Graph tags from React.
 *
 * A static-hosted SPA has no server to render head tags per route, so they are set
 * client-side. That is enough for browsers, link previews that execute JavaScript, and
 * Google (which renders pages). It is *not* enough for scrapers that read raw HTML —
 * which is why `index.html` also ships a sensible default set for the homepage, and this
 * hook only upgrades them.
 */

interface MetaOptions {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  /** Ask crawlers to skip this page — used for /admin. */
  noIndex?: boolean;
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string): void {
  if (!content) return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  if (!href) return;
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function useDocumentMeta({
  title,
  description,
  canonicalUrl,
  ogImageUrl,
  noIndex,
}: MetaOptions): void {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }

    if (title) {
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
      upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }

    if (canonicalUrl) {
      upsertLink('canonical', canonicalUrl);
      upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    }

    if (ogImageUrl) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', ogImageUrl);
      upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    }

    // The admin area must never be indexed. Removing the tag again on unmount matters:
    // navigating from /admin back to the homepage should not leave it noindexed.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noIndex) {
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    } else if (robots) {
      robots.setAttribute('content', 'index, follow');
    }
  }, [title, description, canonicalUrl, ogImageUrl, noIndex]);
}
