import { useEffect, useState, useCallback } from 'react';
import { 
  Wifi as WifiIcon, 
  Loader2 as LoaderIcon, 
  RefreshCw as RefreshIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Clock as ClockIcon,
  Users as UsersIcon,
  Globe as GlobeIcon
} from 'lucide-react';
import { protocol } from '../api';
import clsx from 'clsx';

export default function OnlineUsersPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await protocol.activeSessions();
      if (Array.isArray(data)) {
        setSessions(data);
      } else if (data && data.raw) {
        setSessions([]); 
        setError("Core returned unstructured data. Check logs.");
      } else {
        setSessions([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const id = setInterval(() => fetchSessions(true), 10000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  const filteredSessions = sessions.filter(s => 
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.uuid?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in w-full pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">Live Connections</h2>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">
             <span className="flex items-center gap-1.5"><WifiIcon className="w-3 h-3 text-success animate-pulse" /> {sessions.length} Active Sessions</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary transition-colors" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10 w-full md:w-72 h-11 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800"
              placeholder="Filter by Email or UUID..."
            />
          </div>
          <button onClick={() => fetchSessions(true)} disabled={refreshing || loading} className="btn-secondary h-11 w-11 p-0 rounded-2xl flex items-center justify-center">
            <RefreshIcon className={clsx("w-4 h-4", (refreshing || loading) && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-sm font-bold animate-in zoom-in-95">
          {error}
        </div>
      )}

      <div className="card overflow-hidden min-h-[300px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800 text-left">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Client Identity</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Network Source</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Uptime</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Throughput</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Client Identity</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Node</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Network Source</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Uptime</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Throughput</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <LoaderIcon className="w-8 h-8 animate-spin mx-auto text-neutral-200" />
                    <p className="mt-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Polling Active Streams...</p>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-neutral-400 font-bold uppercase text-xs tracking-widest">
                    No active connections found
                  </td>
                </tr>
              ) : filteredSessions.map((session, idx) => (
                <tr key={idx} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UsersIcon className="w-5 h-5 text-neutral-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold tracking-tight truncate">{session.email || 'Anonymous'}</p>
                        <p className="text-[10px] font-mono text-neutral-400 truncate w-32">{session.uuid}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
                       <span className="text-xs font-bold">{session.node}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-neutral-500">
                      <GlobeIcon className="w-4 h-4" />
                      <span className="text-xs font-mono">{session.ip}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-500">
                       <ClockIcon className="w-3.5 h-3.5 opacity-50" />
                       {session.uptime || '0s'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2 w-28">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-neutral-400">
                             <DownloadIcon className="w-3 h-3" />
                             <span className="text-[10px] font-black">DL</span>
                          </div>
                          <p className="text-xs font-bold tracking-tight text-neutral-700 dark:text-neutral-300">{session.bytes_in}</p>
                       </div>
                       <div className="flex items-center justify-between text-neutral-500">
                          <div className="flex items-center gap-1.5">
                             <UploadIcon className="w-3 h-3" />
                             <span className="text-[10px] font-black">UL</span>
                          </div>
                          <p className="text-xs font-bold tracking-tight text-neutral-700 dark:text-neutral-300">{session.bytes_out}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                       <span className="text-[10px] font-black uppercase text-success tracking-widest">Online</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
