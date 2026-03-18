import { useEffect, useState, useCallback } from 'react';
import { Cpu, HardDrive, Clock, Users, Activity, ShieldCheck, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { system, users as usersApi, protocol } from '../api';
import clsx from 'clsx';

const MAX_PTS = 25;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [cpuH, setCpuH] = useState([]);
  const [ramH, setRamH] = useState([]);
  const [userCount, setUserCount] = useState({ total: 0, active: 0 });
  const [proto, setProto] = useState({ running: false });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const [s, u, p] = await Promise.all([system.stats(), usersApi.count(), protocol.status()]);
      setStats(s);
      setUserCount(u);
      setProto(p);
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in">
      {/* Header Status */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">System Overview</h1>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-bold">Real-time Performance Metrics</p>
        </div>
        <div className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm',
          proto.running 
            ? 'bg-success/5 border-success/20 text-success' 
            : 'bg-danger/5 border-danger/20 text-danger'
        )}>
          <span className={clsx('w-2 h-2 rounded-full shadow-sm', proto.running ? 'bg-success animate-pulse' : 'bg-danger')} />
          {proto.running ? 'Core Active' : 'Core Defunct'}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Cpu} 
          label="Processor" 
          value={`${stats?.cpu_percent?.toFixed(1) ?? 0}%`} 
          sub={`${stats?.cpu_count ?? 0} Core Engine`} 
        />
        <StatCard 
          icon={HardDrive} 
          label="Resource" 
          value={`${stats?.ram_percent?.toFixed(1) ?? 0}%`} 
          sub={`${stats?.ram_used_gb ?? 0}GB Consumed`} 
        />
        <StatCard 
          icon={Users} 
          label="Identity" 
          value={userCount.active} 
          sub={`from ${userCount.total} total pool`} 
        />
        <StatCard 
          icon={Clock} 
          label="Reliability" 
          value={stats?.uptime_human?.split(',')[0] || '—'} 
          sub="Stable runtime" 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="CPU Load History" 
          data={cpuH} 
          color="#737373" 
          icon={Activity}
        />
        <ChartCard 
          title="Memory Consumption" 
          data={ramH} 
          color="#a3a3a3" 
          icon={Zap}
        />
      </div>

      {/* Infrastructure Note */}
      <div className="flex items-center justify-center gap-4 py-6 text-[10px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-[0.3em]">
        <ShieldCheck className="w-4 h-4" />
        HiVoid Encrypted Infrastructure
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-6 flex flex-col justify-between group hover:border-neutral-400 dark:hover:border-neutral-600 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Icon className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
        </div>
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</span>
      </div>
      <div>
        <h3 className="text-3xl font-black tracking-tighter leading-none">{value}</h3>
        <p className="text-[10px] text-neutral-500 font-bold uppercase mt-2 tracking-wide opacity-70">{sub}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, data, color, icon: Icon }) {
  return (
    <div className="card p-6 shadow-apple-sm">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-400" />
          <h3 className="text-sm font-black tracking-tight">{title}</h3>
        </div>
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Last 60s</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="t" 
              hide 
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fontSize: 9, fill: '#a3a3a3', fontWeight: 'bold' }} 
              axisLine={false} 
              tickLine={false} 
              width={25} 
            />
            <Tooltip
              contentStyle={{ 
                background: '#171717', 
                border: 'none', 
                borderRadius: '16px', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '12px',
                color: '#fff'
              }}
              labelStyle={{ display: 'none' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
              cursor={{ stroke: '#a3a3a3', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
              type="stepAfter" 
              dataKey="v" 
              stroke={color} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill={`url(#grad-${title.replace(/\s/g, '')})`} 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
