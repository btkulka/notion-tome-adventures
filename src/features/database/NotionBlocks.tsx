/* eslint-disable @typescript-eslint/no-explicit-any -- Notion blocks and rich text are untyped JSON. */
import React from 'react';
import { Link } from 'react-router-dom';
import { useCached } from '@/lib/cached';
import { databaseApi, type Block } from './api';
import { notionPageId } from './browse';

/** A page's content as Notion blocks, drawn in the Tome style. Unknown block types are skipped. */
export function NotionBlocks({ blocks }: { blocks: Block[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; ) {
    const block = blocks[i];
    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      const run: Block[] = [];
      while (i < blocks.length && blocks[i].type === block.type) run.push(blocks[i++]);
      const items = run.map((item) => (
        <li key={item.id} className="pl-1">
          <RichText rich={item[item.type]?.rich_text} />
          {item.children && <div className="mt-1.5 flex flex-col gap-2"><NotionBlocks blocks={item.children} /></div>}
        </li>
      ));
      out.push(
        block.type === 'bulleted_list_item'
          ? <ul key={block.id} className="m-0 pl-5 list-[square] marker:text-gilt-deep flex flex-col gap-1.5">{items}</ul>
          : <ol key={block.id} className="m-0 pl-6 list-decimal marker:text-bone-3 flex flex-col gap-1.5">{items}</ol>
      );
      continue;
    }
    out.push(<BlockView key={block.id} block={block} />);
    i++;
  }
  return <>{out}</>;
}

function Children({ block }: { block: Block }) {
  if (!block.children?.length) return null;
  return <div className="flex flex-col gap-3 pl-4 border-l border-rule"><NotionBlocks blocks={block.children} /></div>;
}

const HEADINGS: Record<string, string> = { heading_1: 't-h2', heading_2: 't-h3', heading_3: 't-label text-bone-2' };

