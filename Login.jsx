import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useTranslation } from '../lib/i18n.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t, dir } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError(t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center bg-graphite">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-6 rounded-lg border border-slate-800 bg-steel space-y-4">
        <h1 className="text-slate-100 text-xl font-semibold text-center">Meno</h1>
        <div>
          <label className="text-slate-400 text-xs">{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full mt-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs">{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full mt-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          {t('auth.login')}
        </button>
      </form>
    </div>
  );
}
