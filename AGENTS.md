# AGENTS.md

Mercado Ganadero — marketplace de hacienda (Argentina). Stack: **Expo SDK 52 / React Native 0.76 / expo-router v4 / TypeScript strict / NativeWind 4 (Tailwind 3)**, backend **Supabase** (Postgres + PostGIS, RLS) + una Edge Function Deno. Web exportada como SPA/PWA en **Vercel** (proyecto `mercadoganadero`) con funciones serverless en `api/`.

Dominio en español: roles `productor | comprador | fletero | admin`, tablas `ofertas`, `demandas`, `matches`, `solicitudes_flete`, `conversaciones`, `mensajes`, `operaciones`. Git: `git@github.com:cesar2016/mega.git` (ya inicializado, `origin` configurado).

## Comandos

```bash
npm run web          # expo start --web -> http://localhost:8081
npm run typecheck    # tsc --noEmit (NO cubre api/ ni scripts/)
npm run lint         # eslint . (0 errores; quedan warnings conocidos)
npm run build:web    # expo export --platform web + scripts/inject-og.mjs -> dist/
npm run build        # alias de build:web
npm run preview:web  # node scripts/serve.mjs 8101 (fallback SPA sobre dist/)
```

- **No hay framework de tests ni script `test`.** Verificá con `npm run typecheck` + `npm run lint` y corriendo la app. `lint` tiene warnings (unused vars en `api/visita.js`, `OfferCreateScreen`, `SuperAdminScreen`, `upload.ts`); no son errores.
- `./scripts/test-migrations.sh` corre **todas** las migraciones contra el Postgres del stack local (puerto 54322, base descartable `mg_test`). Usalo **antes** de `supabase db push`.
- `node scripts/seed-session.mjs [email]` genera `dist/seed.html` e inyecta una sesión en `localStorage`; `scripts/shot.sh` e `scripts/inspect.mjs` hacen capturas/inspección con Chrome headless. `dist/` y `dist/seed.html` son artefactos locales (gitignored).

## Entrypoints y routing

Los archivos de `app/` son **wrappers finos** (`export { default } from "features/..."`); las pantallas viven en `features/<area>/`.

```
app/_layout.tsx              Stack + QueryClientProvider + sesión + PWA/SW + push + visita + ToastHost
app/index.tsx                feed público (NO redirige); tiene su propia barra mobile
app/auth/_layout.tsx         useGuestRedirect: si ya hay sesión, sale de /auth
app/onboarding.tsx           features/onboarding/OnboardingScreen
app/(main)/_layout.tsx       onboarding incompleto -> /onboarding; sidebar (>=1024) o Stack mobile
app/(main)/tabs/_layout.tsx  Tabs (feed|matches|ofertas|operaciones|demandas|chat|perfil|superadmin)
app/(main)/oferta-nueva.tsx  features/offers/OfferCreateScreen (modal en mobile)
app/(main)/oferta/[id].tsx   features/offers/OfferDetailScreen (modal en mobile)
app/(main)/operaciones.tsx   alias de features/offers/OfertasScreen
app/+html.tsx                <head> de la web (PWA/manifest/meta); se re-inyecta en el build
```

- **Visitantes anónimos pueden navegar el feed y el detalle de ofertas** si Supabase está configurado. `(main)/_layout.tsx` les muestra `PublicTopNavbar` + `Slot`; las acciones y las demás pestañas redirigen a `/auth` con `returnUrl`. No agregues guards globales que vuelvan a bloquear el feed.
- `components/layout/navItems.ts` → `NAV_ITEMS` es la **fuente única** de navegación (sidebar, tab bar y `Tabs`): feed, matches, ofertas, operaciones, demandas, chat, perfil y superadmin. `superadmin` sólo se muestra con `isSuperAdmin()` (`lib/superAdmin.ts`, `public.es_super_admin()`); no dupliques la lista en otro archivo.
- En modo demo (sin Supabase configurado), `app/_layout.tsx` inyecta un `DEMO_USER` y `store/authStore.ts` un perfil sintético; `lib/supabase.ts` expone `isSupabaseConfigured` (false si la URL contiene `tu-proyecto`/`placeholder`/`TU_PROYECTO`).
- `lib/hooks/useAuthRedirect.tsx` tiene tres guards distintos (`useAuthRedirect`, `useGuestRedirect`, `useOnboardingRedirect`); no los mezcles.
- Los grupos no aparecen en la URL real: `/tabs/feed`, `/tabs/perfil`, `/oferta/:id`, `/oferta-nueva`. Los hrefs internos pueden usar `/(main)/tabs/...`.

