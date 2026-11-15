'use client';
// The AI picked in the interface. Meta is the default; only Meta, ChatGPT and Gemini are offered.
export const DEFAULT_AI = 'meta';
export const UI_AIS = ['meta', 'chatgpt', 'gemini'];
export function loadAi(): string {
  try { const a = localStorage.getItem('ai_engine'); return a && UI_AIS.includes(a) ? a : DEFAULT_AI; } catch { return DEFAULT_AI; }
}
export function saveAi(id: string) { try { localStorage.setItem('ai_engine', id); } catch {} }
