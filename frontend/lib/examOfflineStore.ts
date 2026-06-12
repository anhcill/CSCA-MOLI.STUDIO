/**
 * IndexedDB-based offline store for exam drafts & sync queue.
 *
 * DB: csca_exam_offline
 * Stores:
 *   - drafts: key=[examId, attemptId], holds selectedAnswers + startTime + timeLeft
 *   - syncQueue: auto-increment, holds pending answer_changed / submit_attempt actions
 */

const DB_NAME = 'csca_exam_offline';
const DB_VERSION = 1;
const DRAFTS_STORE = 'drafts';
const QUEUE_STORE = 'syncQueue';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExamDraft {
  examId: number;
  attemptId: number;
  selectedAnswers: Record<number, number | string>; // questionId → answerId|answerKey|essayText
  startTime: number; // Date.now() when exam started
  timeLeftSeconds: number; // last known timeLeft
  practiceMode: boolean;
  updatedAt: number; // Date.now()
}

export interface SyncQueueItem {
  id?: number; // auto-increment
  type: 'answer_changed' | 'submit_attempt';
  attemptId: number;
  questionId?: number; // for answer_changed
  answerKey?: string;
  essayAnswer?: string;
  timeSpent?: number;
  practiceMode?: boolean;
  createdAt: number;
  retryCount: number;
  /** 'pending' | 'sending' | 'failed' */
  status: string;
  errorMessage?: string;
}

// ── DB helpers ───────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: ['examId', 'attemptId'] });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('byAttempt', 'attemptId', { unique: false });
        store.createIndex('byStatus', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode = 'readonly') {
  const transaction = db.transaction(store, mode);
  return transaction.objectStore(store);
}

// ── Draft operations ─────────────────────────────────────────────────────────

export async function saveDraft(draft: ExamDraft): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, DRAFTS_STORE, 'readwrite');
    const req = store.put({ ...draft, updatedAt: Date.now() });
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function loadDraft(examId: number, attemptId: number): Promise<ExamDraft | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, DRAFTS_STORE);
    const req = store.get([examId, attemptId]);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteDraft(examId: number, attemptId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, DRAFTS_STORE, 'readwrite');
    const req = store.delete([examId, attemptId]);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Load latest draft for an exam (any attemptId). */
export async function loadLatestDraft(examId: number): Promise<ExamDraft | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, DRAFTS_STORE);
    const req = store.openCursor();
    let latest: ExamDraft | null = null;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value as ExamDraft;
        if (val.examId === examId && (!latest || val.updatedAt > latest.updatedAt)) {
          latest = val;
        }
        cursor.continue();
      } else {
        db.close();
        resolve(latest);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ── Sync queue operations ────────────────────────────────────────────────────

export async function enqueueSync(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, QUEUE_STORE, 'readwrite');

    if (item.type === 'answer_changed' && item.questionId) {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          const addReq = store.add(item);
          addReq.onsuccess = () => { db.close(); resolve(addReq.result as number); };
          addReq.onerror = () => { db.close(); reject(addReq.error); };
          return;
        }

        const current = cursor.value as SyncQueueItem;
        const sameAnswer =
          current.type === 'answer_changed' &&
          current.status !== 'synced' &&
          current.attemptId === item.attemptId &&
          current.questionId === item.questionId;

        if (sameAnswer) {
          const updateReq = cursor.update({
            ...current,
            ...item,
            id: current.id,
            retryCount: 0,
            status: 'pending',
            errorMessage: undefined,
          });
          updateReq.onsuccess = () => { db.close(); resolve(current.id as number); };
          updateReq.onerror = () => { db.close(); reject(updateReq.error); };
          return;
        }

        cursor.continue();
      };
      cursorReq.onerror = () => { db.close(); reject(cursorReq.error); };
      return;
    }

    const req = store.add(item);
    req.onsuccess = () => { db.close(); resolve(req.result as number); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getPendingQueue(attemptId?: number): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, QUEUE_STORE);
    const req = store.openCursor();
    const items: SyncQueueItem[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value as SyncQueueItem;
        if (val.status !== 'synced' && (!attemptId || val.attemptId === attemptId)) {
          items.push(val);
        }
        cursor.continue();
      } else {
        db.close();
        // Sort by createdAt (FIFO)
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function updateQueueItem(id: number, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = QUEUE_STORE;
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (!getReq.result) { db.close(); resolve(); return; }
      const updated = { ...getReq.result, ...updates };
      const putReq = store.put(updated);
      putReq.onsuccess = () => { db.close(); resolve(); };
      putReq.onerror = () => { db.close(); reject(putReq.error); };
    };
    getReq.onerror = () => { db.close(); reject(getReq.error); };
  });
}

export async function removeQueueItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, QUEUE_STORE, 'readwrite');
    const req = store.delete(id);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearSyncedItems(attemptId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeName = QUEUE_STORE;
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value as SyncQueueItem;
        if (val.attemptId === attemptId && val.status === 'synced') {
          cursor.delete();
        }
        cursor.continue();
      } else {
        db.close();
        resolve();
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
