import { t } from '../services/i18n';
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
  if (!ready) return <Text style={ui.small}>{t('persist.loading')}</Text>;
  return (
    <View style={ui.stack}>
      {localError && (
        <>
          <ErrorMessage message={localError} />
          <TextButton
            label={t('persist.retryLocal')}
            onPress={() => {
              void store.retryLocal();
            }}
          />
        </>
      )}
      {!configured ? (
        <InfoCard title={saved ? t('persist.savedLocal') : t('persist.localMode')}>{t('persist.noCloud')}</InfoCard>
      ) : saved && pendingSync ? (
        <InfoCard title={t('persist.localOnly')}>

          Deine neuesten Einstellungen wurden noch nicht hochgeladen.
        </InfoCard>
      ) : saved ? (
        <SuccessMessage message={t('persist.synced')} />
      ) : null}
      <ErrorMessage message={remoteError} />
      {configured && (pendingSync || remoteError) && (
        <TextButton
          label={t('persist.retryCloud')}
          loading={saving}
          onPress={() => {
            void store.retryRemote();
          }}
        />
      )}
    </View>
  );
}
