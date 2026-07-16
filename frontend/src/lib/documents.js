export function extractMarkdownHeadings(content) {
  if (!content) return [];

  const items = [];
  const usedIds = new Map();
  let inCodeBlock = false;

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match || match[1].length > 2) return;

    const text = cleanupHeadingText(match[2]);
    if (!text) return;

    const baseId = slugifyHeading(text);
    const count = (usedIds.get(baseId) || 0) + 1;
    usedIds.set(baseId, count);
    items.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      level: match[1].length,
      text,
    });
  });

  return items;
}

export function cleanupHeadingText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

export function slugifyHeading(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'section';
}

export function normalizeCategory(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '未分类';
}

export function pickCategory(items, preferredCategory) {
  const names = Array.from(new Set(items.map((item) => normalizeCategory(item.category))));
  if (preferredCategory && names.includes(preferredCategory)) return preferredCategory;
  return names[0] || '';
}

