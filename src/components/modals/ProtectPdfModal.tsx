import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { t } from '@/i18n';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Download,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const ProtectPdfModal: React.FC = () => {
  const {
    protectModalOpen,
    setProtectModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!protectModalOpen || !activeTab) return null;

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setStatusMessage(null);
    setProtectModalOpen(false);
  };

  const handleProtectAndSaveAs = async () => {
    if (!password) {
      setStatusMessage({
        type: 'error',
        text: t('please_enter_a_password')
      });
      return;
    }

    if (password.length < 4) {
      setStatusMessage({
        type: 'error',
        text: t('password_must_be_at_least_4_characters')
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage({
        type: 'error',
        text: t('passwords_do_not_match')
      });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);

      // AES-256 Şifreleme uygula
      // Bekleyen düzenlemeler şifrelemeden ÖNCE yazılmalı (şifreli PDF sonradan yeniden düzenlenemez)
      const encryptedBytes = await PdfEditService.encryptPdf(
        await PdfEditService.savePdfWithAnnotations(activeTab.data.slice(), activeTab.annotations || []),
        password
      );

      const baseName = activeTab.fileName.replace(/\.pdf$/i, '');
      const protectedFileName = `${baseName}_protected.pdf`;

      // Electron ortamı varsa farklı kaydet diyaloğu aç
      if (window.electronAPI) {
        // base64 çevir
        let binary = '';
        const len = encryptedBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(encryptedBytes[i]);
        }
        const b64 = window.btoa(binary);

        const res = await window.electronAPI.savePdfAs(protectedFileName, b64, language);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: t('document_successfully_encrypted_and_saved')
          });
          setTimeout(() => {
            handleClose();
          }, 1200);
          return;
        } else if (res.canceled) {
          setIsProcessing(false);
          return;
        }
      }

      // Web/Fallback İndirme
      const blob = new Blob([encryptedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = protectedFileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: t('document_successfully_encrypted_and_downloaded')
      });

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      console.error('Encryption error:', err);
      setStatusMessage({
        type: 'error',
        text: `${t('error')} ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyToCurrent = async () => {
    if (!password || password !== confirmPassword || password.length < 4) {
      handleProtectAndSaveAs();
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);

      // Bekleyen düzenlemeler şifrelemeden ÖNCE yazılmalı (şifreli PDF sonradan yeniden düzenlenemez)
      const encryptedBytes = await PdfEditService.encryptPdf(
        await PdfEditService.savePdfWithAnnotations(activeTab.data.slice(), activeTab.annotations || []),
        password
      );

      updateTab(activeTab.id, {
        data: encryptedBytes,
        annotations: [],
        undoStack: [],
        redoStack: [],
        isModified: true
      });

      setStatusMessage({
        type: 'success',
        text: t('encryption_applied_to_active_document')
      });

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      console.error('Encryption error:', err);
      setStatusMessage({
        type: 'error',
        text: `${t('error')} ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-sm">
              {t('protect_document_with_password')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4">
          <div className="flex items-start space-x-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-amber-700 dark:text-amber-300">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {t('your_document_is_protected_using_industry_standard_iso_3')}
            </p>
          </div>

          {/* Parola Girişi */}
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('document_open_password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('enter_at_least_4_characters')}
                className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Parola Onayı */}
          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('confirm_password')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirm_password_2')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Güvenlik Notu */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <p>• {t('aes_256_robust_cryptographic_security')}</p>
            <p>• {t('if_forgotten_content_cannot_be_recovered')}</p>
          </div>

          {/* Durum Bildirimi */}
          {statusMessage && (
            <div
              className={`flex items-center space-x-2 p-2.5 rounded-lg text-xs ${
                statusMessage.type === 'error'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleProtectAndSaveAs}
            disabled={isProcessing || !password}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium shadow-md transition-colors"
          >
            {isProcessing ? (
              <span>{t('encrypting')}</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{t('save_protected_as')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
