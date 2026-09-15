/**
 * Supabase Client & Unified Data Adapter — GDG HITU Platform
 * 100% Native Supabase implementation for platform persistence and realtime sync.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase Configuration] Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Please ensure they are set in your environment (e.g. Vercel dashboard or .env.local).'
  );
}


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});

export const db = supabase;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000));
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
  }

  toISOString(): string {
    return this.toDate().toISOString();
  }

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export function increment(n: number) {
  return { __type: 'increment', value: n };
}

// ─── Collection Mapping ──────────────────────────────────────────────────────

const COLLECTION_MAP: Record<string, string> = {
  tasks: 'tasks',
  users: 'users',
  authorizedUsers: 'users',
  authorized_admins: 'users',
  oCoins: 'ocoin_transactions',
  ocoin_transactions: 'ocoin_transactions',
  attendance_sessions: 'attendance_sessions',
  attendance_records: 'attendance_records',
  meetings: 'meetings',
  discounts: 'discounts',
  discount_purchases: 'discount_purchases',
  supportTickets: 'support_tickets',
  support_tickets: 'support_tickets',
  supportTicketMessages: 'support_ticket_messages',
  support_ticket_messages: 'support_ticket_messages',
  activityLogs: 'activity_logs',
  activity_logs: 'activity_logs',
  notifications: 'notifications',
  opportunities: 'opportunities',
  committees: 'committees',
  courses: 'courses',
  course_categories: 'course_categories',
  course_lessons: 'course_lessons',
  course_progress: 'course_progress',
  bans: 'bans',
  system_settings: 'system_settings',
  archive_items: 'archive_items',
  archive: 'archive_items',
};

// Known columns per table for explicit column mapping
const KNOWN_COLUMNS: Record<string, Set<string>> = {
  users: new Set(['id', 'username', 'display_name', 'email', 'photo_url', 'role', 'permissions', 'status', 'committee_id', 'committee_name', 'password_hash', 'salt', 'google_linked_email', 'is_two_factor_enabled', 'employee_code', 'ocoins_balance', 'created_at', 'updated_at', 'raw_data']),
  tasks: new Set(['id', 'title', 'description', 'committee_id', 'committee_name', 'assigned_to', 'deadline', 'ocoins_reward', 'priority', 'status', 'files', 'created_by', 'created_by_name', 'created_at', 'updated_at', 'raw_data']),
  task_submissions: new Set(['id', 'task_id', 'submitted_by', 'submitted_by_name', 'notes', 'files', 'status', 'reviewed_by', 'reviewed_at', 'created_at', 'raw_data']),
  attendance_sessions: new Set(['id', 'title', 'description', 'session_code', 'date', 'start_time', 'end_time', 'status', 'created_by', 'committee_id', 'total_attended', 'created_at', 'raw_data']),
  attendance_records: new Set(['id', 'session_id', 'session_title', 'employee_id', 'employee_name', 'employee_code', 'employee_photo', 'check_in_time', 'status', 'created_at', 'raw_data']),
  ocoin_transactions: new Set(['id', 'user_id', 'user_display_name', 'amount', 'type', 'reason', 'task_id', 'task_title', 'new_balance', 'created_by', 'created_by_name', 'created_at', 'raw_data']),
  discounts: new Set(['id', 'title', 'description', 'discount_type', 'discount_value', 'ocoin_cost', 'promo_code', 'redemption_url', 'image_url', 'terms', 'status', 'expires_at', 'total_purchases', 'total_coins_collected', 'created_at', 'raw_data']),
  discount_purchases: new Set(['id', 'discount_id', 'employee_id', 'employee_name', 'employee_photo', 'ocoin_cost', 'promo_code', 'redemption_code', 'purchased_at', 'raw_data']),
  meetings: new Set(['id', 'title', 'description', 'committee_id', 'date', 'time', 'meeting_link', 'location', 'status', 'created_by', 'created_at', 'raw_data']),
  support_tickets: new Set(['id', 'ticket_number', 'subject', 'category', 'priority', 'status', 'creator_id', 'creator_name', 'creator_email', 'assigned_to_admin_id', 'assigned_to_admin_name', 'last_activity_at', 'created_at', 'raw_data']),
  support_ticket_messages: new Set(['id', 'ticket_id', 'sender_id', 'sender_name', 'sender_role', 'message', 'created_at', 'raw_data']),
  courses: new Set(['id', 'title', 'description', 'thumbnail_url', 'category_id', 'category_name', 'level', 'instructor', 'status', 'youtube_playlist_url', 'total_lessons', 'created_at', 'raw_data']),
  course_categories: new Set(['id', 'name', 'description', 'color', 'course_count', 'created_at', 'raw_data']),
  course_lessons: new Set(['id', 'course_id', 'title', 'description', 'duration', 'video_url', 'position', 'is_free', 'created_at', 'raw_data']),
  course_progress: new Set(['id', 'user_id', 'course_id', 'lesson_id', 'completed', 'completed_at', 'progress_percent', 'updated_at', 'raw_data']),
  activity_logs: new Set(['id', 'actor_id', 'actor_name', 'action', 'target_id', 'target_name', 'details', 'created_at', 'raw_data']),
  notifications: new Set(['id', 'recipient_email', 'recipient_uid', 'type', 'title', 'message', 'task_id', 'ticket_id', 'related_entity_type', 'related_entity_id', 'action_url', 'read', 'created_at', 'raw_data']),
  opportunities: new Set(['id', 'title', 'description', 'company', 'type', 'location', 'location_type', 'url', 'deadline', 'tags', 'created_by', 'is_active', 'created_at', 'updated_at', 'raw_data']),
  committees: new Set(['id', 'name', 'code', 'description', 'leader_id', 'leader_name', 'member_count', 'icon', 'color', 'created_at', 'raw_data']),
  bans: new Set(['id', 'employee_id', 'employee_name', 'reason', 'status', 'banned_by', 'banned_by_name', 'banned_at', 'lifted_at', 'lifted_by', 'notes', 'raw_data']),
  system_settings: new Set(['key', 'value', 'updated_at', 'raw_data']),
  archive_items: new Set(['id', 'item_type', 'original_id', 'data', 'archived_by', 'archived_at', 'raw_data']),
};

export interface CollectionRef {
  type: 'collection';
  path: string;
  table: string;
  parentField?: string;
  parentId?: string;
}

export interface DocRef {
  type: 'doc';
  table: string;
  id: string;
  path: string;
}

export function collection(first: any, ...segments: string[]): CollectionRef {
  // Can be called as collection(db, 'tasks') or collection(db, 'tasks', taskId, 'submissions')
  const pathParts = segments.filter(Boolean);
  if (pathParts.length === 0 && typeof first === 'string') {
    pathParts.push(first);
  }

  if (pathParts.length === 1) {
    const collName = pathParts[0];
    const table = COLLECTION_MAP[collName] || toSnakeCase(collName);
    return { type: 'collection', path: collName, table };
  }

  if (pathParts.length === 3) {
    // Subcollection pattern: ('tasks', taskId, 'submissions')
    const [parentColl, parentId, subColl] = pathParts;
    if (subColl === 'submissions') {
      return { type: 'collection', path: `${parentColl}/${parentId}/${subColl}`, table: 'task_submissions', parentField: 'task_id', parentId };
    }
    if (subColl === 'lessons') {
      return { type: 'collection', path: `${parentColl}/${parentId}/${subColl}`, table: 'course_lessons', parentField: 'course_id', parentId };
    }
    const table = toSnakeCase(subColl);
    return { type: 'collection', path: `${parentColl}/${parentId}/${subColl}`, table, parentField: `${toSnakeCase(parentColl)}_id`, parentId };
  }

  const collName = pathParts[pathParts.length - 1];
  const table = COLLECTION_MAP[collName] || toSnakeCase(collName);
  return { type: 'collection', path: pathParts.join('/'), table };
}

export function doc(first: any, ...segments: string[]): DocRef {
  if (first && first.type === 'collection') {
    const colRef = first as CollectionRef;
    const docId = segments[0] || `${colRef.table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      type: 'doc',
      table: colRef.table,
      id: docId,
      path: `${colRef.path}/${docId}`,
    };
  }

  const pathParts = segments.filter(Boolean);
  if (pathParts.length === 1) {
    const [id] = pathParts;
    return { type: 'doc', table: 'general', id, path: id };
  }

  if (pathParts.length === 2) {
    const [collName, docId] = pathParts;
    const table = COLLECTION_MAP[collName] || toSnakeCase(collName);
    return { type: 'doc', table, id: docId, path: `${collName}/${docId}` };
  }

  if (pathParts.length === 4) {
    const [parentColl, parentId, subColl, docId] = pathParts;
    if (subColl === 'submissions') {
      return { type: 'doc', table: 'task_submissions', id: docId, path: `${parentColl}/${parentId}/${subColl}/${docId}` };
    }
    if (subColl === 'lessons') {
      return { type: 'doc', table: 'course_lessons', id: docId, path: `${parentColl}/${parentId}/${subColl}/${docId}` };
    }
    return { type: 'doc', table: toSnakeCase(subColl), id: docId, path: `${parentColl}/${parentId}/${subColl}/${docId}` };
  }

  const id = pathParts[pathParts.length - 1] || `doc_${Date.now()}`;
  const collName = pathParts[pathParts.length - 2] || 'general';
  return { type: 'doc', table: COLLECTION_MAP[collName] || toSnakeCase(collName), id, path: pathParts.join('/') };
}

// ─── Query Building ──────────────────────────────────────────────────────────

export interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  val?: any;
  dir?: 'asc' | 'desc';
  limitCount?: number;
}

export interface QueryDef {
  type: 'query';
  collection: CollectionRef;
  constraints: QueryConstraint[];
}

export function where(field: string, op: string, val: any): QueryConstraint {
  return { type: 'where', field, op, val };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, dir };
}

export function limit(limitCount: number): QueryConstraint {
  return { type: 'limit', limitCount };
}

export function query(colRef: CollectionRef, ...constraints: QueryConstraint[]): QueryDef {
  return {
    type: 'query',
    collection: colRef,
    constraints,
  };
}

// ─── Row Mapping ─────────────────────────────────────────────────────────────

function mapRow(row: any): any {
  if (!row) return row;
  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};
  const res: Record<string, any> = { ...raw, ...row };

  // Generate camelCase aliases for all snake_case keys
  for (const [k, v] of Object.entries(row)) {
    if (k.includes('_')) {
      const camel = toCamelCase(k);
      if (res[camel] === undefined) {
        res[camel] = v;
      }
    }
  }

  // Ensure id is defined
  res.id = row.id ?? row.key ?? raw.id;

  // Make dates accessible as Timestamp-like objects if needed
  for (const [k, v] of Object.entries(res)) {
    if (typeof v === 'string' && (k.endsWith('At') || k.endsWith('_at') || k === 'date' || k === 'deadline' || k === 'check_in_time')) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        try {
          const strObj = new String(v) as any;
          strObj.toDate = () => d;
          strObj.toMillis = () => d.getTime();
          strObj.seconds = Math.floor(d.getTime() / 1000);
          res[k] = strObj;
        } catch {}
      }
    }
  }

  return res;
}

export interface DocumentData {
  [field: string]: any;
}

export interface DocumentSnapshot<T = DocumentData> {
  id: string;
  exists(): boolean;
  data(): T;
  [key: string]: any;
}

export interface QueryDocumentSnapshot<T = DocumentData> {
  id: string;
  exists(): boolean;
  data(): T;
  [key: string]: any;
}

export interface QuerySnapshot<T = DocumentData> {
  docs: QueryDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
  forEach(callback: (result: QueryDocumentSnapshot<T>) => void): void;
}

function mapSnapshotDoc<T = DocumentData>(row: any): QueryDocumentSnapshot<T> {
  const data = mapRow(row);
  return {
    id: data.id,
    exists: () => true,
    data: () => data as T,
    ...data,
  };
}

// ─── Document Operations ─────────────────────────────────────────────────────

export async function getDoc<T = DocumentData>(docRef: DocRef): Promise<DocumentSnapshot<T>> {
  const table = docRef.table;
  const idCol = table === 'system_settings' ? 'key' : 'id';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(idCol, docRef.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => undefined as unknown as T,
    };
  }

  const mapped = mapRow(data);
  return {
    id: mapped.id,
    exists: () => true,
    data: () => mapped as T,
    ...mapped,
  };
}

export async function getDocs<T = DocumentData>(target: CollectionRef | QueryDef): Promise<QuerySnapshot<T>> {
  const colRef = target.type === 'query' ? target.collection : target;
  const constraints = target.type === 'query' ? target.constraints : [];
  const table = colRef.table;

  let queryBuilder = supabase.from(table).select('*');

  // If subcollection has parent filter
  if (colRef.parentField && colRef.parentId) {
    queryBuilder = queryBuilder.eq(colRef.parentField, colRef.parentId);
  }

  const { data, error } = await queryBuilder;
  if (error || !data) {
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: () => {},
    };
  }

  let items = data.map(mapRow);

  // Apply in-memory constraints for guaranteed consistency
  for (const c of constraints) {
    if (c.type === 'where' && c.field && c.op) {
      const field = c.field;
      const snake = toSnakeCase(field);
      const val = c.val;

      items = items.filter((item) => {
        const itemVal = item[field] !== undefined ? item[field] : item[snake];
        if (c.op === '==' || c.op === '===') {
          if (typeof itemVal === 'string' && typeof val === 'string') {
            return itemVal.toLowerCase() === val.toLowerCase();
          }
          return itemVal === val;
        }
        if (c.op === '!=') return itemVal !== val;
        if (c.op === '>') return itemVal > val;
        if (c.op === '>=') return itemVal >= val;
        if (c.op === '<') return itemVal < val;
        if (c.op === '<=') return itemVal <= val;
        if (c.op === 'in') return Array.isArray(val) && val.includes(itemVal);
        if (c.op === 'array-contains') {
          if (!Array.isArray(itemVal)) return false;
          return itemVal.some((x) => x === val || (typeof x === 'object' && (x?.id === val || x?.uid === val)));
        }
        return true;
      });
    }
  }

  // Handle orderBy
  const orderConstraints = constraints.filter((c) => c.type === 'orderBy');
  if (orderConstraints.length > 0) {
    items.sort((a, b) => {
      for (const c of orderConstraints) {
        const f = c.field!;
        const snake = toSnakeCase(f);
        const va = a[f] !== undefined ? a[f] : a[snake];
        const vb = b[f] !== undefined ? b[f] : b[snake];
        if (va === vb) continue;
        if (va === undefined || va === null) return 1;
        if (vb === undefined || vb === null) return -1;
        const cmp = va > vb ? 1 : -1;
        return c.dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // Handle limit
  const limitConstraint = constraints.find((c) => c.type === 'limit');
  if (limitConstraint && limitConstraint.limitCount) {
    items = items.slice(0, limitConstraint.limitCount);
  }

  const docs = items.map((row) => mapSnapshotDoc<T>(row));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (d: QueryDocumentSnapshot<T>) => void) => docs.forEach(cb),
  };
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }): Promise<void> {
  const table = docRef.table;
  const isSettings = table === 'system_settings';
  const idCol = isSettings ? 'key' : 'id';
  const id = docRef.id || data.id || `doc_${Date.now()}`;

  let finalData = { ...data };
  if (options?.merge) {
    const { data: existing } = await supabase.from(table).select('*').eq(idCol, id).maybeSingle();
    if (existing) {
      finalData = { ...(existing.raw_data || {}), ...existing, ...data };
    }
  }

  const payload: Record<string, any> = {
    [idCol]: id,
    raw_data: { ...finalData, [idCol]: id },
  };

  const allowedCols = KNOWN_COLUMNS[table];
  for (const [k, v] of Object.entries(finalData)) {
    const snake = toSnakeCase(k);
    if (allowedCols?.has(snake)) {
      payload[snake] = normalizeValueForDb(v);
    }
  }

  const { error } = await supabase.from(table).upsert(payload);
  if (error) {
    console.warn(`Supabase setDoc error on ${table}:`, error.message);
  }
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  const table = docRef.table;
  const isSettings = table === 'system_settings';
  const idCol = isSettings ? 'key' : 'id';

  const { data: existing } = await supabase.from(table).select('*').eq(idCol, docRef.id).maybeSingle();
  const existingRaw = existing?.raw_data || existing || {};

  const resolvedData: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && (v as any).__type === 'increment') {
      const current = existingRaw[k] ?? existing?.[toSnakeCase(k)] ?? 0;
      resolvedData[k] = Number(current) + (v as any).value;
    } else {
      resolvedData[k] = v;
    }
  }

  const mergedRaw = { ...existingRaw, ...resolvedData, [idCol]: docRef.id };
  const payload: Record<string, any> = {
    raw_data: mergedRaw,
  };

  const allowedCols = KNOWN_COLUMNS[table];
  for (const [k, v] of Object.entries(resolvedData)) {
    const snake = toSnakeCase(k);
    if (allowedCols?.has(snake)) {
      payload[snake] = normalizeValueForDb(v);
    }
  }

  const { error } = await supabase.from(table).update(payload).eq(idCol, docRef.id);
  if (error) {
    console.warn(`Supabase updateDoc error on ${table}:`, error.message);
  }
}

export async function addDoc(colRef: CollectionRef, data: any): Promise<DocRef> {
  const table = colRef.table;
  const generatedId = data.id || `${table.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docReference = doc(colRef, generatedId);

  const fullData = { ...data, id: generatedId };
  if (colRef.parentField && colRef.parentId) {
    fullData[colRef.parentField] = colRef.parentId;
    fullData[toCamelCase(colRef.parentField)] = colRef.parentId;
  }

  await setDoc(docReference, fullData);
  return docReference;
}

export async function deleteDoc(docRef: DocRef): Promise<void> {
  const table = docRef.table;
  const idCol = table === 'system_settings' ? 'key' : 'id';
  await supabase.from(table).delete().eq(idCol, docRef.id);
}

function normalizeValueForDb(val: any): any {
  if (val instanceof Timestamp) return val.toISOString();
  if (val instanceof Date) return val.toISOString();
  if (val && typeof val === 'object' && val.__type === 'increment') return val.value;
  return val;
}

// ─── Realtime Subscriptions ──────────────────────────────────────────────────

export function onSnapshot<T = DocumentData>(
  target: DocRef,
  onNext: (snap: DocumentSnapshot<T>) => void,
  onError?: (err: any) => void
): () => void;
export function onSnapshot<T = DocumentData>(
  target: CollectionRef | QueryDef | any,
  onNext: (snap: QuerySnapshot<T>) => void,
  onError?: (err: any) => void
): () => void;
export function onSnapshot(
  target: any,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
): () => void {
  let active = true;

  const runFetch = async () => {
    try {
      if (target.type === 'doc') {
        const snap = await getDoc(target);
        if (active) onNext(snap);
      } else {
        const snap = await getDocs(target);
        if (active) onNext(snap);
      }
    } catch (e) {
      if (active && onError) onError(e);
    }
  };

  runFetch();

  const table = target.type === 'doc' ? target.table : (target.type === 'query' ? target.collection.table : target.table);
  const channelName = `realtime_${table}_${Math.random().toString(36).substring(2, 9)}`;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      runFetch();
    })
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

// ─── Batch Writes ────────────────────────────────────────────────────────────

export function writeBatch(_db?: any) {
  const operations: Array<() => Promise<any>> = [];
  return {
    set(docRef: DocRef, data: any, options?: { merge?: boolean }) {
      operations.push(() => setDoc(docRef, data, options));
      return this;
    },
    update(docRef: DocRef, data: any) {
      operations.push(() => updateDoc(docRef, data));
      return this;
    },
    delete(docRef: DocRef) {
      operations.push(() => deleteDoc(docRef));
      return this;
    },
    async commit() {
      for (const op of operations) {
        await op();
      }
    },
  };
}

// ─── Auth & Provider Shims ───────────────────────────────────────────────────

export const auth = {
  get currentUser() {
    try {
      const raw = localStorage.getItem('elgogalyia_user_session') || localStorage.getItem('elgogalyia_session_v1');
      if (raw) {
        const u = JSON.parse(raw);
        return {
          uid: u.uid || u.id,
          displayName: u.displayName || u.username,
          email: u.email,
          photoURL: u.photoURL,
        };
      }
    } catch {}
    return null;
  },
  onAuthStateChanged(cb: (user: any) => void) {
    cb(this.currentUser);
    return () => {};
  },
};

export const googleProvider = {
  setCustomParameters: () => {},
};

export async function signInWithPopup(
  _auth?: any,
  _provider?: any
): Promise<{ user: { uid: string; email: string; displayName: string } }> {
  throw new Error('Google OAuth is managed via Supabase or platform security credentials.');
}

export async function signOut() {
  localStorage.removeItem('elgogalyia_session_v1');
  localStorage.removeItem('elgogalyia_user_session');
}

export async function runTransaction<T>(
  _Supabase: any,
  updateFunction: (transaction: {
    get: (ref: DocRef) => Promise<DocumentSnapshot>;
    set: (ref: DocRef, data: any, options?: { merge?: boolean }) => any;
    update: (ref: DocRef, data: any) => any;
    delete: (ref: DocRef) => any;
  }) => Promise<T>
): Promise<T> {
  const tx = {
    get: (ref: DocRef) => getDoc(ref),
    set: (ref: DocRef, data: any, options?: any) => setDoc(ref, data, options),
    update: (ref: DocRef, data: any) => updateDoc(ref, data),
    delete: (ref: DocRef) => deleteDoc(ref),
  };
  return updateFunction(tx);
}

