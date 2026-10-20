# AGENTS.md

Mercado Ganadero — livestock (cattle) marketplace. Stack: **Expo SDK 52 / React Native 0.76 / expo-router v4 / TypeScript strict / NativeWind 4 (Tailwind CSS 3)**, backend **Supabase** (Postgres + PostGIS, RLS) con una **Deno edge function**. Dominio en español: roles `productor | comprador | fletero | admin`, tablas `ofertas`, `demandas`, `matches`, `solicitudes_flete`.

## Levantar la app (web)

```bash
npm run web          # expo start --web  -> http://localhost:8081
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build:web    # expo export --platform web  -> dist/ (SPA)
npm run preview:web  # node scripts/serve.mjs 8101 (servidor estático con fallback SPA)
```

Los tres pasan hoy. `npx expo export --platform web` también genera un SPA funcional en `dist/`.

**Proyecto Supabase**: `mega` / ref `kkoctmvglhjayjtiepgh` (East US). Ya está linkeado (`supabase/.temp/project-ref`). Las credenciales viven en `.env` (gitignored).

**Sin credenciales reales** la app arranca en "modo demo": `lib/supabase.ts` exporta `isSupabaseConfigured`, false mientras la URL contenga un placeholder (`tu-proyecto`, `placeholder`, `TU_PROYECTO`). En modo demo hay un perfil sintético, el guard de auth no bloquea y no se dispara ninguna query.

## Estilos: Tailwind + NativeWind

Todo el styling es **Tailwind vía NativeWind v4** (mismo `className` en web y nativo). No usar `StyleSheet.create` salvo para estilos dinámicos que no dependan del theme.

Archivos del setup (no borrar):

| Archivo | Para qué |
|---|---|
| `babel.config.js` | `babel-preset-expo` con `jsxImportSource: "nativewind"` + preset `nativewind/babel` |
| `metro.config.js` | `withNativeWind(config, { input: "./global.css" })` |
| `tailwind.config.js` | `content` (app/components/features/lib) + `presets: [nativewind/preset]` + paleta propia |
| `global.css` | `@tailwind base/components/utilities` + reset de scrollbar y tipografía (aplica sólo en web) |
| `nativewind-env.d.ts` | tipos de `className` en los componentes de RN |

Reglas:

- **Los colores viven en `tailwind.config.js` (`theme.extend.colors`)**: `canvas`, `surface`, `surface-soft`, `surface-sunk`, `line`, `line-soft`, `ink` (+`soft`/`muted`) y las escalas `sage` (principal), `clay` (acento), `sky` (informativo) y `wheat` (avisos). Son tonos desaturados/"difuminados" a propósito.
- **Clases siempre literales.** Tailwind escanea el código fuente: `text-${color}-500` no se compila. Si el color es dinámico, mapear a clases completas en un objeto.
- `shadow-soft` / `shadow-card` / `shadow-lift` reemplazan las sombras por defecto; `rounded-xl/2xl/3xl` son los radios del design system.
- `focus-within:` funciona en los inputs custom (`components/ui/Input.tsx`); `active:` funciona en `Pressable`.
- **`hidden md:flex`**: `hidden` pone `display:none`; para volver a mostrar hace falta `display:flex` (no alcanza `md:flex-row`).
- En nativo, `md:`/`lg:` no se recalculan: el breakpoint se resuelve una vez. Por eso la navegación de escritorio se decide en runtime con `useResponsive()`.

## Iconos

Set único de iconos Lucide, con el color controlado por clases de Tailwind.

- `components/ui/Icon.types.ts` — `IconName` (union) + `IconComponent`.
- `components/ui/Icon.registry.ts` — registro **nativo**: `lucide-react-native` envuelto con `cssInterop(..., { className: { target: "style", nativeStyleToProp: { color: true } } })` para que `color` del style llegue al prop `color` (que Lucide usa como `stroke`).
- `components/ui/Icon.registry.web.ts` — registro **web**: `lucide-react` pelado (el `className` va al `<svg>` del DOM y la propiedad CSS `color` alimenta `stroke="currentColor"`).
- `components/ui/Icon.tsx` — `<Icon name="store" size={18} className="text-sage-600" />`. El registry se resuelve por plataforma (`.web.ts`).

