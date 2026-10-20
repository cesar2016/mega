import type { Href } from "expo-router";
import type { IconName } from "components/ui/Icon.types";

export type NavItem = {
  /** Nombre de la ruta dentro del navegador de pestañas. */
  name: string;
  href: Href;
  title: string;
  icon: IconName;
};

/** Navegación principal: se usa en el sidebar (web) y en la barra inferior (mobile). */
export const NAV_ITEMS: NavItem[] = [
  { name: "feed", href: "/(main)/tabs/feed", title: "Ofertas", icon: "store" },
  { name: "matches", href: "/(main)/tabs/matches", title: "Matches", icon: "sparkles" },
  { name: "ofertas", href: "/(main)/tabs/ofertas", title: "Mis ofertas", icon: "boxes" },
  { name: "demandas", href: "/(main)/tabs/demandas", title: "Demandas", icon: "search" },
  { name: "chat", href: "/(main)/tabs/chat", title: "Chat", icon: "message" },
  { name: "perfil", href: "/(main)/tabs/perfil", title: "Perfil", icon: "user" },
];

/** Devuelve el item activo según la ruta actual de la web. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname.endsWith(`/tabs/${item.name}`));
}
