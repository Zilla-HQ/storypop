"use client";

/**
 * Client island for the FlashPromoBanner dismiss action. Sets a 7-day
 * `restay_flash_dismissed=1` cookie + reloads the page so the server
 * component re-renders with `dismissed=true` and skips the banner.
 */
export function FlashDismissButton() {
  function dismiss() {
    document.cookie = "restay_flash_dismissed=1; path=/; max-age=" + 60 * 60 * 24 * 7;
    // Reload so the server-rendered banner disappears immediately.
    window.location.reload();
  }
  return (
    <button
      type="button"
      onClick={dismiss}
      className="text-white/80 hover:text-white"
      aria-label="Dismiss"
    >
      ✕
    </button>
  );
}
