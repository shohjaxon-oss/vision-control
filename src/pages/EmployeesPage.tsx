import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type Table,
} from '@tanstack/react-table';
import { motion } from 'motion/react';
import { callApi } from '@/lib/apiFacade';
import type { Employee } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsentBadge, EnrollmentBadge } from '@/components/badges';
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function EmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: employees, isLoading, isError, refetch } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => callApi<Employee[]>((a) => a.getEmployees()),
  });

  const columnHelper = createColumnHelper<Employee>();

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
        id: 'name',
        header: t('employees.colName'),
        cell: (info) => (
          <span className="font-medium text-ink">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('position', {
        header: t('employees.colPosition'),
        cell: (info) => <span className="text-text2">{info.getValue()}</span>,
      }),
      columnHelper.accessor('department', {
        header: t('employees.colDepartment'),
        cell: (info) => <span className="text-text2">{info.getValue()}</span>,
      }),
      columnHelper.accessor('consent_status', {
        header: t('employees.colConsent'),
        cell: (info) => <ConsentBadge status={info.getValue()} />,
        enableSorting: false,
      }),
      columnHelper.accessor('enrollment_status', {
        header: t('employees.colEnrollment'),
        cell: (info) => (
          <EnrollmentBadge
            status={info.getValue()}
            samples={info.row.original.enrollment_samples}
          />
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('is_active', {
        header: t('employees.colStatus'),
        cell: (info) => (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium',
              info.getValue() ? 'text-ink font-semibold' : 'text-text2'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', info.getValue() ? 'bg-[#16A34A]' : 'bg-[#DC2626]')} />
            {info.getValue() ? t('status.active') : t('status.inactive')}
          </span>
        ),
        enableSorting: false,
      }),
    ],
    [t, columnHelper]
  );

  const table = useReactTable({
    data: employees || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredData = useMemo(() => {
    const rows = table.getRowModel().rows;
    return rows.filter((row) => {
      const emp = row.original;
      const matchesSearch =
        !search ||
        `${emp.first_name} ${emp.last_name} ${emp.position} ${emp.department}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesFilter =
        filterActive === 'all' ||
        (filterActive === 'active' && emp.is_active) ||
        (filterActive === 'inactive' && !emp.is_active);
      return matchesSearch && matchesFilter;
    });
  }, [table, search, filterActive]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-control bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm font-medium text-text2">{t('common.error')}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t('employees.title')}</h1>
          <p className="mt-1 text-sm font-medium text-text2 tabular-nums">
            {filteredData.length} {t('nav.employees').toLowerCase()}
          </p>
        </div>
        <Button onClick={() => navigate('/employees/new')}>
          <Plus size={16} strokeWidth={1.5} />
          {t('employees.add')}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text2"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('employees.search')}
            className="pl-9 text-ink font-medium"
          />
        </div>

        <div className="flex rounded-control border border-line bg-surface p-0.5 shadow-xs">
          {(['all', 'active', 'inactive'] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors',
                filterActive === f
                  ? 'bg-ink text-white shadow-xs'
                  : 'text-text2 hover:text-ink hover:bg-surface-hover'
              )}
            >
              {t(`employees.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>

        <ColumnVisibility table={table} />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-panel border border-line py-16 text-center">
          <Users size={32} strokeWidth={1.5} className="text-mutedtext" />
          <p className="mt-4 text-sm text-ink">{t('employees.empty')}</p>
          <p className="mt-1 text-xs text-text2">{t('employees.emptyHint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-line bg-surface">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-2.5 text-left text-xs font-medium text-text2"
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            className={cn(
                              'flex items-center gap-1.5',
                              canSort && 'cursor-pointer hover:text-ink'
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && (
                              sorted === 'asc' ? (
                                <ArrowUp size={14} strokeWidth={1.5} />
                              ) : sorted === 'desc' ? (
                                <ArrowDown size={14} strokeWidth={1.5} />
                              ) : (
                                <ArrowUpDown size={14} strokeWidth={1.5} className="text-mutedtext" />
                              )
                            )}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <motion.tr
                  key={row.original.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  className="cursor-pointer border-b border-line transition-colors hover:bg-surface last:border-0"
                  onClick={() => navigate(`/employees/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ColumnVisibility({ table }: { table: Table<Employee> }) {
  const { t } = useTranslation();
  const hiddenCount = table.getAllColumns().filter((c) => !c.getIsVisible()).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {hiddenCount > 0 ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
          {hiddenCount > 0 && <span className="tabular-nums">{hiddenCount}</span>}
          <ChevronDown size={14} strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table.getAllColumns().map((column) => (
          <DropdownMenuItem
            key={column.id}
            onClick={() => column.toggleVisibility()}
            className="cursor-pointer"
          >
            <span className={cn('mr-2', column.getIsVisible() ? 'text-ink' : 'text-mutedtext')}>
              {column.getIsVisible() ? <Eye size={14} strokeWidth={1.5} /> : <EyeOff size={14} strokeWidth={1.5} />}
            </span>
            {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