Para agregar un icono: importarlo en **los dos** registries y sumar el nombre a `IconName`. No usar `@expo/vector-icons` (quedó sin uso).

## Layout responsive

- `lib/hooks/useResponsive.ts` → `{ width, height, isWeb, isWide (>=1024), isTablet (>=768), isCompact }`. En nativo siempre es "compacto".
- `app/(main)/_layout.tsx`: en escritorio (`isWide`) renderiza **sidebar + `<Slot />`** (el sidebar acompaña también al formulario de publicación); en mobile/tablet renderiza el `Stack` con `oferta-nueva` como modal nativo.
- `app/(main)/tabs/_layout.tsx`: `Tabs` con `tabBar` propio. En escritorio devuelve `null` (la navegación ya está en el sidebar); en mobile usa `components/layout/MobileTabBar.tsx`.
- `components/layout/AppSidebar.tsx`: navegación lateral (web). `components/layout/navItems.ts` es la **fuente única** de las entradas de navegación (compartida por el sidebar y las pestañas).
- `components/layout/MobileTopBar.tsx`: barra superior compacta (sólo mobile) con marca, saludo y acción.
- `components/ui/Screen.tsx`: esqueleto de página — ancho máximo `max-w-shell` (1280px), padding responsive, header con eyebrow/título/subtítulo/acción.
- Grillas: columnas según `width` (`>=1280` → 3, `>=768` → 2, si no 1) usando `components/ui/Grid.tsx` (no `FlatList` con `numColumns`: anida mal dentro del `ScrollView` de `Screen` y en web reparte mal el ancho).

## Componentes de UI

`components/ui/`: `Button` (+`IconButton`, `ButtonRow`), `Input`, `Card` (+`Badge`, `SectionHeader`), `Screen` (+`Gradient`), `Avatar` (+`EmptyState`), `Grid`, `Icon`, `Toast`.

- `Gradient` envuelve `expo-linear-gradient` con los degradados suaves del header.
- `Grid` es la grilla de tarjetas (`columns` = 1/2/3 según el ancho). **No usar `FlatList` con `numColumns`**: dentro de un `ScrollView` anida mal y en web las celdas reparten el ancho de forma irregular.
- Los toasts son reales: `store/toastStore.ts` (zustand) + `components/ui/Toast.tsx` (montado en `app/_layout.tsx`). `lib/utils.ts` `showToast` empuja al store.

## Requisitos de setup (si falta alguno, se rompe el build)

- **`package.json` debe mantener `"main": "expo-router/entry"`.** Sin eso Expo resuelve `expo/AppEntry.js`, que importa un `App.js` inexistente → `Unable to resolve "../../App"`.
- **Las versiones de paquetes deben corresponder a SDK 52.** El scaffold traía `expo-asset@58`, `expo-image-picker@58` (versiones de SDK 54+). Correr `npx expo install --fix` tras cambiar dependencias: deja `react-native@0.76.9`, `expo-asset@~11.0.5`, `expo-image-picker@~16.0.6`, `expo-sqlite@~15.1.4`, `@react-native-async-storage/async-storage@1.23.1`.
- **`query-string@^7.1.1` debe ser dependencia directa.** `expo-router@4.0.22` lo importa en `build/fork/getPathFromState.js` sin declararlo → `Unable to resolve "query-string"`. No subir a v8+: es ESM-only y el interop `__importStar` de expo-router deja `queryString.parse === undefined`.
- **`expo-font` debe ser dependencia directa** para que `@expo/vector-icons` resuelva (si no, queda anidado en `node_modules/expo` y no se hoistea).
- **`react-dom` + `react-native-web` son obligatorios para web**; `react-native-web` debe ser `~0.19.13` en SDK 52.
- **`react-native-css-interop` debe ser dependencia directa (top-level).** El preset `nativewind/babel` transforma el JSX con `importSource: "react-native-css-interop"` y Babel resuelve ese specifier desde la raíz del proyecto: si queda anidado en `node_modules/nativewind` → `Unable to resolve module react-native-css-interop/jsx-runtime`.
- **`react-native-reanimated` (~3.16.1) debe ser dependencia directa.** El preset `nativewind/babel` agrega `"react-native-reanimated/plugin"`; si no está instalado, Babel no resuelve el plugin y el build de *cualquier* plataforma falla.
- **`react-native-screens` debe quedar en `~4.4.0`** (la de SDK 52). Con 4.30 el codegen de RN 0.76 revienta con `Unknown prop type for "onAppear"` al exportar para Android/iOS.
- `assets/` debe contener `icon.png` y `splash.png` (los referencia `app.json`).
- El plugin de expo-router en `app.json` **no debe setear `root`**: el root del router es `app/` por defecto; `root: "(app)"` apuntaba a una carpeta inexistente.

