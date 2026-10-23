import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { SocketProvider } from './context/SocketContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);
