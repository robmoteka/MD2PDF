/**
 * Tests for src/shared/laneflow.ts
 *
 * Run with:  npm test
 * (node --import tsx --test test/**\/*.test.ts)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderLaneflowFence, parseLaneflowInfo } from '../src/shared/laneflow.js';

// ─── parseLaneflowInfo ────────────────────────────────────────────────────────

describe('parseLaneflowInfo', () => {
  it('no tokens → empty object', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow'), {});
  });

  it('LR token → direction LR', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow LR'), { direction: 'LR' });
  });

  it('TB token → direction TB', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow TB'), { direction: 'TB' });
  });

  it('lowercase lr → direction LR (case-insensitive)', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow lr'), { direction: 'LR' });
  });

  it('unknown token → empty object', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow xyz'), {});
  });

  it('first valid token wins', () => {
    assert.deepEqual(parseLaneflowInfo('laneflow LR TB'), { direction: 'LR' });
  });
});

// ─── renderLaneflowFence — success paths ─────────────────────────────────────

const LINEAR = `laneflow v0.1

lane Sales "Sales"

Sales: start    (Order received)
Sales: verify   [Verify order details]
Sales: confirm  [Confirm order]
Sales: done     ((Order confirmed))

start --> verify --> confirm --> done
`;

const GATEWAY = `laneflow v0.1
direction LR

lane Sales "Sales"

Sales: start   (Order received)
Sales: decide  <In stock?>
Sales: confirm [Confirm order]
Sales: reject  [Reject order]
Sales: done    ((Done))

start --> decide
decide -- yes --> confirm --> done
decide -- no  --> reject  --> done
`;

const MULTILANE = `laneflow v0.1

lane Sales     "Sales"
lane Warehouse "Warehouse"
lane Finance   "Finance"

Sales:     start    (Order received)
Sales:     check    [Check availability]
Sales:     decide   <In stock?>
Sales:     reject   [Notify customer: unavailable]
Warehouse: pack     [Pack order]
Warehouse: ship     [Ship to customer]
Finance:   invoice  [Issue invoice]
Finance:   done     ((Order closed))

start --> check --> decide
decide -- no  --> reject --> done
decide -- yes --> pack
pack --> ship
pack --> invoice
ship --> done
invoice --> done
`;

describe('renderLaneflowFence — valid diagrams', () => {
  it('linear process: returns <div class="laneflow-rendered"> wrapper', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'light' });
    assert.ok(html.startsWith('<div class="laneflow-rendered">'), `unexpected start: ${html.slice(0, 60)}`);
  });

  it('linear process: contains <svg element', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'light' });
    assert.ok(html.includes('<svg'), 'missing <svg');
  });

  it('linear process: contains at least one <rect (lane band)', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'light' });
    assert.ok(html.includes('<rect'), 'missing <rect');
  });

  it('linear process: contains at least one <path (edge)', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'light' });
    assert.ok(html.includes('<path'), 'missing <path');
  });

  it('gateway (LR): non-empty SVG', async () => {
    const html = await renderLaneflowFence(GATEWAY, { theme: 'light', direction: 'LR' });
    assert.ok(html.includes('<svg'), 'missing <svg in gateway diagram');
  });

  it('multilane: non-empty SVG with multiple rects', async () => {
    const html = await renderLaneflowFence(MULTILANE, { theme: 'light' });
    // Three lanes → at least three <rect elements
    const rectCount = (html.match(/<rect/g) ?? []).length;
    assert.ok(rectCount >= 3, `expected ≥3 rects for 3 lanes, got ${rectCount}`);
  });

  it('dark theme: SVG present', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'dark' });
    assert.ok(html.includes('<svg'), 'missing <svg with dark theme');
  });

  it('direction TB: SVG present', async () => {
    const html = await renderLaneflowFence(LINEAR, { theme: 'light', direction: 'TB' });
    assert.ok(html.includes('<svg'), 'missing <svg with direction TB');
  });
});

// ─── renderLaneflowFence — error paths ───────────────────────────────────────

describe('renderLaneflowFence — invalid diagrams', () => {
  it('invalid source → returns error block (not plain text)', async () => {
    const html = await renderLaneflowFence('this is not valid laneflow syntax', { theme: 'light' });
    assert.ok(html.includes('class="laneflow-error"'), `expected error block, got: ${html.slice(0, 100)}`);
  });

  it('error block contains "--- source ---" marker', async () => {
    const html = await renderLaneflowFence('garbage', { theme: 'light' });
    assert.ok(html.includes('--- source ---'), 'error block missing source section');
  });

  it('error block does NOT contain raw unescaped angle brackets', async () => {
    // source with angle brackets — must be escaped in error block
    const html = await renderLaneflowFence('<not a diagram>', { theme: 'light' });
    // The original < should appear as &lt; inside laneflow-error
    assert.ok(html.includes('&lt;'), 'source not HTML-escaped in error block');
    // There should be no laneflow-rendered wrapper
    assert.ok(!html.includes('class="laneflow-rendered"'), 'error path wrongly wrapped in rendered div');
  });

  it('empty source → error block', async () => {
    const html = await renderLaneflowFence('', { theme: 'light' });
    assert.ok(html.includes('class="laneflow-error"'), 'empty source should produce error block');
  });
});

// ─── Sanity: three canonical examples ────────────────────────────────────────

describe('canonical examples sanity check', () => {
  const examples: Array<[string, string]> = [
    ['01-linear', LINEAR],
    ['02-gateway', GATEWAY],
    ['03-multilane', MULTILANE],
  ];

  for (const [name, src] of examples) {
    it(`${name}: non-empty SVG output`, async () => {
      const html = await renderLaneflowFence(src, { theme: 'light' });
      assert.ok(!html.includes('class="laneflow-error"'), `${name} produced error: ${html.slice(0, 200)}`);
      assert.ok(html.includes('<svg'), `${name} missing <svg`);
      // At minimum a non-trivial SVG has both rect and path
      assert.ok(html.includes('<rect'), `${name} missing <rect`);
      assert.ok(html.includes('<path'), `${name} missing <path`);
    });
  }
});
