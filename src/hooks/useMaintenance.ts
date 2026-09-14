import { useState, useEffect } from 'react';
import { subscribeMaintenanceMode, setMaintenanceMode, getMaintenanceState, type MaintenanceConfig } from '@/lib/maintenance';
import { useAuth } from '@/context/AuthContext';

export function useMaintenance() {
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>(getMaintenanceState);
  const { userProfile } = useAuth();

  useEffect(() => {
    const unsub = subscribeMaintenanceMode((cfg) => {
      setMaintenance(cfg);
    });
    return unsub;
  }, []);

  const toggleMaintenance = async (enabled: boolean, customMessage?: string) => {
    if (!userProfile) return;
    await setMaintenanceMode(
      enabled,
      {
        uid: userProfile.uid,
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      },
      customMessage
    );
  };

  return {
    maintenance,
    isMaintenanceActive: Boolean(maintenance.enabled),
    toggleMaintenance,
  };
}
