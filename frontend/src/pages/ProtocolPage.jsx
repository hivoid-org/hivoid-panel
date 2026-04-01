import { useEffect, useState, useCallback } from 'react';
import { 
  Play as PlayIcon, 
  Square as SquareIcon, 
  RotateCcw as RotateCcwIcon, 
  RefreshCw as RefreshCwIcon, 
  Loader2 as LoaderIcon, 
  Activity as ActivityIcon, 
  Clock as ClockIcon, 
  Hash as HashIcon, 
  Server as ServerIcon, 
  Wifi as WifiIcon, 
  WifiOff as WifiOffIcon, 
  FileCode as FileCodeIcon, 
  Shield as ShieldIcon, 
  Settings2 as SettingsIcon, 
  Save as SaveIcon, 
  FileJson as FileJsonIcon, 
  Zap as ZapIcon, 
  Globe as GlobeIcon, 
  Cpu as CpuIcon, 
  Lock as LockIcon, 
  Terminal as TerminalIcon, 
  Filter as FilterIcon, 
  Binary as BinaryIcon,
  Download as DownloadIcon,
} from 'lucide-react';
import { protocol, users as usersApi, settings as settingsApi } from '../api';
import GeoTagPicker from '../components/GeoTagPicker';
import { ROUTE_CATEGORIES } from '../constants';
import clsx from 'clsx';

