import { useMemo } from 'react'

/**
 * 极简 Markdown 渲染器，只覆盖导出文档用到的语法：
 * 标题、段落、引用、分隔线、管道表格，行内支持 `code` 与 **bold**。
 * 之所以自己渲染而不是直接显示源码，是为了让导出前能看清表格是否成形。
 */

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' }
  | { kind: 'table'; head: string[]; rows: string[][] }

function splitRow(line: string): string[] {
  const inner = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
  return inner.split('|').map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

const isDivider = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-')

export function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith('---') && line.trim() === '---') {
      blocks.push({ kind: 'hr' })
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      index += 1
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'quote', text: quote.join(' ') })
      continue
    }

    if (line.trimStart().startsWith('|')) {
      const raw: string[] = []
      while (index < lines.length && lines[index].trimStart().startsWith('|')) {
        raw.push(lines[index])
        index += 1
      }
      const head = splitRow(raw[0])
      const rows: string[][] = []
      for (let i = 1; i < raw.length; i += 1) {
        if (isDivider(raw[i])) continue
        rows.push(splitRow(raw[i]))
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    const para: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('#') &&
      !lines[index].trimStart().startsWith('|') &&
      !lines[index].trimStart().startsWith('>') &&
      lines[index].trim() !== '---'
    ) {
      para.push(lines[index].trim())
      index += 1
    }
    blocks.push({ kind: 'p', text: para.join(' ') })
  }

  return blocks
}

/** 行内标记：`code` 与 **bold** */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="rounded-[4px] bg-[#F2F3F6] px-1 py-[1px] font-mono text-[10.5px] text-[#2E3340]"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

const COL_WIDTH: Record<number, string[]> = {
  3: ['42%', '22%', '36%'],
  // 字段列要给 `customer.address.province` 这种路径留够宽度，否则会折行；
  // 必填列也不能再窄，否则表头两个字就会被挤断
  5: ['36%', '14%', '12%', '9%', '29%'],
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  const widths = COL_WIDTH[head.length]
  return (
    <div className="mb-3 overflow-hidden rounded-ctl border border-line">
      <table className="w-full table-fixed border-collapse">
        {widths && (
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-line bg-surface-sunken">
            {head.map((cell, i) => (
              <th
                key={i}
                className="px-1.5 py-[5px] text-left text-[10.5px] font-medium text-ink-sub"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-line-soft last:border-b-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="break-words px-1.5 py-[5px] align-top text-[11.5px] leading-[16px] text-ink-sub"
                >
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MarkdownView({ md }: { md: string }) {
  const blocks = useMemo(() => parseMarkdown(md), [md])

  return (
    <div className="pb-2">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h':
            if (block.level === 1) {
              return (
                <h1 key={i} className="mb-2 mt-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  <Inline text={block.text} />
                </h1>
              )
            }
            if (block.level === 2) {
              return (
                <h2 key={i} className="mb-2 mt-5 text-[12.5px] font-semibold text-ink">
                  <Inline text={block.text} />
                </h2>
              )
            }
            return (
              <h3 key={i} className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-mute">
                <Inline text={block.text} />
              </h3>
            )
          case 'quote':
            return (
              <div
                key={i}
                className="mb-3 border-l-2 border-line pl-2.5 text-[11px] leading-[17px] text-ink-mute"
              >
                <Inline text={block.text} />
              </div>
            )
          case 'hr':
            return <hr key={i} className="my-4 border-0 border-t border-line" />
          case 'table':
            return <Table key={i} head={block.head} rows={block.rows} />
          default:
            return (
              <p key={i} className="mb-2.5 text-[12px] leading-[19px] text-ink-sub">
                <Inline text={block.text} />
              </p>
            )
        }
      })}
    </div>
  )
}
