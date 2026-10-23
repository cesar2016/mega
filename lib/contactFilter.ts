/**
 * Filtro de seguridad anti-fuga de datos de contacto.
 *
 * Bloquea el intercambio de teléfonos, correos electrónicos, redes sociales,
 * enlaces web, CUIT o números escritos en letras dentro del chat interno y
 * descripciones de publicaciones, garantizando que las partes no se conozcan
 * ni intercambien vías de contacto externas.
 */

export type ResultadoFiltroContacto = {
  bloqueado: boolean;
  motivo: string | null;
};

const PALABRAS_NUMEROS = new Set([
  "cero",
  "uno",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "quince",
]);

const PATRONES_PROHIBIDOS: { regex: RegExp; motivo: string }[] = [
  {
    regex: /[a-zA-Z0-9._%+-]+\s*(?:@|\barroba\b|\(at\)|\[at\])\s*[a-zA-Z0-9.-]+/i,
    motivo: "No está permitido compartir direcciones de correo electrónico.",
  },
  {
    regex: /\b(?:gmail|hotmail|outlook|yahoo|icloud|live\.com|protonmail)\b/i,
    motivo: "No está permitido mencionar proveedores de correo electrónico.",
  },
  {
    regex: /\b(?:https?:\/\/|www\.|[a-zA-Z0-9-]+\.(?:com|ar|net|org|io|me|gg|ly|app)\b)/i,
    motivo: "No está permitido incluir enlaces web o dominios externos.",
  },
  {
    regex:
      /\b(?:whatsapp|wasap|wsp|wpp|whapp|wa\.me|telegram|t\.me|instagram|insta|facebook|messenger|tiktok|linkedin|twitter)\b/i,
    motivo: "No está permitido mencionar WhatsApp ni redes sociales externas.",
  },
  {
    regex:
      /\b(?:mi\s+(?:cel|celular|tel|telefono|teléfono|numero|número|contacto|correo|mail)|escribime\s+al|llamame|llámame|agendame|pasame\s+tu\s+(?:cel|numero|número|tel|whatsapp))\b/i,
    motivo: "Por seguridad, toda la comunicación debe realizarse dentro del chat del sitio.",
  },
  {
    regex: /\b(?:20|23|24|27|30|33)[-\s.]?\d{8}[-\s.]?\d\b/,
    motivo: "No está permitido compartir números de CUIT/CUIL en el chat.",
  },
];

/**
 * Detecta si un texto intenta compartir datos de contacto directo.
 */
export function detectarDatosContacto(texto?: string | null): ResultadoFiltroContacto {
  const limpio = (texto ?? "").trim();
  if (!limpio) return { bloqueado: false, motivo: null };

  // 1. Patrones explícitos (emails, dominios, redes, frases de evasión, CUIT)
  for (const item of PATRONES_PROHIBIDOS) {
    if (item.regex.test(limpio)) {
      return { bloqueado: true, motivo: item.motivo };
    }
  }

  // 2. Secuencias numéricas que parezcan teléfonos (6 o más dígitos, aún separados por espacios, guiones o puntos)
  const bloquesNumericos = limpio.match(/\+?\d[\d\s.\-()/_,]{5,}\d/g) ?? [];
  for (const bloque of bloquesNumericos) {
    const soloDigitos = bloque.replace(/\D/g, "");
    if (soloDigitos.length >= 6) {
      return {
        bloqueado: true,
        motivo: "No está permitido enviar números de teléfono ni secuencias numéricas de contacto.",
      };
    }
  }

  // 3. Total de dígitos excesivo en un mismo mensaje (para evitar que partan el teléfono en varios renglones)
  const todosLosDigitos = limpio.replace(/\D/g, "");
  if (todosLosDigitos.length >= 8) {
    return {
      bloqueado: true,
      motivo: "El mensaje contiene demasiados dígitos y fue bloqueado para evitar el envío de teléfonos.",
    };
  }

  // 4. Números escritos en palabras (ej. "tres cinco uno cuatro dos...")
  const tokens = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);

  let cantidadPalabrasNumero = 0;
  let rachaPalabrasNumero = 0;
  for (const token of tokens) {
    if (PALABRAS_NUMEROS.has(token)) {
      cantidadPalabrasNumero += 1;
      rachaPalabrasNumero += 1;
      if (rachaPalabrasNumero >= 3 || cantidadPalabrasNumero >= 4) {
        return {
          bloqueado: true,
          motivo: "No está permitido dictar números de teléfono en letras.",
        };
      }
    } else if (token !== "y") {
      rachaPalabrasNumero = 0;
    }
  }

  // 5. Usuarios de redes tipo @usuario (de al menos 3 caracteres)
  if (/(?:^|\s)@[a-zA-Z0-9_.]{3,}/.test(limpio)) {
    return {
      bloqueado: true,
      motivo: "No está permitido compartir usuarios de redes sociales (@usuario).",
    };
  }

  return { bloqueado: false, motivo: null };
}
