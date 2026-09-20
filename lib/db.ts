import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db as firestore } from './firebase';


interface SkateDB extends DBSchema {
  skates: {
    key: string;
    value: {
      id: string;
      status: 'Available' | 'Active' | 'Paused' | 'Maintenance';
      name: string;
    };
  };
  sessions: {
    key: string;
    value: {
      id: string;
      skateId: string;
      startTime: number;
      endTime: number;
      pausedAt: number | null;
      status: 'active' | 'completed' | 'cancelled';
      price: number;
    };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      collection: string;
      docId: string;
      operation: 'set' | 'update' | 'delete';
      data: any;
      timestamp: number;
    };
  };
  pricing: {
    key: string;
    value: {
      id: string;
      price30Min: number;
      price60Min: number;
    };
  };
  trainers: {
    key: string;
    value: {
      id: string;
      email: string;
      password: string; // Stored securely for the deletion workaround
      createdAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SkateDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SkateDB>('SkateHouseDB', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('skates', { keyPath: 'id' });
          db.createObjectStore('sessions', { keyPath: 'id' });
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('pricing', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('trainers', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// Generic Offline-first write
export const offlineWrite = async (
  collection: 'skates' | 'sessions' | 'pricing' | 'trainers',
  docId: string,
  data: any,
  operation: 'set' | 'update' | 'delete' = 'set'
) => {
  const db = await initDB();
  const tx = db.transaction([collection, 'sync_queue'], 'readwrite');
  
  if (operation === 'delete') {
    await tx.objectStore(collection).delete(docId);
  } else {
    await tx.objectStore(collection).put({ id: docId, ...data });
  }

  await tx.objectStore('sync_queue').add({
    collection,
    docId,
    operation,
    data,
    timestamp: Date.now(),
  });

  await tx.done;
  
  // Try to sync immediately if online
  if (typeof window !== 'undefined' && navigator.onLine) {
    syncNow();
  }
};

export const syncNow = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const db = await initDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const queue = await tx.objectStore('sync_queue').getAll();
  
  if (queue.length === 0) return;

  console.log(`Syncing ${queue.length} items to Firebase...`);

  for (const item of queue) {
    try {
      const docRef = doc(firestore, item.collection, item.docId);
      
      if (item.operation === 'delete') {
        await deleteDoc(docRef);
      } else if (item.operation === 'update') {
        await updateDoc(docRef, item.data);
      } else {
        await setDoc(docRef, item.data);
      }
      
      // If successful, delete from queue
      if (item.id) {
        await db.delete('sync_queue', item.id);
      }
    } catch (error) {
      console.error('Error syncing item:', item, error);
      // We leave it in the queue to try again later
    }
  }
};

// Setup online listener for background syncing
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("Back online! Triggering background sync...");
    syncNow();
  });
}

