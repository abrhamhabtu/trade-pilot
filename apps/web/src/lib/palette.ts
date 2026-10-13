// Whole-app colour palettes and backdrops. Each is a block of CSS in
// globals.css keyed by an attribute on <html>; switching is one attribute change.

export const PALETTES = [
  { id: 'graphite', name: 'Graphite', note: 'Cool near-black, green accent' },
  { id: 'midnight', name: 'Midnight', note: 'Deep navy with mint' },
  { id: 'carbon', name: 'Carbon', note: 'True black, white accent' },
  { id: 'indigo', name: 'Indigo', note: 'Pure black, electric indigo' },
  { id: 'violet', name: 'Violet', note: 'Charcoal with soft violet' },
  { id: 'ember', name: 'Ember', note: 'Warm charcoal, amber accent' },
  { id: 'arctic', name: 'Arctic', note: 'Teal slate, ice blue' },
  { id: 'orchid', name: 'Orchid', note: 'Ink plum, pink accent' },
] as const;

export const BACKDROPS = [
  { id: 'spotlight', name: 'Spotlight', note: 'A soft light from above' },
  { id: 'plain', name: 'Plain', note: 'Flat colour, nothing else' },
  { id: 'grid', name: 'Grid', note: 'Fine graph-paper lines' },
  { id: 'aurora', name: 'Aurora', note: 'Accent glow in the corners' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];
export type BackdropId = (typeof BACKDROPS)[number]['id'];
export const PALETTE_KEY = 'tp.palette';
export const BACKDROP_KEY = 'tp.backdrop';
export const DEFAULT_PALETTE: PaletteId = 'graphite';
export const DEFAULT_BACKDROP: BackdropId = 'spotlight';
/** Other parts of the app (the sidebar, Settings) listen for this to stay in step. */
export const APPEARANCE_EVENT = 'tp:appearance';

function read<T extends string>(key: string, allowed: readonly { id: T }[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (allowed.some((p) => p.id === saved)) return saved as T;
  } catch {}
  return fallback;
}

export const loadPalette = () => read(PALETTE_KEY, PALETTES, DEFAULT_PALETTE);
export const loadBackdrop = () => read(BACKDROP_KEY, BACKDROPS, DEFAULT_BACKDROP);

function apply(attr: string, key: string, id: string, fallback: string) {
  const root = document.documentElement;
  if (id === fallback) root.removeAttribute(attr);
  else root.setAttribute(attr, id);
  try {
    localStorage.setItem(key, id);
  } catch {}
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

export const applyPalette = (id: PaletteId) => apply('data-palette', PALETTE_KEY, id, DEFAULT_PALETTE);
export const applyBackdrop = (id: BackdropId) => apply('data-backdrop', BACKDROP_KEY, id, DEFAULT_BACKDROP);

/** Runs before first paint so a saved look never flashes the default. */
export const PALETTE_BOOT_SCRIPT = `try{var d=document.documentElement,p=localStorage.getItem('${PALETTE_KEY}'),b=localStorage.getItem('${BACKDROP_KEY}');if(p&&p!=='${DEFAULT_PALETTE}')d.setAttribute('data-palette',p);if(b&&b!=='${DEFAULT_BACKDROP}')d.setAttribute('data-backdrop',b)}catch(e){}`;
