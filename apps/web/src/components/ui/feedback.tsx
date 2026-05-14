'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function HelpTooltip({ content }: { content: string }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({ x: r.left + r.width / 2, y: r.top - 8 });
    }
    setVisible(true);
  };

  const hide = () => setVisible(false);

  // Close on scroll / resize
  useEffect(() => {
    if (!visible) return;
    const close = () => setVisible(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [visible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-white/[0.05] text-[10px] text-white/30 transition-all hover:bg-white/10 hover:text-white/60 flex-shrink-0"
      >
        ?
      </div>

      {visible && typeof window !== 'undefined' && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
        >
          <div
            style={{
              background: 'rgba(17, 31, 53, 0.97)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(79,156,249,0.25)',
              borderRadius: 10,
              boxShadow: '0 16px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,156,249,0.08)',
              padding: '10px 14px',
              width: 240,
              fontSize: 12,
              color: 'rgba(224,234,248,0.85)',
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
            }}
          >
            {content}
            {/* Arrow */}
            <div style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(17,31,53,0.97)',
            }} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
