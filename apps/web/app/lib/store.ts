import type { StorefrontTemplate } from "./template";
import type { Intent, Piece, SlotName, Spec } from "./types";

// ponytail: localStorage per browser. Move to Supabase tables when groups and storefronts need to follow the user across devices.

export type Entry = { prompt: string; notes: string[]; status: "composing" | "done" | "error" };

// A group is one shopping request: a look (an outfit) or a set (one kind of item), with its own bag
export type Group = {
  id: string;
  number: number;
  name: string;
  entries: Entry[];
  intent: Intent | null;
  spec: Spec | null;
  pieces: Record<string, Piece>;
  picks: Partial<Record<SlotName, string>>;
  sizes: Record<string, string>;
  // Pieces saved for later with the heart. Missing on groups stored before it existed
  saved?: string[];
};

// An AI picture of an outfit group, stored per group id beside the groups. key: the picked piece ids it shows.
// spots: where each of those pieces sits in the picture, 0 to 1 from the top left
export type OutfitImage = { src: string; key: string; spots: { id: string; x: number; y: number }[] };

// A storefront is how groups look, independent of what is in them. The description is read by the agent
// to reuse it for a similar request, and by Jev to restyle a page like it
export type Storefront = { id: string; name: string; description: string; savedAt: string; template: StorefrontTemplate };

// storefront: the saved storefront new searches load into, null lets Jev compose
export type Prefs = { size: string | null; storefront: string | null };
export const defaultPrefs: Prefs = { size: null, storefront: null };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadGroups = (user: string) => read<Group[]>(`fluid:groups:${user}`, []);
export const storeGroups = (user: string, groups: Group[]) => write(`fluid:groups:${user}`, groups);
// Older saves had no template and cannot load products, so they are skipped
export const loadStorefronts = (user: string) => read<Storefront[]>(`fluid:storefronts:${user}`, []).filter((s) => s.template?.spec);
export const storeStorefronts = (user: string, list: Storefront[]) => write(`fluid:storefronts:${user}`, list);
export const loadPrefs = (user: string): Prefs => ({ ...defaultPrefs, ...read<Partial<Prefs>>(`fluid:prefs:${user}`, {}) });
export const storePrefs = (user: string, prefs: Prefs) => write(`fluid:prefs:${user}`, prefs);

export const loadJson = <T,>(user: string, name: string, fallback: T) => read<T>(`fluid:${name}:${user}`, fallback);
export const storeJson = (user: string, name: string, value: unknown) => write(`fluid:${name}:${user}`, value);
