import * as React from 'react';
import {
  applyTheme,
  isTheme,
  readAppliedTheme,
  setTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '../lib/theme';
import {
  applyTypeface,
  isTypeface,
  readAppliedTypeface,
  setTypeface,
  TYPEFACE_OPTIONS,
  TYPEFACE_STORAGE_KEY,
  type Typeface,
} from '../lib/typeface';
import { cn } from '../lib/utils';

type ModelState = 'unknown' | 'unsupported' | 'downloadable' | 'downloading' | 'available';

const MODEL_COPY: Record<ModelState, string> = {
  unknown: 'Checking this browser.',
  unsupported:
    'This browser has no built-in model. Every tool still works; suggestions come from the built-in rules.',
  downloadable:
    'This browser can add its own model. Your browser downloads it from its maker, and what you write still stays on this device. The browser decides the size and does not tell this site; it is large, often several gigabytes, so use Wi-Fi.',
  downloading: 'Your browser is downloading its model.',
  available: "Your browser's model is ready. Suggestions are written on this device.",
};

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'night', label: 'Night' },
  { value: 'dawn', label: 'Dawn' },
];

/**
 * The "Aa" button in the top bar: theme and typeface in one small panel.
 * Anchored to its button on wide screens and pinned under the header on
 * narrow ones. Closes on Escape, on an outside press, and when focus leaves.
 *
 * It renders from the defaults and picks up the applied values in an effect,
 * because the boot script has already set them on <html> before hydration.
 */
export default function DisplayMenu() {
  const [open, setOpen] = React.useState(false);
  const [theme, setThemeState] = React.useState<Theme>('night');
  const [typeface, setTypefaceState] = React.useState<Typeface>('default');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const titleId = React.useId();
  const themeName = React.useId();
  const typefaceName = React.useId();
  const [model, setModel] = React.useState<ModelState>('unknown');
  const [progress, setProgress] = React.useState<number | null>(null);

  // Ask the browser about its model only once the panel is open. This check
  // never downloads anything.
  React.useEffect(() => {
    if (!open || model !== 'unknown') return undefined;
    let cancelled = false;
    void import('../lib/local-ai').then(async ({ getBrowserModelCapability }) => {
      const capability = await getBrowserModelCapability();
      if (!cancelled) setModel(capability.state);
    });
    return () => {
      cancelled = true;
    };
  }, [open, model]);

  const downloadModel = async () => {
    setModel('downloading');
    setProgress(0);
    const { downloadBrowserModel } = await import('../lib/local-ai');
    const capability = await downloadBrowserModel({ onProgress: setProgress });
    setProgress(null);
    setModel(capability.state);
  };

  // Follow the boot script's choice, and changes made in other tabs.
  React.useEffect(() => {
    const applied = readAppliedTheme();
    if (applied) setThemeState(applied);
    setTypefaceState(readAppliedTypeface());

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isTheme(event.newValue)) {
        applyTheme(event.newValue);
        setThemeState(event.newValue);
      }
      if (event.key === TYPEFACE_STORAGE_KEY) {
        const next = isTypeface(event.newValue) ? event.newValue : 'default';
        applyTypeface(next);
        setTypefaceState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;

    const outside = (target: EventTarget | null) =>
      !(target instanceof Node && rootRef.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };
  const chooseTypeface = (next: Typeface) => {
    setTypeface(next);
    setTypefaceState(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Display settings"
        title="Display settings"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground/78 transition-colors hover:bg-overlay/35 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-overlay/35 text-foreground'
        )}
      >
        <span aria-hidden="true" className="font-display text-[1.05rem] leading-none font-medium">
          Aa
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className={cn(
            'z-50 rounded-xl bg-popover p-4 text-popover-foreground shadow-[0_28px_70px_-32px_hsl(var(--background))] animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none',
            // Narrow screens: pinned under the header, inside the gutters.
            'fixed inset-x-4 top-[4.5rem] origin-top',
            // Wider screens: anchored to the button.
            'sm:absolute sm:inset-x-auto sm:top-[calc(100%+0.5rem)] sm:right-0 sm:w-80 sm:origin-top-right'
          )}
        >
          <h2 id={titleId} className="text-base font-medium">
            Display
          </h2>

          <fieldset className="mt-3 min-w-0 border-0 p-0">
            <legend className="mb-2 text-sm text-muted-foreground">Theme</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_OPTIONS.map((option) => (
                <Choice
                  key={option.value}
                  name={themeName}
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => chooseTheme(option.value)}
                >
                  <span className="text-sm">{option.label}</span>
                </Choice>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4 min-w-0 border-0 border-t border-border/40 p-0 pt-4">
            <legend className="float-left mb-2 w-full text-sm text-muted-foreground">
              Typeface
            </legend>
            <div className="grid clear-both grid-cols-3 gap-1.5">
              {TYPEFACE_OPTIONS.map((option) => (
                <Choice
                  key={option.value}
                  name={typefaceName}
                  value={option.value}
                  checked={typeface === option.value}
                  onChange={() => chooseTypeface(option.value)}
                  label={option.label}
                >
                  <span
                    aria-hidden="true"
                    className="text-[1.375rem] leading-none"
                    style={{ fontFamily: option.family }}
                  >
                    Aa
                  </span>
                  <span aria-hidden="true" className="text-[0.7rem] leading-tight">
                    {option.label}
                  </span>
                </Choice>
              ))}
            </div>
          </fieldset>

          <p className="mt-3 text-xs text-muted-foreground">Saved on this device.</p>

          <div className="mt-4 border-t border-border/40 pt-4">
            <h3 className="font-sans text-sm text-muted-foreground">On-device AI</h3>
            <p className="mt-2 text-sm leading-relaxed" aria-live="polite">
              {MODEL_COPY[model]}
              {model === 'downloading' && progress !== null
                ? ` ${Math.round(progress * 100)} percent.`
                : ''}
            </p>
            {model === 'downloadable' && (
              <button
                type="button"
                onClick={downloadModel}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-border/60 px-3 text-sm transition-colors hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                Let my browser download its model
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ChoiceProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  /** Accessible name when the visible content is a glyph sample and a caption. */
  label?: string;
};

function Choice({ name, value, checked, onChange, children, label }: ChoiceProps) {
  return (
    <label className="relative">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          'flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-border/50 px-2 py-2 text-center text-muted-foreground transition-colors duration-150',
          'peer-hover:border-border peer-hover:text-foreground',
          'peer-checked:border-foam peer-checked:bg-foam/12 peer-checked:text-foreground',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring'
        )}
      >
        {children}
      </span>
    </label>
  );
}
