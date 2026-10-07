import { create } from "zustand";

export interface PromptRequest {
  title: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  // Confirm-only mode: no input field; resolves with "confirm" instead of text.
  confirmOnly?: boolean;
}

interface PromptState {
  request: PromptRequest | null;
  open: (req: PromptRequest) => Promise<string | null>;
  close: (value: string | null) => void;
  resolve: ((value: string | null) => void) | null;
}

// Global prompt service. window.prompt() is unavailable in Tauri's WKWebView,
// so file/folder naming, renames, deletes, and the link button all route
// through here.
export const usePromptStore = create<PromptState>((set, get) => ({
  request: null,
  resolve: null,
  open: (req) =>
    new Promise<string | null>((resolve) => {
      set({ request: req, resolve });
    }),
  close: (value) => {
    get().resolve?.(value);
    set({ request: null, resolve: null });
  },
}));

export function showPrompt(req: PromptRequest): Promise<string | null> {
  return usePromptStore.getState().open(req);
}
