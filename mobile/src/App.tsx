import { useEffect, useState, type FormEvent } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { HomeScreen } from './screens/HomeScreen';
import { OrganizeScreen } from './screens/OrganizeScreen';
import { RecentsScreen } from './screens/RecentsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignaturesScreen } from './screens/SignaturesScreen';
import { SignScreen } from './screens/SignScreen';
import { useAnnot } from './annot/state';
import { onIncomingPdf } from './lib/documents';
import { useForm } from './lib/form';
import { useSearch } from './lib/search';
import { ToolScreen } from './screens/ToolScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { ViewerScreen } from './screens/ViewerScreen';
import { useMobile } from './store';
import { S } from './strings';

function PasswordDialog() {
  const request = useMobile((s) => s.password);
  const [value, setValue] = useState('');

  useEffect(() => setValue(''), [request]);
  if (!request) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value) request.submit(value);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={S.passwordTitle}
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(14,14,17,0.4)', paddingBottom: 'calc(var(--sab) + 16px)' }}
    >
      <form onSubmit={submit} className="glass flex w-full max-w-sm flex-col gap-3 rounded-[26px] p-5">
        <h2 className="text-[17px] font-bold tracking-[-0.02em]">{S.passwordTitle}</h2>
        <input
          type="password"
          autoFocus
          aria-label={S.passwordPlaceholder}
          placeholder={S.passwordPlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 rounded-3xl border-0 bg-[var(--card)] px-4 text-[15px] outline-none"
        />
        {request.attempt > 0 && (
          <p role="alert" className="text-[13px] font-medium" style={{ color: 'var(--red-ink)' }}>
            {S.passwordWrong}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={request.cancel}
            className="h-12 flex-1 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold"
          >
            {S.cancel}
          </button>
          <button
            type="submit"
            className="h-12 flex-1 rounded-3xl border-0 text-[15px] font-semibold text-white"
            style={{ background: 'var(--red)' }}
          >
            {S.open}
          </button>
        </div>
      </form>
    </div>
  );
}

function Toast() {
  const error = useMobile((s) => s.error);
  const dismiss = useMobile((s) => s.dismissError);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(dismiss, 4000);
    return () => window.clearTimeout(id);
  }, [error, dismiss]);

  if (!error) return null;
  return (
    <div
      role="alert"
      className="fixed left-5 right-5 z-50 rounded-3xl px-4 py-3 text-sm font-medium text-white"
      style={{ bottom: 'calc(var(--sab) + 100px)', background: 'var(--dock)' }}
    >
      {error}
    </div>
  );
}

export function App() {
  const screen = useMobile((s) => s.screen);
  const busy = useMobile((s) => s.busy);
  const hasPasswordPrompt = useMobile((s) => s.password !== null);

  useEffect(() => onIncomingPdf((uri, name) => void useMobile.getState().openIncoming(uri, name)), []);

  // Android geri tuşu: parola → vazgeç, araç → araçlar → geldiği yer, okuyucu → ana sayfa, ana sayfa → çık
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener('backButton', () => {
      const s = useMobile.getState();
      const a = useAnnot.getState();
      if (s.password) s.password.cancel();
      else if (s.screen === 'viewer' && a.active) {
        // İşaretlemede geri: önce yazma penceresi, sonra seçim, sonra araç, en son moddan çıkış
        if (a.editing) a.setEditing(null);
        else if (a.selected) a.select(null);
        else if (a.tool) a.setTool(null);
        else a.exit();
      } else if (s.screen === 'sign') s.leaveSign();
      else if (s.screen === 'settings' || s.screen === 'signatures' || s.screen === 'recents') s.goHome();
      else if (s.screen === 'tool') s.leaveTool();
      else if (s.screen === 'organize') s.leaveOrganize();
      else if (s.screen === 'tools') s.leaveTools();
      else if (s.screen === 'viewer' && useForm.getState().editing) useForm.getState().setEditing(null);
      else if (s.screen === 'viewer' && useSearch.getState().open) useSearch.getState().setOpen(false);
      else if (s.screen === 'viewer') s.closeDoc();
      else CapApp.exitApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  return (
    <div className="relative h-full" aria-busy={busy}>
      {screen === 'viewer' ? (
        <ViewerScreen />
      ) : screen === 'tools' ? (
        <ToolsScreen />
      ) : screen === 'tool' ? (
        <ToolScreen />
      ) : screen === 'organize' ? (
        <OrganizeScreen />
      ) : screen === 'sign' ? (
        <SignScreen />
      ) : screen === 'settings' ? (
        <SettingsScreen />
      ) : screen === 'signatures' ? (
        <SignaturesScreen />
      ) : screen === 'recents' ? (
        <RecentsScreen />
      ) : (
        <HomeScreen />
      )}
      {busy && !hasPasswordPrompt && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'var(--veil)' }}
          role="status"
        >
          <span className="glass rounded-3xl px-5 py-3 text-sm font-semibold">{S.opening}</span>
        </div>
      )}
      <PasswordDialog />
      <Toast />
    </div>
  );
}
