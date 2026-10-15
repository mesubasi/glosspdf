import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { Lock, Eye, EyeOff } from 'lucide-react';

export const PasswordModal: React.FC = () => {
  const { passwordModalOpen, passwordCallback, closePasswordModal, language } = usePdfStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!passwordModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordCallback) {
      passwordCallback(password);
    }
    setPassword('');
    closePasswordModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-[#252526] border border-acrobat-border dark:border-acrobat-darkBorder rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-acrobat-red/10 flex items-center justify-center text-acrobat-red">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {language === 'tr' ? 'Parola Korumalı Belge' : 'Password Protected Document'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'tr'
                ? 'Bu PDF dosyasını açmak için parola gereklidir.'
                : 'A password is required to open this PDF.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={language === 'tr' ? 'Parolayı girin...' : 'Enter password...'}
              autoFocus
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 rounded-md outline-none focus:border-acrobat-red text-slate-800 dark:text-slate-100 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={closePasswordModal}
              className="px-3 py-1.5 text-xs rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
            >
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-acrobat-red hover:bg-acrobat-darkRed text-white rounded font-medium shadow-md transition-colors"
            >
              {language === 'tr' ? 'Aç' : 'Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
