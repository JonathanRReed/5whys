import * as React from 'react';
import { ToastProvider } from './ui/toast';

export default function WithToasts({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
