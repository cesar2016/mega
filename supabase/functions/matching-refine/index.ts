import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async req) {
  try {
    // 1. Obtener ofertas activas y demandas activas con STDWithin pero sin match aún
    const { data: candidates, error } = await supabase.rpc("view_matching_candidatos");

    if (error) throw error;

    // 2. Para cada candidate, calcular score refinado (incluye peso, precio, raza parcial)
    const refined: Array<{
      oferta_id: string;
      demanda_id: string;
      puntaje_refinado: number;
    }> = [];

    for (const c of candidates) {
      let score = (c.puntaje_base || 0);

      // Añadir puntos por peso promedio vs rango del comprador
      if (c.peso_promedio && c.peso_min_kg && c.peso_max_kg) {
        const peso_promedio = parseFloat(c.peso_promedio as string);
        const peso_promedio_rango = (parseFloat(c.peso_min_kg as string) + parseFloat(c.peso_max_kg as string)) / 2;
        const diff = Math.abs(peso_promedio - peso_promedio_rango);
        if (diff <= 20) score += 10;
        else if (diff <= 50) score += 5;
      }

      // Añadir puntos por precio vs precio máximo del comprador
      if (c.tipo_precio && c.tipo_precio === 'por_kilo' && c.precio && c.precio_max) {
        const diff = Math.abs(parseFloat(c.precio as string) - parseFloat(c.precio_max as string));
        if (diff <= 20) score += 5;
        else if (diff <= 50) score += 2;
      }

      // Añadir puntos por raza exacta (partial match: mismo prefijo)
      if (c.raza && c.demand_raza) {
        if (c.raza.toLowerCase() === c.demand_raza.toLowerCase()) score += 10;
        else if (c.raza.toLowerCase().startsWith(c.demand_raza.toLowerCase().substr(0, 3))) score += 3;
      }

      // Añadir bonus por categoria exacta extra
      if (c.categoria === c.demand_categoria) score += 5; // bonus extra si el trigger base ya lo tenía

      refined.push({
        oferta_id: c.oferta_id,
        demanda_id: c.demanda_id,
        puntaje_refinado: Math.min(100, score),
      });
    }

    // 3. Insertar/actualizar matches con upsert
    const { error: upsertError } = await supabase
      .from("matches")
      .upsert(
        refined.map(r => ({
          oferta_id: r.oferta_id,
          demanda_id: r.demanda_id,
          puntaje: r.puntaje_refinado,
          estado: "pendiente",
        })),
        { onConflict: "oferta_id,demanda_id" }
      );

    if (upsertError) throw upsertError;

    // 4. Notificar matches nuevos (aquí could integrarse con push notification service)
    // Por ahora solo logueamos; en producción dispararíamos Expo Push API

    return new Response(
      JSON.stringify({
        status: "refined",
        candidates_count: candidates.length,
        matches_created: refined.length,
        message: "Matching refinado completado",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("matching-refine error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}