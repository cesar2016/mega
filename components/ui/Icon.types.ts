import type { ComponentType } from "react";

/**
 * Componente de icono: acepta `size`, `strokeWidth` y `className`.
 * El color se controla con clases de Tailwind (`text-sage-500`,
 * `text-ink-muted`, ...).
 */
export type IconComponent = ComponentType<any>;

export type IconName =
  | "alert"
  | "arrowLeft"
  | "arrowRight"
  | "badgeCheck"
  | "ban"
  | "beef"
  | "boxes"
  | "building"
  | "calendar"
  | "camera"
  | "check"
  | "checkCircle"
  | "chevronDown"
  | "chevronRight"
  | "clipboard"
  | "cloudOff"
  | "coins"
  | "copy"
  | "eye"
  | "eyeOff"
  | "filter"
  | "flame"
  | "handshake"
  | "heart"
  | "house"
  | "image"
  | "inbox"
  | "info"
  | "landmark"
  | "layoutGrid"
  | "link"
  | "lock"
  | "logIn"
  | "logOut"
  | "mail"
  | "mapPin"
  | "menu"
  | "message"
  | "package"
  | "packagePlus"
  | "pencil"
  | "phone"
  | "plus"
  | "refresh"
  | "ruler"
  | "scale"
  | "search"
  | "send"
  | "settings"
  | "share"
  | "shield"
  | "shoppingCart"
  | "signal"
  | "sliders"
  | "sparkles"
  | "sprout"
  | "store"
  | "tag"
  | "tractor"
  | "trash"
  | "trendingUp"
  | "truck"
  | "user"
  | "userPlus"
  | "users"
  | "video"
  | "wallet"
  | "x";

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
};
