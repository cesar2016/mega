/* eslint-env node */
let webpush = null;
try {
  webpush = require("web-push");
} catch (_e) {
  // fallback
}

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://kkoctmvglhjayjtiepgh.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjE3MTA3MCwiZXhwIjoyMTA3NzQ3MDcwfQ.rSyZGjmQot2u1Hz8IHWUPxE9kTIuo4F75-FOBp8JDUg";

const VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
  "BBz6Dwh5UcktW6VQ2WpXM7OpV6qj07Qx2gPlcTq-nRr6BKo5kuvm24m9kmvd0eUrkQdxWLiGlI4crPfhR7eY-co";

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "2X1HqEyuYNhpAoGSW_mFFYbtNZ3RqBwVfBYUmSoKSOY";

if (webpush) {
  try {
    webpush.setVapidDetails(
      "mailto:mganadero.ok@gmail.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } catch (_e) {
    // ignore init error
  }
}

async function registrarSuscripcionBackend({ userId, endpoint, p256dh, auth, userAgent }) {
  if (!userId || !endpoint || !p256dh || !auth) {
    return { ok: false, error: "Datos de suscripción incompletos" };
  }

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_push_subscription`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: userAgent || null,
    }),
  });

  if (rpcRes.ok) {
    return { ok: true };
  }

  // Fallback directo con service_role sobre la tabla push_subscriptions
  const upsertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  return { ok: upsertRes.ok, status: upsertRes.status };
}

async function enviarPushAUsuario({
  userId,
  title,
  body,
  url = "/",
  tag = "mega-notif",
  soundType = "message",
  badgeCount = 1,
}) {
  if (!webpush || !userId) {
    return { sent: 0, error: "web-push no disponible o sin userId" };
  }

  const rpcRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/obtener_push_subscriptions_usuario`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId }),
    }
  );

  if (!rpcRes.ok) {
    return { sent: 0, error: `RPC status ${rpcRes.status}` };
  }

  const subs = await rpcRes.json();
  if (!Array.isArray(subs) || subs.length === 0) {
    return { sent: 0 };
  }

  const payloadStr = JSON.stringify({
    title: title || "Mercado Ganadero",
    body: body || "Tenés una nueva notificación",
    url,
    tag,
    soundType,
    badgeCount: Number(badgeCount) > 0 ? Number(badgeCount) : 1,
    timestamp: Date.now(),
  });

  let enviados = 0;
  await Promise.all(
    subs.map(async (sub) => {
      if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) return;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadStr,
          { TTL: 86400, urgency: "high" }
        );
        enviados += 1;
      } catch (err) {
        const statusCode = err && err.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/eliminar_push_subscription_endpoint`,
            {
              method: "POST",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ p_endpoint: sub.endpoint }),
            }
          ).catch(() => {});
        }
      }
    })
  );

  return { sent: enviados, totalSubs: subs.length };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    // Acción 1: Registrar/actualizar suscripción del dispositivo para el usuario activo
    if (body.action === "subscribe") {
      const subRes = await registrarSuscripcionBackend({
        userId: body.user_id,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        userAgent: body.user_agent,
      });
      return res.status(200).json(subRes);
    }

    // Acción 2: Enviar notificación Web Push al destinatario
    const {
      user_id,
      title,
      message,
      body: bodyText,
      url,
      tag,
      soundType,
      badgeCount,
      delay_ms,
    } = body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    if (delay_ms && Number(delay_ms) > 0 && Number(delay_ms) <= 8000) {
      await new Promise((r) => setTimeout(r, Number(delay_ms)));
    }

    const result = await enviarPushAUsuario({
      userId: user_id,
      title: title || "Mercado Ganadero",
      body: bodyText || message || "Tenés una nueva notificación",
      url: url || "/",
      tag: tag || `mega-${Date.now()}`,
      soundType: soundType || "message",
      badgeCount: badgeCount || 1,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
};

module.exports.enviarPushAUsuario = enviarPushAUsuario;
