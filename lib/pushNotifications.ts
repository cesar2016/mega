import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { playMessageSound, playVentaSound } from "lib/sound";

export const VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
  "BBz6Dwh5UcktW6VQ2WpXM7OpV6qj07Qx2gPlcTq-nRr6BKo5kuvm24m9kmvd0eUrkQdxWLiGlI4crPfhR7eY-co";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Actualiza el badge numérico sobre el ícono de la aplicación instalada en el celular
 * (Badging API: navigator.setAppBadge / navigator.clearAppBadge) y el título del documento.
 */
export async function actualizarBadgeIconoApp(totalSinVer: number) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const count = Math.max(0, Math.round(totalSinVer || 0));

  try {
    const nav = window.navigator as any;
    if (count > 0) {
      if (typeof nav.setAppBadge === "function") {
        await nav.setAppBadge(count);
      }
      if (typeof document !== "undefined") {
        document.title = `(${count}) Mercado Ganadero`;
      }
    } else {
      if (typeof nav.clearAppBadge === "function") {
        await nav.clearAppBadge();
      }
      if (typeof document !== "undefined") {
        document.title = "Mercado Ganadero · Compra y venta de hacienda";
      }
    }
  } catch {
    // Ignorar si el sistema operativo no soporta Badging API
  }
}

/**
 * Registra o actualiza la suscripción Web Push del navegador en Supabase (`public.push_subscriptions`)
 * usando tanto la RPC SECURITY DEFINER como el endpoint `/api/push` para que si se cambia de usuario
 * en el mismo celular, el endpoint quede asignado inmediatamente al usuario logueado actual.
 */
export async function sincronizarSuscripcionPush(userId?: string | null): Promise<boolean> {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    !userId ||
    !isSupabaseConfigured
  ) {
    return false;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  try {
    await navigator.serviceWorker.register("/sw.js").catch(() => {});
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) return false;

    // 1. Vía RPC SECURITY DEFINER (permite reasignar el dispositivo si cambió de cuenta)
    try {
      await supabase.rpc("registrar_push_subscription", {
        p_user_id: userId,
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: navigator.userAgent || null,
      });
    } catch {
      // ignorar y usar respaldo /api/push
    }

    // 2. Respaldo directo vía /api/push con service_role
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent || null,
      }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Solicita permiso de notificaciones al navegador y, si el usuario acepta,
 * registra automáticamente su suscripción Web Push en segundo plano.
 */
export async function solicitarPermisoPushYSuscribir(
  userId?: string | null
): Promise<NotificationPermission | "unsupported"> {
  if (Platform.OS !== "web" || typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted" && userId) {
      await sincronizarSuscripcionPush(userId);
    }
    return perm;
  } catch {
    return "denied";
  }
}

/**
 * Muestra una notificación nativa del sistema a través del Service Worker
 * cuando el usuario recibe un evento y tiene la pestaña en segundo plano.
 */
export async function mostrarNotificacionSistema({
  title,
  body,
  url = "/",
  tag = "mega-notif",
  soundType = "message",
}: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  soundType?: "message" | "venta";
}) {
  if (Platform.OS !== "web" || typeof window === "undefined" || !("Notification" in window)) {
    return;
  }
  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: soundType === "venta" ? [400, 150, 400, 150, 600] : [250, 120, 250],
        data: { url, soundType },
      } as any);
      return;
    }
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag,
    });
  } catch {
    // ignore notification errors
  }
}

/**
 * Envía una notificación Web Push remota (vía `/api/push`) a todos los dispositivos
 * del usuario destinatario para que le llegue aún con la app cerrada.
 */
export async function enviarPushRemoto({
  userId,
  title,
  body,
  url = "/",
  tag,
  soundType = "message",
  badgeCount = 1,
  delayMs,
}: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  soundType?: "message" | "venta";
  badgeCount?: number;
  delayMs?: number;
}) {
  if (!userId) return;
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        title,
        body,
        url,
        tag: tag || `mega-${Date.now()}`,
        soundType,
        badgeCount,
        delay_ms: delayMs,
      }),
    });
  } catch {
    // No bloquear el flujo principal si falla la red
  }
}

/**
 * Hook que sincroniza la suscripción Web Push cuando el usuario inicia sesión,
 * escucha mensajes del Service Worker para reproducir sonidos cuando la app está en segundo plano,
 * y solicita permiso en la primera interacción si todavía está en 'default'.
 */
export function usePushNotificationsBootstrap(userId?: string | null) {
  const [permiso, setPermiso] = useState<string>("default");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Si se abrió la app tocando una notificación push (?fromPush=message|venta)
    try {
      const params = new URLSearchParams(window.location.search);
      const fromPush = params.get("fromPush");
      if (fromPush === "venta") {
        setTimeout(() => playVentaSound(), 400);
      } else if (fromPush === "message") {
        setTimeout(() => playMessageSound(), 400);
      }
    } catch {
      // ignore
    }

    if (!("serviceWorker" in navigator)) return;

    const onSwMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data) return;
      if (data.type === "MEGA_PUSH_RECEIVED" || data.type === "MEGA_PUSH_CLICKED") {
        if (data.soundType === "venta") {
          playVentaSound();
        } else {
          playMessageSound();
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    setPermiso(Notification.permission);

    if (!userId) return;

    if (Notification.permission === "granted") {
      void sincronizarSuscripcionPush(userId);

      const resyncOnFocus = () => {
        if (document.visibilityState === "visible") {
          void sincronizarSuscripcionPush(userId);
        }
      };
      document.addEventListener("visibilitychange", resyncOnFocus);
      return () => {
        document.removeEventListener("visibilitychange", resyncOnFocus);
      };
    }

    if (Notification.permission === "default") {
      const handleFirstInteraction = async () => {
        window.removeEventListener("click", handleFirstInteraction);
        window.removeEventListener("touchstart", handleFirstInteraction);
        const nuevoPermiso = await solicitarPermisoPushYSuscribir(userId);
        setPermiso(nuevoPermiso);
      };

      window.addEventListener("click", handleFirstInteraction, { once: true, passive: true });
      window.addEventListener("touchstart", handleFirstInteraction, { once: true, passive: true });

      return () => {
        window.removeEventListener("click", handleFirstInteraction);
        window.removeEventListener("touchstart", handleFirstInteraction);
      };
    }
  }, [userId]);

  return { permiso };
}
