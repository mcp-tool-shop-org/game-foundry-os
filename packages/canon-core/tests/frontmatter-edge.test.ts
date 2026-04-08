import { describe, it, expect } from 'vitest';
import { parseMarkdownFrontmatter } from '@mcptoolshop/canon-core';

describe('frontmatter parsing edge cases', () => {
  it('handles multiline values', () => {
    const content = [
      '---',
      'canon_id: char_test',
      'kind: character',
      'title: Test',
      'variant_ids:',
      '  - base',
      '  - phase2',
      '  - alt_costume',
      '---',
      'Body text',
    ].join('\n');

    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.variant_ids).toEqual(['base', 'phase2', 'alt_costume']);
    expect(result!.body).toBe('Body text');
  });

  it('handles inline arrays [a, b, c]', () => {
    const content = '---\ncanon_id: test\nkind: encounter\ntitle: Test\ntags: [combat, boss, ch1]\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.tags).toEqual(['combat', 'boss', 'ch1']);
  });

  it('handles boolean values true/false', () => {
    const content = '---\ncanon_id: test\nkind: character\ntitle: Test\nis_boss: true\nis_friendly: false\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.is_boss).toBe(true);
    expect(result!.frontmatter.is_friendly).toBe(false);
  });

  it('handles numeric values', () => {
    const content = '---\ncanon_id: test\nkind: chapter\ntitle: Test\nencounter_count: 5\ndifficulty: 3.5\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.encounter_count).toBe(5);
    expect(result!.frontmatter.difficulty).toBe(3.5);
  });

  it('handles quoted strings with colons', () => {
    const content = '---\ncanon_id: "char:skeleton_warrior"\nkind: character\ntitle: "Title: With Colons"\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.canon_id).toBe('char:skeleton_warrior');
    expect(result!.frontmatter.title).toBe('Title: With Colons');
  });
});
