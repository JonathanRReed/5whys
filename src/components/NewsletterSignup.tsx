import * as React from 'react';
import { subscribeNewsletter } from '../lib/api';
import { cn } from '../lib/utils';

type Props = {
  className?: string;
};

export default function NewsletterSignup({ className }: Props) {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || status === 'loading') return;

    setStatus('loading');
    const result = await subscribeNewsletter(email.trim());

    if (result.success) {
      setStatus('success');
      setMessage(result.message || 'You are on the list.');
      setEmail('');
    } else {
      setStatus('error');
      setMessage(result.error || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div
      className={cn(
        'rounded-3xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.2)] p-6 sm:p-8',
        className
      )}
    >
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h3 className="text-xl font-semibold text-foreground">Stay in the loop</h3>
        <p className="text-sm text-muted-foreground">
          New tools, career insights, and practical guides delivered when they are ready.
          No spam. No sales pitches.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            disabled={status === 'loading'}
            className="flex-1 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foam)/0.3)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>

        {status !== 'idle' && status !== 'loading' && (
          <p
            className={cn(
              'text-sm',
              status === 'success' ? 'text-[hsl(var(--foam))]' : 'text-[hsl(var(--destructive))]'
            )}
            role="status"
          >
            {message}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Privacy-first. No data shared. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
