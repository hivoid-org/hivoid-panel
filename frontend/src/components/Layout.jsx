import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Users, Radio, Settings, LogOut, Moon, Sun, Menu, X
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/users',    icon: Users,           label: 'Users' },
  { to: '/protocol', icon: Radio,           label: 'Protocol' },
  { to: '/settings', icon: Settings,        label: 'Settings' },
];

export default function Layout() {
  const { logout, admin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-neutral-950">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:sticky top-0 left-0 z-50 h-screen w-60 flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
              <span className="text-white dark:text-neutral-900 text-xs font-black">Hi</span>
            </div>
            <span className="text-sm font-bold tracking-tight">HiVoid</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-neutral-500 hover:text-danger hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-4 px-5 lg:px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-xl">
          <button onClick={() => setOpen(true)} className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold">{NAV.find(n => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)))?.label || 'HiVoid'}</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
