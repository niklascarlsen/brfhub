import type {ConfigContext, ExpoConfig} from 'expo/config';
import {withEntitlementsPlist} from 'expo/config-plugins';

// A free Apple ID signs with a personal team, which cannot carry the push
// entitlement that expo-notifications adds. Set APPLE_PERSONAL_TEAM in .env
// to the team id to build to a phone with one. Push does not work there.
const personalTeam = process.env.APPLE_PERSONAL_TEAM;

export default ({config}: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;

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
