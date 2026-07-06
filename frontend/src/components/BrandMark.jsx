import React from 'react';

/**
 * The real Vyeta Digital Solutions mark (blue dot + slash), used wherever the
 * app previously showed a placeholder gold "V" square. `size` controls the
 * square badge dimensions; the image itself is transparent-background PNG so
 * it sits cleanly on both the dark navy and light glass panels.
 */
export default function BrandMark({ size = 56, rounded = 'rounded-2xl' }) {
  return (
    <div
      className={`bg-midnight-950 ${rounded} flex items-center justify-center shadow-gold overflow-hidden`}
      style={{ width: size, height: size }}
    >
      <img src="/vyeta-mark.png" alt="Vyeta" style={{ width: '68%', height: '68%', objectFit: 'contain' }} />
    </div>
  );
}
