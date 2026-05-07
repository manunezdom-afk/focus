import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_PROFILE, fetchProfile, type UserProfile } from './profile';

// Port simplificado de src/hooks/useUserProfile.js. Sin upsert por ahora —
// solo lectura. Cuando agreguemos un onboarding mobile vamos a agregar
// saveProfile/snoozeSetup.
export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(DEFAULT_PROFILE);
      setLoaded(true);
      return;
    }
    let mounted = true;
    fetchProfile(userId)
      .then((p) => {
        if (!mounted) return;
        setProfile({ ...DEFAULT_PROFILE, ...(p ?? {}) });
        setLoaded(true);
      })
      .catch((err) => {
        if (!mounted) return;
        console.warn('[Focus] no se pudo cargar perfil:', err?.message);
        setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return { profile, loaded };
}
