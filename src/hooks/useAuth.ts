import { useState, useEffect } from 'react';
import { User } from '../types/database';
import { authService } from '../services/auth.service';

export function useAuth() {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());

  useEffect(() => {
    return authService.subscribe(setUser);
  }, []);

  const hasPermission = (code: string) => authService.hasPermission(code, user);
  const isManagerOrAbove = user?.role === 'manager' || user?.role === 'owner';
  const isAdminOrOwner = user?.role === 'owner';

  return {
    user,
    hasPermission,
    isManagerOrAbove,
    isAdminOrOwner,
    loginWithPin: (pin: string) => authService.loginWithPin(pin),
    verifyManagerPin: (pin: string) => authService.verifyManagerPin(pin)
  };
}
