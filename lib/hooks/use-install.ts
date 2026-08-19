"use client";

import { useCallback, useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = {
  /** Running from the home screen already. */
  installed: boolean;
  /** The browser offered a real installer we can trigger. */
  canPromptNative: boolean;
  /** iOS Safari: no API, instructions are the only route. */
  isIOSSafari: boolean;
  /** iOS, but a browser that cannot install at all. */
  cannotInstall: boolean;
  promptInstall: () => Promise<void>;
};

/**
 * One source of truth for install capability, shared by the automatic
 * prompt and the manual link on the profile page — otherwise the two
 * drift and one of them lies about what the browser can do.
 *
 * The case worth naming: iOS Chrome, Firefox, and the in-app browsers
 * inside WhatsApp and Instagram cannot install anything. A lot of
 * traffic arrives by tapping a link inside WhatsApp, so offering them a
 * button that does nothing is a real failure, not an edge case.
 */
export function useInstall(): InstallState {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [cannotInstall, setCannotInstall] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const iOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS reports itself as a Mac
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const realSafari =
      /Safari/.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line|MicroMessenger/.test(
        ua
      );

    if (iOSDevice) {
      setIsIOSSafari(realSafari);
      setCannotInstall(!realSafari);
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  return {
    installed,
    canPromptNative: deferred !== null,
    isIOSSafari,
    cannotInstall,
    promptInstall,
  };
}
