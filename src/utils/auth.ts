// src/utils/auth.ts
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
