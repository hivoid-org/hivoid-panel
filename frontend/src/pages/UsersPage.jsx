import { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, Trash2, Edit3, X, RefreshCw, Loader2, UserCheck, Fingerprint,
  Calendar, Download, Upload, Copy, Share2, Check, FileJson, Link, Zap
} from 'lucide-react';
import { users as usersApi } from '../api';
import clsx from 'clsx';

const MODES = [
  { value: 'performance', label: 'Performance' },
  { value: 'high_performance', label: 'High Performance' },
  { value: 'stealth', label: 'Stealth' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'adaptive', label: 'Adaptive' },
];
const OBFS = [
  { value: 'none', label: 'None' },
  { value: 'random', label: 'Random' },
  { value: 'http', label: 'HTTP' },
  { value: 'tls', label: 'TLS' },
];

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
    const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b)/Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
  };

  return (
    <div className="space-y-6 animate-in max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium animate-in',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Users</h2>
          <p className="text-sm text-neutral-500">{users.length} registered · {users.filter(u => u.enabled).length} active</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 w-64"
              placeholder="Search..."
            />
          </div>
          <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add user
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden md:table-cell">UUID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Mode / Obfs</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Traffic</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden xl:table-cell">Limits</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-neutral-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  {/* Name */}
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      {u.email && <p className="text-xs text-neutral-400 mt-0.5">{u.email}</p>}
                    </div>
                  </td>
                  {/* UUID */}
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <button
                      onClick={() => { navigator.clipboard.writeText(u.uuid); notify('UUID copied'); }}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-mono transition-colors"
                    >
                      {u.uuid.substring(0, 8)}…
                      <Copy className="w-3 h-3" />
                    </button>
                  </td>
                  {/* Mode / Obfs */}
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{u.mode}</span>
                    {u.obfs !== 'none' && <span className="text-xs text-neutral-400 ml-1.5">· {u.obfs}</span>}
                  </td>
                  {/* Traffic */}
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1"><ArrowDown className="w-3 h-3" />{fmtBytes(u.bytes_in)}</span>
                      <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />{fmtBytes(u.bytes_out)}</span>
                    </div>
                  </td>
                  {/* Limits */}
                  <td className="px-5 py-3.5 hidden xl:table-cell text-xs text-neutral-500">
                    {u.max_connections || '∞'} conns · {u.bandwidth_limit ? `${u.bandwidth_limit} KB/s` : '∞'}
                    {u.expire_at && (
                      <span className={clsx('block mt-0.5', new Date(u.expire_at) < new Date() ? 'text-danger' : '')}>
                        Exp: {new Date(u.expire_at).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-5 py-3.5 text-center">
                    <span className={clsx(
                      'inline-block w-2 h-2 rounded-full',
                      u.enabled ? 'bg-success' : 'bg-neutral-300 dark:bg-neutral-600'
                    )} />
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleUser(u)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors" title={u.enabled ? 'Disable' : 'Enable'}>
                        <UserCheck className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditUser(u); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setConfigUser(u); setShowConfigModal(true); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-primary transition-colors" title="Configuration">
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteUser(u)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-danger transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          onSaved={() => { setShowModal(false); load(); notify(editUser ? 'User updated' : 'User created'); }}
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

function ArrowDown(props) {
  return <Download {...props} />;
}
function ArrowUp(props) {
  return <Upload {...props} />;
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    uuid: user?.uuid || '',
    max_connections: user?.max_connections || 0,
    data_limit_gb: user?.data_limit_gb || 0,
    bandwidth_limit: user?.bandwidth_limit || 0,
    expire_at: user?.expire_at || '',
    mode: user?.mode || 'performance',
    obfs: user?.obfs || 'none',
    enabled: user?.enabled ?? true,
    note: user?.note || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const genUuid = async () => {
    try { const d = await usersApi.generateUuid(); setForm(f => ({ ...f, uuid: d.uuid })); }
    catch (e) { setError(e.message); }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 max-h-[90vh] overflow-y-auto animate-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold">{isEdit ? 'Edit user' : 'Create user'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-sm font-medium">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name"><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required /></Field>
            <Field label="Email"><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" /></Field>
          </div>

          {!isEdit && (
            <Field label="UUID">
              <div className="flex gap-2">
                <input value={form.uuid} onChange={e => setForm({...form, uuid: e.target.value})} className="input flex-1 font-mono text-xs" placeholder="Auto-generate if empty" />
                <button type="button" onClick={genUuid} className="btn-secondary shrink-0"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </Field>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Max conns"><input type="number" value={form.max_connections} onChange={e => setForm({...form, max_connections: parseInt(e.target.value) || 0})} className="input" min="0" /></Field>
            <Field label="Data (GB)"><input type="number" value={form.data_limit_gb} onChange={e => setForm({...form, data_limit_gb: parseInt(e.target.value) || 0})} className="input" min="0" /></Field>
            <Field label="Speed (KB/s)"><input type="number" value={form.bandwidth_limit} onChange={e => setForm({...form, bandwidth_limit: parseInt(e.target.value) || 0})} className="input" min="0" /></Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Expiry">
              <input type="datetime-local" value={form.expire_at ? form.expire_at.substring(0, 16) : ''} onChange={e => setForm({...form, expire_at: e.target.value ? new Date(e.target.value).toISOString() : ''})} className="input text-xs" />
            </Field>
            <Field label="Mode">
              <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})} className="input">
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Obfuscation">
              <select value={form.obfs} onChange={e => setForm({...form, obfs: e.target.value})} className="input">
                {OBFS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <span className="text-sm font-medium">Enabled</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
              className={clsx('w-10 h-6 rounded-full relative transition-colors', form.enabled ? 'bg-success' : 'bg-neutral-300 dark:bg-neutral-600')}
            >
              <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', form.enabled ? 'left-5' : 'left-1')} />
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full h-10 mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save changes' : 'Create user'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-0.5">{label}</label>
      {children}
    </div>
  );
}

function ConfigModal({ user, onClose, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    usersApi.getConfig(user.id)
      .then(setData)
      .catch(e => notify(e.message, false))
      .finally(() => setLoading(false));
  }, [user.id, notify]);

  const copy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 animate-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold">Client Configuration</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{user.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-300" /></div>
        ) : (
          <div className="space-y-6">
            {/* JSON Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-400 px-1">
                <span className="flex items-center gap-1.5"><FileJson className="w-3.5 h-3.5" /> Client JSON</span>
                <button 
                  onClick={() => copy(JSON.stringify(data.json, null, 2), 'json')} 
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {copied === 'json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === 'json' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl text-[11px] font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto max-h-48 border border-neutral-100 dark:border-neutral-800">
                {JSON.stringify(data.json, null, 2)}
              </pre>
            </div>

            {/* URL Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-400 px-1">
                <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" /> Subscription URL</span>
                <button 
                  onClick={() => copy(data.url, 'url')} 
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {copied === 'url' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === 'url' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <code className="text-[11px] font-mono text-neutral-500 truncate flex-1">{data.url}</code>
              </div>
            </div>

            {/* Protocol Link Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-400 px-1">
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-500" /> Protocol Link (One-Click)</span>
                <button 
                  onClick={() => copy(data.protocol, 'protocol')} 
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {copied === 'protocol' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === 'protocol' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <code className="text-[11px] font-mono text-neutral-500 truncate flex-1">{data.protocol}</code>
              </div>
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-secondary w-full h-10 mt-6">Close</button>
      </div>
    </div>
  );
}
