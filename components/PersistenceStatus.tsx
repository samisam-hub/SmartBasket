import { Text, View } from "react-native";
import { ErrorMessage, InfoCard, SuccessMessage, TextButton } from "./ui";
import { usePreferences } from "@/context/PreferencesContext";
import { ui } from "@/lib/theme";
export function PersistenceStatus() {
  const {
    configured,
    saved,
    pendingSync,
    saving,
    localError,
    remoteError,
    ready,
    store,
  } = usePreferences();
  if (!ready) return <Text style={ui.small}>Loading your preferences…</Text>;
  return (
    <View style={ui.stack}>
      {localError && (
        <>
          <ErrorMessage message={localError} />
          <TextButton
            label="Retry device save"
            onPress={() => {
              void store.retryLocal();
            }}
          />
        </>
      )}
      {!configured ? (
        <InfoCard title={saved ? "Saved on this device" : "Local mode"}>
          Cloud sync is not configured. You can complete and resume onboarding
          on this device.
        </InfoCard>
      ) : saved && pendingSync ? (
        <InfoCard title="Saved on this device only">
          Your latest preferences have not been uploaded yet.
        </InfoCard>
      ) : saved ? (
        <SuccessMessage message="Preferences synced to Supabase." />
      ) : null}
      <ErrorMessage message={remoteError} />
      {configured && (pendingSync || remoteError) && (
        <TextButton
          label="Retry cloud sync"
          loading={saving}
          onPress={() => {
            void store.retryRemote();
          }}
        />
      )}
    </View>
  );
}
