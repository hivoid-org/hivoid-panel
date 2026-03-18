import { useEffect, useState } from 'react';
import { Save, Lock, Loader2, Eye, EyeOff, Shield, Key, Check, UserCircle } from 'lucide-react';
import { settings as settingsApi, auth as authApi } from '../api';
import clsx from 'clsx';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [username, setUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  
  const [pw, setPw] = useState({ current: '', new_: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await authApi.me();
        setUsername(user.username);
        await settingsApi.get();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const notify = (msg, ok = true) => { 
    setToast({ msg, ok }); 
    setTimeout(() => setToast(null), 3000); 
  };

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) return notify("Username cannot be empty", false);
    setUsernameLoading(true);
    try {
      await authApi.updateProfile(username);
      notify('Username updated successfully');
    } catch (e) {
      notify(e.message, false);
    } finally {
      setUsernameLoading(false);
    }
  };

  const handlePw = async (e) => {
    e.preventDefault();
    if (pw.new_ !== pw.confirm) return notify("Passwords don't match", false);
    if (pw.new_.length < 6) return notify('Minimum 6 characters', false);
    setPwLoading(true);
    try {
      await authApi.changePassword(pw.current, pw.new_);
      notify('Access credentials updated');
      setPw({ current: '', new_: '', confirm: '' });
    } catch (e) { 
      notify(e.message, false); 
    } finally { 
      setPwLoading(false); 
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in pb-12">
      {toast && (
        <div className={clsx(
          'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-apple-lg flex items-center gap-3 transition-transform',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Hero Header */}
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-[2rem] bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4 border border-neutral-200 dark:border-neutral-800">
           <Shield className="w-7 h-7 text-neutral-500" />
        </div>
        <h2 className="text-xl font-black tracking-tight">System Security</h2>
        <p className="text-sm text-neutral-400 mt-1">Manage global administrator access.</p>
      </div>

      {/* Username Identity Section */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
           <UserCircle className="w-4 h-4 text-neutral-400" />
           <span className="text-sm font-bold">Username</span>
        </div>
        <div className="p-8">
          <form onSubmit={handleUpdateUsername} className="space-y-6">
            <Field label="Administrator Username">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input h-12 bg-neutral-50 dark:bg-neutral-950 px-5 font-bold text-sm"
                  required
                />
            </Field>

            <div className="pt-2">
              <button type="submit" disabled={usernameLoading} className="btn-primary w-full h-12 rounded-2xl shadow-apple-sm text-sm font-black">
                {usernameLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Username'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Security Credentials Section */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
           <Key className="w-4 h-4 text-neutral-400" />
           <span className="text-sm font-bold">Password</span>
        </div>
        <div className="p-8">
          <form onSubmit={handlePw} className="space-y-6">
            <Field label="Current Authority Password">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.current}
                  onChange={e => setPw(p => ({...p, current: e.target.value}))}
                  className="input h-12 bg-neutral-50 dark:bg-neutral-950 pr-12 font-mono text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="New Secure Key">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.new_}
                  onChange={e => setPw(p => ({...p, new_: e.target.value}))}
                  className="input h-12 bg-neutral-50 dark:bg-neutral-950 font-mono text-sm"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
              </Field>
              <Field label="Repeat New Key">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.confirm}
                  onChange={e => setPw(p => ({...p, confirm: e.target.value}))}
                  className="input h-12 bg-neutral-50 dark:bg-neutral-950 font-mono text-sm"
                  required
                />
              </Field>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={pwLoading} className="btn-primary w-full h-12 rounded-2xl shadow-apple-sm text-sm font-black">
                {pwLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Authority Key'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
