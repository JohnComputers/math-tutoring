import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately tiny markdown subset for admin-authored content.
 *
 * Supports: `## ` and `### ` headings, `- ` bullets, `---` rules, `**bold**`, `*italic*`,
 * and blank-line paragraphs. That covers everything the policy pages and bio need.
 *
 * The important property is what it *cannot* do. Output is built as React elements from
 * parsed text — there is no `dangerouslySetInnerHTML` anywhere — so admin content cannot
 * inject markup or script into the page, even if a stored value were ever tampered with.
 * A full markdown library would add a dependency and an HTML-sanitising problem to solve.
 */

type Block =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'rule' };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: 'list', items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (line === '---' || line === '***') {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'rule' });
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', level: 3, text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', level: 2, text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * Inline `**bold**` and `*italic*`.
 *
 * Splits on the delimiters and rebuilds as elements. Because every segment becomes a
 * React text node, any `<` or `&` in the source is escaped by React automatically.
 */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function RichText({ content, className = 'prose' }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 2 ? (
              <h2 key={index}>{renderInline(block.text)}</h2>
            ) : (
              <h3 key={index}>{renderInline(block.text)}</h3>
            );
          case 'list':
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'rule':
            return <hr key={index} />;
          case 'paragraph':
          default:
            return <p key={index}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
