import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMarkdownHeadings,
  normalizeCategory,
  pickCategory,
  slugifyHeading,
} from '../src/lib/documents.js';

test('extractMarkdownHeadings includes h1/h2, skips code and deduplicates ids', () => {
  const content = '# Hello World\n## 子标题\n```md\n# ignored\n```\n# Hello World';
  assert.deepEqual(extractMarkdownHeadings(content), [
    { id: 'hello-world', level: 1, text: 'Hello World' },
    { id: '子标题', level: 2, text: '子标题' },
    { id: 'hello-world-2', level: 1, text: 'Hello World' },
  ]);
});

test('heading slug and category fallbacks are stable', () => {
  assert.equal(slugifyHeading(' *** '), 'section');
  assert.equal(normalizeCategory('  '), '未分类');
  assert.equal(pickCategory([{ category: '' }, { category: 'Go' }], 'Go'), 'Go');
});

