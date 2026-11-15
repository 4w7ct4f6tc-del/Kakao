'use client';
/** The AI the user picked. Default: Meta (free and fast). The user can switch anytime. */
export const DEFAULT_AI = 'meta';
export function loadAi(): string {
  try { return localStorage.getItem('ai_engine') || DEFAULT_AI; } catch { return DEFAULT_AI; }
}
export function saveAi(id: string) {
  try { localStorage.setItem('ai_engine', id); } catch {}
}
