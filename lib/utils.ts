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

/**
 * Formatea una cadena a formato CUIT: 00-12345678-0
 */
export function formatCuit(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
}

/**
 * Valida que el CUIT tenga exactamente el formato 00-12345678-0 (11 dígitos con guiones)
 */
export function isValidCuitFormat(cuit: string): boolean {
  return /^\d{2}-\d{8}-\d{1}$/.test(cuit);
}