## Web, Vercel y PWA

- `vercel.json` sirve `dist/`, reescribe **`/oferta/:id` -> `/api/oferta?id=:id`** (preview Open Graph dinámico) y `/api/*`. Si tocás los rewrites se pierde el OG de las publicaciones compartidas.
- `scripts/inject-og.mjs` corre **después** de `expo export`: copia assets de `public/` (manifest, `sw.js`, iconos, sonidos, banners), y **borra y re-inyecta** `<title>`, `description`, OG/Twitter y el manifest en `dist/index.html`. Si cambiás meta/PWA, actualizá **también** `app/+html.tsx`, porque el script pisa lo que haya.
- `public/` se sirve en la raíz (`/manifest.json`, `/sw.js`, `/icons/...`, `/sound/...`, `/videos/hacienda-bg.mp4`). Si cambiás la lista de precache de `public/sw.js`, subí `CACHE_NAME` para invalidar el service worker viejo.
- `api/` son funciones **Node CommonJS** de Vercel, no TypeScript: `tsconfig.include` no las cubre, pero `eslint .` sí las lintea.
  - `api/oferta.js`: devuelve HTML con OG/Twitter de la oferta (lee `dist/index.html`); `api/og-image.js` genera la imagen con `sharp`.
  - `api/comprar.js`: marca la oferta como `vendida`, inserta en `operaciones` y manda emails (Gmail SMTP o Resend).
  - `api/push.js`: Web Push con `web-push`/VAPID. `api/visita.js`: registra visitas del sitio.
- PWA instalable: `lib/pwa.ts` (prompt de instalación, standalone, service worker), `components/pwa/InstallAppButton.tsx` (sheet montado en el root) y `public/manifest.json`.
- Push y sonidos: `lib/pushNotifications.ts` (suscripción, badge del ícono, notificación de sistema) y `lib/sound.ts` (zustand + `localStorage`; se configura en Perfil).

## Requisitos de setup (si falta alguno, se rompe el build)

- **`package.json` debe mantener `"main": "expo-router/entry"`.** Sin eso Expo resuelve `expo/AppEntry.js`, que importa un `App.js` inexistente → `Unable to resolve "../../App"`.
- **Versiones de SDK 52.** Tras cambiar dependencias corré `npx expo install --fix`: `react-native@0.76.9`, `expo-asset@~11.0.5`, `expo-image-picker@~16.0.6`, `expo-sqlite@~15.1.4`, `react-native-web@~0.19.13`, `@react-native-async-storage/async-storage@1.23.1`.
- **`query-string@^7`** debe ser dependencia directa (`expo-router@4` lo importa sin declararlo). No subir a v8+: es ESM-only y el interop deja `queryString.parse === undefined`.
- **`react-native-css-interop` y `react-native-reanimated` (~3.16.1) top-level**: el preset `nativewind/babel` resuelve ambos desde la raíz; si quedan anidados, Babel falla (`react-native-css-interop/jsx-runtime` o el plugin de reanimated).
- **`react-native-screens` ~4.4.0**: con 4.30 el codegen de RN 0.76 revienta con `Unknown prop type for "onAppear"`.
- `react-dom`, `react-native-web`, `expo-font` y `expo-asset` deben ser dependencias directas. `assets/` debe tener `icon.png` y `splash.png`.
- El plugin de expo-router en `app.json` **no debe setear `root`**.
- `tsconfig.include` es `app`, `components`, `features`, `lib`, `store`, `nativewind-env.d.ts`. Un directorio nuevo de primer nivel hay que agregarlo o `tsc` no lo revisa. Usá los alias `lib/*`, `features/*`, `store/*`, `components/*` (Metro respeta `tsconfig.paths`).

## Estilos: Tailwind + NativeWind

Todo el styling es Tailwind vía NativeWind v4 (mismo `className` en web y nativo). No uses `StyleSheet.create` salvo estilos dinámicos que no dependan del theme.

