import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type UserRole = 'super_admin' | 'admin' | 'user' | null;

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  storeId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        // If profile doesn't exist, create a default one
        if (profileError.code === 'PGRST116') { // No rows returned
          console.log('No profile found, creating default profile');
          const { data: insertData, error: insertError } = await supabase
            .from('profiles')
            .insert({ 
              user_id: userId, 
              full_name: 'User',
              email: '' 
            })
            .select('*')
            .single();
          
          if (!insertError && insertData) {
            setProfile(insertData);
          } else {
            console.error('Error creating default profile:', insertError);
          }
        } else {
          console.error('Profile fetch error:', profileError);
        }
      } else {
        console.log('Profile data:', profileData);
        if (profileData) {
          setProfile(profileData);
        }
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        // If role doesn't exist, create a default 'user' role
        if (roleError.code === 'PGRST116') { // No rows returned
          console.log('No role found, creating default user role');
          const { data: insertData, error: insertError } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'user' })
            .select('role')
            .single();
          
          if (!insertError && insertData) {
            setRole(insertData.role as UserRole);
          } else {
            console.error('Error creating default role:', insertError);
          }
        } else {
          console.error('Role fetch error:', roleError);
        }
      } else {
        console.log('Role data:', roleData);
        if (roleData) {
          setRole(roleData.role as UserRole);
        }
      }

      // Fetch store if admin
      if (roleData?.role === 'admin') {
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('admin_id', userId)
          .single();

        if (storeError) {
          console.error('Store fetch error:', storeError);
        } else {
          console.log('Store data:', storeData);
          if (storeData) {
            setStoreId(storeData.id);
          }
        }
      }
      
      console.log('Profile fetch complete');
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setStoreId(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setStoreId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        storeId,
        loading,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
