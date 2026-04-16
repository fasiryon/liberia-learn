/**
 * components/LowBandwidthModeScript.tsx
 *
 * Inline <script> injected into <head> to apply the data-lowbandwidth
 * attribute before first paint (prevents FOUC for bandwidth-aware styles).
 *
 * Usage: <LowBandwidthModeScript /> inside the root layout <head>.
 *
 * The script is intentionally tiny and self-contained so it can run
 * before any framework hydration.
 */
export function LowBandwidthModeScript() {
  const inlineScript = `
(function(){
  try {
    var stored = localStorage.getItem('llbm');
    var enabled = false;
    if (stored === '1') { enabled = true; }
    else if (stored !== '0') {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        enabled = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' ||
          (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 0.5);
      }
    }
    if (enabled) document.documentElement.setAttribute('data-lowbandwidth','true');
  } catch(e) {}
})();
`.trim();

  return (
    <script
      dangerouslySetInnerHTML={{ __html: inlineScript }}
      suppressHydrationWarning
    />
  );
}
