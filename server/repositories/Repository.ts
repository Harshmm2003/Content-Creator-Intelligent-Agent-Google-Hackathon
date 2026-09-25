import { PaginatedResult } from '../../shared/types';

export interface QueryFilters {
  status?: string;
  search?: string;
  ownerId?: string;
  userEmail?: string;
  isTrash?: boolean;
}

export interface ListOptions {
  filters?: QueryFilters;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export interface Repository<T extends { id: string; version: number }> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<T, 'id'>>): Promise<T>;
  getById(id: string): Promise<T | null>;
  list(options?: ListOptions): Promise<PaginatedResult<T>>;
  update(id: string, updates: Partial<T>, expectedVersion: number): Promise<T>;
  softDelete(id: string, expectedVersion: number): Promise<T>;
  restore(id: string): Promise<T>;
  hardDelete(id: string): Promise<boolean>;
}

export interface SubcollectionRepository<T> {
  create(parentId: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  list(parentId: string, limit?: number): Promise<T[]>;
  deleteAll(parentId: string): Promise<number>;
}
