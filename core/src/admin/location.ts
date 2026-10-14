// Where the admin is: a tab, and the step down within it. The web keeps it
// in the address, so back, forward and a reload go where they should; the
// app keeps it in each tab's state.

export const ADMIN_TABS = [
  'apartments',
  'resources',
  'announcements',
  'organization',
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

// The organization's own pages. The phone opens each from an overview; the
// desktop shows them beside a menu.
export const ORGANIZATION_SECTIONS = [
  'details',
  'languages',
  'rules',
  'admins',
  'history',
  'password',
  'account',
] as const;

export type OrganizationSection = (typeof ORGANIZATION_SECTIONS)[number];

export type AdminLocation =
  | {tab: 'apartments'; step: 'list' | 'new'}
  | {tab: 'apartments'; step: 'apartment' | 'edit' | 'new-resident'; id: string}
  | {tab: 'resources'; step: 'list' | 'new' | 'new-kind'}
  | {tab: 'resources'; step: 'kind'; id: string}
  | {tab: 'resources'; step: 'resource' | 'edit' | 'schedule'; id: string}
  | {tab: 'announcements'; step: 'list' | 'new'}
  | {tab: 'announcements'; step: 'announcement'; id: string}
  | {tab: 'organization'; step: 'overview' | OrganizationSection}
  | {tab: 'organization'; step: 'admin'; id: string};

export type LocationIn<T extends AdminTab> = Extract<AdminLocation, {tab: T}>;

export function tabRoot<T extends AdminTab>(tab: T): LocationIn<T> {
  return {
    tab,
    step: tab === 'organization' ? 'overview' : 'list',
  } as LocationIn<T>;
}

// The step above, which a back link and Android's back button go to. A tab
// has none.
export function parentOf(location: AdminLocation): AdminLocation | null {
  switch (location.tab) {
    case 'apartments':
      switch (location.step) {
        case 'list':
          return null;
        case 'new':
        case 'apartment':
          return tabRoot('apartments');
        case 'edit':
        case 'new-resident':
          return {tab: 'apartments', step: 'apartment', id: location.id};
      }
      break;
    case 'resources':
      switch (location.step) {
        case 'list':
          return null;
        case 'new':
        case 'new-kind':
        case 'kind':
        case 'resource':
          return tabRoot('resources');
        case 'edit':
        case 'schedule':
          return {tab: 'resources', step: 'resource', id: location.id};
      }
      break;
    case 'announcements':
      return location.step === 'list' ? null : tabRoot('announcements');
    case 'organization':
      switch (location.step) {
        case 'overview':
          return null;
        case 'admin':
          return {tab: 'organization', step: 'admins'};
        default:
          return tabRoot('organization');
      }
  }
}

function idPath(base: string, id: string, rest?: string): string {
  const path = `${base}/${encodeURIComponent(id)}`;
  return rest ? `${path}/${rest}` : path;
}

export function adminPath(location: AdminLocation): string {
  const base = `/admin/${location.tab}`;

  switch (location.tab) {
    case 'apartments':
      switch (location.step) {
        case 'list':
          return base;
        case 'new':
          return `${base}/new`;
        case 'apartment':
          return idPath(base, location.id);
        case 'edit':
        case 'new-resident':
          return idPath(base, location.id, location.step);
      }
      break;
    case 'resources':
      switch (location.step) {
        case 'list':
          return base;
        case 'new':
          return `${base}/new`;
        case 'new-kind':
          return `${base}/kinds/new`;
        case 'kind':
          return idPath(`${base}/kinds`, location.id);
        case 'resource':
          return idPath(base, location.id);
        case 'edit':
        case 'schedule':
          return idPath(base, location.id, location.step);
      }
      break;
    case 'announcements':
      switch (location.step) {
        case 'list':
          return base;
        case 'new':
          return `${base}/new`;
        case 'announcement':
          return idPath(base, location.id);
      }
      break;
    case 'organization':
      switch (location.step) {
        case 'overview':
          return base;
        case 'admin':
          return idPath(`${base}/admins`, location.id);
        default:
          return `${base}/${location.step}`;
      }
  }
}

function isSection(value: string): value is OrganizationSection {
  return (ORGANIZATION_SECTIONS as readonly string[]).includes(value);
}

// The location an address names, or null for one that names none.
export function parseAdminPath(path: string): AdminLocation | null {
  const parts = path.replace(/\/+$/, '').split('/');

  if (parts[0] !== '' || parts[1] !== 'admin') {
    return null;
  }

  const tab = parts[2];
  let rest: string[];
  try {
    rest = parts.slice(3).map(decodeURIComponent);
  } catch {
    return null;
  }
  const [first, second, third] = rest;

  switch (tab) {
    case 'apartments':
      if (first === undefined) {
        return tabRoot('apartments');
      }
      if (first === 'new' && second === undefined) {
        return {tab, step: 'new'};
      }
      if (second === undefined) {
        return {tab, step: 'apartment', id: first};
      }
      if ((second === 'edit' || second === 'new-resident') && !third) {
        return {tab, step: second, id: first};
      }
      return null;
    case 'resources':
      if (first === undefined) {
        return tabRoot('resources');
      }
      if (first === 'new' && second === undefined) {
        return {tab, step: 'new'};
      }
      if (first === 'kinds') {
        if (second === 'new' && third === undefined) {
          return {tab, step: 'new-kind'};
        }
        return second !== undefined && third === undefined
          ? {tab, step: 'kind', id: second}
          : null;
      }
      if (second === undefined) {
        return {tab, step: 'resource', id: first};
      }
      if ((second === 'edit' || second === 'schedule') && !third) {
        return {tab, step: second, id: first};
      }
      return null;
    case 'announcements':
      if (first === undefined) {
        return tabRoot('announcements');
      }
      if (second !== undefined) {
        return null;
      }
      return first === 'new'
        ? {tab, step: 'new'}
        : {tab, step: 'announcement', id: first};
    case 'organization':
      if (first === undefined) {
        return tabRoot('organization');
      }
      if (first === 'admins' && second !== undefined && third === undefined) {
        return {tab, step: 'admin', id: second};
      }
      return isSection(first) && second === undefined
        ? {tab, step: first}
        : null;
    default:
      return null;
  }
}
