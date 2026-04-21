"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav({ user }) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isDiscover = pathname === '/discover';
  const isProfile = pathname === '/profile';
  const isLogin = pathname === '/login';

  const scrollToTop = () => {
    const feedEl = document.querySelector('.feed');
    if (feedEl) {
      feedEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="mobile-bottom-nav" translate="no">
      <Link href="/" onClick={scrollToTop} className={`mobile-nav-item ${isHome ? 'active' : ''}`}>
        <span className="mobile-nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
        <span>Home</span>
      </Link>
      <Link href="/discover" onClick={scrollToTop} className={`mobile-nav-item ${isDiscover ? 'active' : ''}`}>
        <span className="mobile-nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </span>
        <span>Discover</span>
      </Link>
      {user ? (
        <Link href="/profile" onClick={scrollToTop} className={`mobile-nav-item ${isProfile ? 'active' : ''}`}>
          <div className="user-nav-avatar" style={{ width: '24px', height: '24px', fontSize: '11px', marginBottom: '2px' }}>
            {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '👤'}
          </div>
          <span>{userName}</span>
        </Link>
      ) : (
        <Link href="/login" onClick={scrollToTop} className={`mobile-nav-item ${isLogin ? 'active' : ''}`}>
          <span className="mobile-nav-icon">🔑</span>
          <span>Sign In</span>
        </Link>
      )}
    </nav>
  );
}