## Routing

expo-router v4, file-based, en `app/`:

```
app/_layout.tsx              Stack + QueryClientProvider + bootstrap de sesión + ToastHost
app/index.tsx                / -> redirect a (main)/tabs/feed (o /auth)
app/auth/_layout.tsx         guard: si hay sesión, va a la app
app/auth/index.tsx           features/auth/AuthScreen (login / registro)
app/onboarding.tsx           features/onboarding/OnboardingScreen
app/(main)/_layout.tsx       guard de sesión; en web ≥1024px: sidebar + Slot; si no: Stack
app/(main)/tabs/_layout.tsx  Tabs: feed | matches | ofertas | demandas | chat | perfil
app/(main)/oferta-nueva.tsx  features/offers/OfferCreateScreen
app/(main)/oferta/[id].tsx   features/offers/OfferDetailScreen (detalle de la publicación)
```

Los archivos de `app/` son **wrappers finos** (`export { default } from "features/..."`); las pantallas viven en `features/<area>/`. expo-router v4 exporta `Stack`, `Tabs`, `Navigator`, `Slot` — **no** `createNativeNavigator` (el viejo `app/(main)/tabs/TabsNavigator.tsx` se eliminó).

Los segmentos de grupo son válidos en los hrefs: `router.push("/(main)/tabs/feed")`. En la web las URLs reales incluyen `tabs`: `/tabs/feed`, `/tabs/perfil`, `/oferta-nueva` (los grupos `(main)` no aparecen).

## Imports

`tsconfig.json` tiene `baseUrl: "."` y `paths` para `lib/*`, `features/*`, `store/*`, `components/*`; Metro los respeta (`isTsconfigPathsEnabled` defaults to true). **Preferir los alias**: el scaffold traía imports rotos (`../lib/supabase` desde dentro de `lib/`, `../offers/useOfferDB`, `../../lib/hooks/useOfferMedia`, `../lib/store/authStore`).

`tsconfig.include` es `app`, `components`, `features`, `lib`, `store` — un directorio nuevo de primer nivel debe agregarse ahí o tsc no lo revisa.

## Estado

Fuente única de verdad: **zustand** en `store/authStore.ts` (export nombrado `useAuthStore`, middleware `persist`, key `mercado-ganadero-auth`). Se eliminó el uso de `react-redux`/`@reduxjs/toolkit` de `features/`; esos paquetes no están instalados. No reintroducir un segundo store.

`store/authStore.ts` también provee el perfil demo cuando Supabase no está configurado, y aplana `cuit`/`verificado` (vienen de `productores`) y `radio_km` (de `fleteros`) al objeto de perfil.

Los toasts viven en `store/toastStore.ts` (zustand, sin persistencia).

## Env vars

