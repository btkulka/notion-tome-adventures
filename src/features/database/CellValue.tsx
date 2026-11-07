import React from 'react';
import { Link } from 'react-router-dom';
import type { Cell, Column } from './api';
import { cellItems, DATE_TYPES, formatDates, isEmpty, isFileRef, isPageRef, itemText, tierOf } from './browse';

const CHIP_TYPES = ['select', 'status', 'multi_select', 'relation', 'rollup'];

/**
 * One property value. `compact` is the table cell: one clamped line of text and
 * checkboxes as a diamond. Otherwise it is the entry panel's full value.
 */
export function CellValue({ column, cell, compact = false }: { column: Column; cell: Cell; compact?: boolean }) {
  if (isEmpty(cell)) return compact ? null : <span className="text-bone-3">—</span>;

  if (typeof cell === 'boolean') {
    if (compact) return cell ? <i className="t-diamond" aria-label="Yes" /> : null;
    return <span>{cell ? 'Yes' : 'No'}</span>;
  }

  if (typeof cell === 'number') return <span className="t-num">{cell.toLocaleString()}</span>;

  if (typeof cell === 'string') {
    if (column.type === 'url') {
      return (
        <a href={cell} target="_blank" rel="noreferrer" className="break-all" onClick={(e) => e.stopPropagation()}>
          {cell.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
        </a>
      );
    }
    if (CHIP_TYPES.includes(column.type)) return <Chip column={column} text={cell} />;
    if (DATE_TYPES.includes(column.type)) return <span className="whitespace-nowrap">{formatDates(cell)}</span>;
    return <span className={compact ? 'line-clamp-2' : 'whitespace-pre-line'}>{cell}</span>;
  }

  const items = cellItems(cell);
  const linkish = items.some((i) => typeof i === 'object');
  if (!linkish && !items.every((i) => typeof i === 'string')) return <span className="t-num">{items.map(itemText).join(', ')}</span>;

  return (
    <span className={`flex gap-1.5 ${compact ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
      {items.map((item, i) => {
        if (typeof item === 'object' && isPageRef(item)) {
          if (item.title === null) return <span key={i} className="t-chip db-chip h-6 text-bone-3" title="Not imported from Notion">Unlinked page</span>;
          return (
            <Link key={i} to={{ search: `?entry=${item.id}` }} onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Chip column={column} text={item.title} link />
            </Link>
          );
        }
        if (typeof item === 'object' && isFileRef(item)) {
          return item.url ? (
            <a key={i} href={item.url} target="_blank" rel="noreferrer" className="t-chip db-chip h-6" onClick={(e) => e.stopPropagation()}>{item.name}</a>
          ) : (
            <span key={i} className="t-chip db-chip h-6" title="Stored in Notion; not hosted here yet">{item.name}</span>
          );
        }
        return <Chip key={i} column={column} text={itemText(item)} />;
      })}
    </span>
  );
}

function Chip({ column, text, link = false }: { column: Column; text: string; link?: boolean }) {
  const tier = tierOf(column, text);
  return (
    <span className={`t-chip db-chip h-6 whitespace-nowrap ${tier ? `t-chip--tier tier-${tier}` : ''} ${link ? 'is-link' : ''}`}>
      {tier && <i className="t-diamond" style={{ width: 6, height: 6 }} />}
      {text}
    </span>
  );
}
