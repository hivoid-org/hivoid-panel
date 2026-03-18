import { useEffect, useState, useCallback } from 'react';
import { Play, Square, RotateCcw, RefreshCw, Loader2, Activity, Clock, Hash, Server, Wifi, WifiOff, FileCode } from 'lucide-react';
import { protocol, users as usersApi } from '../api';
import clsx from 'clsx';

export default function ProtocolPage() {
  const [status, setStatus] = useState(null);
  const [userCount, setUserCount] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([protocol.status(), usersApi.count()]);
      setStatus(s);
      setUserCount(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 4000); return () => clearInterval(id); }, [fetchAll]);

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const action = async (type) => {
    setActionLoading(type);
    try {
      let r;
      if (type === 'start') r = await protocol.start();
      if (type === 'stop') r = await protocol.stop();
      if (type === 'restart') r = await protocol.restart();
      if (type === 'sync') r = await protocol.syncConfig();
      notify(r.message || 'Done');
      await fetchAll();
    } catch (e) { notify(e.message, false); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-white rounded-full animate-spin" /></div>;

  const running = status?.running;

  return (
    <div className="space-y-6 animate-in max-w-2xl mx-auto">
      {toast && (
        <div className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium animate-in shadow-apple-lg',
          toast.ok ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-danger text-white'
        )}>{toast.msg}</div>
      )}

      {/* Hero status section */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-col items-center text-center gap-6">
          <div className={clsx(
            'w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 shadow-inner',
            running
              ? 'bg-success/10'
              : 'bg-neutral-100 dark:bg-neutral-800'
          )}>
            {running
              ? <Wifi className="w-10 h-10 text-success animate-pulse" />
              : <WifiOff className="w-10 h-10 text-neutral-300" />
            }
          </div>
          <div>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight">HiVoid Core</h2>
              <span className={clsx(
                'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border',
                running ? 'bg-success/5 text-success border-success/20' : 'bg-danger/5 text-danger border-danger/20'
              )}>
                {running ? 'Service Online' : 'Service Offline'}
              </span>
            </div>
          </div>

          {/* Core Controls */}
          <div className="flex items-center gap-3 w-full max-w-xs mt-2">
            {!running ? (
              <button onClick={() => action('start')} disabled={!!actionLoading} className="btn-primary flex-1 h-12 rounded-2xl">
                {actionLoading === 'start' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                Start Server
              </button>
            ) : (
              <>
                <button onClick={() => action('restart')} disabled={!!actionLoading} className="btn-secondary flex-1 h-12 rounded-2xl border-neutral-200 dark:border-neutral-700">
                  <RotateCcw className={clsx('w-5 h-5', actionLoading === 'restart' && 'animate-spin')} />
                  Restart
                </button>
                <button onClick={() => action('stop')} disabled={!!actionLoading} className="btn bg-neutral-100 dark:bg-neutral-800 text-danger hover:bg-danger/10 flex-1 h-12 rounded-2xl">
                  {actionLoading === 'stop' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Binary info block */}
        <div className="mt-8 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800">
           <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
              <FileCode className="w-4 h-4 shrink-0" />
              <span className="truncate">/usr/local/bin/hivoid-server</span>
           </div>
        </div>

        {/* Quick Stats Grid */}
        {running && (
          <div className="grid grid-cols-2 gap-4 mt-8">
            <StatItem icon={Hash} label="Process Identifier" value={status.pid || '—'} />
            <StatItem icon={Clock} label="Operational Time" value={status.uptime || '—'} />
            <StatItem icon={Activity} label="Connected Clients" value={userCount.active} />
            <StatItem icon={Server} label="Pool Capacity" value={userCount.total} />
          </div>
        )}
      </div>

      {/* Sync Card */}
      <div className="card p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Synchronize</h3>
            <p className="text-xs text-neutral-400 mt-1">Deploy user updates without downtime.</p>
          </div>
          <button onClick={() => action('sync')} disabled={!!actionLoading} className="btn-secondary h-11 w-11 rounded-2xl sm:w-auto sm:px-5">
            {actionLoading === 'sync' ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            <span className="hidden sm:inline ml-2">Sync Profiles</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon: Icon, label, value }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-2xl border border-neutral-100 dark:border-transparent">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-bold tracking-tight">{value}</p>
    </div>
  );
}
