import { Platform, useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Responsive = {
  width: number;
  height: number;
  isWeb: boolean;
  /** Escritorio: se usa la barra lateral en lugar de las pestañas inferiores. */
  isWide: boolean;
  /** Tablet. */
  isTablet: boolean;
  /** Móvil (o web angosta). */
  isCompact: boolean;
};

/**
 * Detecta el tamaño disponible para adaptar la navegación y las grillas.
 * En nativo siempre se comporta como móvil (layout de una columna).
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  return {
    width,
    height,
    isWeb,
    isWide: isWeb && width >= BREAKPOINTS.lg,
    isTablet: isWeb && width >= BREAKPOINTS.md,
    isCompact: !(isWeb && width >= BREAKPOINTS.lg),
  };
}
