import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password, totpCode);
      if (res?.totp_required) {
        setTotpRequired(true);
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-sm animate-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <img 
            src={theme === 'dark' ? '/logo-light.png' : '/logo-dark.png'} 
            alt="HiVoid Logo" 
            className="w-16 h-16 object-contain mx-auto mb-4"
          />
          <h1 className="text-xl font-bold">HiVoid Panel</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to continue</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger font-medium animate-in">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!totpRequired ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5 ml-0.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5 ml-0.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="animate-in slide-in-from-bottom-2">
                <label className="block text-center text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Authenticator Code</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="input text-center text-2xl font-black tracking-[0.5em] h-14"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                />
                <p className="text-[10px] text-center text-neutral-500 font-medium mt-3">Enter the 6-digit code from your app</p>
              </div>
            )}
            
            <button type="submit" disabled={loading} className="btn-primary w-full h-12 rounded-xl font-black shadow-apple-lg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (totpRequired ? 'Verify' : 'Sign in')}
            </button>

            {totpRequired && (
              <button 
                type="button" 
                onClick={() => { setTotpRequired(false); setTotpCode(''); }}
                className="w-full text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 mt-2"
              >
                Back to credentials
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">HiVoid v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
