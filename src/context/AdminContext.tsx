import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  checkUserAdminClaims, 
  bootstrapAdminBackend, 
  PRIMARY_ADMIN_EMAIL,
  isPrimaryAdminEmail
} from '../lib/adminService';
import type { AdminProfile, AdminRole, StaffRole } from '../types';

interface AdminContextType {
  isAdmin: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  adminRole: StaffRole | null;
  adminProfile: AdminProfile | null;
  isCheckingAdmin: boolean;
  isBootstrapping: boolean;
  adminError: string | null;
  refreshAdminStatus: () => Promise<void>;
  bootstrapNow: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [adminRole, setAdminRole] = useState<StaffRole | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const verifyAdminState = useCallback(async () => {
    if (status !== 'authenticated' || !user) {
      setIsAdmin(false);
      setAdminRole(null);
      setAdminProfile(null);
      setIsCheckingAdmin(false);
      return;
    }

    setIsCheckingAdmin(true);
    setAdminError(null);

    try {
      const claimsInfo = await checkUserAdminClaims();
      const isPrimary = isPrimaryAdminEmail(user.email);

      if (claimsInfo.isStaff || claimsInfo.isAdmin) {
        setIsAdmin(claimsInfo.isAdmin);
        setIsStaff(true);
        setAdminRole(claimsInfo.role || (isPrimary ? 'super_admin' : 'admin'));
        setAdminProfile({
          uid: user.uid,
          email: user.email || PRIMARY_ADMIN_EMAIL,
          displayName: isPrimary ? (user.displayName || 'Omar King') : (user.displayName || 'عضو الفريق'),
          role: claimsInfo.role || (isPrimary ? 'super_admin' : 'admin'),
          photoURL: user.photoURL || undefined,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });
      } else if (isPrimary) {
        // Primary super admin logged in, bootstrap custom claims automatically
        console.log('[AdminContext] Primary admin detected without claims. Triggering auto-bootstrap...');
        setIsBootstrapping(true);
        try {
          await bootstrapAdminBackend();
          const refreshed = await checkUserAdminClaims();
          setIsAdmin(true);
          setIsStaff(true);
          setAdminRole('super_admin');
          setAdminProfile({
            uid: user.uid,
            email: user.email || PRIMARY_ADMIN_EMAIL,
            displayName: user.displayName || 'Omar King',
            role: 'super_admin',
            photoURL: user.photoURL || undefined,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          });
        } catch (bootstrapErr: any) {
          console.warn('[AdminContext] Auto-bootstrap error:', bootstrapErr);
          setIsAdmin(true);
          setIsStaff(true);
          setAdminRole('super_admin');
          setAdminProfile({
            uid: user.uid,
            email: user.email || PRIMARY_ADMIN_EMAIL,
            displayName: user.displayName || 'Omar King',
            role: 'super_admin',
            photoURL: user.photoURL || undefined,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          });
        } finally {
          setIsBootstrapping(false);
        }
      } else {
        setIsAdmin(false);
        setIsStaff(false);
        setAdminRole(null);
        setAdminProfile(null);
      }
    } catch (err: any) {
      console.error('[AdminContext] Error verifying admin state:', err);
      setIsAdmin(false);
      setIsStaff(false);
      setAdminRole(null);
      setAdminError(err.message || 'فشل التحقق من صلاحيات الإدارة.');
    } finally {
      setIsCheckingAdmin(false);
    }
  }, [user, status]);

  useEffect(() => {
    verifyAdminState();
  }, [verifyAdminState]);

  const bootstrapNow = async () => {
    setIsBootstrapping(true);
    setAdminError(null);
    try {
      await bootstrapAdminBackend();
      await verifyAdminState();
    } catch (err: any) {
      setAdminError(err.message || 'فشل استكمال عملية التهيئة.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        isStaff,
        isSuperAdmin: adminRole === 'super_admin',
        adminRole,
        adminProfile,
        isCheckingAdmin,
        isBootstrapping,
        adminError,
        refreshAdminStatus: verifyAdminState,
        bootstrapNow,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
