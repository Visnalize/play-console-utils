import { describe, expect, it, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  cannedRepliesItem,
  createCannedReply,
  fillCannedReplyPlaceholders,
} from './canned-replies';

describe('createCannedReply', () => {
  it('trims the label and keeps the content as-is', () => {
    const reply = createCannedReply('  Already fixed  ', 'Hi {author}!');
    expect(reply.label).toBe('Already fixed');
    expect(reply.content).toBe('Hi {author}!');
  });

  it('assigns each reply a unique id', () => {
    const a = createCannedReply('A', 'a');
    const b = createCannedReply('B', 'b');
    expect(a.id).not.toBe(b.id);
  });
});

describe('fillCannedReplyPlaceholders', () => {
  it('replaces known placeholders', () => {
    expect(
      fillCannedReplyPlaceholders('Hi {author}, thanks for using {app}!', {
        author: 'Jane',
        app: 'Brick 1100',
      }),
    ).toBe('Hi Jane, thanks for using Brick 1100!');
  });

  it('leaves unknown placeholders literal instead of blanking them', () => {
    expect(fillCannedReplyPlaceholders('Hi {foo}', { author: 'Jane' })).toBe(
      'Hi {foo}',
    );
  });

  it('replaces repeated occurrences of the same placeholder', () => {
    expect(
      fillCannedReplyPlaceholders('{author} {author}', { author: 'Jane' }),
    ).toBe('Jane Jane');
  });

  it('is a no-op on a template with no placeholders', () => {
    expect(fillCannedReplyPlaceholders('Hello there', {})).toBe('Hello there');
  });
});

describe('cannedRepliesItem', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to an empty list', async () => {
    expect(await cannedRepliesItem.getValue()).toEqual([]);
  });

  it('persists saved templates', async () => {
    const reply = createCannedReply('Already fixed', 'Hi {author}!');
    await cannedRepliesItem.setValue([reply]);
    expect(await cannedRepliesItem.getValue()).toEqual([reply]);
  });
});
