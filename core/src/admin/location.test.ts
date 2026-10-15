import {describe, expect, test} from 'vitest';

import {
  adminPath,
  parentOf,
  parseAdminPath,
  type AdminLocation,
} from './location';

const LOCATIONS: [AdminLocation, string][] = [
  [{tab: 'apartments', step: 'list'}, '/admin/apartments'],
  [{tab: 'apartments', step: 'new'}, '/admin/apartments/new'],
  [{tab: 'apartments', step: 'apartment', id: 'a1'}, '/admin/apartments/a1'],
  [{tab: 'apartments', step: 'edit', id: 'a1'}, '/admin/apartments/a1/edit'],
  [
    {tab: 'apartments', step: 'new-resident', id: 'a1'},
    '/admin/apartments/a1/new-resident',
  ],
  [{tab: 'resources', step: 'list'}, '/admin/resources'],
  [{tab: 'resources', step: 'new'}, '/admin/resources/new'],
  [{tab: 'resources', step: 'new-kind'}, '/admin/resources/kinds/new'],
  [{tab: 'resources', step: 'kind', id: 'k1'}, '/admin/resources/kinds/k1'],
  [{tab: 'resources', step: 'resource', id: 'r1'}, '/admin/resources/r1'],
  [{tab: 'resources', step: 'edit', id: 'r1'}, '/admin/resources/r1/edit'],
  [
    {tab: 'resources', step: 'schedule', id: 'r1'},
    '/admin/resources/r1/schedule',
  ],
  [{tab: 'resources', step: 'close', id: 'r1'}, '/admin/resources/r1/close'],
  [{tab: 'announcements', step: 'list'}, '/admin/announcements'],
  [{tab: 'announcements', step: 'new'}, '/admin/announcements/new'],
  [
    {tab: 'announcements', step: 'announcement', id: 'n1'},
    '/admin/announcements/n1',
  ],
  [{tab: 'organization', step: 'overview'}, '/admin/organization'],
  [{tab: 'organization', step: 'history'}, '/admin/organization/history'],
  [{tab: 'organization', step: 'account'}, '/admin/organization/account'],
  [
    {tab: 'organization', step: 'admin', id: 'u1'},
    '/admin/organization/admins/u1',
  ],
];

describe('adminPath and parseAdminPath', () => {
  test.each(LOCATIONS)('%o is %s and back', (location, path) => {
    expect(adminPath(location)).toBe(path);
    expect(parseAdminPath(path)).toEqual(location);
  });

  test('an id is kept apart from the path around it', () => {
    const location: AdminLocation = {
      tab: 'apartments',
      step: 'apartment',
      id: 'a/b c',
    };

    expect(parseAdminPath(adminPath(location))).toEqual(location);
  });

  test('a trailing slash names the same place', () => {
    expect(parseAdminPath('/admin/resources/r1/')).toEqual({
      tab: 'resources',
      step: 'resource',
      id: 'r1',
    });
  });

  test.each([
    '/book',
    '/admin',
    '/admin/elsewhere',
    '/admin/apartments/a1/remove',
    '/admin/apartments/a1/edit/more',
    '/admin/resources/kinds',
    '/admin/announcements/n1/edit',
    '/admin/organization/unknown',
    '/admin/apartments/%E0%A4%A',
  ])('%s names no place', (path) => {
    expect(parseAdminPath(path)).toBeNull();
  });
});

describe('parentOf', () => {
  test('a tab has no step above it', () => {
    expect(parentOf({tab: 'apartments', step: 'list'})).toBeNull();
    expect(parentOf({tab: 'organization', step: 'overview'})).toBeNull();
  });

  test('a form on a thing goes back to the thing', () => {
    expect(parentOf({tab: 'apartments', step: 'edit', id: 'a1'})).toEqual({
      tab: 'apartments',
      step: 'apartment',
      id: 'a1',
    });
    expect(parentOf({tab: 'resources', step: 'schedule', id: 'r1'})).toEqual({
      tab: 'resources',
      step: 'resource',
      id: 'r1',
    });
    expect(parentOf({tab: 'resources', step: 'close', id: 'r1'})).toEqual({
      tab: 'resources',
      step: 'resource',
      id: 'r1',
    });
  });

  test('a thing goes back to its list', () => {
    expect(parentOf({tab: 'resources', step: 'kind', id: 'k1'})).toEqual({
      tab: 'resources',
      step: 'list',
    });
    expect(parentOf({tab: 'organization', step: 'admin', id: 'u1'})).toEqual({
      tab: 'organization',
      step: 'admins',
    });
    expect(parentOf({tab: 'organization', step: 'history'})).toEqual({
      tab: 'organization',
      step: 'overview',
    });
  });
});
