import { QueryClient, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { FormStatus, HostMessage, PanelSnapshot, PanelTab, WebviewMessage } from './protocol.js';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const api = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

export function send(msg: WebviewMessage): void {
  api?.postMessage(msg);
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

let resolveFirst: (snapshot: PanelSnapshot) => void = () => {};
const firstSnapshot = new Promise<PanelSnapshot>((resolve) => (resolveFirst = resolve));

// The host pushes all state. The panel never polls.
window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  const msg = event.data;
  if (msg.type === 'snapshot') {
    resolveFirst(msg.snapshot);
    queryClient.setQueryData(['snapshot'], msg.snapshot);
  } else if (msg.type === 'show_tab') {
    queryClient.setQueryData(['tab'], msg.tab);
  } else if (msg.type === 'form_status') {
    queryClient.setQueryData(['form', msg.form.target], msg.form);
  }
});

export function useSnapshot(): PanelSnapshot {
  return useSuspenseQuery({ queryKey: ['snapshot'], queryFn: () => firstSnapshot }).data;
}

export function useTab(): [PanelTab, (tab: PanelTab) => void] {
  const { data } = useQuery<PanelTab>({ queryKey: ['tab'], queryFn: () => 'usage', initialData: 'usage' });
  return [data, (tab) => queryClient.setQueryData(['tab'], tab)];
}

const IDLE = (target: string): FormStatus => ({ target, status: 'idle' });

export function useForm(target: string): [FormStatus, (form: FormStatus) => void] {
  const { data } = useQuery<FormStatus>({
    queryKey: ['form', target],
    queryFn: () => IDLE(target),
    initialData: IDLE(target),
  });
  return [data, (form) => queryClient.setQueryData(['form', target], form)];
}
