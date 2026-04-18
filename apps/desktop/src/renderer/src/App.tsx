import { buildSrcdoc } from '@open-codesign/runtime';
import { BUILTIN_DEMOS } from '@open-codesign/templates';
import { Wordmark } from '@open-codesign/ui';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PreviewToolbar } from './components/PreviewToolbar';
import { Onboarding } from './onboarding';
import { useCodesignStore } from './store';

export function App() {
  const messages = useCodesignStore((s) => s.messages);
  const previewHtml = useCodesignStore((s) => s.previewHtml);
  const isGenerating = useCodesignStore((s) => s.isGenerating);
  const sendPrompt = useCodesignStore((s) => s.sendPrompt);
  const config = useCodesignStore((s) => s.config);
  const configLoaded = useCodesignStore((s) => s.configLoaded);
  const loadConfig = useCodesignStore((s) => s.loadConfig);
  const [prompt, setPrompt] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    void sendPrompt(prompt);
    setPrompt('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  if (!configLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--color-background)] text-[13px] text-[var(--color-text-muted)]">
        Loading…
      </div>
    );
  }

  if (config === null || !config.hasKey) {
    return <Onboarding />;
  }

  const canSend = prompt.trim().length > 0 && !isGenerating;

  return (
    <div className="h-full grid grid-cols-[360px_1fr] bg-[var(--color-background)]">
      <aside className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background-secondary)]">
        <header className="px-5 h-[52px] flex items-center border-b border-[var(--color-border-muted)]">
          <Wordmark badge="pre-alpha" />
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3">
              <span
                className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] font-medium"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Starter prompts
              </span>
              <ul className="flex flex-col gap-2">
                {BUILTIN_DEMOS.map((demo) => (
                  <li key={demo.id}>
                    <button
                      type="button"
                      onClick={() => setPrompt(demo.prompt)}
                      className="group w-full text-left px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-soft)] hover:-translate-y-[1px] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    >
                      <div className="text-[13px] font-semibold text-[var(--color-text-primary)] tracking-[-0.005em] group-hover:text-[var(--color-accent)] transition-colors duration-150">
                        {demo.title}
                      </div>
                      <div className="text-[12px] text-[var(--color-text-muted)] mt-[3px] leading-[1.5]">
                        {demo.description}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}-${m.content.slice(0, 8)}`}
                  className={`px-4 py-3 rounded-[var(--radius-lg)] text-[13px] leading-[1.55] ${
                    m.role === 'user'
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] border border-[var(--color-accent-muted)]'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border-muted)] text-[var(--color-text-primary)]'
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[var(--color-border-muted)] p-4">
          <div className="relative flex items-end gap-2 p-2 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-focus-ring)] transition-[box-shadow,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <textarea
              ref={taRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to design…"
              disabled={isGenerating}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1 text-[13px] leading-[1.5] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none min-h-[24px] max-h-[160px]"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send prompt"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white shadow-[var(--shadow-soft)] hover:bg-[var(--color-accent-hover)] hover:scale-[1.04] active:scale-[0.96] disabled:opacity-30 disabled:hover:scale-100 disabled:pointer-events-none transition-[transform,background-color,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </div>
          <div className="mt-2 px-1 text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
            <span>
              <kbd
                className="px-[5px] py-[1px] rounded-[4px] bg-[var(--color-surface-active)] text-[10px] text-[var(--color-text-secondary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Enter
              </kbd>{' '}
              to send ·{' '}
              <kbd
                className="px-[5px] py-[1px] rounded-[4px] bg-[var(--color-surface-active)] text-[10px] text-[var(--color-text-secondary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Shift+Enter
              </kbd>{' '}
              for newline
            </span>
            {isGenerating ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--color-accent)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                Generating
              </span>
            ) : null}
          </div>
        </form>
      </aside>

      <main className="flex flex-col">
        <header className="h-[52px] px-6 border-b border-[var(--color-border-muted)] flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] tracking-[-0.005em]">
            <span
              aria-hidden="true"
              className={`w-[6px] h-[6px] rounded-full ${
                previewHtml ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-strong)]'
              }`}
            />
            {previewHtml ? 'Preview' : 'No design yet'}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            BYOK · local-first · multi-model
          </span>
        </header>
        <PreviewToolbar />
        <div className="flex-1 p-6 overflow-auto">
          {previewHtml ? (
            <iframe
              key={previewHtml.length}
              title="design-preview"
              sandbox="allow-scripts"
              srcDoc={buildSrcdoc(previewHtml)}
              className="w-full h-full bg-white rounded-[var(--radius-2xl)] shadow-[var(--shadow-card)] border border-[var(--color-border)]"
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-[400px] flex flex-col items-center gap-6">
        <div className="relative inline-flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 -m-6 rounded-full"
            style={{
              background: 'radial-gradient(circle, var(--color-accent-soft), transparent 70%)',
            }}
          />
          <EmptyMark />
        </div>
        <div className="flex flex-col gap-2 relative">
          <h2 className="text-[24px] font-semibold text-[var(--color-text-primary)] tracking-[-0.01em] leading-[1.2]">
            A blank canvas, ready when you are.
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] leading-[1.6]">
            Pick a starter on the left, or describe what you want to design. The result renders here
            in a sandboxed preview.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyMark() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="relative"
    >
      <title>open-codesign canvas</title>
      <rect
        x="10.5"
        y="10.5"
        width="51"
        height="51"
        rx="8"
        stroke="var(--color-border-strong)"
        strokeDasharray="3 5"
        strokeWidth="1"
      />
      <rect
        x="25"
        y="25"
        width="22"
        height="22"
        rx="4"
        fill="var(--color-surface)"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
      />
      <circle cx="36" cy="36" r="3.5" fill="var(--color-accent)" />
    </svg>
  );
}
