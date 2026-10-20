import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  remove: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, tone = "success") => {
    counter += 1;
    const id = `toast-${counter}-${Date.now()}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 4000);
  },
  remove: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
