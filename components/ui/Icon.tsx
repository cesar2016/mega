import { iconRegistry } from "./Icon.registry";
import type { IconProps } from "./Icon.types";

export type { IconName } from "./Icon.types";

/**
 * Renderiza un icono de Lucide. El color y el tamaño se controlan con
 * clases de Tailwind (`className="text-sage-500"`) y con `size`.
 */
export function Icon({ name, size = 20, className, strokeWidth = 2, color }: IconProps) {
  const Component = iconRegistry[name];
  return (
    <Component
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      color={color}
    />
  );
}
