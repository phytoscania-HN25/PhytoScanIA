import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, RotateCcw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signIn, signUp, resetPassword } from '../api/auth.js';
import { useUser } from '../context/UserContext.jsx';

const TABS = [
  { key: 'login', label: 'Entrar', icon: LogIn },
  { key: 'register', label: 'Crear cuenta', icon: UserPlus },
  { key: 'reset', label: 'Recuperar', icon: RotateCcw },
];

export default function AuthForm({ type }) {
  const initial = TABS.find(t => t.key === type)?.key || 'login';
  const [tab, setTab] = useState(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // ⚠️ defensivo: si alguien monta AuthForm sin provider, no crashea
  const { user } = useUser() || {};

  // ✅ redirige automáticamente cuando ya hay sesión (evita “tocar pestañas”)
  useEffect(() => {
    if (user) {
      const next = new URLSearchParams(location.search).get('next') || '/';
      window.location.replace(next);
    }
  }, [user, location.search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      if (tab === 'login') {
        const res = await signIn({ email, password });

        // Si el login por password está deshabilitado, caemos a Magic Link
        if (res?.magicLinkSent) {
          setMessage('Te envié un enlace de acceso a tu correo. Abrilo para entrar.');
          return;
        }

        // ✅ entrar de un solo
        const next = new URLSearchParams(location.search).get('next') || '/';
        window.location.replace(next);
        return;
      } else if (tab === 'register') {
        await signUp({ email, password, nombre_completo: nombre, rol: 'productor' });
        setMessage('Cuenta creada. Si tu proyecto requiere confirmación por correo, revisá tu bandeja. Luego iniciá sesión.');
        setTab('login');
      } else {
        await resetPassword(email);
        setMessage('Te envié un enlace para restablecer contraseña.');
      }
    } catch (err) {
      setError(err?.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-zinc-200/70 bg-white/80 backdrop-blur-xl shadow-xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-zinc-900 mb-6">PhytoScan IA</h1>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                tab === key
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
              ].join(' ')}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-3" size={16} />
              <input
                className="pl-9 border rounded-xl w-full h-11 outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              <p className="mt-2 text-xs text-zinc-500">
                Rol por defecto: <b>productor</b>. (Los ascensos los hace un administrador.)
              </p>
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-3" size={16} />
            <input
              type="email"
              className="pl-9 border rounded-xl w-full h-11 outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {tab !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-3 top-3" size={16} />
              <input
                type="password"
                className="pl-9 border rounded-xl w-full h-11 outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={tab !== 'reset'}
              />
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
          {message && <div className="text-sm text-emerald-700">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            {loading ? 'Procesando…' : (tab === 'login' ? 'Entrar' : tab === 'register' ? 'Crear cuenta' : 'Enviar enlace')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
