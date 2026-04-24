'use client';

import { useRef, useState, useEffect } from 'react';

export default function DraggableScrollContainer({ children, className }) {
  const scrollRef = useRef(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  
  const [isMoved, setIsMoved] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // Only for UI cursor

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      if (!isDownRef.current) return;
      
      const x = e.clientX;
      const walk = (x - startXRef.current) * 2;
      
      if (Math.abs(x - startXRef.current) > 5) {
        setIsMoved(true);
      }
      
      container.scrollLeft = scrollLeftRef.current - walk;
    };

    const handleMouseUp = () => {
      isDownRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseDown = (e) => {
      isDownRef.current = true;
      setIsDragging(true);
      setIsMoved(false);
      startXRef.current = e.clientX;
      scrollLeftRef.current = container.scrollLeft;
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    container.addEventListener('mousedown', handleMouseDown);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleClick = (e) => {
    if (isMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsMoved(false);
  };

  return (
    <div
      ref={scrollRef}
      className={className}
      onClickCapture={handleClick}
      onDragStart={(e) => e.preventDefault()}
      style={{ 
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        scrollBehavior: 'auto',
        touchAction: 'auto'
      }}
    >
      {children}
    </div>
  );
}
