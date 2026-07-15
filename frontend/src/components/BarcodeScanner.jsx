import React, { useEffect, useRef } from 'react';
import { X, ScanLine } from 'lucide-react';

/**
 * Opens the device camera and scans for a barcode/QR code, matching it
 * against inventory SKUs. Uses html5-qrcode, which wraps getUserMedia + a
 * decoder and works across modern mobile and desktop browsers (unlike the
 * native BarcodeDetector API, which Safari still doesn't support).
 */
export default function BarcodeScanner({ onDetected, onClose }) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!isMounted) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            onDetected(decodedText);
          },
          () => {
            // per-frame scan failures are expected constantly while aiming — ignore
          }
        )
        .catch(() => {
          // Camera unavailable/denied — the empty state message below covers this
        });
    });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel max-w-sm w-full p-5 rounded-3xl space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-gold-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scan Barcode / QR</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div id={containerId} className="rounded-2xl overflow-hidden bg-black min-h-[240px]" />
        <p className="text-[11px] text-center text-slate-400">
          Point your camera at a stock item's barcode or QR code. If nothing happens, your browser may be blocking camera access —
          check your permissions.
        </p>
      </div>
    </div>
  );
}
