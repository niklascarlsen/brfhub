/// <reference types="node" />
// The config runs in Node, which reads the Firebase file below.

import {existsSync} from 'node:fs';
import {join} from 'node:path';

import type {ConfigContext, ExpoConfig} from 'expo/config';
import {withEntitlementsPlist} from 'expo/config-plugins';

// With its extension, which Expo's config loader needs to find it.
import {theme} from './src/theme.ts';

// The Apple team a local iOS build signs with, set in .env. APPLE_TEAM_ID is
// a paid Apple Developer Program team, which signs push as well. A free
// Apple ID signs with a personal team instead, which cannot carry the push
// entitlement that expo-notifications adds: APPLE_PERSONAL_TEAM strips it,
// and push does not work there. EAS builds sign with their own credentials
// and need neither.
const team = process.env.APPLE_TEAM_ID;
const personalTeam = process.env.APPLE_PERSONAL_TEAM;

// Firebase's file for Android push, which is not committed: on EAS the
// GOOGLE_SERVICES_JSON file variable, locally app/google-services.json if
// it is there. Without either, Android builds without push.
function googleServicesFile(projectRoot: string): string | undefined {
  const local = join(projectRoot, 'google-services.json');

  return (
    process.env.GOOGLE_SERVICES_JSON ??
    (existsSync(local) ? './google-services.json' : undefined)
  );
}

// The colours the native shell paints before the app draws: the window
// behind it, the Android icon's ground and the notification icon's tint.
function withTheme(config: ExpoConfig): ExpoConfig {
  return {
    ...config,
    backgroundColor: theme.bg,
    android: {
      ...config.android,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        backgroundColor: theme.bg,
      },
    },
    plugins: config.plugins?.map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-notifications'
        ? [plugin[0], {...plugin[1], color: theme.accent}]
        : plugin,
    ),
  };
}

export default ({config, projectRoot}: ConfigContext): ExpoConfig => {
  const themed = withTheme(config as ExpoConfig);
  const base = {
    ...themed,
    android: {
      ...themed.android,
      googleServicesFile: googleServicesFile(projectRoot),
    },
  };

  if (team) {
    return {...base, ios: {...base.ios, appleTeamId: team}};
  }

  if (!personalTeam) {
    return base;
  }

  return withEntitlementsPlist(
    {...base, ios: {...base.ios, appleTeamId: personalTeam}},
    (mod) => {
      delete mod.modResults['aps-environment'];
      return mod;
    },
  );
};