- Sólo `EXPO_PUBLIC_*` llega al bundle del cliente (`node_modules/babel-preset-expo/build/inline-env-vars.js`). `lib/supabase.ts` lee `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `supabaseService` (service_role) fue **eliminado** a propósito: el bundle web es público y una service_role ahí filtra la base entera. La edge function crea su propio cliente.
- `type Database` no lo exporta `@supabase/supabase-js`; el cliente quedó sin tipar. Generar tipos con `supabase gen types typescript --project-id <ref> > lib/database.types.ts` y pasarlos a `createClient<Database>()`.

## Migraciones / base de datos

**`supabase/schema.sql` es un archivo de referencia, NO una migración** (tiene errores SQL verificados: `CREATE_TYPE`, `CREATE POLIC`, `producer_id` vs `productor_id`, `UNIQUE(...COALESCE(...))`). El schema real vive en `supabase/migrations/`, ya aplicado al proyecto `mega`:

| Migración | Qué hace |
|---|---|
| `20240101000000_init_schema.sql` | schema completo: tablas, índices, RLS, view `view_matching_candidatos`, trigger `handle_new_user`, RPCs de onboarding |
| `20240101010000_cron_matching.sql` | `pg_cron` (tolerante si no está habilitado) + `handle_matching_refresh()` |
| `20240101020000_triggers_matching.sql` | matching instantáneo vía `calcular_matches_oferta()` / `calcular_matches_demanda()` |
| `20240101030000_rls_email_confirmado.sql` | reemplaza el check de email confirmado en las políticas RLS |
| `20240101040000_fix_rpcs_onboarding.sql` | corrige `RETURN (SELECT * FROM ...)` en los RPCs |
| `20240101050000_sync_email_confirmed.sql` | trigger que copia `auth.users.email_confirmed_at` a `profiles` |
| `20240101060000_oferta_media_portada.sql` | columna `oferta_media.es_portada` (+ índice único por oferta), policies de update/delete de media y bucket `oferta_media` de Storage |
| `20240101070000_matching_security_definer.sql` | el matching pasa a `SECURITY DEFINER` (fix del bug de RLS al publicar), policy `matches_update_parties` (aceptar/descartar) y trigger `proteger_match_inmutable` (el cliente no puede tocar `puntaje`) |

`./scripts/test-migrations.sh` corre todas las migraciones contra el Postgres local (puerto 54322) en una BD descartable `mg_test` — usarlo **antes** de `supabase db push`.

**El check de "email confirmado" NO puede ser `auth.jwt()->>'email_confirmed_at'`**: con las claves nuevas de Supabase (`sb_publishable_`/`sb_secret_`) el JWT ya no incluye ese claim, así que todas las políticas quedaban en `false` y la app no leía ni escribía nada. Ahora se usa `public.email_confirmado()`, función `SECURITY DEFINER` que lee `auth.users.email_confirmed_at` (dato que el usuario no puede falsear). **No volver al claim del JWT.**

**El matching tiene que ser `SECURITY DEFINER`**: `calcular_matches_oferta()` / `calcular_matches_demanda()` corren dentro del trigger del INSERT del cliente, así que con permisos de invocante el `INSERT` en `matches` lo hacía el rol `authenticated` (que no tenía policy de INSERT) y **la publicación del lote se caía entera** con *"new row violates row-level security policy for table matches"*. Ahora las funciones y los triggers son `SECURITY DEFINER` con `search_path = public, pg_temp` y referencias calificadas (`public.ofertas`, …). `matches` tampoco tiene policy de INSERT: el score lo calcula el servidor.

`matches` sólo deja cambiar `estado` (`pendiente|aceptado|rechazado|finalizado`): la policy `matches_update_parties` + el trigger `proteger_match_inmutable` bloquean que el cliente toque `oferta_id`, `demanda_id` o `puntaje` (el trigger compara `current_user` con el dueño de la tabla).

Otros facts del schema:

- `profiles` tiene `onboarding_completado`; `cuit`/`verificado` viven en `productores` y `radio_km` en `fleteros`.
- El trigger `handle_new_user` (sobre `auth.users`) crea el `profiles` al registrarse, tomando el nombre de `raw_user_meta_data->>'nombre'`.
- RPCs usados por el onboarding: `registrar_rol_onboarding(p_user_id, p_rol, p_datos_adicionales)` y `completar_onboarding_perfil(p_user_id, p_nombre, p_telefono, p_rol_extra, p_avatar_url, p_tipo_usuario)`.
- `ofertas` no tiene FK a `productores` (la relación es por `profiles`): embeber `productores (*)` dentro de un select sobre `ofertas` falla con *"Could not find a relationship between 'ofertas' and 'productores'"*. Sólo `profiles (...)` se puede embeber ahí.
- `solicitudes_flete` no tiene columna `fletero_id`: la política usa `EXISTS` sobre `ofertas_flete`.
- RLS exige email confirmado en todas las políticas. El proyecto tiene `mailer_autoconfirm: false`, así que **hay que confirmar el email** para poder operar (SMTP por defecto de Supabase está limitado a ~2-3 emails/hora; se puede desactivar "Confirm email" en el dashboard para dev).
- `pg_cron` no está habilitado en el proyecto: la migración lo detecta y avisa, no falla.
- `config.toml` declara `[db.seed] sql_paths = ["./seed.sql"]` pero `supabase/seed.sql` no existe → `supabase db reset` falla.
- `config.toml` usa `major_version = 17` y `pgdelta`: el stack Docker local debe coincidir.

## Supabase CLI

| Script | Notas |
|---|---|
| `npm run db:migrate` | `supabase db push` (remoto; el proyecto ya está linkeado) |
| `npm run db:migrate:status` | `supabase migration list` |
| `npm run db:reset` | `supabase db reset` (local, requiere Docker) |
| `npm run function:deploy` | `supabase functions deploy` — el subcomando es **plural** |
| `npm run function:logs` | `supabase functions logs` |

**No hay framework de tests ni script `test`.** La verificación es `typecheck` + `lint` + correr la app.

## Edge function

- `supabase/functions/matching-refine/index.ts` es Deno y **no lo cubre `tsc --noEmit` ni ESLint** (ambos excluyen `supabase/`; `.eslintrc.js` ignora `/supabase/functions/*`).
- Llama `supabase.rpc("view_matching_candidatos")`, pero ese objeto es una **VIEW** → usar `.from("view_matching_candidatos").select("*")`.
- Necesita secrets: `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`.
- Deploy: `supabase functions deploy matching-refine`; agregar `--no-verify-jwt` si el cron la tiene que llamar sin auth.

## Cuentas de prueba (proyecto `mega`)

Todas con contraseña `Prueba12345!`, emails ya confirmados y onboarding completo (entran directo a la app):

| Rol | Email | Datos extra |
|---|---|---|
| productor (vendedor) | `vendedor.mercadoganadero@gmail.com` | `productores`: CUIT 20304050607, verificado |
| comprador | `comprador.mercadoganadero@gmail.com` | tiene 1 demanda activa (Novillos, 400-500 kg, hasta $2700, radio 150 km, Córdoba) |
| transportista (fletero) | `transportista.mercadoganadero@gmail.com` | `fleteros`: radio 250 km, verificado |

Datos sembrados: 2 ofertas de Novillos (12 cab., 430 kg, $2500, Córdoba/Río Cuarto, con `ubicacion`) **pertenecientes al productor de prueba** y 1 demanda del comprador. El trigger de matching genera 2 `matches` con puntaje 80 (los dos lados los ven: el productor ve la demanda, el comprador ve los lotes).

Para crear más: `POST /auth/v1/admin/users` con la `service_role` (ver `scripts/` en el repo del proyecto) y `email_confirm: true`; si no se confirma el email, las políticas RLS bloquean toda operación.

## Media de las publicaciones (fotos + video)

- La tabla `oferta_media` guarda fotos y videos de cada oferta. `es_portada` marca **qué imagen se usa como preview** en la card (índice único por oferta: sólo una portada).
- Bucket de Storage `oferta_media` (público). La key es `{userId}/{uuid}.{ext}`; las políticas permiten insertar sólo en la carpeta del propio usuario (`storage.foldername(name)[1] = auth.uid()`).
- **`contentType` del upload debe ser el mime type real** (`image/jpeg`, `video/mp4`, ...): el bucket rechaza comodines (`image/*`).
- **En web el picker devuelve un `data:` URI (base64)**: hay que decodificarlo a `Blob` antes de subirlo (`lib/upload.ts` → `toUploadBody`), si no se guarda el base64 como texto y la imagen no se puede mostrar.
- `useOfferMedia` expone `portadaId` + `setPortada(id)`: la primera foto es la portada por defecto y el productor puede elegir otra tocándola en la galería.
- La card (`features/offers/OfferCard.tsx`) muestra la portada; el detalle (`features/offers/OfferDetailScreen.tsx`, ruta `/(main)/oferta/[id]`) muestra la galería completa con reproductor de video (`expo-video`).
- Máximo 5 fotos y 2 videos de 15 s por oferta (`MAX_IMAGES` / `MAX_VIDEOS` en `useOfferMedia.ts`).

## Pantalla de Matches (cruces del matching)

- Ruta: `app/(main)/tabs/matches.tsx` → `features/matches/MatchesScreen.tsx` (card: `features/matches/MatchCard.tsx`). Es la 2ª pestaña: `NAV_ITEMS` (`components/layout/navItems.ts`) es la fuente única y alimenta el sidebar, la barra inferior y el `Tabs`.
- Datos: `lib/hooks/useMatches.ts` (`useMatches`, `actualizarEstadoMatch`, `usePendientesMatch`). El select embebe `ofertas` + `demandas` + `profiles` + `oferta_media`; la RLS de `matches` ya filtra por parte (productor de la oferta o comprador de la demanda).
- La contraparte se decide en runtime: si `match.ofertas.productor_id === profile.id` el cruce es con una demanda; si no, con un lote (y se puede abrir `/(main)/oferta/[id]`).
- `lib/matching.ts` replica el puntaje de Postgres (categoría 30, raza 20, distancia 30, peso 15, precio 5) para explicar **por qué** aparece cada cruce. `decodeGeografia` deserializa el WKB hex de `geography` y `distanciaKm` es Haversine.
- El badge con los cruces pendientes vive en el sidebar (`AppSidebar`) y en la barra inferior (`MobileTabBar` lee `options.tabBarBadge`; con 6 pestañas el ícono es `w-12` para no desbordar a 320 px).

## Convenciones

- Comentarios, copy de UI e identificadores de BD están en **español** — mantenerlo.
- Formularios con **react-hook-form + zod** (`features/`), con el schema zod declarado arriba del archivo de la pantalla y validado a mano con `Schema.parse(form.getValues())` (no está instalado `@hookform/resolvers`). Para inputs controlados usar `form.watch()`, no `form.getValues()` en el render.
- `useOfferMedia` exporta `MAX_IMAGES` (5) / `MAX_VIDEOS` / `MAX_VIDEO_DURATION`; `totalMedia` es una **función** (`totalMedia()`), no un número.
- `lib/utils.ts` `showToast(message, tone)` empuja al store de toasts (`success | error | info`).
- `lib/hooks/useOfferDB.ts` refresca cada 60 s; `useOfertasActivas` se desactiva solo en modo demo. `lib/hooks/useDemandaDB.ts` hace lo mismo con `demandas`.
- `features/offers/OfferCreateScreen.tsx` tiene selector de `tipo_precio` (chips `por_kilo | por_cabeza | a_convenir`); el zod exige esos valores exactos. Al publicar inserta la oferta y sus filas en `oferta_media` (la foto elegida queda como `es_portada`).
- `ImagePicker` viene de `expo-image-picker` (no de `react-native`); usar `mediaTypes: ["images"]` / `["videos"]` (`MediaTypeOptions` está deprecado) y validar la duración del video después de elegirlo.
- `.gitignore` cubre `node_modules`, `.expo`, `dist`, `supabase/.temp` y `.env` (que tiene las claves reales). El repo **todavía no es un repositorio git** — inicializarlo antes del primer commit.

## Scripts de desarrollo (web)

| Script | Para qué |
|---|---|
| `npm run build:web` | exporta el SPA a `dist/` |
| `npm run preview:web` | sirve `dist/` con fallback SPA en `http://localhost:8101` |
| `node scripts/seed-session.mjs [email]` | genera `dist/seed.html` que inyecta una sesión de Supabase en `localStorage` y redirige (`?ruta=/tabs/perfil`) |
| `scripts/shot.sh <salida.png> <ancho> <alto> [seed:<ruta>]` | captura de pantalla con Chrome headless vía CDP (usa `scripts/inspect.mjs`) |
| `scripts/inspect.mjs <url> <ancho> <alto>` | lista elementos que desbordan el viewport y scrollers horizontales |

`seed-session.mjs` usa las cuentas de prueba de abajo; el `dist/seed.html` que genera es un artefacto local (no commitear).

