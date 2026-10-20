// Genera dist/seed.html: al abrirlo inyecta una sesión de Supabase en
// localStorage y redirige a la app. Sirve para previsualizar la web
// autenticada (screenshots / debugging) sin tocar la app.
//
//   node scripts/seed-session.mjs [email] [password]
// La ruta de destino se pasa por query: ?ruta=/tabs/perfil
import { readFileSync, writeFileSync } from "node:fs";

const email = process.argv[2] || "vendedor.mercadoganadero@gmail.com";
const password = process.argv[3] || "Prueba12345!";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en .env");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: anonKey },
  body: JSON.stringify({ email, password }),
});
const session = await res.json();

if (!session.access_token) {
  console.error("No se pudo iniciar sesión:", JSON.stringify(session).slice(0, 300));
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const storage = {
  [`sb-${ref}-auth-token`]: JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user,
  }),
};

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>seed</title></head>
<body>
<script>
  const store = ${JSON.stringify(storage)};
  for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  const ruta = new URLSearchParams(location.search).get('ruta') || '/';
  location.replace(ruta);
</script>
</body></html>`;

writeFileSync("dist/seed.html", html);
console.log(`dist/seed.html listo (${email})`);
