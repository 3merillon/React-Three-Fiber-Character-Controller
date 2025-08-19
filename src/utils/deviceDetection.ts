export function detectDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const minDimension = Math.min(screenWidth, screenHeight);
  const maxDimension = Math.max(screenWidth, screenHeight);
  const devicePixelRatio = window.devicePixelRatio || 1;

  // More comprehensive tablet detection
  const isTablet = (
    // iPad detection (including iPad Pro)
    /ipad/.test(userAgent) ||
    // iPad on iOS 13+ (reports as desktop Safari)
    (navigator.platform === 'MacIntel' && maxTouchPoints > 1) ||
    // Android tablet detection
    (/android/.test(userAgent) && !/mobile/.test(userAgent)) ||
    // Surface and other Windows tablets
    /tablet/.test(userAgent) ||
    // Large touch screens (tablets typically 768px+ in portrait)
    (maxTouchPoints > 0 && minDimension >= 768 && maxDimension >= 1024) ||
    // High DPR touch devices with large screens
    (maxTouchPoints > 0 && devicePixelRatio >= 1.5 && minDimension >= 768)
  );

  const isMobile = maxTouchPoints > 0 && !isTablet && minDimension < 768;
  const isMobileDevice = isTablet || isMobile;
  const isDesktop = !isMobileDevice;

  return { isMobileDevice, isDesktop };
}