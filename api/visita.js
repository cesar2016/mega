/**
 * Vercel Serverless Function: /api/visita
 *
 * Registra cada visita al sitio detectando automáticamente la ubicación
 * geográfica (Ciudad, Provincia/Región, País), IP y dispositivo desde
 * las cabeceras de red de Vercel o geolocalización IP.
 */

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://kkoctmvglhjayjtiepgh.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM0Mzk4OSwiZXhwIjoyMDkxOTE5OTg5fQ.T76 A-cI6x_y-3-c4G-cI6x_y".includes(" ")
    ? process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM0Mzk4OSwiZXhwIjoyMDkxOTE5OTg5fQ.aH2fW2nJ9gY6rU4vK1mP8xL3zQ5wE7tR0yU2iO4pA6s"
    : process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDM5ODksImV4cCI6MjA5MTkxOTk4OX0.R6N5X2sI6X1xP3jB5bW2vY8nL4mK7qR9tZ0wE2yU4iO";

const REGIONES_AR = {
  "B": "Buenos Aires",
  "C": "CABA",
  "K": "Catamarca",
  "H": "Chaco",
  "U": "Chubut",
  "X": "Córdoba",
  "W": "Corrientes",
  "E": "Entre Ríos",
  "P": "Formosa",
  "Y": "Jujuy",
  "L": "La Pampa",
  "F": "La Rioja",
  "M": "Mendoza",
  "N": "Misiones",
  "Q": "Neuquén",
  "R": "Río Negro",
  "A": "Salta",
  "J": "San Juan",
  "D": "San Luis",
  "Z": "Santa Cruz",
  "S": "Santa Fe",
  "G": "Santiago del Estero",
  "V": "Tierra del Fuego",
  "T": "Tucumán",
};

function detectarDispositivo(ua = "") {
  const limpio = String(ua);
  const SO = /Android/i.test(limpio)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(limpio)
      ? "iOS"
      : /Windows/i.test(limpio)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(limpio)
          ? "Mac"
          : /Linux/i.test(limpio)
            ? "Linux"
            : "Web";

  const Nav = /Edg\//i.test(limpio)
    ? "Edge"
    : /Chrome\//i.test(limpio)
      ? "Chrome"
      : /Firefox\//i.test(limpio)
        ? "Firefox"
        : /Safari\//i.test(limpio)
          ? "Safari"
          : "Navegador";

  return `${SO} · ${Nav}`;
}

function decodificarHeader(valor) {
  if (!valor) return "";
  try {
    return decodeURIComponent(String(valor));
  } catch {
    return String(valor);
  }
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

    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded
      ? String(forwarded).split(",")[0].trim()
      : req.headers["x-real-ip"] || req.socket?.remoteAddress || "";

    const paisCode = decodificarHeader(req.headers["x-vercel-ip-country"]);
    const regionCode = decodificarHeader(req.headers["x-vercel-ip-country-region"]);
    const ciudadHeader = decodificarHeader(req.headers["x-vercel-ip-city"]);
    const ua = req.headers["user-agent"] || body.userAgent || "";

    const pais =
      body.pais ||
      (paisCode === "AR" ? "Argentina" : paisCode || "Argentina");

    const provincia =
      body.provincia ||
      (paisCode === "AR" && REGIONES_AR[regionCode] ? REGIONES_AR[regionCode] : regionCode) ||
      "";

    const ciudad = body.ciudad || ciudadHeader || "";
    const dispositivo = body.dispositivo || detectarDispositivo(ua);

    return res.status(200).json({
      ok: true,
      geo: {
        ip: ip || null,
        pais: pais || "Argentina",
        provincia: provincia || null,
        ciudad: ciudad || null,
        dispositivo,
      },
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
};
