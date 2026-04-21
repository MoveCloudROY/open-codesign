import { useT } from '@open-codesign/i18n';
import { X } from 'lucide-react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';
import type { UpdateState } from '../state/update-store';

export function UpdateBanner({ store }: { store: StoreApi<UpdateState> }) {
  const t = useT();
  const show = useStore(store, (s) => s.shouldShowBanner());
  const version = useStore(store, (s) => s.version);
  const releaseUrl = useStore(store, (s) => s.releaseUrl);
  const dismissFn = useStore(store, (s) => s.dismiss);

  if (!show) return null;

  const onDismiss = async () => {
    dismissFn();
    if (window.codesign) {
      await window.codesign.preferences.update({ dismissedUpdateVersion: version });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
      <span>
        <strong className="text-[var(--color-text-primary)]">
          {t('updates.bannerAvailable', { version })}
        </strong>{' '}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-[var(--color-text-primary)] transition-colors"
          onClick={() => {
            if (window.codesign) void window.codesign.openExternal(releaseUrl);
          }}
        >
          {t('updates.bannerViewRelease')}
        </button>
      </span>
      <button
        type="button"
        aria-label={t('updates.bannerDismissAria')}
        className="shrink-0 p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
        onClick={() => void onDismiss()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