- Setup que no se toca: `babel.config.js` (`jsxImportSource: "nativewind"` + preset), `metro.config.js` (`withNativeWind`), `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`.
- Colores en `tailwind.config.js` (`theme.extend.colors`): `canvas`, `surface`, `surface-soft`, `surface-sunk`, `line`, `line-soft`, `ink` (+`soft`/`muted`) y escalas `sage`, `clay`, `sky`, `wheat` (desaturadas a propósito).
- **Clases literales**: Tailwind escanea el código; `text-${color}-500` no compila. Para colores dinámicos mapeá a clases completas.
- `shadow-soft`/`shadow-card`/`shadow-lift` y `rounded-xl/2xl/3xl` son el design system.
- **`hidden md:flex`**: `hidden` es `display:none`; para volver a mostrar hace falta `display:flex` (no alcanza `md:flex-row`).
- En nativo los breakpoints no se recalculan: la navegación de escritorio se decide en runtime con `useResponsive()` (`isWide >=1024`, `isTablet >=768`).
- Grillas con `components/ui/Grid.tsx` (1/2/3 columnas). **No uses `FlatList` con `numColumns`** dentro del `ScrollView` de `Screen`: anida mal y en web reparte mal el ancho.
- `components/ui/`: `Button` (+`IconButton`), `Input`, `Card` (+`Badge`, `SectionHeader`), `Screen` (+`Gradient`), `Avatar` (+`EmptyState`), `Grid`, `Icon`, `Toast`, `Logo`, `MediaCover`, `BackgroundVideo`, `SocialIcons`.

**Iconos Lucide**: agregá el nombre a `components/ui/Icon.types.ts` (`IconName`) e importalo en **los dos** registries (`Icon.registry.ts` nativo y `Icon.registry.web.ts`). No uses `@expo/vector-icons`.

## Layout y matches

- `lib/hooks/useResponsive.ts` → `{ width, height, isWeb, isWide (>=1024), isTablet (>=768), isCompact }`. En nativo siempre es compacto. `components/ui/Screen.tsx` fija el ancho máximo `max-w-shell` (1280 px) y el header estándar.
- `lib/hooks/useMatches.ts`: `useMatches`, `actualizarEstadoMatch` y `usePendientesMatch`. El select embebe `ofertas` + `demandas` + `profiles` + `oferta_media`; la RLS ya filtra por parte (productor de la oferta o comprador de la demanda). La contraparte se decide en runtime comparando `match.ofertas.productor_id` con el perfil.
- `lib/matching.ts` replica el puntaje de Postgres (categoría 30, raza 20, distancia 30, peso 15, precio 5) para explicar cada cruce; `decodeGeografia` deserializa el WKB hex de `geography` y `distanciaKm` es Haversine.
- Badges de no vistos: `store/notificacionesStore.ts` + hooks de chat/matches/operaciones; `actualizarBadgeIconoApp()` actualiza el badge del ícono PWA.

## Estado y convenciones

- zustand es la fuente de estado: `store/authStore.ts` (persist, key `mercado-ganadero-auth`; también aplana `cuit`/`verificado`/`radio_km`), `store/toastStore.ts`, `store/notificacionesStore.ts` (badges vistos) y `lib/sound.ts`. No reintroduzcas redux ni un segundo store de auth.
- `lib/utils.ts`: `showToast(mensaje, "success" | "error" | "info")`; `validarNombreUsuario()` (mín. 8, sin espacios, con número y carácter especial) y `isValidCuitFormat()` (`00-12345678-0`).
- Formularios con **react-hook-form + zod**: schema arriba del archivo, validación manual con `Schema.parse(form.getValues())` (no está `@hookform/resolvers`) y `form.watch()` para inputs controlados.
- Comentarios, copy de UI e identificadores de BD en **español**.
- `lib/contactFilter.ts` replica en el cliente el filtro anti-fuga de teléfonos/emails/redes/CUIT. La regla real está en triggers de Postgres (`trg_validar_mensaje_sin_contacto`, `trg_validar_oferta_sin_contacto`); si cambiás una, cambiá la otra.
- `lib/hooks/useOfferDB.ts` refresca cada 60 s; los hooks se desactivan solos en modo demo. `useDemandasActivas` está en `useDemandaDB.ts`.
- `useOfferMedia` exporta `MAX_IMAGES` (5), `MAX_VIDEOS` (2), `MAX_VIDEO_DURATION` (**20 s**) y `MAX_VIDEO_SIZE` (50 MB); `totalMedia` es una **función**.
- `tipo_precio` es `por_kilo | por_cabeza | a_convenir` (valores exactos del enum). La publicación inserta la oferta y sus filas de `oferta_media`; la primera foto es portada por defecto.
- Uploads (`lib/upload.ts`): bucket público `oferta_media`, key `{userId}/{uuid}.{ext}`, `contentType` con el mime real (no `image/*`). En web el picker devuelve `data:` URI: hay que decodificarlo a `Blob` con `toUploadBody()`. `extractVideoThumbnailBlob()` genera la miniatura para OG.
- `ImagePicker` viene de `expo-image-picker`; usá `mediaTypes: ["images"]`/`["videos"]` (`MediaTypeOptions` está deprecado) y validá la duración.

