import React from 'react';
import { createRoot } from 'react-dom/client';

// Note: This is a wrapper that will load the web app
// The actual app is loaded in the iframe

const App = () => {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <iframe
        src={process.env.WEB_URL || 'http://localhost:3000'}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="POS System"
      />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
