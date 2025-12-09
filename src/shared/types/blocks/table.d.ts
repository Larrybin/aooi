import { Button, Pagination } from './common';

export interface TableColumn<T> {
  name?: string;
  title?: string;
  type?:
    | 'copy'
    | 'image'
    | 'time'
    | 'label'
    | 'dropdown'
    | 'user'
    | 'json_preview';
  placeholder?: string;
  metadata?: unknown;
  className?: string;
  callback?: (item: T) => unknown;
}

export interface Table<T = unknown> {
  title?: string;
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  pagination?: Pagination;
  actions?: Button[];
}
