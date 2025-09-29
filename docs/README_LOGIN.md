# Login + Usuarios (Supabase) — PhytoScan IA

## Qué agrego
- `src/api/auth.js` — signup/signin/signout/reset + `fetchUsuarioProfile()`.
- `src/context/UserContext.jsx` — contexto con session + perfil (`Usuarios`). `useUser()`.
- `src/routes/ProtectedRoute.jsx` — protege rutas y (opcional) por roles.
- `src/pages/Login.jsx` — UI de login/sign up/reset.
- `src/pages/Account.jsx` — perfil + cerrar sesión.

## Cómo lo integro
1. **Variables `.env.local`**:
```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```
2. **App.jsx** (ejemplo)
```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import Account from './pages/Account';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <Router>
      <UserProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/forbidden" element={<div>No tenés permisos</div>} />
        </Routes>
      </UserProvider>
    </Router>
  );
}
```
3. **RLS/Triggers**
- Asegurate de correr `03_rls_v2.sql` y `04_auth_sync.sql`.
- Signup envía `nombre_completo` y `rol` como metadata; el trigger inserta la fila en `Usuarios`.

## Notas
- Si la tabla es `usuarios` en minúscula, el fetch tiene fallback.
- Para exigir rol en una ruta:
```jsx
<ProtectedRoute roles={['tecnico','admin']}>
  <Validacion />
</ProtectedRoute>
```
