# Android navigation and safe-area fixes — 2026-09-06

## Navigation diagnosis and change

The old `home()` helper queued `router.dismissAll()` (POP_TO_TOP) and immediately
queued `router.replace("/")`. Both operated on the same native stack during one
exit, so the replacement was calculated while the dismissal was still pending.
It also sent edits to Home unconditionally. The stack has a tabs route and a
single dynamic onboarding route; steps replace each other. There are no auth
redirect effects, sign-out calls, or BackHandler.exitApp calls in the save path.
The preference provider remains mounted above the navigation stack.

The conflicting exit actions and incorrect edit destination are confirmed code
defects. No phone was connected to adb, so the reported physical-device exit was
not reproduced and there is no native crash log proving its precise crash cause.

The flow now carries an explicit `intent` parameter through every step and
review edit. It is chosen before saving, rather than inferred from the completion
flag that saving changes. One root-stack `reset` leaves only `(tabs)`, selecting
Home for first onboarding or Profile for edits. This also handles direct links
and removes all onboarding/basket-setup history from the root stack. Android
Back from Home therefore cannot reopen completed onboarding. Back from Profile
uses normal tab navigation, returning to Home.

Save & exit uses the same single transition after a successful draft write.
An in-flight guard blocks competing taps/back/step changes, and completion only
navigates while the screen is still focused. Failed local persistence stays on
the form. Cloud failure retains the existing explicit local-only behavior.
No timeouts/delays were added to navigation and no auth/backend behavior changed.

The transition uses React Navigation's documented
[reset operation](https://reactnavigation.org/docs/navigation-object/#reset).

## Safe-area diagnosis and change

The root SafeAreaProvider was already present. Bottom tabs already included a
system inset through React Navigation; the problem was not a missing provider.
The app relied on the library's 49pt default visible height while adding a 16pt
caption line and 4pt top/bottom item padding on top of the library's own item
padding. This crowded the icon/label content near the system-safe boundary.

The central Tabs layout now reads live `useSafeAreaInsets()` values and specifies
56pt visible tab content plus `insets.bottom`, with exactly `insets.bottom` as
system padding. Extra item bottom padding is removed. Labels stay below icons.
The 56pt value is a shared content design height, not a device offset. There is
no minimum/fixed system inset, model detection, or manufacturer condition.
Left/right insets are also passed to Tabs. Root initialWindowMetrics supplies
the initial measurement while the provider continues updating live insets.

Safe-area responsibilities were reviewed across all routes:

- Home, Basket, Profile: shared Screen handles top/left/right; Tabs owns bottom.
- Products: FlatList container handles top/left/right; Tabs owns bottom.
- Onboarding and edit routes: shared Screen protects all four edges, including
  the loading state and final save control. Scroll/keyboard handling is retained.
- Basket setup: native Stack header owns top; Screen explicitly owns bottom and
  sides. Bottom protection is no longer implicitly coupled to `top={false}`.
- No custom modals or bottom sheets exist. Profile uses OS-native Alert dialogs.

The layout follows the system insets for gesture navigation, three-button
navigation, iOS home indicators, side cutouts, and inset changes. No tab-screen
bottom inset is added twice. Brand, typography, cards, and workflow are unchanged.
See [Expo safe-area guidance](https://docs.expo.dev/develop/user-interface/safe-areas/).

## Verification

- TypeScript and ESLint pass.
- All 20 tests pass, including four actual StackRouter/TabRouter scenarios for
  onboarding/edit saves from existing stacks and direct links. They check selected
  tabs, Back history, immediately updated store values, and storage restoration.
- Existing domain, offline persistence, failure, and PostgreSQL/RLS tests pass.
- Expo Doctor: 18/18 checks pass.
- Android production export with Hermes bytecode passes.
- `.github/workflows/build-android.yml` is unchanged.

Still required on physical devices: repeat first onboarding and Profile edits,
confirm no exit and immediate saved values, press hardware Back after saving,
test Save & exit/resume and offline saves, and test gesture/three-button modes.
Check all tabs and onboarding controls with the keyboard open and closed, plus
an iPhone home indicator. Verify an installed update retains existing preferences.
If a native exit persists, capture adb logcat around Save to distinguish a native
crash from an Activity/navigation transition.

## Files

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/onboarding/[step].tsx`
- `app/basket-setup.tsx`
- `components/ui.tsx`
- `hooks/useBasketFlow.ts`
- `services/preference-navigation.ts`
- `tests/navigation.test.cjs`
- `docs/ANDROID-FIXES.md`
