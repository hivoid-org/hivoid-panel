import { useEffect, useState, useCallback } from 'react';
import { 
  Cpu as CpuIcon, 
  HardDrive as HardDriveIcon, 
  Clock as ClockIcon, 
  Users as UsersIcon, 
  Activity as ActivityIcon, 
  ShieldCheck as ShieldIcon, 
  Zap as ZapIcon,
  Server as ServerIcon,
  Terminal as TerminalIcon,
  Database as DatabaseIcon,
  ArrowUpRight as UpIcon,
  ArrowDownLeft as DownIcon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { system, users as usersApi, protocol } from '../api';
import clsx from 'clsx';

const MAX_PTS = 25;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [cpuH, setCpuH] = useState([]);
  const [ramH, setRamH] = useState([]);
  const [userCount, setUserCount] = useState({ total: 0, active: 0 });
  const [proto, setProto] = useState({ running: false, version: __APP_VERSION__ });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);

  const fmtBytes = (b) => {
    if (!b || b === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return parseFloat((b / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
  };

  const fetch = useCallback(async () => {
    try {
      const [s, u, p, allUsers] = await Promise.all([
        system.stats(), 
        usersApi.count(), 
        protocol.status(),
        usersApi.list({ limit: 5 })
      ]);
      setStats(s);
      setUserCount(u);
      setProto(p);
      setRecentUsers(allUsers);
      
      const t = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCpuH(prev => [...prev, { t, v: s.cpu_percent }].slice(-MAX_PTS));
      setRamH(prev => [...prev, { t, v: s.ram_percent }].slice(-MAX_PTS));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); const id = setInterval(fetch, 3000); return () => clearInterval(id); }, [fetch]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-neutral-200 dark:border-neutral-800 border-t-neutral-900 dark:border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full space-y-8 animate-in pb-12">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">
             <ServerIcon className="w-3 h-3" /> System Control Center
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Command Center</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Server Time</p>
              <p className="text-sm font-bold">{new Date().toLocaleTimeString()}</p>
           </div>
           <div className={clsx(
              'px-5 py-2.5 rounded-2xl border text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-apple-sm',
              proto.running 
                ? 'bg-success/5 border-success/20 text-success' 
                : 'bg-danger/5 border-danger/20 text-danger'
            )}>
              <span className={clsx('w-2 h-2 rounded-full shadow-lg', proto.running ? 'bg-success animate-pulse' : 'bg-danger')} />
              Core {__APP_VERSION__} {proto.running ? 'Operational' : 'Offline'}
           </div>
        </div>
      </div>

      {/* Primary Resource Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <ResourceCard 
          icon={CpuIcon} 
          label="Processor" 
          value={`${stats?.cpu_percent?.toFixed(1) ?? 0}%`} 
          sub={`${stats?.cpu_count ?? 0} Cores available`}
          color="text-primary"
          progress={stats?.cpu_percent}
        />
        <ResourceCard 
          icon={HardDriveIcon} 
          label="Memory" 
          value={`${stats?.ram_percent?.toFixed(1) ?? 0}%`} 
          sub={`${stats?.ram_used_gb ?? 0} GB utilized`}
          color="text-secondary"
          progress={stats?.ram_percent}
        />
        <ResourceCard 
          icon={UsersIcon} 
          label="Subscribers" 
          value={userCount.active} 
          sub={`${userCount.total} total registrants`}
          color="text-success"
          progress={(userCount.active / (userCount.total || 1)) * 100}
        />
        <ResourceCard 
          icon={ClockIcon} 
          label="Uptime" 
          value={stats?.uptime_human?.split(',')[0] || '—'} 
          sub="No interruption"
          color="text-neutral-500"
          progress={100}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Charts */}
        <div className="lg:col-span-2 space-y-6">
           <div className="card p-8">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                       <ActivityIcon className="w-5 h-5 text-neutral-900 dark:text-white" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase tracking-widest">Real-time Load</h3>
                       <p className="text-center text-xs text-neutral-400 mt-6">HiVoid {__APP_VERSION__}</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <Legend color="bg-neutral-900 dark:bg-white" label="CPU" />
                    <Legend color="bg-neutral-400" label="RAM" />
                 </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cpuH}>
                    <defs>
                      <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="currentColor" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: '900' }}
                    />
                    <Area type="monotone" dataKey="v" stroke="#000" strokeWidth={3} fillOpacity={1} fill="url(#colorV)" className="text-neutral-900 dark:text-white" isAnimationActive={false} />
                    <Area data={ramH} type="monotone" dataKey="v" stroke="#a3a3a3" strokeWidth={2} fill="transparent" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

            {/* System Details Card */}
           <div className="card p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <SystemDetail icon={ZapIcon} label="Engine Version" value={proto.version} sub="Latest core protocol" />
              <SystemDetail icon={TerminalIcon} label="Operating System" value={stats?.os_name || 'Detecting...'} sub="Core Deployment Node" />
              <SystemDetail icon={DownIcon} label="Aggregate Ingress" value={fmtBytes(userCount.total_bytes_in)} sub="Total Download Flow" />
              <SystemDetail icon={UpIcon} label="Aggregate Egress" value={fmtBytes(userCount.total_bytes_out)} sub="Total Upload Flow" />
           </div>
        </div>

        {/* Sidebar: Recent Activity */}
        <div className="space-y-6">
           <div className="card p-8">
              <h3 className="text-sm font-black uppercase tracking-widest mb-6">Recent Records</h3>
              <div className="space-y-6">
                 {recentUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between group cursor-pointer">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-xs">
                             {u.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-xs font-bold truncate max-w-[120px]">{u.name}</p>
                             <p className="text-[9px] text-neutral-400 font-black uppercase tracking-tighter">{u.enabled ? 'Subscriber' : 'Inactive'}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black">{u.mode || 'Performance'}</p>
                          <p className="text-[9px] text-neutral-400 font-bold">{new Date(u.created_at || Date.now()).toLocaleDateString()}</p>
                       </div>
                    </div>
                 ))}
                 <button className="w-full py-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-colors mt-4">
                    View Registry
                 </button>
              </div>
           </div>

           {/* Security Quick Status */}
           <div className="bg-neutral-900 text-white rounded-[2rem] p-8 shadow-apple-2xl">
              <div className="flex items-center justify-between mb-4">
                 <ShieldIcon className={clsx("w-8 h-8", proto?.running ? "text-success" : "text-neutral-500")} />
                 {proto?.running && <span className="text-[10px] font-black uppercase text-success bg-success/10 px-3 py-1 rounded-full border border-success/20">Active Protection</span>}
              </div>
              <h4 className="text-lg font-black tracking-tight leading-tight mb-2">
                 {proto?.running ? 'Network Guard is Active' : 'Network Guard is Standby'}
              </h4>
              <p className="text-[11px] text-neutral-400 font-medium leading-relaxed mb-6">
                 {proto?.running 
                   ? 'Your HiVoid core is currently filtering inbound telemetry and protecting subscriber metadata using SPKI pinning.' 
                   : 'Security profiles are configured and verified. Full protection will activate once the engine is started.'}
              </p>
              <div className="flex flex-col gap-3">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-neutral-500 shadow-apple-sm">
                    <span>Anti-Probe Tarpit</span>
                    <span className={clsx(
                       proto?.anti_probe && proto?.running ? "text-success" : (proto?.anti_probe ? "text-neutral-500" : "text-danger")
                    )}>
                       {proto?.anti_probe && proto?.running ? 'Active' : (proto?.anti_probe ? 'Ready' : 'Disabled')}
                    </span>
                 </div>
                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-neutral-500">
                    <span>Cert Pinning</span>
                    <span className={proto?.cert_pinning ? "text-success" : "text-danger"}>{proto?.cert_pinning ? 'Verified' : 'Unverified'}</span>
                 </div>
                 {proto?.geodata_installed && (
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-neutral-500">
                        <span>Geo-Intelligence</span>
                        <span className="text-success">Integrated</span>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ icon: Icon, label, value, sub, color, progress }) {
  return (
    <div className="card p-8 group hover:scale-[1.02] transition-transform duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors bg-neutral-50 dark:bg-neutral-900 group-hover:bg-neutral-100", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
           <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{label}</span>
           <p className="text-2xl font-black tracking-tighter mt-1">{value}</p>
        </div>
      </div>
      <div className="space-y-3 pt-2">
        <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
           <div className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-neutral-500 font-bold text-center uppercase tracking-tighter">{sub}</p>
      </div>
    </div>
  );
}

function SystemDetail({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-4">
       <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-neutral-400" />
       </div>
       <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{label}</p>
          <p className="text-sm font-black truncate">{value}</p>
          <p className="text-[9px] text-neutral-500 font-bold uppercase truncate">{sub}</p>
       </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-2">
       <div className={clsx("w-2 h-2 rounded-full", color)} />
       <span className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">{label}</span>
    </div>
  );
}
