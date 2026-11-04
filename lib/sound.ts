import { Platform } from "react-native";
import { create } from "zustand";

const STORAGE_KEY = "mega_sound_settings_v1";

export type SoundSettingsState = {
  enabled: boolean;
  volume: number; // 0 a 100
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
};

function loadInitialSettings(): { enabled: boolean; volume: number } {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
          volume:
            typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 100
              ? parsed.volume
              : 80,
        };
      }
    } catch {
      // ignore storage errors
    }
  }
  return { enabled: true, volume: 80 };
}

function saveSettings(enabled: boolean, volume: number) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ enabled, volume })
      );
    } catch {
      // ignore storage errors
    }
  }
}

const initial = loadInitialSettings();

export const useSoundStore = create<SoundSettingsState>((set, get) => ({
  enabled: initial.enabled,
  volume: initial.volume,
  setEnabled: (enabled: boolean) => {
    saveSettings(enabled, get().volume);
    set({ enabled });
  },
  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    saveSettings(get().enabled, clamped);
    set({ volume: clamped });
  },
}));

export type SoundType = "message" | "venta";

const SOUND_PATHS: Record<SoundType, string> = {
  message: "/sound/message.mp3",
  venta: "/sound/venta.mp3",
};

const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {};
let audioUnlocked = false;

if (Platform.OS === "web" && typeof window !== "undefined") {
  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      for (const tipo of ["message", "venta"] as SoundType[]) {
        const a = new Audio(SOUND_PATHS[tipo]);
        a.preload = "auto";
        audioCache[tipo] = a;
      }
    } catch {
      // ignore
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

/**
 * Reproduce el sonido configurado ('message' o 'venta') respetando la configuración
 * de activación y volumen elegida por el usuario en su perfil.
 */
export function playAppSound(type: SoundType, options?: { force?: boolean }) {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof Audio === "undefined") {
    return;
  }

  const { enabled, volume } = useSoundStore.getState();
  if (!options?.force && (!enabled || volume <= 0)) {
    return;
  }

  const effectiveVolume = Math.max(0, Math.min(1, (volume > 0 ? volume : 80) / 100));

  try {
    const src = SOUND_PATHS[type];
    const audio = new Audio(src);
    audio.volume = effectiveVolume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Si el navegador bloquea autoplay, reintentar con instancia en caché
      const cached = audioCache[type];
      if (cached) {
        cached.volume = effectiveVolume;
        cached.currentTime = 0;
        void cached.play().catch(() => {});
      }
    });
  } catch {
    // ignore audio playback error
  }
}

export function playMessageSound(options?: { force?: boolean }) {
  playAppSound("message", options);
}

export function playVentaSound(options?: { force?: boolean }) {
  playAppSound("venta", options);
}
