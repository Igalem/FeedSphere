'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ProfileClient from './ProfileClient';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, let's create it (lazy initialization)
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert([
            { 
              id: user.id, 
              email: user.email,
              username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Citizen'
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError.message, insertError);
        } else {
          data = newProfile;
          error = null;
        }
      }

      if (error) {
        console.error('Error loading profile:', error.message, error);
      } else if (data) {
        setProfile(data);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return null;

  return <ProfileClient initialUser={user} initialProfile={profile} />;
}
