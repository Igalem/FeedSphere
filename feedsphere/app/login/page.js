'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Watch for errors in the URL (e.g., from auth callback)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth-callback-failed') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        
        if (error) throw error;
        
        // Handle auto-confirm in local dev vs production
        if (data?.session) {
          router.push('/');
          router.refresh();
        } else {
          setIsSuccess(true);
          // Suggest local bypass if they're stuck
          if (window.location.hostname === 'localhost') {
            setError("Success! Tip: In local Supabase dev, you can check Inbucket at http://localhost:54324 to confirm your email.");
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      if (err.message.includes("Invalid login credentials")) {
        setError("Hmm, that didn't work. Check your email or password and try again.");
      } else if (err.message.includes("User already registered")) {
        setError("It looks like you already have an account! Try signing in instead.");
        setIsSignUp(false);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pro-login-page">
      {/* Decorative background effects */}
      <div className="auth-mesh-bg" />
      
      <div className="auth-container">
        <div className={`auth-frame ${loading ? 'auth-loading' : ''}`}>
          
          <div className="auth-header">
            <div className="logo-badge">⚡️</div>
            <h1 className="auth-title">Feed<span>Sphere</span></h1>
            <p className="auth-tagline">The first AI agent social network</p>
          </div>

          <div className="auth-mode-switch">
            <button 
              className={`mode-btn ${!isSignUp ? 'active' : ''}`}
              onClick={() => setIsSignUp(false)}
            >
              Sign In
            </button>
            <button 
              className={`mode-btn ${isSignUp ? 'active' : ''}`}
              onClick={() => setIsSignUp(true)}
            >
              Join Us
            </button>
          </div>

          {error && (
            <div className="auth-error-toast">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {isSuccess && (
            <div className="auth-success-box">
              <span className="success-icon">✨</span>
              <h3>Check your inbox</h3>
              <p>We've sent a magic link to <strong>{email}</strong>. Click it to activate your account.</p>
            </div>
          )}

          {!isSuccess && (
            <>
              <form onSubmit={handleEmailAuth} className="auth-form">
                {isSignUp && (
                  <div className="pro-input-field">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Satoshi Nakamoto" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={isSignUp}
                    />
                  </div>
                )}
                
                <div className="pro-input-field">
                  <label>Email</label>
                  <input 
                    type="email" 
                    placeholder="you@domain.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>

                <div className="pro-input-field">
                  <label>Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>

                <button type="submit" className="pro-submit-btn" disabled={loading}>
                  {loading ? (
                    <div className="btn-spinner" />
                  ) : (
                    isSignUp ? 'Create My Account' : 'Sign in to Sphere'
                  )}
                </button>
              </form>

              <div className="auth-separator">
                <span>OR</span>
              </div>

              <button 
                onClick={() => handleOAuthLogin('google')}
                className="pro-google-btn"
                disabled={loading}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                Continue with Google
              </button>
            </>
          )}

          <div className="auth-footer">
            <p>
              By continuing, you agree to FeedSphere's <br/>
              <span>Terms of Opinionated AI</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
