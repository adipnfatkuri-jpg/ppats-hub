import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUrlForNavSection,
  isValidNavSection,
  resolveInitialNavSection,
} from './navigationState.ts';

test('resolveInitialNavSection prioritizes valid URL section, falls back to sessionStorage, then dashboard', () => {
  assert.equal(resolveInitialNavSection('?section=wizard', 'tax'), 'wizard');
  assert.equal(resolveInitialNavSection('', 'wizard'), 'wizard');
  assert.equal(resolveInitialNavSection('?section=invalid', 'wizard'), 'wizard');
  assert.equal(resolveInitialNavSection('?section=invalid', 'unknown'), 'dashboard');
  assert.equal(resolveInitialNavSection('', null), 'dashboard');
});

test('buildUrlForNavSection syncs ?section cleanly without losing other params or hash', () => {
  assert.equal(
    buildUrlForNavSection('https://sim-ppats.example/', 'wizard'),
    '/?section=wizard'
  );
  assert.equal(
    buildUrlForNavSection('https://sim-ppats.example/?section=wizard&foo=1#top', 'dashboard'),
    '/?foo=1#top'
  );
  assert.equal(
    buildUrlForNavSection('https://sim-ppats.example/?section=wizard', 'dashboard'),
    '/'
  );
  assert.equal(
    buildUrlForNavSection('https://sim-ppats.example/?foo=bar', 'tax'),
    '/?foo=bar&section=tax'
  );
});

test('isValidNavSection validates known sections strictly', () => {
  assert.equal(isValidNavSection('wizard'), true);
  assert.equal(isValidNavSection('dashboard'), true);
  assert.equal(isValidNavSection('non_akta_rekap'), true);
  assert.equal(isValidNavSection('other'), false);
  assert.equal(isValidNavSection(null), false);
});
