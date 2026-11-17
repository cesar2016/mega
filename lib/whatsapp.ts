import { Linking, Platform } from "react-native";
import { showToast } from "./utils";

/**
 * Normaliza números de teléfono (especialmente argentinos) para la API de WhatsApp (wa.me).
 *
 * En Argentina:
 * - El formato internacional de celulares requiere: código de país 54 + prefijo móvil 9 + código de área (sin 0) + número local (sin 15).
 * - Ejemplos:
 *   "011 15-4455-6677" -> "5491144556677"
 *   "11 4455-6677"     -> "5491144556677"
 *   "+54 9 11 44556677"-> "5491144556677"
 *   "+54 11 44556677"  -> "5491144556677"
 *   "0351 15-4455667"  -> "5493514455667"
 *   "351 4455667"      -> "5493514455667"
 */
export function normalizarTelefonoWhatsApp(raw?: string | null): string {
  if (!raw) return "";

  // Si contiene placeholders de no informado
  if (
    raw.includes("No informado") ||
    raw.includes("No especificado") ||
    raw.includes("Sin informar")
  ) {
    return "";
  }

  // Dejar sólo dígitos
  let num = raw.replace(/[^0-9]/g, "");
  if (!num) return "";

  // Quitar prefijo internacional "00"
  if (num.startsWith("00")) {
    num = num.slice(2);
  }

  // 1. Si ya empieza con 549 (formato internacional argentino móvil completo)
  if (num.startsWith("549")) {
    let resto = num.slice(3);
    if (resto.startsWith("0")) resto = resto.slice(1);
    // Quitar 15 si se ingresó después del código de área
    resto = quitarPrefijo15(resto);
    return `549${resto}`;
  }

  // 2. Si empieza con 54 (Argentina sin el 9)
  if (num.startsWith("54")) {
    let resto = num.slice(2);
    if (resto.startsWith("0")) resto = resto.slice(1);
    resto = quitarPrefijo15(resto);
    return `549${resto}`;
  }

  // 3. Número nacional (sin prefijo 54)
  // Quitar el 0 inicial si lo tiene (ej: 011 -> 11, 0351 -> 351)
  if (num.startsWith("0")) {
    num = num.slice(1);
  }

  // Quitar el 15 si está presente después del código de área
  num = quitarPrefijo15(num);

  // Si tiene entre 8 y 11 dígitos, asumimos que es número de Argentina y le anteponemos 549
  if (num.length >= 8 && num.length <= 11) {
    return `549${num}`;
  }

  // Si es un número extranjero largo (ej: Uruguay 598..., Paraguay 595...), conservarlo
  return num;
}

/**
 * Quita el prefijo '15' de números celulares argentinos.
 * Ej: "111544556677" -> "1144556677"
 * Ej: "351154455667" -> "3514455667"
 */
function quitarPrefijo15(numero: string): string {
  const codigosArea = [
    "11", // AMBA
    "351", // Córdoba
    "341", // Rosario
    "221", // La Plata
    "223", // Mar del Plata
    "261", // Mendoza
    "381", // Tucumán
    "387", // Salta
    "358", // Río Cuarto
    "291", // Bahía Blanca
    "342", // Santa Fe
    "343", // Paraná
    "379", // Corrientes
    "362", // Resistencia
    "383", // Catamarca
    "385", // Santiago del Estero
    "264", // San Juan
    "266", // San Luis
    "299", // Neuquén
    "280", // Trelew
    "2966", // Río Gallegos
    "2901", // Ushuaia
  ];

  for (const cod of codigosArea) {
    if (numero.startsWith(cod + "15")) {
      return cod + numero.slice(cod.length + 2);
    }
  }

  // Si no coincidió con lista exacta pero empieza con 15 y tiene 10 dígitos (ej interior)
  if (numero.startsWith("15") && numero.length === 10) {
    return numero.slice(2);
  }

  return numero;
}

/**
 * Abre la conversación de WhatsApp con el mensaje preformateado.
 * En Web usa window.open para evitar bloqueos de popup o errores de Linking.
 */
export function abrirWhatsAppEnlace(numero?: string | null, mensaje?: string) {
  const limpio = normalizarTelefonoWhatsApp(numero);
  if (!limpio) {
    showToast("Teléfono no disponible o inválido para WhatsApp", "info");
    return;
  }

  const texto = mensaje ? encodeURIComponent(mensaje) : "";
  const url = `https://wa.me/${limpio}${texto ? `?text=${texto}` : ""}`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      Linking.openURL(url).catch(() => {
        showToast("No se pudo abrir WhatsApp", "error");
      });
    }
  } else {
    Linking.openURL(url).catch(() => {
      showToast("No se pudo abrir WhatsApp", "error");
    });
  }
}
