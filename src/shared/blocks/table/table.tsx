import type { ReactNode } from 'react';
import { Trash } from 'lucide-react';

import {
  TableBody,
  TableCell,
  Table as TableComponent,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { NavItem } from '@/shared/types/blocks/common';
import type { TableColumn } from '@/shared/types/blocks/table';

import { Copy } from './copy';
import { Dropdown } from './dropdown';
import { Image } from './image';
import { JsonPreview } from './json-preview';
import { Label } from './label';
import { Time } from './time';
import { User, type TableUserValue } from './user';

export function Table<T extends object>({
  columns,
  data,
  emptyMessage,
}: {
  columns?: TableColumn<T>[];
  data?: T[];
  emptyMessage?: string;
}) {
  if (!columns) {
    columns = [];
  }

  return (
    <TableComponent className="w-full">
      <TableHeader className="">
        <TableRow className="rounded-md">
          {columns &&
            columns.map((item: TableColumn<T>, idx: number) => {
              return (
                <TableHead key={idx} className={item.className}>
                  {item.title}
                </TableHead>
              );
            })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data && data.length > 0 ? (
          data.map((item, idx: number) => (
            <TableRow key={idx} className="h-16">
              {columns &&
                columns.map((column: TableColumn<T>, iidx: number) => {
                  const record = item as Record<string, unknown>;
                  const value =
                    column.name && column.name in record
                      ? record[column.name]
                      : undefined;

                  const rawContent = column.callback
                    ? column.callback(item)
                    : value;

                  let cellContent: ReactNode | undefined;

                  if (column.type === 'image') {
                    cellContent = (
                      <Image
                        placeholder={column.placeholder}
                        value={value as string}
                        metadata={
                          column.metadata as {
                            width?: number;
                            height?: number;
                          }
                        }
                        className={column.className}
                        alt={
                          column.placeholder ||
                          (typeof value === 'string' ? (value as string) : '')
                        }
                      />
                    );
                  } else if (column.type === 'time') {
                    cellContent = (
                      <Time
                        placeholder={column.placeholder}
                        value={value as string | Date}
                        metadata={
                          column.metadata as {
                            format?: string;
                          }
                        }
                        className={column.className}
                      />
                    );
                  } else if (column.type === 'label') {
                    cellContent = (
                      <Label
                        placeholder={column.placeholder}
                        value={value as string}
                        metadata={
                          column.metadata as {
                            variant?:
                              | 'default'
                              | 'secondary'
                              | 'destructive'
                              | 'outline';
                          }
                        }
                        className={column.className}
                      />
                    );
                  } else if (column.type === 'copy' && value) {
                    cellContent = (
                      <Copy
                        placeholder={column.placeholder}
                        value={value as string}
                        metadata={
                          column.metadata as {
                            message?: string;
                          }
                        }
                        className={column.className}
                      >
                        {rawContent as ReactNode}
                      </Copy>
                    );
                  } else if (column.type === 'dropdown') {
                    cellContent = (
                      <Dropdown
                        placeholder={column.placeholder}
                        value={rawContent as NavItem[]}
                        metadata={column.metadata as Record<string, unknown>}
                        className={column.className}
                      />
                    );
                  } else if (column.type === 'user') {
                    cellContent = (
                      <User
                        placeholder={column.placeholder}
                        value={value as TableUserValue}
                        metadata={column.metadata as Record<string, unknown>}
                        className={column.className}
                      />
                    );
                  } else if (column.type === 'json_preview') {
                    cellContent = (
                      <JsonPreview
                        placeholder={column.placeholder}
                        value={value as string}
                        metadata={column.metadata as Record<string, unknown>}
                        className={column.className}
                      />
                    );
                  }

                  return (
                    <TableCell key={iidx} className={column.className}>
                      {cellContent ?? column.placeholder}
                    </TableCell>
                  );
                })}
            </TableRow>
          ))
        ) : (
          <TableRow className="">
            <TableCell colSpan={columns.length}>
              <div className="text-muted-foreground flex w-full items-center justify-center py-8">
                {emptyMessage ? (
                  <p>{emptyMessage}</p>
                ) : (
                  <Trash className="h-10 w-10" />
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </TableComponent>
  );
}
