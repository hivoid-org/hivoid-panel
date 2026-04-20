import { useEffect, useState } from 'react';
import { 
  Save as SaveIcon, 
  Lock as LockIcon, 
  Loader2 as LoaderIcon, 
  Eye as EyeIcon, 
  EyeOff as EyeOffIcon, 
  Shield as ShieldIcon, 
  Key as KeyIcon, 
  Check as CheckIcon, 
  UserCircle as UserIcon,
  Terminal as TerminalIcon,
  Database as DatabaseIcon,
  Cpu as CpuIcon,
  Globe as GlobeIcon,
  Server as ServerIcon,
  Activity as ActivityIcon,
  Network as NetworkIcon,
  Settings as SettingsLucide
} from 'lucide-react';
import { settings as settingsApi, auth as authApi } from '../api';
import clsx from 'clsx';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('admin');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  const [username, setUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  
  const [pw, setPw] = useState({ current: '', new_: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Global Settings
  const [globalSettings, setGlobalSettings] = useState({
    server_address: '',
    servers: '',
    hivoid_config: '{}'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await authApi.me();
        setUsername(user.username);
        setTotpEnabled(user.totp_enabled);
        
        const sets = await settingsApi.get();
        setGlobalSettings({
          server_address: sets.server_address || '',
          servers: sets.servers || '',
          hivoid_config: sets.hivoid_config || '{}'
        });
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

  const handleUpdateGlobal = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      // Validate JSON
      try {
        JSON.parse(globalSettings.hivoid_config);
      } catch(err) {
        throw new Error("Invalid JSON in Core Configuration");
      }

      await settingsApi.update(globalSettings);
      notify('Global parameters synchronized');
    } catch (e) {
      notify(e.message, false);
    } finally {
      setSettingsLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full space-y-8 animate-in pb-12">
      {toast && (
        <div className={clsx(
          'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-apple-lg flex items-center gap-3 transition-transform',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>
          {toast.ok ? <CheckIcon className="w-4 h-4" /> : <ShieldIcon className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">
             <SettingsLucide className="w-3 h-3" /> Panel Customization
          </div>
          <h1 className="text-4xl font-black tracking-tighter">System Settings</h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Navigation */}
        <div className="w-full lg:w-72 space-y-2 shrink-0">
           <TabItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={UserIcon} label="Admin Account" />
           <TabItem active={activeTab === 'network'} onClick={() => setActiveTab('network')} icon={NetworkIcon} label="Network & Core" />
           <TabItem active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={TerminalIcon} label="Engine Paths" />
           <TabItem active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={ShieldIcon} label="Authentication" />
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 card p-8 min-h-[500px]">
           {activeTab === 'admin' && (
              <div className="space-y-8 animate-in slide-in-from-right-2">
                 <div>
                    <h3 className="text-xl font-black tracking-tight mb-1">Administrator Profile</h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">Manage primary access identity</p>
                 </div>
                 
                 <form onSubmit={handleUpdateUsername} className="space-y-6 pt-4">
                    <SettingField label="Primary Username" sub="Used for panel authentication.">
                        <div className="flex gap-3">
                           <input 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            className="input flex-1 font-bold h-12 rounded-2xl" 
                            placeholder="Administrator Name"
                           />
                           <button type="submit" disabled={usernameLoading} className="btn-primary px-8 rounded-2xl h-12 shadow-apple-lg min-w-[120px]">
                              {usernameLoading ? <LoaderIcon className="w-4 h-4 animate-spin" /> : 'Save'}
                           </button>
                        </div>
                    </SettingField>
                 </form>
                 <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                       <div>
                          <h4 className="text-sm font-black uppercase tracking-widest">Two-Factor Authentication</h4>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Secure your account with an Authenticator app</p>
                       </div>
                       <button 
                        onClick={() => setShow2FAModal(true)}
                        className={clsx(
                           "px-6 h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                           totpEnabled ? "bg-danger/10 text-danger border border-danger/20" : "bg-success/10 text-success border border-success/20"
                        )}
                       >
                          {totpEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                       </button>
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'network' && (
              <div className="space-y-8 animate-in slide-in-from-right-2">
                  <div>
                    <h3 className="text-xl font-black tracking-tight mb-1">Network & Core v1.1</h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">Global protocol distribution and engine parameters</p>
                  </div>
                  
                  <form onSubmit={handleUpdateGlobal} className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SettingField label="Primary Server Address" sub="Main entry point for clients.">
                          <input 
                            value={globalSettings.server_address} 
                            onChange={e => setGlobalSettings({...globalSettings, server_address: e.target.value})} 
                            className="input font-bold h-12 rounded-2xl" 
                            placeholder="e.g. node1.hivoid.io"
                          />
                      </SettingField>
                      <SettingField label="Multi-Server List" sub="Comma-separated for resilience.">
                          <input 
                            value={globalSettings.servers} 
                            onChange={e => setGlobalSettings({...globalSettings, servers: e.target.value})} 
                            className="input font-bold h-12 rounded-2xl" 
                            placeholder="node1:4433, node2:4433"
                          />
                      </SettingField>
                    </div>

                    <SettingField label="Global Core JSON Override" sub="Direct JSON configuration for advanced engine parameters.">
                        <textarea 
                          value={globalSettings.hivoid_config} 
                          onChange={e => setGlobalSettings({...globalSettings, hivoid_config: e.target.value})} 
                          className="input font-mono text-xs p-4 min-h-[200px] rounded-2xl resize-none" 
                          placeholder='{ "anti_probe": true, "max_conns": 5000 }'
                        />
                    </SettingField>

                    <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                       <button type="submit" disabled={settingsLoading} className="btn-primary px-12 h-12 rounded-2xl shadow-apple-lg text-sm font-black min-w-[200px]">
                          {settingsLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <>Sync Global Config</>}
                       </button>
                    </div>
                  </form>
              </div>
           )}

           {activeTab === 'system' && (
              <div className="space-y-8 animate-in slide-in-from-right-2">
                  <div>
                    <h3 className="text-xl font-black tracking-tight mb-1">Engine Paths</h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">Internal directory & binary locations</p>
                 </div>
                 <div className="space-y-6 pt-4">
                      <StaticField label="Binary Execution Path" value="/usr/local/bin/hivoid-server" />
                      <StaticField label="Configuration Pipeline" value="/opt/hivoid-panel/data/server.json" />
                      <StaticField label="Persistent Database" value="/opt/hivoid-panel/backend/data/hivoid_panel.db" />
                      <StaticField label="Logging Stream" value="journalctl -u hivoid-server -f" />
                 </div>
              </div>
           )}

           {activeTab === 'security' && (
              <div className="space-y-8 animate-in slide-in-from-right-2">
                 <div>
                    <h3 className="text-xl font-black tracking-tight mb-1">Passphrase Management</h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">Rotate root access credentials</p>
                 </div>

                 <form onSubmit={handlePw} className="space-y-6 pt-4">
                    <SettingField label="Current Secret" sub="Validate existing identity.">
                        <div className="relative">
                           <input 
                            type={showPw ? 'text' : 'password'}
                            value={pw.current} 
                            onChange={e => setPw({...pw, current: e.target.value})} 
                            className="input font-mono h-12 rounded-2xl" 
                            placeholder="Required for changes"
                            required
                           />
                           <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 transition-colors">
                              {showPw ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                           </button>
                        </div>
                    </SettingField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                       <SettingField label="New Passphrase" sub="Minimum 6 characters.">
                           <input 
                            type={showPw ? 'text' : 'password'}
                            value={pw.new_} 
                            onChange={e => setPw({...pw, new_: e.target.value})} 
                            className="input font-mono h-12 rounded-2xl" 
                            placeholder="••••••••"
                            required
                           />
                       </SettingField>
                       <SettingField label="Confirm Passphrase" sub="Must match exactly.">
                           <input 
                            type={showPw ? 'text' : 'password'}
                            value={pw.confirm} 
                            onChange={e => setPw({...pw, confirm: e.target.value})} 
                            className="input font-mono h-12 rounded-2xl" 
                            placeholder="••••••••"
                            required
                           />
                       </SettingField>
                    </div>

                    <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                       <button type="submit" disabled={pwLoading} className="btn-primary px-12 h-12 rounded-2xl shadow-apple-lg text-sm font-black min-w-[200px]">
                          {pwLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <>Update Credentials</>}
                       </button>
                    </div>
                 </form>
              </div>
           )}
        </div>
      </div>

      {show2FAModal && (
        <TwoFAModal 
            enabled={totpEnabled} 
            onClose={() => setShow2FAModal(false)}
            onComplete={(en) => { setTotpEnabled(en); setShow2FAModal(false); notify(en ? '2FA Enabled' : '2FA Disabled'); }}
        />
      )}
    </div>
  );
}

function TwoFAModal({ enabled, onClose, onComplete }) {
    const [step, setStep] = useState(enabled ? 'disable' : 'intro');
    const [setup, setSetup] = useState(null);
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const startSetup = async () => {
        setLoading(true);
        try {
            const data = await authApi.totpSetup();
            setSetup(data);
            setStep('setup');
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const verifySetup = async () => {
        setLoading(true);
        try {
            await authApi.totpVerify(setup.secret, token);
            onComplete(true);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const disable = async () => {
        if (!confirm('Are you sure? This will reduce account security.')) return;
        setLoading(true);
        try {
            await authApi.totpDisable();
            onComplete(false);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[2rem] shadow-apple-2xl p-8 animate-in zoom-in-95">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black tracking-tight">{enabled ? 'Disable 2FA' : 'Setup 2FA'}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"><CheckIcon className="w-5 h-5 text-neutral-400 rotate-45" /></button>
                </div>

                {error && <div className="mb-4 text-xs font-bold text-danger bg-danger/10 p-3 rounded-xl">{error}</div>}

                {step === 'intro' && (
                    <div className="space-y-6">
                        <p className="text-xs text-neutral-500 font-medium leading-relaxed">Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to log in.</p>
                        <button onClick={startSetup} disabled={loading} className="btn-primary w-full h-12 rounded-2xl font-black">
                            {loading ? <LoaderIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Get Started'}
                        </button>
                    </div>
                )}

                {step === 'setup' && setup && (
                    <div className="space-y-6 text-center">
                        <div className="bg-white p-4 rounded-2xl inline-block mx-auto border border-neutral-100">
                            <img src={setup.qr_code} alt="QR Code" className="w-48 h-48" />
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Scan this code with Google Authenticator or Authy</p>
                        <div className="text-left space-y-4">
                            <div className="space-y-1.5 text-center">
                                <label className="text-[10px] font-bold uppercase text-neutral-500">Manual Entry Key</label>
                                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-mono text-xs select-all text-center">{setup.secret}</div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-neutral-500 block text-center">Verification Token</label>
                                <input 
                                    value={token} 
                                    onChange={e => setToken(e.target.value)} 
                                    className="input text-center text-xl font-bold tracking-[0.5em] h-14" 
                                    placeholder="000000"
                                    maxLength={6}
                                />
                            </div>
                        </div>
                        <button onClick={verifySetup} disabled={loading || token.length < 6} className="btn-primary w-full h-12 rounded-2xl font-black">
                             {loading ? <LoaderIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Verify & Enable'}
                        </button>
                    </div>
                )}

                {step === 'disable' && (
                    <div className="space-y-6">
                        <p className="text-xs text-neutral-500 font-medium leading-relaxed">Disabling 2FA will make your account vulnerable to password-only attacks. Continue?</p>
                        <button onClick={disable} disabled={loading} className="btn bg-danger/10 hover:bg-danger/20 text-danger w-full h-12 rounded-2xl font-black">
                            {loading ? <LoaderIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Disable'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function TabItem({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={clsx(
      "flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all w-full text-left",
      active 
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-apple-lg" 
        : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    )}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function SettingField({ label, sub, children }) {
  return (
    <div className="space-y-2">
      <div className="px-1">
        <label className="text-sm font-black tracking-tight block">{label}</label>
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function StaticField({ label, value }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
       <span className="text-xs font-bold text-neutral-500">{label}</span>
       <span className="text-[11px] font-black font-mono text-neutral-900 dark:text-white mt-1 md:mt-0">{value}</span>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4">
       <div className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <Icon className="w-5 h-5 text-neutral-400" />
       </div>
       <div>
          <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{label}</p>
          <p className="text-sm font-black">{value}</p>
       </div>
    </div>
  );
}


