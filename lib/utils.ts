import { useToastStore } from "store/toastStore";

/**
 * Aviso flotante. Antes sólo escribía en la consola; ahora muestra un toast
 * real en la app (arriba a la derecha en escritorio, arriba en mobile).
 */
export function showToast(message: string, type: "success" | "error" | "info" = "success") {
  useToastStore.getState().push(message, type);
}
