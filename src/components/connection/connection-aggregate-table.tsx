import { DeleteForeverRounded } from '@mui/icons-material'
import { IconButton, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { ConnectionAggregateItem } from '@/hooks/use-connection-data'

import { formatConnectionChains, formatConnectionTraffic } from './connection-row-view'

const ROW_HEIGHT = 40
const OVERSCAN_ROWS = 6

type AggregateColumnField =
  | 'host'
  | 'topGroup'
  | 'total'
  | 'download'
  | 'upload'
  | 'dlSpeed'
  | 'ulSpeed'
  | 'activeCount'
  | 'connectionCount'
  | 'closedCount'
  | 'chains'
  | 'rule'
  | 'process'
  | 'firstSeen'
  | 'lastSeen'
  | 'action'

interface AggregateColumn {
  field: AggregateColumnField
  headerName: string
  width: number
  minWidth: number
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  cell?: (row: ConnectionAggregateItem) => ReactNode
}

interface SortingState {
  id: AggregateColumnField
  desc: boolean
}

interface RowComponentProps {
  row: ConnectionAggregateItem
  columns: AggregateColumn[]
  borderColor: string
  virtualTop: number
  onDeleteItem: (id: string) => void
}

interface Props {
  items: ConnectionAggregateItem[]
  onDeleteItem: (id: string) => void
}

const formatTime = (value: number) =>
  value > 0 ? new Date(value).toLocaleString() : ''

const joinTexts = (values: string[]) => values.filter(Boolean).join(', ')

const getTotalTraffic = (row: ConnectionAggregateItem) =>
  (row.download ?? 0) + (row.upload ?? 0)

const getAggregateCellValue = (
  field: AggregateColumnField,
  row: ConnectionAggregateItem,
) => {
  switch (field) {
    case 'host':
      return row.host
    case 'topGroup':
      return row.topGroup
    case 'total':
      return getTotalTraffic(row)
    case 'download':
      return row.download ?? 0
    case 'upload':
      return row.upload ?? 0
    case 'dlSpeed':
      return row.curDownload ?? 0
    case 'ulSpeed':
      return row.curUpload ?? 0
    case 'activeCount':
      return row.activeCount ?? 0
    case 'connectionCount':
      return row.connectionCount ?? 0
    case 'closedCount':
      return row.closedCount ?? 0
    case 'chains':
      return formatConnectionChains(row.chains)
    case 'rule':
      return joinTexts(row.rules)
    case 'process':
      return joinTexts(row.processes)
    case 'firstSeen':
      return row.firstSeen ?? 0
    case 'lastSeen':
      return row.lastSeen ?? 0
    default:
      return ''
  }
}

const compareAggregateCellValue = (
  field: AggregateColumnField,
  left: ConnectionAggregateItem,
  right: ConnectionAggregateItem,
) => {
  const leftValue = getAggregateCellValue(field, left)
  const rightValue = getAggregateCellValue(field, right)

  if (typeof leftValue === 'number' || typeof rightValue === 'number') {
    return (Number(leftValue) || 0) - (Number(rightValue) || 0)
  }

  return String(leftValue ?? '').localeCompare(String(rightValue ?? ''))
}

const defaultDescFields = new Set<AggregateColumnField>([
  'total',
  'download',
  'upload',
  'dlSpeed',
  'ulSpeed',
  'activeCount',
  'connectionCount',
  'closedCount',
  'firstSeen',
  'lastSeen',
])

const renderCell = (column: AggregateColumn, row: ConnectionAggregateItem) => {
  if (column.cell) return column.cell(row)
  const value = getAggregateCellValue(column.field, row)
  if (column.field === 'firstSeen' || column.field === 'lastSeen') {
    return formatTime(Number(value) || 0)
  }
  return value
}

const RowComponent = memo(
  function RowComponent({
    row,
    columns,
    borderColor,
    virtualTop,
    onDeleteItem,
  }: RowComponentProps) {
    const handleDelete = useCallback(
      (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        onDeleteItem(row.id)
      },
      [onDeleteItem, row.id],
    )

    return (
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: virtualTop,
          left: 0,
          right: 0,
          height: ROW_HEIGHT,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {columns.map((column) => (
          <div
            key={column.field}
            style={{
              boxSizing: 'border-box',
              flex: `0 0 ${column.width}px`,
              minWidth: column.minWidth,
              padding: '8px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                column.align === 'right'
                  ? 'flex-end'
                  : column.align === 'center'
                    ? 'center'
                    : 'flex-start',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {column.field === 'action' ? (
              <Tooltip title="删除这一行统计">
                <IconButton size="small" onClick={handleDelete}>
                  <DeleteForeverRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              renderCell(column, row)
            )}
          </div>
        ))}
      </div>
    )
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.columns === next.columns &&
    prev.virtualTop === next.virtualTop &&
    prev.onDeleteItem === next.onDeleteItem &&
    prev.borderColor === next.borderColor,
)

export const ConnectionAggregateTable = (props: Props) => {
  const { items, onDeleteItem: rawOnDeleteItem } = props
  const onDeleteItemRef = useRef(rawOnDeleteItem)
  onDeleteItemRef.current = rawOnDeleteItem
  const onDeleteItem = useCallback(
    (id: string) => onDeleteItemRef.current(id),
    [],
  )
  const { t } = useTranslation()
  const theme = useTheme()
  const [sorting, setSorting] = useState<SortingState | null>({
    id: 'total',
    desc: true,
  })
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 })
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const columns = useMemo<AggregateColumn[]>(() => {
    return [
      {
        field: 'host',
        headerName: t('connections.components.fields.host'),
        width: 220,
        minWidth: 160,
      },
      {
        field: 'topGroup',
        headerName: '分组',
        width: 160,
        minWidth: 120,
      },
      {
        field: 'total',
        headerName: '总流量',
        width: 90,
        minWidth: 70,
        align: 'right',
        cell: (row) => formatConnectionTraffic(getTotalTraffic(row)),
      },
      {
        field: 'download',
        headerName: t('shared.labels.downloaded'),
        width: 90,
        minWidth: 70,
        align: 'right',
        cell: (row) => formatConnectionTraffic(row.download),
      },
      {
        field: 'upload',
        headerName: t('shared.labels.uploaded'),
        width: 90,
        minWidth: 70,
        align: 'right',
        cell: (row) => formatConnectionTraffic(row.upload),
      },
      {
        field: 'dlSpeed',
        headerName: t('connections.components.fields.dlSpeed'),
        width: 90,
        minWidth: 70,
        align: 'right',
        cell: (row) => `${formatConnectionTraffic(row.curDownload)}/s`,
      },
      {
        field: 'ulSpeed',
        headerName: t('connections.components.fields.ulSpeed'),
        width: 90,
        minWidth: 70,
        align: 'right',
        cell: (row) => `${formatConnectionTraffic(row.curUpload)}/s`,
      },
      {
        field: 'activeCount',
        headerName: '活跃',
        width: 70,
        minWidth: 58,
        align: 'right',
      },
      {
        field: 'connectionCount',
        headerName: '连接数',
        width: 76,
        minWidth: 64,
        align: 'right',
      },
      {
        field: 'closedCount',
        headerName: '已关闭',
        width: 76,
        minWidth: 64,
        align: 'right',
      },
      {
        field: 'chains',
        headerName: t('connections.components.fields.chains'),
        width: 300,
        minWidth: 180,
      },
      {
        field: 'rule',
        headerName: t('connections.components.fields.rule'),
        width: 240,
        minWidth: 160,
      },
      {
        field: 'process',
        headerName: t('connections.components.fields.process'),
        width: 200,
        minWidth: 140,
      },
      {
        field: 'firstSeen',
        headerName: '首次出现',
        width: 150,
        minWidth: 120,
      },
      {
        field: 'lastSeen',
        headerName: '最后活跃',
        width: 150,
        minWidth: 120,
      },
      {
        field: 'action',
        headerName: '操作',
        width: 64,
        minWidth: 56,
        align: 'center',
        sortable: false,
      },
    ]
  }, [t])

  const sortedItems = useMemo(() => {
    if (!sorting) return items

    const direction = sorting.desc ? -1 : 1
    return [...items].sort(
      (left, right) =>
        compareAggregateCellValue(sorting.id, left, right) * direction,
    )
  }, [items, sorting])

  const tableWidth = useMemo(
    () => columns.reduce((total, column) => total + column.width, 0),
    [columns],
  )

  const updateViewport = useCallback((element: HTMLDivElement) => {
    setViewport((current) => {
      const next = {
        scrollTop: element.scrollTop,
        height: element.clientHeight,
      }
      return current.scrollTop === next.scrollTop &&
        current.height === next.height
        ? current
        : next
    })
  }, [])

  const setScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      scrollContainerRef.current = element
      if (element) updateViewport(element)
    },
    [updateViewport],
  )

  useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateViewport(element)
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }

    const observer = new ResizeObserver(() => updateViewport(element))
    observer.observe(element)
    return () => observer.disconnect()
  }, [updateViewport])

  useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    const maxScrollTop = Math.max(
      0,
      element.scrollHeight - element.clientHeight,
    )
    if (element.scrollTop <= maxScrollTop) return

    element.scrollTop = maxScrollTop
  }, [sortedItems.length])

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      updateViewport(event.currentTarget)
    },
    [updateViewport],
  )

  const bodyScrollTop = Math.max(0, viewport.scrollTop - ROW_HEIGHT)
  const firstVisibleRow = Math.min(
    sortedItems.length,
    Math.max(0, Math.floor(bodyScrollTop / ROW_HEIGHT) - OVERSCAN_ROWS),
  )
  const lastVisibleRow = Math.max(
    firstVisibleRow,
    Math.min(
      sortedItems.length,
      Math.ceil((bodyScrollTop + viewport.height) / ROW_HEIGHT) + OVERSCAN_ROWS,
    ),
  )
  const totalRowsHeight = sortedItems.length * ROW_HEIGHT

  const toggleSorting = useCallback((field: AggregateColumnField) => {
    if (field === 'action') return

    setSorting((current) => {
      if (!current || current.id !== field) {
        return { id: field, desc: defaultDescFields.has(field) }
      }
      if (current.desc) return { id: field, desc: false }
      return null
    })
  }, [])

  const borderColor = theme.palette.divider
  const headerBackground = theme.palette.background.paper
  const textSecondary = theme.palette.text.secondary

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <div
        ref={setScrollContainer}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            minWidth: '100%',
            width: tableWidth,
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${borderColor}`,
                backgroundColor: headerBackground,
              }}
            >
              {columns.map((column) => (
                <div
                  key={column.field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    boxSizing: 'border-box',
                    flex: `0 0 ${column.width}px`,
                    minWidth: column.minWidth,
                    fontSize: 13,
                    fontWeight: 600,
                    color: textSecondary,
                    userSelect: 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSorting(column.field)}
                    disabled={column.sortable === false}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        column.align === 'right'
                          ? 'flex-end'
                          : column.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      gap: 4,
                      padding: 8,
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: column.align === 'right' ? 'right' : 'left',
                      cursor:
                        column.sortable === false ? 'default' : 'pointer',
                    }}
                  >
                    {column.headerName}
                    {sorting?.id === column.field
                      ? sorting.desc
                        ? '▼'
                        : '▲'
                      : null}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              height: totalRowsHeight,
            }}
          >
            {Array.from(
              { length: lastVisibleRow - firstVisibleRow },
              (_, offset) => {
                const index = firstVisibleRow + offset
                const row = sortedItems[index]
                if (!row) return null

                return (
                  <RowComponent
                    key={row.id}
                    row={row}
                    columns={columns}
                    borderColor={borderColor}
                    virtualTop={index * ROW_HEIGHT}
                    onDeleteItem={onDeleteItem}
                  />
                )
              },
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
