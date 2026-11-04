import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase, isSupabaseConfigured } from "lib/supabase";

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
 * Registra o actualiza la suscripción Web Push del navegador en Supabase (`public.push_subscriptions`)
 * para que el usuario reciba notificaciones aún con la aplicación cerrada.
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

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Solicita permiso de notificaciones al navegador y, si el usuario acepta,
 * registra automáticamente su suscripción Web Push en segundo plano.
 */
export async function solicitarPermisoPushYSuscribir(userId?: string | null): Promise<NotificationPermission | "unsupported"> {
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
}: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
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
        data: { url },
      });
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
}: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
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
      }),
    });
  } catch {
    // No bloquear el flujo principal si falla la red
  }
}

/**
 * Hook que sincroniza la suscripción Web Push cuando el usuario inicia sesión
 * y solicita permiso en la primera interacción si todavía está en 'default'.
 */
export function usePushNotificationsBootstrap(userId?: string | null) {
  const [permiso, setPermiso] = useState<string>("default");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    setPermiso(Notification.permission);

    if (!userId) return;

    if (Notification.permission === "granted") {
      void sincronizarSuscripcionPush(userId);
      return;
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
