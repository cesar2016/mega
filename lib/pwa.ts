import { useEffect, useState } from "react";
import { Platform } from "react-native";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

const STORAGE_HIDE_FOREVER_KEY = "mega_pwa_no_volver_a_mostrar_v1";
const SESSION_LATER_KEY = "mega_pwa_mas_adelante_v1";

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let isStandaloneInstalled = false;
let sheetOpenManual = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function getPromptFromWindow(): BeforeInstallPromptEvent | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  if (window.__deferredPwaPrompt) {
    deferredInstallPrompt = window.__deferredPwaPrompt;
  }
  return deferredInstallPrompt;
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
  if (window.__deferredPwaPrompt) {
    deferredInstallPrompt = window.__deferredPwaPrompt;
  }

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    window.__deferredPwaPrompt = deferredInstallPrompt;
    notifyListeners();
  });

  window.addEventListener("pwa-prompt-ready", () => {
    if (window.__deferredPwaPrompt) {
      deferredInstallPrompt = window.__deferredPwaPrompt;
      notifyListeners();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    window.__deferredPwaPrompt = null;
    isStandaloneInstalled = true;
    sheetOpenManual = false;
    notifyListeners();
  });
}

export function registerPwaServiceWorker() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

export function isIosDevice(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua);
}

export function openPwaInstallSheet() {
  sheetOpenManual = true;
  notifyListeners();
}

export function closePwaInstallSheet(mode: "later" | "never" = "later") {
  sheetOpenManual = false;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SESSION_LATER_KEY, "1");
      if (mode === "never") {
        window.localStorage.setItem(STORAGE_HIDE_FOREVER_KEY, "1");
      }
    } catch {
      // ignore storage errors
    }
  }
  notifyListeners();
}

export function shouldAutoShowPwaSheet(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  if (checkIsStandalone()) return false;
  try {
    if (window.localStorage.getItem(STORAGE_HIDE_FOREVER_KEY) === "1") return false;
    if (window.sessionStorage.getItem(SESSION_LATER_KEY) === "1") return false;
  } catch {
    return false;
  }
  return true;
}

export function usePwaInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    isStandaloneInstalled = checkIsStandalone();
    getPromptFromWindow();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const triggerNativePrompt = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    let promptEvt = getPromptFromWindow();

    // Si el Service Worker recién terminó de registrarse, esperar hasta 1.5s por el evento
    if (!promptEvt && Platform.OS === "web" && typeof window !== "undefined") {
      for (let i = 0; i < 6; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        promptEvt = getPromptFromWindow();
        if (promptEvt) break;
      }
    }

    if (!promptEvt) return "unavailable";

    try {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      if (choice.outcome === "accepted") {
        deferredInstallPrompt = null;
        if (typeof window !== "undefined") {
          window.__deferredPwaPrompt = null;
        }
        isStandaloneInstalled = true;
        sheetOpenManual = false;
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
    canPromptNatively: Boolean(getPromptFromWindow()),
    isIos: isIosDevice(),
    sheetOpenManual,
    triggerNativePrompt,
    openSheet: openPwaInstallSheet,
    closeSheet: closePwaInstallSheet,
  };
}
