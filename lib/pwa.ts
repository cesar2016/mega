import { useEffect, useState } from "react";
import { Platform } from "react-native";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let isStandaloneInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function checkIsStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const mediaMatch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((window.navigator as any)?.standalone);
  return mediaMatch || iosStandalone;
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  isStandaloneInstalled = checkIsStandalone();

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    isStandaloneInstalled = true;
    notifyListeners();
  });
}

export function registerPwaServiceWorker() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
    // Si load ya ocurrió, registrarlo de inmediato
    if (document.readyState === "complete") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }
}

export function isIosDevice(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua);
}

export function usePwaInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    isStandaloneInstalled = checkIsStandalone();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const triggerNativePrompt = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredInstallPrompt) return "unavailable";
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredInstallPrompt = null;
        isStandaloneInstalled = true;
      }
      notifyListeners();
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  };

  return {
    isWeb: Platform.OS === "web",
    isInstalled: isStandaloneInstalled,
    canPromptNatively: Boolean(deferredInstallPrompt),
    isIos: isIosDevice(),
    triggerNativePrompt,
  };
}
