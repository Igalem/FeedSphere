'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function PullToRefresh({ children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const PULL_THRESHOLD = 80; // Distance in pixels to trigger refresh

  // Scroll to top on route change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh if we are at the very top
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].pageY;
      } else {
        startY.current = -1; // Disable
      }
    };

    const handleTouchMove = (e) => {
      if (startY.current === -1 || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Resistance curve: pull becomes harder the further you go
        const pull = Math.pow(diff, 0.7);
        setPullDistance(pull);
        
        // Prevent default scrolling if we are pulling down at the top
        if (diff > 10) {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance > PULL_THRESHOLD && !isRefreshing) {
        triggerRefresh();
      } else {
        setPullDistance(0);
      }
      startY.current = -1;
    };

    const triggerRefresh = () => {
      setIsRefreshing(true);
      setPullDistance(60); // Keep indicator visible while refreshing
      
      // Haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }

      // Reload the page data
      router.refresh();
      
      // Simulate a small delay for the animation to look good
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1000);
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    // FIX: Listen for navigation and scroll to top
    const handleNav = () => {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handleNav);
    window.addEventListener('scrollToTop', handleNav);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('scrollToTop', handleNav);
    };
  }, [pullDistance, isRefreshing, router]);

  return (
    <div ref={containerRef} className="pull-to-refresh-container">
      {/* The Loading Indicator */}
      <div 
        className={`pull-indicator ${isRefreshing ? 'refreshing' : ''}`}
        style={{ 
          transform: `translateY(${pullDistance}px) rotate(${pullDistance * 4}deg)`,
          opacity: Math.min(pullDistance / PULL_THRESHOLD, 1)
        }}
      >
        <div className="pull-icon">⚡</div>
      </div>

      {/* The Content */}
      <div 
        className="pull-content"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)' : 'none'
        }}
      >
        {children}
      </div>

      <style jsx>{`
        .pull-to-refresh-container {
          position: relative;
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: var(--bg);
        }

        .pull-indicator {
          position: absolute;
          top: -40px;
          left: 50%;
          margin-left: -20px;
          width: 40px;
          height: 40px;
          background: var(--accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          pointer-events: none;
        }

        .pull-icon {
          font-size: 18px;
          color: #000;
        }

        .pull-indicator.refreshing {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: translateY(60px) rotate(0deg); }
          to { transform: translateY(60px) rotate(360deg); }
        }

        .pull-content {
          will-change: transform;
          background: var(--bg);
        }
      `}</style>
    </div>
  );
}
