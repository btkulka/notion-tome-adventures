// Which properties the DM can override, and with what kind of field. The Worker
// turns each value back into Notion's shape (worker/content/overrides.ts).
import type { Cell, Column } from './api';

export type EditorKind = 'text' | 'paragraph' | 'number' | 'yesno' | 'choice' | 'choices' | 'date' | 'links';

/** The field for a property, or null when it can't be overridden (files, people, timestamps, list rollups). */
export function editorKind(column: Column, cell: Cell): EditorKind | null {
  switch (column.type) {
    case 'title':
    case 'url':
    case 'email':
    case 'phone_number':
      return 'text';
    case 'rich_text':
      return 'paragraph';
    case 'number':
      return 'number';
    case 'checkbox':
      return 'yesno';
    case 'select':
    case 'status':
      return 'choice';
    case 'multi_select':
      return 'choices';
    case 'date':
      return 'date';
    case 'relation':
      return 'links';
    case 'formula':
      return typeof cell === 'number' ? 'number' : typeof cell === 'boolean' ? 'yesno' : 'text';
    case 'rollup':
      return typeof cell === 'number' ? 'number' : null;
    default:
      return null;
  }
}
