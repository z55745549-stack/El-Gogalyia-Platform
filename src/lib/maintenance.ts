import { doc, setDoc, onSnapshot, serverTimestamp, db } from './supabase';
import { logActivity } from './database-service';

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  enabledAt?: string;
  enabledBy?: string;
  enabledByName?: string;
}

const SETTING_DOC_ID = 'maintenance';
const LOCAL_STORAGE_KEY = 'elgogalyia_maintenance_config';
export const DEFAULT_MAINTENANCE_MESSAGE = 'المنصة في وضعية الصيانة الفورية للتحديثات , يرجي الانتظار لانتهاء من الصيانة';

const ENV_MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
const ENV_MAINTENANCE_MESSAGE = (import.meta.env.VITE_MAINTENANCE_MESSAGE as string) || '';

export function getMaintenanceState(): MaintenanceConfig {
  if (ENV_MAINTENANCE_MODE) {
    return {
      enabled: true,
      message: ENV_MAINTENANCE_MESSAGE.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
  };
}

function saveMaintenanceLocally(config: MaintenanceConfig) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('elgogalyia_maintenance_change', { detail: config }));
  } catch (e) {
    console.warn('saveMaintenanceLocally warning:', e);
  }
}

export function subscribeMaintenanceMode(callback: (config: MaintenanceConfig) => void): () => void {
  // 1. If forced via Vercel environment variable, lock to maintenance mode
  if (ENV_MAINTENANCE_MODE) {
    callback(getMaintenanceState());
    return () => {};
  }

  // 2. Fire immediately with local cached state
  callback(getMaintenanceState());

  // 2. Listen to Supabase real-time
  const docRef = doc(db, 'system_settings', SETTING_DOC_ID);
  const unsub = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const config: MaintenanceConfig = {
          enabled: Boolean(data.enabled),
          message: data.message || DEFAULT_MAINTENANCE_MESSAGE,
          enabledAt: data.enabledAt?.toDate ? data.enabledAt.toDate().toISOString() : (data.enabledAt || ''),
          enabledBy: data.enabledBy || '',
          enabledByName: data.enabledByName || '',
        };
        saveMaintenanceLocally(config);
        callback(config);
      } else {
        const config: MaintenanceConfig = {
          enabled: false,
          message: DEFAULT_MAINTENANCE_MESSAGE,
        };
        saveMaintenanceLocally(config);
        callback(config);
      }
    },
    (err) => {
      console.warn('subscribeMaintenanceMode Supabase snapshot notice:', err);
      callback(getMaintenanceState());
    }
  );

  // 3. Listen to local event
  const handleLocal = (e: Event) => {
    const custom = e as CustomEvent<MaintenanceConfig>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getMaintenanceState());
    }
  };
  window.addEventListener('elgogalyia_maintenance_change', handleLocal);

  return () => {
    unsub();
    window.removeEventListener('elgogalyia_maintenance_change', handleLocal);
  };
}

export async function setMaintenanceMode(
  enabled: boolean,
  adminUser: { uid: string; email: string; displayName: string },
  customMessage?: string
): Promise<void> {
  const config: MaintenanceConfig = {
    enabled,
    message: customMessage?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    enabledAt: new Date().toISOString(),
    enabledBy: adminUser.email || adminUser.uid,
    enabledByName: adminUser.displayName || 'Admin',
  };

  // Immediate local update
  saveMaintenanceLocally(config);

  // Write to Supabase
  try {
    const docRef = doc(db, 'system_settings', SETTING_DOC_ID);
    await setDoc(docRef, {
      ...config,
      updatedAt: serverTimestamp(),
      enabledAt: enabled ? serverTimestamp() : null,
    }, { merge: true });
  } catch (err) {
    console.warn('setMaintenanceMode Supabase warning:', err);
  }

  // Audit log
  logActivity({
    actor: adminUser.email || adminUser.uid,
    actorName: adminUser.displayName || 'Admin',
    action: (enabled ? 'system.maintenance_enabled' : 'system.maintenance_disabled') as any,
    targetType: 'system',
    targetId: 'maintenance',
    targetName: enabled ? 'تفعيل وضع الصيانة الفورية' : 'تعطيل وضع الصيانة الفورية',
    metadata: { enabled, message: config.message },
  }).catch(() => {});
}