function BlockView({ block }: { block: Block }) {
  const data = block[block.type] ?? {};
  switch (block.type) {
    case 'paragraph':
      if (!data.rich_text?.length && !block.children?.length) return null;
      return (
        <>
          <p className="m-0 t-body"><RichText rich={data.rich_text} /></p>
          <Children block={block} />
        </>
      );

    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const heading = <span className={`${HEADINGS[block.type]} pt-2`}><RichText rich={data.rich_text} /></span>;
      if (data.is_toggleable) {
        return (
          <details className="flex flex-col gap-3">
            <summary className="cursor-pointer marker:text-gilt">{heading}</summary>
            <div className="flex flex-col gap-3 pt-3"><NotionBlocks blocks={block.children ?? []} /></div>
          </details>
        );
      }
      return heading;
    }

    case 'toggle':
      return (
        <details>
          <summary className="cursor-pointer t-body marker:text-gilt"><RichText rich={data.rich_text} /></summary>
          <div className="flex flex-col gap-3 pt-3 pl-4"><NotionBlocks blocks={block.children ?? []} /></div>
        </details>
      );

    case 'to_do':
      return (
        <div className="flex items-baseline gap-3 t-body">
          <i className={`t-diamond ${data.checked ? '' : 't-diamond--hollow'}`} aria-label={data.checked ? 'Done' : 'Not done'} />
          <span className={data.checked ? 'line-through text-bone-3' : ''}><RichText rich={data.rich_text} /></span>
        </div>
      );

    case 'quote':
      return (
        <blockquote className="m-0 pl-4 border-l-2 border-gilt-deep t-lore flex flex-col gap-2">
          <span><RichText rich={data.rich_text} /></span>
          {block.children && <NotionBlocks blocks={block.children} />}
        </blockquote>
      );

    case 'callout':
      return (
        <div className="t-raised px-4 py-3 flex flex-col gap-2 t-body">
          <span><RichText rich={data.rich_text} /></span>
          {block.children && <NotionBlocks blocks={block.children} />}
        </div>
      );

    case 'divider':
      return <div className="t-rule py-1"><i /></div>;

    case 'code':
    case 'equation':
      return (
        <pre className="m-0 t-panel px-4 py-3 overflow-x-auto text-[13px] text-bone-2 font-mono whitespace-pre-wrap">
          {block.type === 'code' ? (data.rich_text ?? []).map((t: any) => t.plain_text).join('') : data.expression}
        </pre>
      );

    case 'table':
      return <BlockTable block={block} />;

    case 'column_list':
      return (
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.max(block.children?.length ?? 1, 1)}, minmax(0, 1fr))` }}>
          {(block.children ?? []).map((column) => (
            <div key={column.id} className="flex flex-col gap-3 min-w-0"><NotionBlocks blocks={column.children ?? []} /></div>
          ))}
        </div>
      );

    case 'synced_block':
    case 'template':
      return <NotionBlocks blocks={block.children ?? []} />;

    case 'image':
    case 'video':
    case 'file':
    case 'pdf':
    case 'audio':
      return <Media block={block} />;

    case 'bookmark':
    case 'embed':
    case 'link_preview':
      return data.url ? <a href={data.url} target="_blank" rel="noreferrer" className="break-all">{data.url}</a> : null;

    case 'link_to_page': {
      const id = data.page_id ?? data.database_id;
      return id ? <Link to={{ search: `?entry=${id}` }}>Linked page</Link> : null;
    }

    case 'child_page':
    case 'child_database':
      return <ChildLink block={block} title={data.title || 'Untitled'} />;

    default:
      return data.rich_text ? <p className="m-0 t-body"><RichText rich={data.rich_text} /></p> : null;
  }
}

const bare = (id: string) => id.replace(/-/g, '').toLowerCase();

/**
 * A subpage or an inline table. Both kept their Notion ids when they were imported,
 * so they link to their entry or table here; one that wasn't imported is just named.
 */
function ChildLink({ block, title }: { block: Block; title: string }) {
  const entries = useCached(['content-entries'], () => databaseApi.entries()).data;
  const tables = useCached(['content-tables'], () => databaseApi.tables()).data;
  const id = bare(block.id);
  const page = block.type === 'child_page';
  const table = page ? undefined : tables?.find((t) => bare(t.notionId) === id);
  const to = page ? (entries?.some((e) => bare(e.id) === id) ? { search: `?entry=${block.id}` } : null) : table ? `/database/${table.key}` : null;
  return (
    <div className="flex items-center gap-3 t-small">
      <i className="t-diamond t-diamond--hollow" />
      {to ? <Link to={to}>{title}</Link> : title} <span className="t-label">{page ? 'Subpage' : 'Table'}</span>
    </div>
  );
}

function BlockTable({ block }: { block: Block }) {
  const rows = (block.children ?? []).filter((r) => r.type === 'table_row');
  const header = block.table?.has_column_header;
  const rowHeader = block.table?.has_row_header;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id} className="border-b border-rule">
              {(row.table_row?.cells ?? []).map((cell: any[], c: number) => {
                const head = (header && r === 0) || (rowHeader && c === 0);
                const Tag = head ? 'th' : 'td';
                return (
                  <Tag key={c} className={`text-left align-top px-3 py-2 ${head ? 't-label' : 't-body'}`}>
                    <RichText rich={cell} />
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Media({ block }: { block: Block }) {
  const data = block[block.type] ?? {};
  const url = data.type === 'external' ? data.external?.url : null;
  const caption = data.caption?.length ? <RichText rich={data.caption} /> : null;
  if (block.type === 'image' && url) {
    return (
      <figure className="m-0 flex flex-col gap-2">
        <img src={url} alt="" loading="lazy" className="max-w-full border border-rule" />
        {caption && <figcaption className="t-small">{caption}</figcaption>}
      </figure>
    );
  }
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="break-all">{caption ?? url}</a>;
  // Files Notion hosts were downloaded by the import but aren't served yet.
  return (
    <div className="t-panel border-dashed px-4 py-3 t-small flex items-center gap-3">
      <i className="t-diamond t-diamond--hollow" />
      <span>{caption ?? `${block.type === 'image' ? 'An image' : 'A file'} stored in Notion, not hosted here yet`}</span>
    </div>
  );
}

/** Notion rich text with its bold, italic, code and links. Links between Notion pages open the linked entry. */
export function RichText({ rich }: { rich?: any[] }) {
  return (
    <>
      {(rich ?? []).map((t, i) => {
        const a = t.annotations ?? {};
        let node: React.ReactNode = t.plain_text ?? '';
        if (a.code) node = <code className="font-mono text-[0.9em] text-gilt-hi">{node}</code>;
        if (a.bold) node = <strong className="font-semibold text-bone">{node}</strong>;
        if (a.italic) node = <em>{node}</em>;
        if (a.strikethrough) node = <s>{node}</s>;
        if (a.underline) node = <u>{node}</u>;
        const pageId = t.type === 'mention' && t.mention?.type === 'page' ? t.mention.page?.id : notionPageId(t.href);
        if (pageId) return <Link key={i} to={{ search: `?entry=${pageId}` }}>{node}</Link>;
        if (t.href) return <a key={i} href={t.href} target="_blank" rel="noreferrer">{node}</a>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}
