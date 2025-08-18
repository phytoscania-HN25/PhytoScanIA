import './index.css';
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App.jsx";
import { UserProvider } from "./context/UserContext.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>
);

// Registrar Service Worker (al final de src/index.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ SW registrado:', reg.scope))
      .catch(err => console.error('❌ SW error:', err));
  });
}
