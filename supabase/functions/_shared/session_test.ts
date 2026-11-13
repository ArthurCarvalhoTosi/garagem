import { assertEquals } from '@std/assert';
import { sessionUserId } from './session.ts';

const USER = '00000000-0000-0000-0000-00000000000a';

Deno.test("a signed-in person's session gives their id", () => {
  assertEquals(sessionUserId({ sub: USER, role: 'authenticated', is_anonymous: false }), USER);
  assertEquals(sessionUserId({ sub: USER, role: 'authenticated' }), USER);
});

Deno.test('any other token gets no id', () => {
  assertEquals(sessionUserId(null), null);
  assertEquals(sessionUserId({ sub: USER, role: 'authenticated', is_anonymous: true }), null);
  assertEquals(sessionUserId({ sub: USER, role: 'anon' }), null);
  assertEquals(sessionUserId({ sub: USER, role: 'service_role' }), null);
  assertEquals(sessionUserId({ sub: USER }), null);
  assertEquals(sessionUserId({ role: 'authenticated' }), null);
});
