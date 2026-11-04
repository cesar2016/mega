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
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjE2NDAsImV4cCI6MjA5MjE5NzY0MH0.N7-m8bQ3kY1Z3Uv_mO2-R4r6J5kY7pW9xQ0vB2nC4eA";

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

async function enviarPushAUsuario({ userId, title, body, url = "/", tag = "mega-notif" }) {
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

  return { sent: enviados };
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
    const { user_id, title, message, body: bodyText, url, tag } = body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await enviarPushAUsuario({
      userId: user_id,
      title: title || "Mercado Ganadero",
      body: bodyText || message || "Tenés una nueva notificación",
      url: url || "/",
      tag: tag || `mega-${Date.now()}`,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
};

module.exports.enviarPushAUsuario = enviarPushAUsuario;
