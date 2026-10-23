import { useToastStore } from "store/toastStore";

/**
 * Aviso flotante. Antes sólo escribía en la consola; ahora muestra un toast
 * real en la app (arriba a la derecha en escritorio, arriba en mobile).
 */
export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  useToastStore.getState().push(message, type);
}

/**
 * Enmascara el nombre de otros usuarios dejando visibles sólo los primeros
 * 3 caracteres seguidos de `****` (ej.: "Cesar" -> "Ces****"). Si `esPropio`
 * es `true`, devuelve el nombre completo sin ocultar.
 */
export function maskNombreUsuario(
  nombre?: string | null,
  fallback = "Usu****",
  esPropio = false
): string {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return esPropio ? "Sin nombre" : fallback;
  if (esPropio) return limpio;
  if (limpio.endsWith("****")) return limpio;
  const prefijo = limpio.slice(0, Math.min(3, limpio.length));
  const formateado = prefijo.charAt(0).toUpperCase() + prefijo.slice(1).toLowerCase();
  return `${formateado}****`;
}


