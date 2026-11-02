import { useToastStore } from "store/toastStore";

/**
 * Aviso flotante. Antes sólo escribía en la consola; ahora muestra un toast
 * real en la app (arriba a la derecha en escritorio, arriba en mobile).
 */
export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  useToastStore.getState().push(message, type);
}

/**
 * Devuelve el nombre de usuario para mostrar públicamente sin restricciones ni ocultamiento.
 */
export function maskNombreUsuario(
  nombre?: string | null,
  fallback = "Usuario",
  _esPropio = false
): string {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return fallback === "Usu****" ? "Usuario" : fallback;
  return limpio;
}

/**
 * Valida las reglas del nombre de usuario único:
 * - No menos de 8 caracteres
 * - Sin espacios
 * - Debe contener al menos un número y al menos un carácter especial
 */
export function validarNombreUsuario(nombre: string): string | null {
  const val = nombre.trim();
  if (val.length < 8) {
    return "El nombre de usuario debe tener al menos 8 caracteres.";
  }
  if (/\s/.test(val)) {
    return "El nombre de usuario no puede contener espacios.";
  }
  if (!/[0-9]/.test(val)) {
    return "El nombre de usuario debe incluir al menos un número.";
  }
  if (!/[^a-zA-Z0-9\s]/.test(val)) {
    return "El nombre de usuario debe incluir al menos un carácter especial (ej: _ - . @ # $ * !).";
  }
  return null;
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
