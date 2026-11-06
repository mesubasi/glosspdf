import { useEffect, useState } from 'react';
import type { UpdateState } from '../types/electron';

/** Güncelleme durumu: modal kapalıyken de simgede rozet göstermek için izlenir */
export function useUpdateState(): UpdateState {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateState) return;
    const off = api.onUpdateState(setUpdateState);
    api.getUpdateState().then(({ autoDownload, ...current }) => setUpdateState(current));
    return off;
  }, []);
  return updateState;
}
