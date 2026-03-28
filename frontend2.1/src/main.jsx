import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; // <-- MUST BE HashRouter
import App from './App.jsx';
import './styles/index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter> {/* <-- MUST BE HashRouter */}
      <App />
    </HashRouter>
  </React.StrictMode>,
);