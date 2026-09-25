import { Campaign, PaginatedResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { Repository, ListOptions } from './Repository';
import { AppError } from '../errors/AppError';

export class InMemoryCampaignRepository implements Repository<Campaign> {
  private campaigns = new Map<string, Campaign>();

  constructor(initialData: Campaign[] = []) {
    for (const c of initialData) {
      this.campaigns.set(c.id, { ...c });
    }
  }

  async create(
    data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<Campaign, 'id'>>
  ): Promise<Campaign> {
    const now = new Date().toISOString();
    const id = data.id || `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
    this.campaigns.set(id, newCampaign);
    return { ...newCampaign };
  }

  async getById(id: string): Promise<Campaign | null> {
    const item = this.campaigns.get(id);
    return item ? { ...item } : null;
  }

  async list(options?: ListOptions): Promise<PaginatedResult<Campaign>> {
    let items = Array.from(this.campaigns.values());

    const filters = options?.filters;
    if (filters) {
      if (filters.isTrash) {
        items = items.filter((c) => c.deletedAt !== null);
      } else {
        items = items.filter((c) => c.deletedAt === null);
      }

      if (filters.userEmail || filters.ownerId) {
        items = items.filter(
          (c) =>
            c.ownerId === filters.ownerId ||
            (filters.userEmail && c.memberEmails.includes(filters.userEmail))
        );
      }

      if (filters.status) {
        items = items.filter((c) => c.status === filters.status);
      }

      if (filters.search) {
        const query = filters.search.toLowerCase();
        items = items.filter((c) => c.name.toLowerCase().includes(query));
      }
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

    // Cursor pagination (cursor is ID)
    const limit = options?.limit || CONFIG.DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (options?.cursor) {
      const cursorIndex = items.findIndex((i) => i.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageItems = items.slice(startIndex, startIndex + limit);
    const nextCursor =
      pageItems.length === limit && startIndex + limit < items.length
        ? pageItems[pageItems.length - 1].id
        : null;

    return {
      items: pageItems.map((c) => ({ ...c })),
      nextCursor,
      total: items.length,
    };
  }

  async update(id: string, updates: Partial<Campaign>, expectedVersion: number): Promise<Campaign> {
    const existing = this.campaigns.get(id);
    if (!existing) {
      throw AppError.notFound('Campaign not found');
    }

    if (existing.version !== expectedVersion) {
      throw AppError.conflict(
        `Version conflict: expected version ${expectedVersion}, but found version ${existing.version}`,
        existing
      );
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...existing,
      ...updates,
      id: existing.id,
      ownerId: existing.ownerId,
      ownerEmail: existing.ownerEmail,
      createdAt: existing.createdAt,
      updatedAt: now,
      version: existing.version + 1,
    };

    this.campaigns.set(id, updated);
    return { ...updated };
  }

  async softDelete(id: string, expectedVersion: number): Promise<Campaign> {
    const existing = this.campaigns.get(id);
    if (!existing) throw AppError.notFound('Campaign not found');
    if (existing.version !== expectedVersion) {
      throw AppError.conflict('Version conflict when soft-deleting', existing);
    }
    const now = new Date().toISOString();
    const updated: Campaign = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      version: existing.version + 1,
    };
    this.campaigns.set(id, updated);
    return { ...updated };
  }

  async restore(id: string): Promise<Campaign> {
    const existing = this.campaigns.get(id);
    if (!existing) throw AppError.notFound('Campaign not found');
    const now = new Date().toISOString();
    const updated: Campaign = {
      ...existing,
      deletedAt: null,
      updatedAt: now,
      version: existing.version + 1,
    };
    this.campaigns.set(id, updated);
    return { ...updated };
  }

  async hardDelete(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }
}
