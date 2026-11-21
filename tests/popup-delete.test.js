import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import './chrome-mock.js';

const repos = ['one', 'two', 'three'].map(name => ({ name, full_name: `test/${name}` }));
const find = selector => document.querySelector(selector);
const deletions = [];

beforeAll(async () => {
  document.documentElement.innerHTML = readFileSync('src/popup/popup.html', 'utf8');
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  chrome.runtime.sendMessage = ({ type, payload }, respond) => {
    if (type === 'DELETE_REPO') {
      deletions.push(payload.fullName);
      return respond({ ok: payload.fullName !== 'test/two', error: 'Delete failed' });
    }
    const data = {
      GET_TOKEN: { token: 'test-token' },
      VALIDATE_TOKEN: { login: 'test' },
      FETCH_REPOS: repos,
    };
    respond({ ok: type in data, data: data[type] });
  };
  await import('../src/popup/app.js');
});

beforeEach(async () => {
  jest.useFakeTimers();
  deletions.length = 0;
  find('#toastContainer').replaceChildren();
  find('#refreshBtn').click();
  await jest.advanceTimersByTimeAsync(0);
});

afterEach(() => jest.useRealTimers());

function confirmDelete() {
  const confirm = find('#modalConfirmBtn');
  expect(confirm.disabled).toBe(true);
  const input = find('#modalTypedInput');
  input.value = 'DELETE';
  input.dispatchEvent(new Event('input'));
  confirm.click();
}

function scheduleBulkDelete() {
  find('.repo-checkbox[data-name="test/one"]').click();
  find('.repo-checkbox[data-name="test/two"]').click();
  find('#bulkDeleteBtn').click();
  confirmDelete();
}

test('one Undo cancels the entire batch before any delete is sent', async () => {
  scheduleBulkDelete();
  expect(document.querySelectorAll('.fh-card-pending-delete')).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(29_999);
  expect(deletions).toEqual([]);
  find('.fh-undo-btn').click();
  await jest.advanceTimersByTimeAsync(30_000);
  expect(deletions).toEqual([]);
  expect(document.querySelectorAll('[data-repo]')).toHaveLength(3);
  expect(find('.fh-card-pending-delete')).toBeNull();
  expect(find('.fh-undo-btn')).toBeNull();
});

test('expiry deletes only the confirmed targets and leaves failed repos visible', async () => {
  scheduleBulkDelete();
  find('#deselectAllBtn').click();
  find('.repo-checkbox[data-name="test/three"]').click();
  await jest.advanceTimersByTimeAsync(29_999);
  expect(deletions).toEqual([]);
  await jest.advanceTimersByTimeAsync(1);
  expect(deletions).toEqual(['test/one', 'test/two']);
  expect(find('[data-repo="test/one"]')).toBeNull();
  expect(find('[data-repo="test/two"]')).not.toBeNull();
  expect(find('.repo-checkbox[data-name="test/three"]').checked).toBe(true);
  expect(find('#toastContainer').textContent).toContain('1 done, 1 failed');
  expect(find('.fh-undo-btn')).toBeNull();
  expect(find('.fh-card-pending-delete')).toBeNull();
});

test('a single delete cannot replace a pending batch and can still be undone separately', async () => {
  scheduleBulkDelete();
  find('.delete-btn[data-name="test/one"]').click();
  expect(find('#modalConfirmBtn')).toBeNull();
  find('.delete-btn[data-name="test/three"]').click();
  confirmDelete();
  const undoButtons = document.querySelectorAll('.fh-undo-btn');
  expect(undoButtons).toHaveLength(2);
  undoButtons[1].click();
  await jest.advanceTimersByTimeAsync(30_000);
  expect(deletions).toEqual(['test/one', 'test/two']);
  expect(find('[data-repo="test/three"]')).not.toBeNull();
});
