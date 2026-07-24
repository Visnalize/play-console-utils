import { storage } from '@wxt-dev/storage';

export interface AppMapping {
  label: string;
  slug: string;
}

export const appMappingsItem = storage.defineItem<AppMapping[]>(
  'local:appMappings',
  { fallback: [], version: 1 },
);

export function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'app';
}

const normalize = (label: string) => label.trim().toLowerCase();

export async function resolveAppSlug(
  rawLabel: string,
): Promise<{ slug: string; matched: boolean }> {
  const label = rawLabel.trim();
  const mappings = await appMappingsItem.getValue();

  const exact = mappings.find((m) => normalize(m.label) === normalize(label));
  if (exact) return { slug: exact.slug, matched: true };

  const partial = mappings.find(
    (m) =>
      normalize(m.label) !== '' &&
      normalize(label).includes(normalize(m.label)),
  );
  if (partial) return { slug: partial.slug, matched: true };

  return { slug: slugify(label), matched: false };
}
