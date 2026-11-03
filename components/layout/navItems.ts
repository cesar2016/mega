import type { Href } from "expo-router";
import type { IconName } from "components/ui/Icon.types";

export type NavItem = {
  /** Nombre de la ruta dentro del navegador de pestañas. */
  name: string;
  href: Href;
  title: string;
  icon: IconName;
  onlySuperAdmin?: boolean;
};

/** Navegación principal: se usa en el sidebar (web) y en la barra inferior (mobile). */
export const NAV_ITEMS: NavItem[] = [
  { name: "feed", href: "/", title: "Ofertas", icon: "store" },
  { name: "matches", href: "/(main)/tabs/matches", title: "Matches", icon: "sparkles" },
  { name: "ofertas", href: "/(main)/tabs/ofertas", title: "Mis ofertas", icon: "boxes" },
  {
    name: "operaciones",
    href: "/(main)/tabs/operaciones",
    title: "Compras / Ventas",
    icon: "shoppingCart",
  },
  { name: "demandas", href: "/(main)/tabs/demandas", title: "Demandas", icon: "search" },
  { name: "chat", href: "/(main)/tabs/chat", title: "Chat", icon: "message" },
  { name: "perfil", href: "/(main)/tabs/perfil", title: "Perfil", icon: "user" },
  {
    name: "superadmin",
    href: "/(main)/tabs/superadmin",
    title: "SuperAdmin",
    icon: "shield",
    onlySuperAdmin: true,
  },
];

export function getVisibleNavItems(esSuperAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.onlySuperAdmin || esSuperAdmin);
}

/** Devuelve el item activo según la ruta actual de la web. */
export function activeNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/" || pathname === "" || pathname.endsWith("/feed") || pathname.includes("/tabs/feed")) {
    return NAV_ITEMS[0];
  }
  return NAV_ITEMS.find((item) => pathname.endsWith(`/tabs/${item.name}`));
}
