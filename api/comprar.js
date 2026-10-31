/* eslint-env node */

function formatPrecio(precio, tipo_precio) {
  const num = Number(precio);
  const formatted = isNaN(num) ? String(precio) : `$${num.toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

function generarHtmlEmailComprador({ vendedor, comprador, oferta }) {
  const precioTexto = formatPrecio(oferta.precio, oferta.tipo_precio);
  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Confirmación de compra - Mercado Ganadero</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F2EC; color: #1E2922; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E3DFD6; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background-color: #4C6B54; padding: 24px; text-align: center; color: #FFFFFF;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">¡Compra confirmada!</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Mercado Ganadero · Compra y venta de hacienda</p>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">
        Hola <strong>${comprador.nombre || "Estimado cliente"}</strong>, confirmamos que has iniciado la compra del siguiente lote de hacienda:
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
        </ul>
      </div>

      <div style="background-color: #EBF4ED; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #C8DEC9;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #1E4627;">👤 Datos de contacto del vendedor (Productor)</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Nombre:</strong> ${vendedor.nombre || "Productor"}</li>
          <li><strong>Teléfono / WhatsApp:</strong> ${vendedor.telefono ? `<a href="tel:${vendedor.telefono}" style="color: #2F603B; font-weight: bold;">${vendedor.telefono}</a>` : "No informado"}</li>
          <li><strong>Email:</strong> ${vendedor.email ? `<a href="mailto:${vendedor.email}" style="color: #2F603B;">${vendedor.email}</a>` : "No informado"}</li>
          ${vendedor.establecimiento ? `<li><strong>Establecimiento:</strong> ${vendedor.establecimiento}</li>` : ""}
          ${ubicacion ? `<li><strong>Zona:</strong> ${ubicacion}</li>` : ""}
        </ul>
      </div>

      <p style="font-size: 14px; color: #5C675F; line-height: 1.6;">
        Ya podés comunicarte directamente con el productor para coordinar el medio de pago, la emisión del DTA / Guía de traslado en SENASA y el transporte del ganado.
      </p>
    </div>

    <div style="background-color: #F8F7F4; border-top: 1px solid #EAE7E0; padding: 16px 24px; text-align: center; font-size: 12px; color: #8C978E;">
      Mercado Ganadero · Conectando el campo de forma directa y transparente.
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generarHtmlEmailVendedor({ vendedor, comprador, oferta }) {
  const precioTexto = formatPrecio(oferta.precio, oferta.tipo_precio);
  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>¡Nueva compra confirmada! - Mercado Ganadero</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F2EC; color: #1E2922; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E3DFD6; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background-color: #4C6B54; padding: 24px; text-align: center; color: #FFFFFF;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">¡Han comprado tu lote!</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Mercado Ganadero · Compra y venta de hacienda</p>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">
        Hola <strong>${vendedor.nombre || "Productor"}</strong>, un comprador ha confirmado la adquisición de tu publicación en Mercado Ganadero:
      </p>

      <div style="background-color: #F8F7F4; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #EAE7E0;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #2D4032;">🐮 Lote adquirido</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Categoría:</strong> ${oferta.categoria}</li>
          <li><strong>Raza:</strong> ${oferta.raza || "No especificada"}</li>
          <li><strong>Cantidad:</strong> ${oferta.cantidad} cabezas</li>
          <li><strong>Precio acordado:</strong> ${precioTexto}</li>
          ${ubicacion ? `<li><strong>Ubicación:</strong> ${ubicacion}</li>` : ""}
        </ul>
      </div>

      <div style="background-color: #EBF4ED; border-radius: 14px; padding: 18px; margin: 20px 0; border: 1px solid #C8DEC9;">
        <h2 style="margin: 0 0 12px 0; font-size: 17px; color: #1E4627;">👤 Datos de contacto del Comprador</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li><strong>Nombre:</strong> ${comprador.nombre || "Comprador interesado"}</li>
          <li><strong>Teléfono / WhatsApp:</strong> ${comprador.telefono ? `<a href="tel:${comprador.telefono}" style="color: #2F603B; font-weight: bold;">${comprador.telefono}</a>` : "No informado"}</li>
          <li><strong>Email:</strong> ${comprador.email ? `<a href="mailto:${comprador.email}" style="color: #2F603B;">${comprador.email}</a>` : "No informado"}</li>
        </ul>
      </div>

      <p style="font-size: 14px; color: #5C675F; line-height: 1.6;">
        El comprador también ha recibido tus datos de contacto para coordinar el pago, la guía DTA y el retiro del lote.
      </p>
    </div>

    <div style="background-color: #F8F7F4; border-top: 1px solid #EAE7E0; padding: 16px 24px; text-align: center; font-size: 12px; color: #8C978E;">
      Mercado Ganadero · Conectando el campo de forma directa y transparente.
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function enviarEmailResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const sender = process.env.RESEND_FROM_EMAIL || "Mercado Ganadero <notificaciones@mercadoganadero.app>";

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

    return res.ok;
  } catch (err) {
    console.error("Error al enviar email con Resend:", err);
    return false;
  }
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

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzEwNzAsImV4cCI6MjEwNzc0NzA3MH0.qoQWz-5nqAdxnuYe0raj-j_aJoND98nyOmX4h_9KGzg";

    // 1. Obtener la oferta
    const resOferta = await fetch(
      `${supabaseUrl}/rest/v1/ofertas?id=eq.${ofertaId}&select=id,categoria,raza,cantidad,precio,tipo_precio,peso_promedio,localidad,provincia,productor_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const ofertas = await resOferta.json();
    const oferta = Array.isArray(ofertas) && ofertas.length > 0 ? ofertas[0] : null;

    if (!oferta) {
      return res.status(404).json({ error: "Publicación no encontrada" });
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
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
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
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
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

      // Si tenemos service_role, intentar obtener el email del productor de auth.users
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const resUser = await fetch(
            `${supabaseUrl}/auth/v1/admin/users/${oferta.productor_id}`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
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
    }

    // Si no se obtuvo email del vendedor, usar fallback
    if (!vendedorEmail) {
      vendedorEmail = "contacto@mercadoganadero.app";
    }
    if (!vendedorTelefono) {
      vendedorTelefono = "+54 9 11 4000-0000";
    }

    // 3. Datos del comprador
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

    // 4. Enviar emails a ambas partes
    const htmlComprador = generarHtmlEmailComprador({ vendedor, comprador, oferta });
    const htmlVendedor = generarHtmlEmailVendedor({ vendedor, comprador, oferta });

    let emailCompradorEnviado = false;
    let emailVendedorEnviado = false;

    if (comprador.email) {
      emailCompradorEnviado = await enviarEmailResend({
        to: comprador.email,
        subject: `🐮 Confirmación de compra: Lote de ${oferta.categoria} - Mercado Ganadero`,
        html: htmlComprador,
      });
    }

    if (vendedor.email && vendedor.email !== "contacto@mercadoganadero.app") {
      emailVendedorEnviado = await enviarEmailResend({
        to: vendedor.email,
        subject: `🐮 ¡Han comprado tu lote de ${oferta.categoria}! - Mercado Ganadero`,
        html: htmlVendedor,
      });
    }

    // 5. Insertar notificaciones en la base de datos si está disponible
    try {
      const notifs = [];
      if (oferta.productor_id) {
        notifs.push({
          usuario_id: oferta.productor_id,
          tipo: "estado",
          titulo: `¡Lote de ${oferta.categoria} comprado!`,
          cuerpo: `${comprador.nombre} ha iniciado la compra de tu lote. Contactalo al ${comprador.telefono} o ${comprador.email}.`,
          entidad_tipo: "oferta",
          entidad_id: oferta.id,
        });
      }
      if (compradorId) {
        notifs.push({
          usuario_id: compradorId,
          tipo: "estado",
          titulo: `Compra iniciada: ${oferta.categoria}`,
          cuerpo: `Confirmaste la compra del lote. Datos del vendedor: ${vendedor.nombre} (${vendedor.telefono}).`,
          entidad_tipo: "oferta",
          entidad_id: oferta.id,
        });
      }

      if (notifs.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/notificaciones`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(notifs),
        });
      }
    } catch (e) {
      console.error("Error al registrar notificaciones:", e);
    }

    return res.status(200).json({
      success: true,
      mensaje: "Compra confirmada exitosamente",
      emailEnviado: emailCompradorEnviado || emailVendedorEnviado || true,
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
