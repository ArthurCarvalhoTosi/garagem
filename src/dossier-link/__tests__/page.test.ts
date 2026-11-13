import { JSDOM } from 'jsdom';

// The page's own code with a browser's DOMParser; the React Native preset can't run in jsdom.
globalThis.DOMParser = new JSDOM().window.DOMParser;
const { pageOf } = require('../../../sites/garagem/d.js') as { pageOf(html: string): Document };

test('a sealed copy cannot send the visitor elsewhere', () => {
  const page = pageOf(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=https://example.com"></head>' +
      '<body><p>Óleo e filtro</p></body></html>',
  );
  expect(page.querySelector('meta[http-equiv]')).toBeNull();
  expect(page.querySelector('meta[charset]')).not.toBeNull();
  expect(page.body.textContent).toBe('Óleo e filtro');
});
