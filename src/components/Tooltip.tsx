import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Tooltip dimensions
      const tooltipWidth = 280;
      const tooltipHeight = 80; // Estimated height
      const arrowSize = 6;
      const gap = 8; // Gap between tooltip and component

      let left = 0;
      let top = 0;
      let actualPosition = position;

      // Calculate position based on preference
      switch (position) {
        case 'top':
          left = containerRect.left + containerRect.width / 2 - tooltipWidth / 2;
          top = containerRect.top - tooltipHeight - gap;
          break;
        case 'bottom':
          left = containerRect.left + containerRect.width / 2 - tooltipWidth / 2;
          top = containerRect.bottom + gap;
          break;
        case 'left':
          left = containerRect.left - tooltipWidth - gap;
          top = containerRect.top + containerRect.height / 2 - tooltipHeight / 2;
          break;
        case 'right':
          left = containerRect.right + gap;
          top = containerRect.top + containerRect.height / 2 - tooltipHeight / 2;
          break;
      }

      // Check for viewport overflow and adjust
      if (top < 10) {
        // Would overflow top, switch to bottom
        actualPosition = 'bottom';
        top = containerRect.bottom + gap;
      } else if (top + tooltipHeight > viewportHeight - 10) {
        // Would overflow bottom, switch to top
        actualPosition = 'top';
        top = containerRect.top - tooltipHeight - gap;
      }

      if (left < 10) {
        // Would overflow left
        left = 10;
      } else if (left + tooltipWidth > viewportWidth - 10) {
        // Would overflow right
        left = viewportWidth - tooltipWidth - 10;
      }

      // Calculate arrow position
      let arrowLeft = containerRect.left + containerRect.width / 2 - left - arrowSize;
      arrowLeft = Math.max(12, Math.min(tooltipWidth - 12, arrowLeft)); // Keep arrow within tooltip bounds

      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
        zIndex: 9999,
        opacity: 1,
        transform: 'translateY(0)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      });

      setArrowStyle({
        position: 'absolute',
        left: `${arrowLeft}px`,
        ...(actualPosition === 'top' ? {
          bottom: `-${arrowSize}px`,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowSize}px solid rgba(31, 41, 55, 0.95)`,
        } : {
          top: `-${arrowSize}px`,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid rgba(31, 41, 55, 0.95)`,
        })
      });
    }
  }, [isVisible, position]);

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <>
          {/* Backdrop overlay for better contrast */}
          <div 
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 9998 }}
          />
          
          {/* Tooltip */}
          <div 
            ref={tooltipRef}
            className="pointer-events-none"
            style={{
              ...tooltipStyle,
              background: 'rgba(31, 41, 55, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(59, 246, 138, 0.3)',
              borderRadius: '12px',
              boxShadow: `
                0 20px 25px -5px rgba(0, 0, 0, 0.8),
                0 10px 10px -5px rgba(0, 0, 0, 0.6),
                0 0 0 1px rgba(59, 246, 138, 0.1),
                0 0 20px rgba(59, 246, 138, 0.15)
              `,
              padding: '12px 16px',
            }}
          >
            {/* Content */}
            <div 
              className="text-sm leading-relaxed"
              style={{
                color: '#F9FAFB',
                fontWeight: '400',
                lineHeight: '1.5',
                whiteSpace: 'pre-line'
              }}
            >
              {content}
            </div>
            
            {/* Arrow */}
            <div style={arrowStyle} />
          </div>
        </>
      )}
    </div>
  );
};