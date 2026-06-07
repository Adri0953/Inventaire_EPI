import { writable } from 'svelte/store';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'success';
}

interface ConfirmState {
  options: ConfirmOptions;
  resolve: (val: boolean) => void;
}

const state = writable<ConfirmState | null>(null);

export const confirmStore = {
  subscribe: state.subscribe,
  respond(value: boolean) {
    state.update((s) => {
      s?.resolve(value);
      return null;
    });
  },
};

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    state.set({ options, resolve });
  });
}
