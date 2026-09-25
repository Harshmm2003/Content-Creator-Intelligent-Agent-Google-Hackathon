import {
  initializeApp,
  getApps,
  getApp,
} from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Campaign, Activity, PaginatedResult } from '../../shared/types';
import { Repository, ListOptions } from './Repository';
import { AppError } from '../errors/AppError';
import { CONFIG } from '../../shared/config';

let firestoreInstance: Firestore | null = null;

export function getFirestoreDB(): Firestore {
  if (!firestoreInstance) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
  return firestoreInstance;
}

export class FirestoreCampaignRepository implements Repository<Campaign> {
  private db: Firestore;
  private collectionName = 'campaigns';

  constructor(db?: Firestore) {
    this.db = db || getFirestoreDB();
  }

  async create(
    data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<Campaign, 'id'>>
  ): Promise<Campaign> {
    const now = new Date().toISOString();
    const id = data.id || `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const docRef = doc(this.db, this.collectionName, id);

    const newCampaign: Campaign = {
      ...data,
      id,
      status: data.status || 'draft',
      brief: data.brief || null,
      settings: data.settings || null,
      approvedLineup: data.approvedLineup || [],
      deletedAt: data.deletedAt || null,
      memberEmails: data.memberEmails || [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await setDoc(docRef, newCampaign);
    return newCampaign;
  }

  async getById(id: string): Promise<Campaign | null> {
    const docRef = doc(this.db, this.collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as Campaign;
  }

  async list(options?: ListOptions): Promise<PaginatedResult<Campaign>> {
    const colRef = collection(this.db, this.collectionName);
    const filters = options?.filters;

    let snapshot;
    try {
      snapshot = await getDocs(colRef);
    } catch (err) {
      console.warn('[Firestore] Error fetching campaigns collection, returning empty list:', err);
      return {
        items: [],
        nextCursor: null,
        total: 0,
      };
    }

    let items = snapshot.docs.map((d) => d.data() as Campaign);

    // Apply trash filter
    if (filters?.isTrash) {
      items = items.filter((c) => c.deletedAt !== null);
    } else {
      items = items.filter((c) => c.deletedAt === null);
    }

    // Apply owner and membership authorization filter
    if (filters?.ownerId || filters?.userEmail) {
      items = items.filter((c) => {
        const isOwner = filters.ownerId ? c.ownerId === filters.ownerId : false;
        const isMember = filters.userEmail
          ? c.ownerEmail === filters.userEmail || (c.memberEmails && c.memberEmails.includes(filters.userEmail))
          : false;
        return isOwner || isMember;
      });
    }

    // Status filter
    if (filters?.status) {
      items = items.filter((c) => c.status === filters.status);
    }

    // Search filter
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(s));
    }

    // Sort
    const sortField = (options?.sortField as keyof Campaign) || 'updatedAt';
    const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (aVal < bVal) return -1 * sortOrder;
      if (aVal > bVal) return 1 * sortOrder;
      return 0;
    });

    // Pagination
    const pageLimit = options?.limit || CONFIG.DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (options?.cursor) {
      const cursorIndex = items.findIndex((i) => i.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageItems = items.slice(startIndex, startIndex + pageLimit);
    const hasMore = startIndex + pageLimit < items.length;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;

    return {
      items: pageItems,
      nextCursor,
      total: items.length,
    };
  }

  async update(id: string, updates: Partial<Campaign>, expectedVersion: number): Promise<Campaign> {
    const docRef = doc(this.db, this.collectionName, id);
    const existing = await this.getById(id);
    if (!existing) throw AppError.notFound('Campaign not found');

    if (existing.version !== expectedVersion) {
      throw AppError.conflict(
        `Version mismatch: expected ${expectedVersion}, got ${existing.version}`,
        existing
      );
    }

    const now = new Date().toISOString();
    const newVersion = existing.version + 1;
    const payload: Partial<Campaign> = {
      ...updates,
      updatedAt: now,
      version: newVersion,
    };

    await updateDoc(docRef, payload as any);
    return { ...existing, ...payload };
  }

  async softDelete(id: string, expectedVersion: number): Promise<Campaign> {
    const existing = await this.getById(id);
    if (!existing) throw AppError.notFound('Campaign not found');
    if (existing.version !== expectedVersion) {
      throw AppError.conflict('Version conflict when soft-deleting', existing);
    }

    const now = new Date().toISOString();
    const docRef = doc(this.db, this.collectionName, id);
    const newVersion = existing.version + 1;
    await updateDoc(docRef, {
      deletedAt: now,
      updatedAt: now,
      version: newVersion,
    });

    return {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      version: newVersion,
    };
  }

  async restore(id: string): Promise<Campaign> {
    const existing = await this.getById(id);
    if (!existing) throw AppError.notFound('Campaign not found');

    const now = new Date().toISOString();
    const docRef = doc(this.db, this.collectionName, id);
    const newVersion = existing.version + 1;
    await updateDoc(docRef, {
      deletedAt: null,
      updatedAt: now,
      version: newVersion,
    });

    return {
      ...existing,
      deletedAt: null,
      updatedAt: now,
      version: newVersion,
    };
  }

  async hardDelete(id: string): Promise<boolean> {
    const docRef = doc(this.db, this.collectionName, id);
    await deleteDoc(docRef);
    return true;
  }
}

export class FirestoreActivityRepository {
  private db: Firestore;

  constructor(db?: Firestore) {
    this.db = db || getFirestoreDB();
  }

  async create(campaignId: string, data: any) {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const docRef = doc(this.db, `campaigns/${campaignId}/activity`, id);
    const item = { ...data, id, campaignId };
    await setDoc(docRef, item);
    return item;
  }

  async list(campaignId: string, maxItems = 50) {
    const colRef = collection(this.db, `campaigns/${campaignId}/activity`);
    const q = query(colRef, orderBy('at', 'desc'), firestoreLimit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Activity);
  }

  async deleteAll(campaignId: string): Promise<number> {
    const colRef = collection(this.db, `campaigns/${campaignId}/activity`);
    const snap = await getDocs(colRef);
    const batch = writeBatch(this.db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return snap.size;
  }
}
