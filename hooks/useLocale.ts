import { useSyncExternalStore } from 'react';
import { locale, subscribeLocale, type Locale } from '@/services/i18n';

/** Re-renders the screen when the locale changes, so switching language does not need a restart.
 *  Translating itself needs no hook: `t` reads the active locale directly, which is what lets a
 *  service or a store translate the message it throws. */
export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, locale, locale);