## Base de datos y migraciones

**`supabase/schema.sql` es referencia, NO una migración** (tiene SQL inválido: `CREATE_TYPE`, `CREATE POLIC`, `producer_id` vs `productor_id`, `UNIQUE(...COALESCE(...))`). El schema real es `supabase/migrations/`, ya aplicado al proyecto `mega` (ref `kkoctmvglhjayjtiepgh`).

| Migración | Qué aporta |
|---|---|
| `...000000_init_schema` | tablas, índices, RLS, view `view_matching_candidatos`, `handle_new_user`, RPCs de onboarding |
| `...010000` – `...070000` | cron de matching, triggers instantáneos, `email_confirmado()`, fix de RPCs, sync de email, `oferta_media.es_portada` + bucket, matching `SECURITY DEFINER` + `proteger_match_inmutable` |
| `...080000` | videos de hasta 20 s en `oferta_media` |
| `...090000` | **unifica `productor` y `comprador`**: ambos publican ofertas y demandas y tienen fila en `productores`; el alta crea `rol='productor'` |
| `...100000` | `productores`/`fleteros` pasan a ser privados (sólo el titular los lee) |
| `...110000` | chat interno (`conversaciones`, `mensajes`), triggers anti-contacto, `iniciar_o_abrir_conversacion()` |
| `...120000` | leído/no leído y notificaciones de mensajes |
| `...130000` | lectura **anónima** de ofertas activas y su media (OG y visitantes) |
| `...140000` | estado de oferta `vendida` |
| `...150000` | tabla `operaciones` + `ofertas.comprador_id`/`fecha_venta` |
| `...160000` | permitir leer ofertas vendidas |
| `...170000` | índices únicos de `profiles.cuit` y `profiles.nombre` + RPC `verificar_disponibilidad` |
| `...180000` | campos completos en `profiles` + lectura pública de `profiles` |
| `...190000` | `oferta_likes`, `oferta_visitas` y bloqueo de edición de ofertas vendidas |
| `...200000` | resetea ventas y renombra al vendedor de prueba a `mganadero.ok@gmail.com` |
| `...210000` | SuperAdmin exclusivo + `sitio_visitas` + RPCs `obtener_usuarios_superadmin`/`obtener_visitas_superadmin` |
| `...220000` | `push_subscriptions` + RPCs de lectura/eliminación |
| `...230000` | RPC `registrar_push_subscription` |

Facts que suelen morder:

- **El check de email confirmado NO puede leer el claim del JWT** (`auth.jwt()->>'email_confirmed_at'`): con las claves nuevas ese claim no existe y todas las políticas quedan en `false`. Usá `public.email_confirmado()` (`SECURITY DEFINER` sobre `auth.users`). No volver al claim.
- **El matching debe ser `SECURITY DEFINER`**: `calcular_matches_oferta()`/`calcular_matches_demanda()` corren en el trigger del INSERT del cliente; con permisos de invocante el INSERT en `matches` viola RLS y **falla la publicación entera**. `matches` tampoco tiene policy de INSERT (el puntaje lo calcula el servidor). Sólo se puede cambiar `estado` (`pendiente|aceptado|rechazado|finalizado`); `oferta_id`, `demanda_id` y `puntaje` son inmutables por trigger.
- **`productor` y `comprador` son equivalentes** para operar: cualquier usuario no-fletero puede vender y comprar. `fletero` es la única figura separada. No escribas lógica que asuma que sólo `productor` publica ofertas.
- `profiles` es de lectura pública; `productores` y `fleteros` son privados (CUIT, RENSPA, establecimiento, radio). No intentes leer datos fiscales de otro usuario: no vas a poder.
- `ofertas` **no tiene FK a `productores`**: embebé `profiles!productor_id (...)`; `productores (*)` falla con *"Could not find a relationship..."*.
- RLS exige email confirmado. `mailer_autoconfirm: false`, SMTP por defecto limitado (~2-3 emails/hora): para dev, confirmá el email o desactivá "Confirm email" en el dashboard.
- `solicitudes_flete` no tiene `fletero_id` (la policy usa `EXISTS` sobre `ofertas_flete`).
- `config.toml` declara `[db.seed] sql_paths = ["./seed.sql"]` pero ese archivo no existe: `supabase db reset` falla. `major_version = 17` (el Docker local debe coincidir). `pg_cron` no está habilitado: la migración avisa y sigue.
- Operaciones: `api/comprar` marca la oferta vendida e inserta en `operaciones`; si el endpoint no está disponible, `PurchaseModal` hace el fallback con Supabase. Una oferta vendida no se puede editar.
- Likes/visitas: `oferta_likes` y `oferta_visitas`; la visita se cuenta a partir de ~30 s (`lib/hooks/useOfertaInteracciones.ts`). `superadmin` ve usuarios y visitas del sitio (`sitio_visitas`, alimentada por `/api/visita`).
- Push: tabla `push_subscriptions`; el cliente registra vía RPC `registrar_push_subscription` y `/api/push`; el handler `push` de `public/sw.js` muestra la notificación y actualiza el badge.

