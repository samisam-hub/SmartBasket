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
  if (!ready) return <Text style={ui.small}>Deine Einstellungen werden geladen …</Text>;
  return (
    <View style={ui.stack}>
      {localError && (
        <>
          <ErrorMessage message={localError} />
          <TextButton
            label="Erneut auf dem Gerät speichern"
            onPress={() => {
              void store.retryLocal();
            }}
          />
        </>
      )}
      {!configured ? (
        <InfoCard title={saved ? "Auf diesem Gerät gespeichert" : "Lokaler Modus"}>

          Die Cloud-Synchronisierung ist nicht eingerichtet. Du kannst die Einrichtung auf diesem Gerät abschließen und fortsetzen.
        </InfoCard>
      ) : saved && pendingSync ? (
        <InfoCard title="Nur auf diesem Gerät gespeichert">

          Deine neuesten Einstellungen wurden noch nicht hochgeladen.
        </InfoCard>
      ) : saved ? (
        <SuccessMessage message="Einstellungen mit deinem Konto synchronisiert." />
      ) : null}
      <ErrorMessage message={remoteError} />
      {configured && (pendingSync || remoteError) && (
        <TextButton
          label="Cloud-Synchronisierung wiederholen"
          loading={saving}
          onPress={() => {
            void store.retryRemote();
          }}
        />
      )}
    </View>
  );
}