export default function ProtocolPage() {
  const [status, setStatus] = useState(null);
  const [userCount, setUserCount] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('core');

  const fetchStatus = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([protocol.status(), usersApi.count()]);
      setStatus(s);
      setUserCount(u);
    } catch (e) { console.error(e); }
  }, []);

  const loadAll = useCallback(async () => {
      try {
          await fetchStatus();
          const p = await settingsApi.get();
          let parsed = {};
          if (p.hivoid_config) {
              try { parsed = JSON.parse(p.hivoid_config); } catch (e) { }
          }
          setConfig({
              mode: parsed.mode || 'performance',
              log_level: parsed.log_level || 'info',
              connection_tracking: parsed.connection_tracking ?? true,
              disconnect_expired: parsed.disconnect_expired ?? true,
              hot_reload: parsed.hot_reload ?? true,
              anti_probe: parsed.anti_probe ?? true,
              fallback_addr: parsed.fallback_addr || '127.0.0.1:80',
              max_conns: parsed.max_conns || 0,
              blocked_hosts: Array.isArray(parsed.blocked_hosts) ? parsed.blocked_hosts.join(", ") : '',
              allowed_hosts: Array.isArray(parsed.allowed_hosts) ? parsed.allowed_hosts.join(", ") : '',
              blocked_tags: Array.isArray(parsed.blocked_tags) ? parsed.blocked_tags.join(", ") : '',
              geosite_path: parsed.geosite_path || './geosite.dat',
              geoip_path: parsed.geoip_path || './geoip.dat',
              bypass_ips: Array.isArray(parsed.bypass_ips) ? parsed.bypass_ips.join(", ") : '127.0.0.1/32, 192.168.1.0/24',
              socks_port: parsed.socks_port || 1080,
              dns_port: parsed.dns_port || 5353,
              dns_upstream: parsed.dns_upstream || '8.8.8.8:53',
              insecure: parsed.insecure ?? true,
              pool_size: parsed.pool_size || 4,
              note: parsed.note || ''
          });
      } finally {
          setLoading(false);
      }
  }, [fetchStatus]);

  useEffect(() => { loadAll(); const id = setInterval(fetchStatus, 4000); return () => clearInterval(id); }, [loadAll, fetchStatus]);

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const executeAction = async (type) => {
    setActionLoading(type);
    try {
      let r;
      if (type === 'start') r = await protocol.start();
      if (type === 'stop') r = await protocol.stop();
      if (type === 'restart') r = await protocol.restart();
      if (type === 'sync') r = await protocol.syncConfig();
      if (type === 'cert') r = await protocol.generateCert();
      if (type === 'geodata') r = await protocol.downloadGeodata();
      notify(r.message || 'Done');
      await fetchStatus();
    } catch (e) { notify(e.message, false); }
    finally { setActionLoading(null); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
        const payload = {
            ...config,
            blocked_hosts: config.blocked_hosts.split(',').map(s=>s.trim()).filter(Boolean),
            allowed_hosts: config.allowed_hosts.split(',').map(s=>s.trim()).filter(Boolean),
            blocked_tags: config.blocked_tags.split(',').map(s=>s.trim()).filter(Boolean),
            bypass_ips: config.bypass_ips.split(',').map(s=>s.trim()).filter(Boolean),
        };
        await settingsApi.update({ hivoid_config: JSON.stringify(payload) });
        notify('Advanced configuration saved successfully.');
        await protocol.syncConfig(); 
    } catch (e) { notify(e.message, false); }
    finally { setSavingConfig(false); }
  };

  if (loading || !config) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-white rounded-full animate-spin" /></div>;

  const running = status?.running;

  return (
    <div className="space-y-6 animate-in w-full pb-12">
      {toast && (
        <div className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium animate-in shadow-apple-lg',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>{toast.msg}</div>
      )}

      {/* Header with quick stats */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Core Status Card */}
        <div className="card lg:w-1/3 p-8 flex flex-col items-center text-center justify-center relative overflow-hidden">
          <div className={clsx(
            "mb-8 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-apple-sm",
            running ? "bg-success/5 text-success border border-success/10" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
          )}>
            CORE HIVOID ENGINE {status?.version || 'V0.10.0'} (v{__APP_VERSION__})
          </div>
          <div className={clsx(
            'w-24 h-24 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 shadow-inner mb-6',
            running ? 'bg-success/5' : 'bg-neutral-50 dark:bg-neutral-900'
          )}>
            <div className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all",
              running ? "bg-success shadow-success/40 shadow-apple-lg" : "bg-neutral-300 dark:bg-neutral-700"
            )}>
              <ActivityIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight mb-1">HiVoid Server</h2>
            <p className={clsx("text-xs font-bold uppercase tracking-widest", running ? "text-success" : "text-danger")}>
              {running ? 'Engine Active' : 'Engine Inactive'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-8 w-full">
            {!running ? (
              <button onClick={() => executeAction('start')} disabled={!!actionLoading} className="btn-primary w-full h-12 rounded-2xl flex-1">
                {actionLoading === 'start' ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <PlayIcon className="w-4 h-4 fill-current mr-1" />}
                Boot System
              </button>
            ) : (
              <div className="flex gap-2 w-full">
                <button onClick={() => executeAction('restart')} disabled={!!actionLoading} className="btn-secondary h-12 rounded-2xl flex-1">
                  <RotateCcwIcon className={clsx('w-4 h-4 mr-1', actionLoading === 'restart' && 'animate-spin')} />
                  Restart
                </button>
                <button onClick={() => executeAction('stop')} disabled={!!actionLoading} className="btn bg-neutral-100 dark:bg-neutral-800 text-danger hover:bg-danger/10 h-12 rounded-2xl flex-1">
                  {actionLoading === 'stop' ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <SquareIcon className="w-4 h-4 fill-current mr-1" />}
                  Halt
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid Card */}
        <div className="flex-1 card p-8 grid grid-cols-2 md:grid-cols-4 gap-6 content-center">
            <QuickStat icon={BinaryIcon} label="Binary Path" value={status?.binary || '/usr/local/bin/hivoid-server'} small />
            <QuickStat icon={HashIcon} label="Process ID" value={status?.pid || 'None'} />
            <QuickStat icon={ClockIcon} label="Total Uptime" value={status?.uptime || '0s'} />
            <QuickStat icon={ActivityIcon} label="Active Flows" value={`${userCount.active} Clients`} />
            <QuickStat icon={CpuIcon} label="Engine Mode" value={config.mode} />
            <QuickStat icon={ShieldIcon} label="Anti-Probe" value={config.anti_probe ? 'Enabled' : 'Disabled'} />
            <QuickStat icon={RefreshCwIcon} label="Hot Reload" value={config.hot_reload ? 'Active' : 'Standby'} />
            <button onClick={() => executeAction('sync')} disabled={!!actionLoading} className="btn-secondary h-full rounded-2xl border-dashed border-2 flex flex-col items-center justify-center py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                 {actionLoading === 'sync' ? <LoaderIcon className="w-4 h-4 animate-spin mb-1" /> : <RefreshCwIcon className="w-4 h-4 mb-1" />}
                 <span className="text-[10px] font-black uppercase">Sync Engine</span>
            </button>
        </div>
      </div>

      {/* Main Settings Studio */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 space-y-2 shrink-0">
          <TabNav active={activeTab === 'core'} onClick={() => setActiveTab('core')} icon={CpuIcon} label="Core Runtime" />
          <TabNav active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={LockIcon} label="Security & Cryptography" />
          <TabNav active={activeTab === 'feats'} onClick={() => setActiveTab('feats')} icon={ZapIcon} label="Capabilities" />
          {status?.geodata_installed && (
            <>
              <TabNav active={activeTab === 'aclm'} onClick={() => setActiveTab('aclm')} icon={FilterIcon} label="ACLM Filter" />
              <TabNav active={activeTab === 'routing'} onClick={() => setActiveTab('routing')} icon={GlobeIcon} label="Default Client" />
            </>
          )}
          
          <div className="pt-6">
            <button onClick={saveConfig} disabled={savingConfig} className="btn-primary w-full h-12 rounded-2xl shadow-apple-lg text-sm font-black">
                {savingConfig ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5 mr-1" />}
                Save Config
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 card p-8 min-h-[400px]">
          {activeTab === 'core' && (
            <div className="space-y-6 animate-in slide-in-from-right-2">
               <div>
                 <h3 className="text-lg font-bold">Core Runtime</h3>
                 <p className="text-xs text-neutral-500 mt-1">Foundational execution parameters and logging verbosity.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <SettingRow label="Engine Mode" sub="Performance vs Stealth tradeoffs.">
                    <select value={config.mode} onChange={e => setConfig({...config, mode: e.target.value})} className="input font-bold">
                        <option value="performance">Performance</option>
                        <option value="high_performance">High Performance</option>
                        <option value="stealth">Stealth</option>
                        <option value="balanced">Balanced</option>
                        <option value="adaptive">Adaptive</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Log Level" sub="Internal access and system verbosity.">
                    <select value={config.log_level} onChange={e => setConfig({...config, log_level: e.target.value})} className="input font-bold">
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Fallback Address" sub="Unauthorized traffic is forwarded here.">
                    <input value={config.fallback_addr} onChange={e => setConfig({...config, fallback_addr: e.target.value})} className="input font-mono" placeholder="127.0.0.1:80" />
                  </SettingRow>
                  <SettingRow label="Max Global Conns" sub="Limits total active streams (0=unlimited).">
                    <input type="number" value={config.max_conns} onChange={e => setConfig({...config, max_conns: parseInt(e.target.value) || 0})} className="input" />
                  </SettingRow>
               </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 animate-in slide-in-from-right-2">
               <div>
                 <h3 className="text-lg font-bold">Security & Cryptography</h3>
                 <p className="text-xs text-neutral-500 mt-1">Management of SSL/TLS certificates and identity material.</p>
               </div>
               <div className="space-y-6 pt-4">
                  <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black flex items-center justify-center shadow-apple-sm">
                           <LockIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                           <p className="text-sm font-bold">Self-Signed TLS Certificates</p>
                           <p className="text-[10px] text-neutral-400 mt-0.5">Regenerate cert.pem and key.pem instantly.</p>
                        </div>
                     </div>
                     <button onClick={() => executeAction('cert')} disabled={!!actionLoading} className="btn-secondary h-10 text-xs px-4">
                        {actionLoading === 'cert' ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />} Regenerate Keys
                     </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-black flex items-center justify-center shadow-apple-sm">
                           <GlobeIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                           <p className="text-sm font-bold">GeoData Dependencies</p>
                           <p className="text-[10px] text-neutral-400 mt-0.5">{status?.geodata_installed ? 'Dat files located in local path.' : 'Dat files are missing from system.'}</p>
                        </div>
                     </div>
                     <button onClick={() => executeAction('geodata')} disabled={!!actionLoading} className={clsx("btn h-10 text-xs px-4 rounded-xl", status?.geodata_installed ? "btn-secondary" : "btn-primary")}>
                        {actionLoading === 'geodata' ? <LoaderIcon className="w-4 h-4 animate-spin" /> : (status?.geodata_installed ? <RefreshCwIcon className="w-4 h-4 mr-2" /> : <DownloadIcon className="w-4 h-4 mr-2" />)} {status?.geodata_installed ? 'Update GeoData' : 'Install GeoData'}
                     </button>
                  </div>
                  {status?.geodata_installed ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SettingRow label="GeoIP Database Path" sub="Standard dat file for IP mapping.">
                           <input value={config.geoip_path} onChange={e => setConfig({...config, geoip_path: e.target.value})} className="input text-xs font-mono" />
                        </SettingRow>
                        <SettingRow label="GeoSite Database Path" sub="Reference for domain categorization.">
                           <input value={config.geosite_path} onChange={e => setConfig({...config, geosite_path: e.target.value})} className="input text-xs font-mono" />
                        </SettingRow>
                      </div>
                  ) : (
                      <div className="p-4 rounded-2xl bg-danger/5 border border-danger/10 text-center">
                          <p className="text-xs font-bold text-danger">Advanced routing (ACLM) requires GeoIP/GeoSite data. Click Install above to enable features.</p>
                      </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'feats' && (
            <div className="space-y-6 animate-in slide-in-from-right-2">
               <div>
                 <h3 className="text-lg font-bold">Capabilities Engine</h3>
                 <p className="text-xs text-neutral-500 mt-1">Toggle advanced server-side features and protection.</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
                  <FeatureToggle 
                    icon={RefreshCwIcon} 
                    label="Hot Reload" 
                    sub="Apply updates without restart."
                    active={config.hot_reload}
                    onToggle={() => setConfig({...config, hot_reload: !config.hot_reload})}
                  />
                  <FeatureToggle 
                    icon={ActivityIcon} 
                    label="Flow Tracking" 
                    sub="Monitor global traffic states."
                    active={config.connection_tracking}
                    onToggle={() => setConfig({...config, connection_tracking: !config.connection_tracking})}
                  />
                  <FeatureToggle 
                    icon={SquareIcon} 
                    label="Expiry Guard" 
                    sub="Force-drop expired users immediately."
                    active={config.disconnect_expired}
                    onToggle={() => setConfig({...config, disconnect_expired: !config.disconnect_expired})}
                  />
                  <FeatureToggle 
                    icon={ShieldIcon} 
                    label="Anti-Probe Tarpit" 
                    sub="Protect against active scanners."
                    active={config.anti_probe}
                    onToggle={() => setConfig({...config, anti_probe: !config.anti_probe})}
                  />
               </div>
            </div>
          )}

          {activeTab === 'aclm' && (
            <div className="space-y-6 animate-in slide-in-from-right-2">
               <div>
                 <h3 className="text-lg font-bold">ACLM Traffic Filters</h3>
                 <p className="text-xs text-neutral-500 mt-1">Host-level whitelisting and blacklisting rules.</p>
               </div>
               <div className="space-y-6 pt-4">
                  <SettingRow label="Blocked Hosts (Deny List)" sub="Domains rejected before external dial.">
                    <textarea value={config.blocked_hosts} onChange={e => setConfig({...config, blocked_hosts: e.target.value})} className="input min-h-[80px] font-mono text-xs py-3" placeholder="e.g. *.malware, domain.xyz" />
                  </SettingRow>
                  <SettingRow label="Allowed Hosts (Allow List)" sub="Explicit whitelist restricting all paths.">
                    <textarea value={config.allowed_hosts} onChange={e => setConfig({...config, allowed_hosts: e.target.value})} className="input min-h-[80px] font-mono text-xs py-3" placeholder="e.g. google.com, *.org" />
                  </SettingRow>
                  <GeoTagPicker 
                    label="Blocked GeoTags" 
                    sub="Global blocking by country or category tags."
                    value={config.blocked_tags}
                    onChange={v => setConfig({...config, blocked_tags: v})}
                  />
               </div>
            </div>
          )}

          {activeTab === 'routing' && (
            <div className="space-y-6 animate-in slide-in-from-right-2">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="text-lg font-bold">Client Defaults</h3>
                   <p className="text-xs text-neutral-500 mt-1">Bootstrap config for subscriber JSON files.</p>
                 </div>
                 <button onClick={() => executeAction('geodata')} disabled={!!actionLoading} className="btn-secondary h-10 px-4 text-xs font-bold rounded-xl">
                    {actionLoading === 'geodata' ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />} Update Geo Data
                 </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                  <SettingRow label="SOCKS Port" sub="Local proxy port."><input type="number" value={config.socks_port} onChange={e => setConfig({...config, socks_port: parseInt(e.target.value) || 1080})} className="input" /></SettingRow>
                  <SettingRow label="DNS Port" sub="Local resolver port."><input type="number" value={config.dns_port} onChange={e => setConfig({...config, dns_port: parseInt(e.target.value) || 5353})} className="input" /></SettingRow>
                  <SettingRow label="Pool size" sub="Connection pool."><input type="number" value={config.pool_size || 4} onChange={e => setConfig({...config, pool_size: parseInt(e.target.value) || 4})} className="input" /></SettingRow>
                  <div className="lg:col-span-2">
                    <SettingRow label="DNS Upstream" sub="Primary recursive resolver for clients.">
                      <input value={config.dns_upstream} onChange={e => setConfig({...config, dns_upstream: e.target.value})} className="input font-mono" />
                    </SettingRow>
                  </div>
                  <FeatureToggle label="TLS Insecure" sub="Allow invalid certs." active={config.insecure} onToggle={() => setConfig({...config, insecure: !config.insecure})} />
                  <div className="md:col-span-2 lg:col-span-3">
                    <SettingRow label="Bypass IP Ranges" sub="Intranet/Local ranges skipped by proxy.">
                      <input value={config.bypass_ips} onChange={e => setConfig({...config, bypass_ips: e.target.value})} className="input font-mono text-xs" />
                    </SettingRow>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, small }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-neutral-400" />
        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className={clsx("font-bold truncate", small ? "text-[10px] opacity-70" : "text-sm tracking-tight")}>{value}</p>
    </div>
  );
}

function SettingRow({ label, sub, children }) {
  return (
    <div className="space-y-2">
      <div className="px-0.5">
        <label className="text-sm font-bold block">{label}</label>
        <p className="text-[10px] text-neutral-400 tracking-wide">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function FeatureToggle({ icon: Icon, label, sub, active, onToggle }) {
  return (
    <button 
      onClick={onToggle}
      className={clsx(
        "flex items-center justify-between p-5 rounded-2xl border transition-all text-left",
        active ? "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-apple-sm" : "bg-neutral-50 dark:bg-neutral-950 border-transparent opacity-60"
      )}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", active ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400")}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <div className={clsx('w-10 h-6 shrink-0 rounded-full relative transition-colors ml-4', active ? 'bg-success' : 'bg-neutral-300 dark:bg-neutral-600')}>
          <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', active ? 'left-5' : 'left-1')} />
      </div>
    </button>
  );
}

function TabNav({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left",
      active 
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-apple-sm" 
        : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    )}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
