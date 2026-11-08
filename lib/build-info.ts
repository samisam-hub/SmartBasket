import Constants from 'expo-constants';

/** Which build is running, in the form "0.1.0 (53)". A fault report is only useful with it:
 *  without it, an old copy still on the phone and a fresh one look exactly the same. */
export function buildLabel(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const build = Constants.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}
