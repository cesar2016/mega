/* eslint-env node */
const fs = require("fs");
const path = require("path");

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (_e) {
  // Opcional si no está instalado
}

function formatPrecio(precio, tipo_precio) {
  const num = Number(precio);
  const formatted = isNaN(num) ? String(precio) : `$${num.toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

function generarHtmlEmailComprador({ vendedor, comprador, oferta, usaCid = false }) {
  const precioTexto = formatPrecio(oferta.precio, oferta.tipo_precio);
  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");
  const logoSrc = usaCid ? "cid:logo_emblema" : "https://mercadoganadero.app/logo.png";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de compra - Mercado Ganadero</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F2EC; color: #1E2922; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E3DFD6; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
    <!-- Header con logo emblema oficial -->
    <div style="background-color: #2D4A36; padding: 30px 24px 24px 24px; text-align: center; color: #FFFFFF;">
      <img src="${logoSrc}" alt="Mercado Ganadero" width="84" height="84" style="display: block; margin: 0 auto 12px auto; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background-color: #FFFFFF; object-fit: contain;" />
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">¡Compra confirmada!</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Mercado Ganadero · Compra y venta de hacienda</p>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">
        Hola <strong>${comprador.nombre || "Estimado cliente"}</strong>, confirmamos que has adquirido el siguiente lote de hacienda:
      </p>

      <div style="background-color: #F8F7F4; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #EAE7E0;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #2D4032;">🐮 Detalle del lote</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Categoría:</strong> ${oferta.categoria}</li>
          <li><strong>Raza:</strong> ${oferta.raza || "No especificada"}</li>
          <li><strong>Cantidad:</strong> ${oferta.cantidad} cabezas</li>
          ${oferta.peso_promedio ? `<li><strong>Peso promedio:</strong> ${oferta.peso_promedio} kg</li>` : ""}
          <li><strong>Precio:</strong> ${precioTexto}</li>
          <li><strong>Ubicación del lote:</strong> ${ubicacion || "A consultar"}</li>
          <li><strong>Estado de la publicación:</strong> <span style="background-color: #C2410C; color: #FFFFFF; font-weight: bold; padding: 2px 8px; border-radius: 6px; font-size: 12px;">VENDIDO</span></li>
        </ul>
      </div>

      <div style="background-color: #EBF4ED; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #C8DEC9;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #1E4627;">👤 Datos de contacto del vendedor (Productor)</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Nombre / Razón Social:</strong> ${vendedor.nombre || "Productor"}</li>
          <li><strong>Teléfono / WhatsApp:</strong> ${vendedor.telefono ? `<a href="tel:${vendedor.telefono}" style="color: #2F603B; font-weight: bold;">${vendedor.telefono}</a>` : "No informado"}</li>
          <li><strong>Email:</strong> ${vendedor.email ? `<a href="mailto:${vendedor.email}" style="color: #2F603B;">${vendedor.email}</a>` : "No informado"}</li>
          ${vendedor.establecimiento ? `<li><strong>Establecimiento:</strong> ${vendedor.establecimiento}</li>` : ""}
          ${ubicacion ? `<li><strong>Zona:</strong> ${ubicacion}</li>` : ""}
        </ul>
      </div>

      <p style="font-size: 14px; color: #5C675F; line-height: 1.6;">
        Ya podés comunicarte directamente con el productor para coordinar la forma de pago, la emisión del DTA / Guía de traslado en SENASA y el transporte de los animales.
      </p>
    </div>

    <div style="background-color: #F8F7F4; border-top: 1px solid #EAE7E0; padding: 18px 24px; text-align: center; font-size: 12px; color: #8C978E;">
      Mercado Ganadero · Conectando el campo de forma directa y transparente.<br />
      <a href="https://mercadoganadero.app" style="color: #4C6B54; text-decoration: none; font-weight: 600;">mercadoganadero.app</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generarHtmlEmailVendedor({ vendedor, comprador, oferta, usaCid = false }) {
  const precioTexto = formatPrecio(oferta.precio, oferta.tipo_precio);
  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");
  const logoSrc = usaCid ? "cid:logo_emblema" : "https://mercadoganadero.app/logo.png";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>¡Han comprado tu lote! - Mercado Ganadero</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F2EC; color: #1E2922; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E3DFD6; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
    <!-- Header con logo emblema oficial -->
    <div style="background-color: #2D4A36; padding: 30px 24px 24px 24px; text-align: center; color: #FFFFFF;">
      <img src="${logoSrc}" alt="Mercado Ganadero" width="84" height="84" style="display: block; margin: 0 auto 12px auto; border-radius: 20px; border: 2px solid rgba(255,255,255,0.25); background-color: #FFFFFF; object-fit: contain;" />
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">¡Han comprado tu lote!</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Mercado Ganadero · Compra y venta de hacienda</p>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">
        Hola <strong>${vendedor.nombre || "Productor"}</strong>, un comprador ha confirmado la adquisición de tu lote en Mercado Ganadero:
      </p>

      <div style="background-color: #F8F7F4; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #EAE7E0;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #2D4032;">🐮 Lote adquirido</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Categoría:</strong> ${oferta.categoria}</li>
          <li><strong>Raza:</strong> ${oferta.raza || "No especificada"}</li>
          <li><strong>Cantidad:</strong> ${oferta.cantidad} cabezas</li>
          <li><strong>Precio acordado:</strong> ${precioTexto}</li>
          ${ubicacion ? `<li><strong>Ubicación:</strong> ${ubicacion}</li>` : ""}
          <li><strong>Estado:</strong> <span style="background-color: #C2410C; color: #FFFFFF; font-weight: bold; padding: 2px 8px; border-radius: 6px; font-size: 12px;">VENDIDO</span></li>
        </ul>
      </div>

      <div style="background-color: #EBF4ED; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #C8DEC9;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #1E4627;">👤 Datos de contacto del Comprador</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Nombre:</strong> ${comprador.nombre || "Comprador"}</li>
          <li><strong>Teléfono / WhatsApp:</strong> ${comprador.telefono ? `<a href="tel:${comprador.telefono}" style="color: #2F603B; font-weight: bold;">${comprador.telefono}</a>` : "No informado"}</li>
          <li><strong>Email:</strong> ${comprador.email ? `<a href="mailto:${comprador.email}" style="color: #2F603B;">${comprador.email}</a>` : "No informado"}</li>
        </ul>
      </div>

      <p style="font-size: 14px; color: #5C675F; line-height: 1.6;">
        La publicación ha sido marcada como <strong>VENDIDA</strong>. El comprador ya tiene tus datos de contacto para coordinar el pago, la guía DTA ante el SENASA y el retiro de la hacienda.
      </p>
    </div>

    <div style="background-color: #F8F7F4; border-top: 1px solid #EAE7E0; padding: 18px 24px; text-align: center; font-size: 12px; color: #8C978E;">
      Mercado Ganadero · Conectando el campo de forma directa y transparente.<br />
      <a href="https://mercadoganadero.app" style="color: #4C6B54; text-decoration: none; font-weight: 600;">mercadoganadero.app</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Proveedor 1: Gmail SMTP vía Nodemailer
 */
function getGmailTransporter() {
  if (!nodemailer) return null;

  const user = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USERNAME;
  const pass =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.MAIL_PASSWORD;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""), // Limpiar posibles espacios de app passwords
    },
  });
}

/**
 * Proveedor 2: Resend API
 */
async function enviarEmailResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  const senders = [
    process.env.RESEND_FROM_EMAIL,
    "Mercado Ganadero <notificaciones@mercadoganadero.app>",
    "Mercado Ganadero <onboarding@resend.dev>",
  ].filter(Boolean);

  let lastError = null;
  for (const sender of Array.from(new Set(senders))) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[comprar] Email enviado exitosamente a ${to} desde ${sender} vía Resend. ID: ${data?.id}`);
        return { ok: true, provider: "resend", id: data?.id, sender };
      } else {
        lastError = data?.message || `HTTP ${res.status}: ${JSON.stringify(data)}`;
        console.warn(`[comprar] Intento de envío a ${to} desde ${sender} vía Resend falló:`, lastError);
      }
    } catch (err) {
      lastError = err.message;
      console.error("[comprar] Excepción al enviar email con Resend:", err);
    }
  }

  return { ok: false, provider: "resend", error: lastError };
}

