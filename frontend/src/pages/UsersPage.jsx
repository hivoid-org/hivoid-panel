import { useEffect, useState, useCallback } from 'react';
import {
  Search as SearchIcon, 
  Plus as PlusIcon, 
  Trash2 as TrashIcon, 
  Edit3 as EditIcon, 
  X as CloseIcon, 
  RefreshCw as RefreshIcon, 
  Loader2 as LoaderIcon, 
  UserCheck as UserCheckIcon, 
  Fingerprint as FingerprintIcon,
  Calendar as CalendarIcon, 
  Download as DownloadIcon, 
  Upload as UploadIcon, 
  Copy as CopyIcon, 
  Share2 as ShareIcon, 
  Check as CheckIcon, 
  FileJson as JsonIcon, 
  Link as LinkIcon, 
  Zap as ZapIcon,
  Globe as GlobeIcon, 
  Shield as ShieldIcon, 
  Gauge as GaugeIcon, 
  Cpu as CpuIcon, 
  User as UserIcon, 
  Mail as MailIcon, 
  Database as DatabaseIcon, 
  Info as InfoIcon, 
  Activity as ActivityIcon, 
  Clock as ClockIcon,
  Lock as LockIcon
} from 'lucide-react';
import { users as usersApi, protocol as protocolApi } from '../api';
import GeoTagPicker from '../components/GeoTagPicker';
import { MODES, OBFS, ROUTE_CATEGORIES } from '../constants';
import clsx from 'clsx';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [configUser, setConfigUser] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try { setUsers(await usersApi.list({ search: search || undefined })); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [load]);

  const notify = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const toggleUser = async (u) => {
    try { await usersApi.toggle(u.id); notify(`${u.name} toggled`); load(); }
    catch (e) { notify(e.message, false); }
  };
  const deleteUser = async (u) => {
    if (!confirm(`Delete "${u.name}"?`)) return;
    try { await usersApi.delete(u.id); notify(`${u.name} deleted`); load(); }
    catch (e) { notify(e.message, false); }
  };

  const fmtBytes = (b) => {
    if (!b) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB'];
    const idx = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, idx)).toFixed(1)) + ' ' + s[idx];
  };

  return (
    <div className="space-y-6 animate-in w-full pb-12">
      {toast && (
        <div className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium animate-in shadow-apple-lg',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>{toast.msg}</div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">Identity Management</h2>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">
             <span>{users.length} Total Registered</span>
             <span className="w-1 h-1 rounded-full bg-neutral-300" />
             <span className="text-success">{users.filter(u => u.enabled).length} Active</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary transition-colors" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10 w-full md:w-72 h-11 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800"
              placeholder="Query Name, UUID or Email..."
            />
          </div>
          <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn-primary h-11 px-6 rounded-2xl shadow-apple-sm">
            <PlusIcon className="w-4 h-4 mr-1.5" strokeWidth={3} />
            Provision User
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
                <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Subscriber Identity</th>
                <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest hidden lg:table-cell">Heuristics</th>
                <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest hidden md:table-cell">Throughput</th>
                <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest hidden xl:table-cell">Quotas & Expiry</th>
                <th className="text-center px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-24"><LoaderIcon className="w-6 h-6 animate-spin mx-auto text-neutral-300" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-24 text-neutral-400 font-bold">Zero users matching current scope.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className={clsx("hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-all", !u.enabled && "opacity-60")}>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-500 text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                       </div>
                       <div className="min-w-0">
                          <p className="font-bold tracking-tight truncate">{u.name}</p>
                          <p className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{u.uuid}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md self-start">{u.mode || 'performance'}</span>
                       <span className="text-[10px] font-bold text-neutral-400 ml-0.5">{u.obfs !== 'none' ? `Obfs: ${u.obfs}` : 'No Encryption'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden md:table-cell">
                    <div className="space-y-1.5">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                          <DownloadIcon className="w-3 h-3 text-success" /> {fmtBytes(u.bytes_in)}
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                          <UploadIcon className="w-3 h-3 text-primary" /> {fmtBytes(u.bytes_out)}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 hidden xl:table-cell">
                    <div className="text-[11px] space-y-1">
                       <p className="font-bold text-neutral-600 dark:text-neutral-400">{u.max_connections || '∞'} Streams · {u.bandwidth_limit ? `${u.bandwidth_limit} KB/s` : 'Unlmt'}</p>
                       {u.expire_at ? (
                          <div className={clsx("flex items-center gap-1.5 font-black uppercase text-[9px]", new Date(u.expire_at) < new Date() ? "text-danger" : "text-neutral-400")}>
                             <ClockIcon className="w-3 h-3" /> {new Date(u.expire_at).toLocaleDateString()}
                          </div>
                       ) : <p className="text-[9px] font-black uppercase text-neutral-300">Lifetime Active</p>}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      u.enabled ? "bg-success/10 text-success" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                    )}>
                      <span className={clsx("w-1.5 h-1.5 rounded-full", u.enabled ? "bg-success shadow-success/40" : "bg-neutral-300")} />
                      {u.enabled ? 'Active' : 'Halted'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <GridActionButton icon={UserCheckIcon} onClick={() => toggleUser(u)} color="hover:text-success" title={u.enabled ? 'Suspend' : 'Resume'} />
                       <GridActionButton icon={ShareIcon} onClick={() => { setConfigUser(u); setShowConfigModal(true); }} color="hover:text-primary" title="Export Config" />
                       <GridActionButton icon={EditIcon} onClick={() => { setEditUser(u); setShowModal(true); }} color="hover:text-neutral-900 dark:hover:text-white" title="Modify" />
                       <GridActionButton icon={TrashIcon} onClick={() => deleteUser(u)} color="hover:text-danger" title="Purge" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); notify(editUser ? 'Identity parameters updated' : 'Subscriber provisioned'); }}
        />
      )}

      {showConfigModal && (
        <ConfigModal
          user={configUser}
          onClose={() => setShowConfigModal(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

function GridActionButton({ icon: Icon, onClick, color, title }) {
  return (
    <button onClick={onClick} className={clsx("p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-all", color)} title={title}>
       <Icon className="w-4 h-4" />
    </button>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [activeTab, setActiveTab] = useState('basic');
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    uuid: user?.uuid || '',
    max_connections: user?.max_connections || 0,
    max_ips: user?.max_ips || 0,
    bind_ip: user?.bind_ip || '',
    data_limit_gb: user?.data_limit_gb || 0,
    bandwidth_limit: user?.bandwidth_limit || 0,
    expire_at: user?.expire_at || '',
    mode: user?.mode || 'adaptive',
    obfs: user?.obfs || 'none',
    enabled: user?.enabled ?? true,
    note: user?.note || '',
    pool_size: user?.pool_size || 4,
    bypass_domains: user?.bypass_domains || 'localhost',
    bypass_ips: user?.bypass_ips || '127.0.0.1/32, 192.168.1.0/24',
    geoip_path: user?.geoip_path || './geoip.dat',
    geosite_path: user?.geosite_path || './geosite.dat',
    direct_route: user?.direct_route || 'category-ads',
    cert_pin: user?.cert_pin || '',
    blocked_hosts: user?.blocked_hosts || '',
    blocked_tags: user?.blocked_tags || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    protocolApi.status().then(setStatus).catch(console.error);
  }, []);

  const [bandwidthUI, setBandwidthUI] = useState(() => {
    const val = user?.bandwidth_limit || 0;
    if (val >= 1048576) return { value: Math.round(val / 1048576), unit: 'GB' };
    if (val >= 1024) return { value: Math.round(val / 1024), unit: 'MB' };
    return { value: val, unit: 'KB' };
  });

  const updateBandwidth = (v, u) => {
    setBandwidthUI({ value: v, unit: u });
    let kb = parseInt(v) || 0;
    if (u === 'MB') kb *= 1024;
    if (u === 'GB') kb *= 1048576;
    setForm(f => ({ ...f, bandwidth_limit: kb }));
  };

  const genUuid = async () => {
    try { const d = await usersApi.generateUuid(); setForm(f => ({ ...f, uuid: d.uuid })); }
    catch (e) { setError(e.message); }
  };

  const fetchPin = () => {
    if (status?.cert_pin) {
        setForm(f => ({ ...f, cert_pin: status.cert_pin }));
    }
  };


  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) await usersApi.update(user.id, form);
      else await usersApi.create(form);
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const tabClass = (id) => clsx(
    "flex-1 text-center py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
    activeTab === id ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white" : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-[2rem] shadow-apple-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <form onSubmit={submit}>
          <div className="px-8 pt-8 pb-6 border-b border-neutral-100 dark:border-neutral-800">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black tracking-tight">{isEdit ? 'Modify Subscriber' : 'Provision Subscriber'}</h3>
                <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"><CloseIcon className="w-5 h-5 text-neutral-400" /></button>
             </div>
             <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Global Identity & Runtime Pipeline Settings</p>
          </div>

          <div className="flex bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
             <button type="button" onClick={() => setActiveTab('basic')} className={tabClass('basic')}>Basic Identity</button>
             <button type="button" onClick={() => setActiveTab('limits')} className={tabClass('limits')}>Quotas & Limits</button>
             <button type="button" onClick={() => setActiveTab('routing')} className={tabClass('routing')}>Advanced Routing</button>
          </div>

          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {error && <div className="mb-6 p-4 rounded-2xl bg-danger/10 text-danger text-[11px] font-bold border border-danger/20">{error}</div>}

            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in slide-in-from-right-2">
                 <div className="grid grid-cols-2 gap-6">
                    <UserPropField label="Display Name" icon={UserIcon}><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input font-bold" placeholder="e.g. John Doe" required /></UserPropField>
                    <UserPropField label="Email Address" icon={MailIcon}><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" placeholder="Optional identifier" /></UserPropField>
                 </div>
                 {!isEdit && (
                    <UserPropField label="Subscriber UUID (Primary Key)" icon={FingerprintIcon}>
                        <div className="flex gap-2">
                           <input value={form.uuid} onChange={e => setForm({...form, uuid: e.target.value})} className="input flex-1 font-mono text-xs" placeholder="Auto-gen on empty" />
                           <button type="button" onClick={genUuid} className="btn-secondary h-11 w-11 rounded-2xl"><RefreshIcon className="w-4 h-4" /></button>
                        </div>
                    </UserPropField>
                 )}
                 <div className="grid grid-cols-2 gap-6">
                    <UserPropField label="Engine Mode" icon={CpuIcon}>
                        <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})} className="input font-bold">
                           {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </UserPropField>
                    <UserPropField label="Evasion / Obfs" icon={ShieldIcon}>
                        <select value={form.obfs} onChange={e => setForm({...form, obfs: e.target.value})} className="input">
                           {OBFS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </UserPropField>
                 </div>
                 <UserPropField label="Subscriber Note" icon={InfoIcon}><textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="input h-20 text-xs py-3" placeholder="Admin remarks..." /></UserPropField>
              </div>
            )}

            {activeTab === 'limits' && (
              <div className="space-y-6 animate-in slide-in-from-right-2">
                 <div className="grid grid-cols-2 gap-6">
                    <UserPropField label="Max Concurrency" icon={ActivityIcon}><input type="number" value={form.max_connections} onChange={e => setForm({...form, max_connections: parseInt(e.target.value) || 0})} className="input font-bold" min="0" /></UserPropField>
                    <UserPropField label="IP Session Limit" icon={GlobeIcon}><input type="number" value={form.max_ips} onChange={e => setForm({...form, max_ips: parseInt(e.target.value) || 0})} className="input font-bold" min="0" /></UserPropField>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <UserPropField label="Traffic Quota (GB)" icon={DatabaseIcon}><input type="number" value={form.data_limit_gb} onChange={e => setForm({...form, data_limit_gb: parseInt(e.target.value) || 0})} className="input font-bold" min="0" /></UserPropField>
                    <UserPropField label="Bandwidth Limit" icon={GaugeIcon}>
                        <div className="flex gap-1.5">
                            <input type="number" value={bandwidthUI.value} onChange={e => updateBandwidth(e.target.value, bandwidthUI.unit)} className="input flex-1 font-bold" min="0" placeholder="0 = Unlimited" />
                            <select value={bandwidthUI.unit} onChange={e => updateBandwidth(bandwidthUI.value, e.target.value)} className="input w-20 py-1 px-2 text-[10px] font-black uppercase">
                                <option value="KB">KB/s</option>
                                <option value="MB">MB/s</option>
                                <option value="GB">GB/s</option>
                            </select>
                        </div>
                    </UserPropField>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <UserPropField label="Expiration Date" icon={CalendarIcon}><input type="datetime-local" value={form.expire_at ? form.expire_at.substring(0, 16) : ''} onChange={e => setForm({...form, expire_at: e.target.value ? new Date(e.target.value).toISOString() : ''})} className="input text-xs" /></UserPropField>
                    <UserPropField label="Connection Pool" icon={ActivityIcon}><input type="number" value={form.pool_size} onChange={e => setForm({...form, pool_size: parseInt(e.target.value) || 4})} className="input" min="1" max="16" /></UserPropField>
                 </div>
                 <UserPropField label="Bind Interface / IP" icon={LinkIcon}><input value={form.bind_ip} onChange={e => setForm({...form, bind_ip: e.target.value})} className="input font-mono text-xs" placeholder="Default out interface if empty" /></UserPropField>
              </div>
            )}

            {activeTab === 'routing' && (
              <div className="space-y-6 animate-in slide-in-from-right-2">
                 <UserPropField label="Cert Pin (SHA-256 Hex)" icon={LockIcon}>
                    <div className="flex gap-2">
                        <input value={form.cert_pin} onChange={e => setForm({...form, cert_pin: e.target.value})} className="input flex-1 font-mono text-[9px]" placeholder="64-char fingerprint" />
                        <button type="button" onClick={fetchPin} title="Fetch Current Server Pin" className="btn-secondary h-11 px-3 rounded-2xl flex items-center justify-center shrink-0">
                           <ZapIcon className="w-4 h-4 text-yellow-500" />
                        </button>
                    </div>
                 </UserPropField>
                 <div className="grid grid-cols-2 gap-6">
                    <AdvancedSetting label="Bypass Domains" sub="Intranet/Local routes."><input value={form.bypass_domains} onChange={e => setForm({...form, bypass_domains: e.target.value})} className="input text-xs" /></AdvancedSetting>
                    <AdvancedSetting label="Bypass IPs (CIDR)" sub="Address ranges skipped."><input value={form.bypass_ips} onChange={e => setForm({...form, bypass_ips: e.target.value})} className="input text-xs" /></AdvancedSetting>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <AdvancedSetting label="GeoIP Data Path" sub="Relative to core binary."><input value={form.geoip_path} onChange={e => setForm({...form, geoip_path: e.target.value})} className="input text-xs" /></AdvancedSetting>
                    <AdvancedSetting label="GeoSite Data Path" sub="V2Ray directory location."><input value={form.geosite_path} onChange={e => setForm({...form, geosite_path: e.target.value})} className="input text-xs" /></AdvancedSetting>
                 </div>
                 <GeoTagPicker 
                    label="Direct Route Tags" 
                    sub="Forced outbound bypass via direct."
                    value={form.direct_route}
                    onChange={v => setForm({...form, direct_route: v})}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <AdvancedSetting label="Blocked Hosts" sub="Server-side domain blacklist."><input value={form.blocked_hosts} onChange={e => setForm({...form, blocked_hosts: e.target.value})} className="input text-xs font-mono" placeholder="x.com, ads.net" /></AdvancedSetting>
                     <GeoTagPicker 
                        label="Blocked GeoTags" 
                        sub="Server-side GeoData blocking."
                        value={form.blocked_tags}
                        onChange={v => setForm({...form, blocked_tags: v})}
                     />
                  </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black uppercase text-neutral-400">Status</span>
                 <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} className={clsx('w-10 h-6 shrink-0 rounded-full relative transition-colors', form.enabled ? 'bg-success' : 'bg-neutral-300 dark:bg-neutral-600')}>
                    <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', form.enabled ? 'left-5' : 'left-1')} />
                 </button>
              </div>
              <div className="flex gap-3">
                 <button type="button" onClick={onClose} className="btn-secondary px-6 rounded-2xl h-11 text-xs font-bold border-neutral-200">Cancel</button>
                 <button type="submit" disabled={loading} className="btn-primary px-10 rounded-2xl h-11 text-xs font-black shadow-apple-lg min-w-[140px]">
                    {loading ? <LoaderIcon className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? 'Save Changes' : 'Create Subscriber'}
                 </button>
              </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserPropField({ label, icon: Icon, children }) {
  return (
    <div className="space-y-1.5 flex-1">
      <div className="flex items-center gap-1.5 ml-1">
         {Icon && <Icon className="w-3 h-3 text-neutral-400" />}
         <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}

function AdvancedSetting({ label, sub, children }) {
  return (
    <div className="space-y-1.5 flex-1">
      <div className="ml-1">
        <label className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest block">{label}</label>
        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function ConfigModal({ user, onClose, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  const reloadConfig = () => {
    setLoading(true);
    usersApi.getConfig(user.id)
      .then(setData)
      .catch(e => notify(e.message, false))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reloadConfig(); }, [user.id]);

  const copy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-apple-2xl border border-neutral-100 dark:border-neutral-800 p-8 pt-10 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center mb-8">
           <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 dark:bg-white flex items-center justify-center mb-4 shadow-apple-lg">
              <ShareIcon className="w-8 h-8 text-white dark:text-neutral-900" strokeWidth={2.5} />
           </div>
           <h3 className="text-xl font-black tracking-tight">Access Blueprint</h3>
           <p className="text-xs text-neutral-500 mt-1 font-medium">{user.name} ({user.email || 'No Linked Email'})</p>
        </div>

        {loading ? (
          <div className="py-24 flex justify-center"><LoaderIcon className="w-8 h-8 animate-spin text-neutral-200" /></div>
        ) : (
          <div className="space-y-6">
            <ConfigSection 
              icon={JsonIcon} 
              label="Subscriber JSON Bundle" 
              value={JSON.stringify(data.json, null, 2)} 
              isPre 
              onCopy={() => copy(JSON.stringify(data.json, null, 2), 'json')}
              copied={copied === 'json'}
            />
            <ConfigSection 
              icon={LinkIcon} 
              label="Universal Subscription Endpoint" 
              value={data.url} 
              onCopy={() => copy(data.url, 'url')}
              copied={copied === 'url'}
            />
            <ConfigSection 
              icon={ZapIcon} 
              label="Hivoid Protocol URI (Fast Connect)" 
              value={data.protocol} 
              onCopy={() => copy(data.protocol, 'protocol')}
              highlight 
              copied={copied === 'protocol'}
            />

            <div className="grid grid-cols-2 gap-4 mt-8 pt-4">
               <button onClick={reloadConfig} className="btn-secondary h-12 rounded-2xl text-[11px] font-black uppercase">
                  <RefreshIcon className="w-4 h-4 mr-2" /> Sync Current
               </button>
               <button 
                onClick={async () => {
                  if (!window.confirm('IRREVERSABLE: Regenerate Identity UUID?')) return;
                  try {
                    await usersApi.regenerateUuid(user.id);
                    notify('Identity regenerated');
                    reloadConfig();
                  } catch (e) { notify(e.message, false); }
                }}
                className="btn bg-danger/5 hover:bg-danger/10 text-danger border border-danger/20 h-12 rounded-2xl text-[11px] font-black uppercase"
               >
                  <FingerprintIcon className="w-4 h-4 mr-2" /> Regen UUID
               </button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="btn-primary w-full h-12 mt-6 rounded-2xl font-black shadow-apple-lg">Done</button>
      </div>
    </div>
  );
}

function ConfigSection({ icon: Icon, label, value, isPre, onCopy, copied, highlight }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
           <Icon className={clsx("w-3.5 h-3.5", highlight ? "text-yellow-500" : "text-neutral-400")} />
           <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</span>
        </div>
        <button onClick={onCopy} className="text-primary hover:underline text-[10px] font-black uppercase flex items-center gap-1.5">
           {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
           {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {isPre ? (
        <pre className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl text-[10px] font-mono text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-32 border border-neutral-100 dark:border-neutral-800">
           {value}
        </pre>
      ) : (
        <div className={clsx("bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl text-[10px] font-mono text-neutral-400 border border-neutral-100 dark:border-neutral-800 truncate", highlight && "border-yellow-500/20")}>
           {value}
        </div>
      )}
    </div>
  );
}
