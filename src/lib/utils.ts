export function getRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ref)) {
    return ref;
  }
  return null;
}