/**
 * Orquestador de envío de correo (Intenta Gmail SMTP primero, luego Resend)
 */
async function despacharEmail({ to, subject, htmlGenerator, payload }) {
  // 1. Probar primero con Gmail SMTP
  const transporter = getGmailTransporter();
  if (transporter) {
    const fromUser = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USERNAME;
    const from = process.env.GMAIL_FROM || process.env.SMTP_FROM || `Mercado Ganadero <${fromUser}>`;

    const attachments = [];
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: "logo.png",
        path: logoPath,
        cid: "logo_emblema",
      });
    }

    const html = htmlGenerator({ ...payload, usaCid: attachments.length > 0 });

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments,
      });
      console.log(`[comprar] Email enviado exitosamente a ${to} vía Gmail SMTP (${info.messageId})`);
      return { ok: true, provider: "gmail_smtp", messageId: info.messageId };
    } catch (err) {
      console.error("[comprar] Error al despachar con Gmail SMTP:", err.message);
      // Fall through a Resend si hay error o si no funcionó
    }
  }

  // 2. Si no hay Gmail SMTP o falló, probar con Resend
  if (process.env.RESEND_API_KEY) {
    const html = htmlGenerator({ ...payload, usaCid: false });
    return await enviarEmailResend({ to, subject, html });
  }

  console.warn("[comprar] No se detectó configuración de Gmail SMTP (GMAIL_USER / GMAIL_APP_PASSWORD) ni RESEND_API_KEY.");
  return {
    ok: false,
    sinConfig: true,
    error: "Configurá GMAIL_USER y GMAIL_APP_PASSWORD en Vercel para activar los correos automáticos.",
  };
}

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Utilizar POST." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { ofertaId, compradorId, compradorNombre, compradorTelefono, compradorEmail } = body;

    if (!ofertaId) {
      return res.status(400).json({ error: "Falta el ID de la oferta (ofertaId)" });
    }

    const supabaseUrl =
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://kkoctmvglhjayjtiepgh.supabase.co";

    // Service role key para poder acceder a auth.users y actualizar estado de la oferta
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjE3MTA3MCwiZXhwIjoyMTA3NzQ3MDcwfQ.rSyZGjmQot2u1Hz8IHWUPxE9kTIuo4F75-FOBp8JDUg";

    // 1. Obtener la oferta
    const resOferta = await fetch(
      `${supabaseUrl}/rest/v1/ofertas?id=eq.${ofertaId}&select=id,categoria,raza,cantidad,precio,tipo_precio,peso_promedio,localidad,provincia,productor_id,estado`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const ofertas = await resOferta.json();
    const oferta = Array.isArray(ofertas) && ofertas.length > 0 ? ofertas[0] : null;

    if (!oferta) {
      return res.status(404).json({ error: "Publicación no encontrada" });
    }

    // 1b. Si el lote ya fue vendido, rechazar compra duplicada
    if (oferta.estado === "vendida" || oferta.estado === "completada") {
      return res.status(400).json({
        error: "Este lote ya ha sido vendido y no se encuentra disponible.",
        yaVendido: true,
      });
    }

    // 2. Obtener datos del productor / vendedor
    let vendedorNombre = "Productor";
    let vendedorTelefono = null;
    let vendedorEmail = null;
    let vendedorEstablecimiento = null;

    if (oferta.productor_id) {
      // Buscar perfil
      const resPerfil = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${oferta.productor_id}&select=id,nombre,telefono`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );
      const perfiles = await resPerfil.json();
      if (Array.isArray(perfiles) && perfiles.length > 0) {
        vendedorNombre = perfiles[0].nombre || vendedorNombre;
        vendedorTelefono = perfiles[0].telefono || null;
      }

      // Buscar datos de productor (establecimiento)
      try {
        const resProd = await fetch(
          `${supabaseUrl}/rest/v1/productores?user_id=eq.${oferta.productor_id}&select=establecimiento,cuit`,
          {
            headers: {
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
          }
        );
        const productores = await resProd.json();
        if (Array.isArray(productores) && productores.length > 0) {
          vendedorEstablecimiento = productores[0].establecimiento || null;
        }
      } catch {
        // Ignorar si no existe tabla o registro
      }

      // Obtener el email del productor de auth.users con service_role
      try {
        const resUser = await fetch(
          `${supabaseUrl}/auth/v1/admin/users/${oferta.productor_id}`,
          {
            headers: {
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
          }
        );
        if (resUser.ok) {
          const userData = await resUser.json();
          vendedorEmail = userData?.email || null;
        }
      } catch (e) {
        console.error("Error al obtener email del productor:", e);
      }
    }

    if (!vendedorEmail) {
      vendedorEmail = "contacto@mercadoganadero.app";
    }
    if (!vendedorTelefono) {
      vendedorTelefono = "+54 9 11 4000-0000";
    }

    // 3. Marcar la oferta como "vendida" en la base de datos
    try {
      const resUpdate = await fetch(`${supabaseUrl}/rest/v1/ofertas?id=eq.${ofertaId}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ estado: "vendida" }),
      });
      if (!resUpdate.ok) {
        console.error("Error al marcar oferta como vendida:", await resUpdate.text());
      } else {
        console.log(`[comprar] Oferta ${ofertaId} actualizada a estado: vendida`);
        oferta.estado = "vendida";
      }
    } catch (errUpdate) {
      console.error("Excepción al marcar oferta como vendida:", errUpdate);
    }

    // 4. Datos del comprador
    const comprador = {
      id: compradorId || null,
      nombre: compradorNombre || "Comprador",
      telefono: compradorTelefono || "No especificado",
      email: compradorEmail || "comprador@mercadoganadero.app",
    };

    const vendedor = {
      id: oferta.productor_id,
      nombre: vendedorNombre,
      telefono: vendedorTelefono,
      email: vendedorEmail,
      establecimiento: vendedorEstablecimiento,
      localidad: oferta.localidad,
      provincia: oferta.provincia,
    };

    // 5. Enviar emails a ambas partes con Gmail SMTP (o Resend)
    const emailPayload = { vendedor, comprador, oferta };

    let emailCompradorRes = { ok: false };
    let emailVendedorRes = { ok: false };

    if (comprador.email && !comprador.email.includes("@mercadoganadero.app")) {
      emailCompradorRes = await despacharEmail({
        to: comprador.email,
        subject: `🐮 Confirmación de compra: Lote de ${oferta.categoria} - Mercado Ganadero`,
        htmlGenerator: generarHtmlEmailComprador,
        payload: emailPayload,
      });
    }

    if (vendedor.email && !vendedor.email.includes("contacto@mercadoganadero.app")) {
      emailVendedorRes = await despacharEmail({
        to: vendedor.email,
        subject: `🐮 ¡Han comprado tu lote de ${oferta.categoria}! - Mercado Ganadero`,
        htmlGenerator: generarHtmlEmailVendedor,
        payload: emailPayload,
      });
    }

    // 6. Insertar notificaciones en la base de datos
    try {
      const notifs = [];
      if (oferta.productor_id) {
        notifs.push({
          usuario_id: oferta.productor_id,
          tipo: "estado",
          titulo: `¡Lote de ${oferta.categoria} vendido!`,
          cuerpo: `${comprador.nombre} ha confirmado la compra de tu lote. Contactalo al ${comprador.telefono} o ${comprador.email}.`,
          entidad_tipo: "oferta",
          entidad_id: oferta.id,
        });
      }
      if (compradorId) {
        notifs.push({
          usuario_id: compradorId,
          tipo: "estado",
          titulo: `Compra confirmada: ${oferta.categoria}`,
          cuerpo: `Confirmaste la compra del lote. Datos del vendedor: ${vendedor.nombre} (${vendedor.telefono}).`,
          entidad_tipo: "oferta",
          entidad_id: oferta.id,
        });
      }

      if (notifs.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/notificaciones`, {
          method: "POST",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(notifs),
        });
      }
    } catch (e) {
      console.error("Error al registrar notificaciones:", e);
    }

    const algunEmailEnviado = Boolean(emailCompradorRes.ok || emailVendedorRes.ok);
    const tieneConfiguracion = Boolean(
      (process.env.GMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USERNAME) &&
      (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD)
    ) || Boolean(process.env.RESEND_API_KEY);
    const sinConfiguracion = !tieneConfiguracion || Boolean(emailCompradorRes.sinConfig || emailVendedorRes.sinConfig);

    return res.status(200).json({
      success: true,
      mensaje: "Compra confirmada exitosamente. Lote marcado como vendido.",
      loteVendido: true,
      emailCompradorEnviado: Boolean(emailCompradorRes.ok),
      emailVendedorEnviado: Boolean(emailVendedorRes.ok),
      algunEmailEnviado,
      sinConfiguracion,
      emailDetalle: {
        comprador: emailCompradorRes,
        vendedor: emailVendedorRes,
        sinConfiguracion,
      },
      vendedor,
      comprador,
      oferta,
    });
  } catch (error) {
    console.error("Error en endpoint /api/comprar:", error);
    return res.status(500).json({
      error: "Ocurrió un error al procesar la compra",
      detalle: error.message,
    });
  }
};
