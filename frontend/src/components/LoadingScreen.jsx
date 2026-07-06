import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="loader-screen">
      <div className="loader-mark">
        <img src="/vyeta-mark.png" alt="Vyeta" style={{ width: '62%', height: '62%', objectFit: 'contain' }} />
      </div>
      <div className="text-center">
        <h1 className="loader-title">Business Suite</h1>
        <p className="loader-subtitle mt-1">Powered by Vyeta Digital Solutions</p>
      </div>
      <div className="loader-bar-track">
        <div className="loader-bar-fill" />
      </div>
    </div>
  );
}
