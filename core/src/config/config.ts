import {createContext, useContext} from 'react';

import type {Api} from '../api/createApi';
import type {ClientErrorCode} from '../api/errors';
import type {BookingWindow, MemberAccount, Resource} from '../api/types';

// Refetched whenever the user comes back: the window's dates move at
// midnight, and the device clock cannot tell what the server's day is.
export type Config = {
  window: BookingWindow;
  resources: [Resource, ...Resource[]];
  apartment: string;
  organizationName: string;
};

export const ConfigContext = createContext<Config | null>(null);

export function useConfig(): Config {
  const config = useContext(ConfigContext);

  if (config === null) {
    throw new Error('useConfig must be used inside ConfigProvider');
  }

  return config;
}

export type LoadedConfig = {window: BookingWindow; resources: Resource[]};

export async function fetchConfig({api, unwrap}: Api): Promise<LoadedConfig> {
  const [window, resources] = await Promise.all([
    unwrap(api.GET('/booking-window')),
    unwrap(api.GET('/resources')),
  ]);

  return {window, resources};
}

export type ConfigView =
  | {kind: 'ready'; config: Config}
  // The organization has nothing an apartment can book yet.
  | {kind: 'empty'}
  | {kind: 'failed'; error: ClientErrorCode}
  | {kind: 'waiting'};

// What ConfigProvider shows. Once loaded, the config stays shown through
// a failed refresh, and a failure shows only while nothing is.
export function configView(
  loaded: LoadedConfig | null,
  error: ClientErrorCode | null,
  account: MemberAccount,
): ConfigView {
  if (loaded === null) {
    return error === null ? {kind: 'waiting'} : {kind: 'failed', error};
  }

  const [first, ...rest] = loaded.resources;

  if (first === undefined) {
    return {kind: 'empty'};
  }

  return {
    kind: 'ready',
    config: {
      window: loaded.window,
      resources: [first, ...rest],
      apartment: account.apartment,
      organizationName: account.organizationName,
    },
  };
}
