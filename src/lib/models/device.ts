export type HostedModelSupport =
  | { supported: true; reason: null }
  | { supported: false; reason: 'desktop-only' | 'missing-apis' };
/** Desktop only until real phones and tablets have been qualified. No GPU is required. */
export function hostedModelsSupported(): HostedModelSupport {
  if (typeof navigator === 'undefined' || typeof window === 'undefined')
    return { supported: false, reason: 'missing-apis' };
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (
    nav.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) ||
    (window.matchMedia?.('(pointer: coarse)').matches &&
      Math.min(window.innerWidth, window.innerHeight) <= 1024)
  )
    return { supported: false, reason: 'desktop-only' };
  try {
    if (
      !window.isSecureContext ||
      !globalThis.caches ||
      !crypto.subtle ||
      typeof Worker === 'undefined' ||
      typeof WebAssembly === 'undefined' ||
      typeof AudioContext === 'undefined' ||
      typeof OfflineAudioContext === 'undefined'
    )
      return { supported: false, reason: 'missing-apis' };
  } catch {
    return { supported: false, reason: 'missing-apis' };
  }
  return { supported: true, reason: null };
}