## Supabase CLI y Edge Function

| Script | Notas |
|---|---|
| `npm run db:migrate` | `supabase db push` (remoto, proyecto linkeado) |
| `npm run db:migrate:status` | `supabase migration list` |
| `npm run db:reset` | `supabase db reset` (local, Docker; falla por el seed faltante) |
| `npm run function:deploy` | `supabase functions deploy` (subcomando plural) |
| `npm run function:logs` | `supabase functions logs` |

- `supabase/functions/matching-refine/index.ts` es Deno y **no lo cubren `tsc` ni ESLint** (`.eslintrc.js` ignora `/supabase/functions/*`).
- Ese código llama `supabase.rpc("view_matching_candidatos")`, pero es una **VIEW**: usá `.from("view_matching_candidatos").select("*")`.
- Secrets: `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`. Deploy: `supabase functions deploy matching-refine` (`--no-verify-jwt` si la llama un cron).

## Env vars y secretos

- Sólo `EXPO_PUBLIC_*` llega al bundle del cliente (babel-preset-expo). `lib/supabase.ts` lee `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Nunca metas `SUPABASE_SERVICE_ROLE_KEY` en código cliente**: el bundle web es público. El service role sólo va en `api/` (serverless) y en la Edge Function.
- `api/` también usa `EXPO_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (push), y `GMAIL_USER`/`GMAIL_APP_PASSWORD` o `SMTP_*`/`RESEND_API_KEY` (emails de compra). Configuralos en Vercel.
- **Gotcha de seguridad**: hoy `api/comprar.js`, `api/push.js` y `api/visita.js` tienen fallbacks hardcodeados de service_role/SMTP/VAPID. En producción hay que setear las env vars y no seguir agregando secretos al repo.
- `.env.example` está desactualizado (sólo Supabase). La lista real está en `.env`/`.env.local` (gitignored) y en Vercel. No commitees `.env*`.
- `type Database` no lo exporta `@supabase/supabase-js`; el cliente quedó sin tipar. Si querés tipos, generá `lib/database.types.ts` con `supabase gen types typescript --project-id <ref>`.

## Cuentas de prueba (proyecto `mega`)

Contraseña histórica `Prueba12345!` (verificala; los emails sí están confirmados y con onboarding completo):

| Rol | Email | Datos |
|---|---|---|
| vendedor + SuperAdmin (`Mega.Oficial_1`) | `mganadero.ok@gmail.com` | la migración `...200000` renombró la cuenta; `scripts/seed-session.mjs` todavía defaultea al email viejo `vendedor.mercadoganadero@gmail.com` |
| comprador | `comprador.mercadoganadero@gmail.com` | 1 demanda activa (Novillos, 400-500 kg, hasta $2700, radio 150 km, Córdoba) |
| transportista (fletero) | `transportista.mercadoganadero@gmail.com` | `fleteros`: radio 250 km, verificado |

Datos sembrados: 2 ofertas de Novillos (12 cab., 430 kg, $2500, Córdoba/Río Cuarto) del vendedor y 1 demanda del comprador; el matching genera 2 `matches` con puntaje 80. Para crear usuarios, usá `POST /auth/v1/admin/users` con la service_role y `email_confirm: true`; sin email confirmado las políticas RLS bloquean todo.

## Git

- El repo ya existe (`origin` en GitHub). `dist/`, `.expo/`, `supabase/.temp/`, `.env*` y `.vercel/` están gitignored.
- `dist/seed.html` y cualquier artefacto de `scripts/` no se commitea. No commitear credenciales ni los fallbacks de `api/`.
