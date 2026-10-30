import { germanLabel } from '../../lib/german';
import {BrandLogo} from '@/components/BrandAssets';
import { router } from "expo-router";
import { Alert, Text } from "react-native";
import {
  DetailRow,
  InfoCard,
  PreferenceRow,
  PrimaryButton,
  Screen,
  SecondaryButton,
  ScreenHeader,
  SectionCard,
  TextButton,
} from "@/components/ui";
import { PersistenceStatus } from "@/components/PersistenceStatus";
import { PreferenceSummary } from "@/components/PreferenceSummary";
import { usePreferences } from "@/context/PreferencesContext";
import { useBasketFlow } from "@/hooks/useBasketFlow";
import { labels } from "@/types/preferences";
import { ui } from "@/lib/theme";
import {useAuth} from '@/context/AuthContext';
import {useProfile} from '@/context/ProfileContext';
import {useState} from 'react';
import {useMerchantDemo} from '@/services/merchant-demo';
export default function ProfileScreen() {
  const { saved, editing } = usePreferences();
  const flow = useBasketFlow();
  const auth=useAuth(),personal=useProfile(),p=personal.saved;
  const demo=useMerchantDemo();
  const [accountError,setAccountError]=useState<string|null>(null),[signingOut,setSigningOut]=useState(false),[deleting,setDeleting]=useState(false);
  const deleteAccount=()=>Alert.alert(
    "Konto endgültig löschen?",
    "Dein angemeldetes Konto und alle Cloud-Daten einschließlich Warenkörben, Speiseplänen und Einstellungen werden gelöscht. Dies kann nicht rückgängig gemacht werden.",
    [
      {text:"Abbrechen",style:'cancel'},
      {text:"Endgültig löschen",style:'destructive',onPress:()=>{
        setAccountError(null);setDeleting(true);
        void auth.service?.deleteAccount()
          .then(()=>router.dismissTo('/account'))
          .catch(e=>setAccountError(e instanceof Error?e.message:"Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut."))
          .finally(()=>setDeleting(false));
      }},
    ],
  );
  const editPersonal=(step=0)=>{personal.store.update({},step);router.push('/personal-profile');};
  return (
    <Screen><BrandLogo compact />
      <ScreenHeader
        eyebrow="FÜR DICH"
        title="Profil"
        subtitle="Alle deine Einstellungen an einem Ort."
      />
      <SectionCard title={auth.session?.user.is_anonymous||!auth.session?"Gast":p?.displayName||"Dein Konto"}>
        <Text style={ui.body}>{auth.session?.user.email??"SmartBasket-Gastsitzung"}</Text>
        {auth.session?.user.is_anonymous||!auth.session?<><Text style={ui.small}>Erstelle ein Konto, um deine SmartBasket-Daten geräteübergreifend zu behalten.</Text><PrimaryButton label="Konto erstellen" onPress={()=>router.push('/account')} /><TextButton label="Anmelden" onPress={()=>router.push({pathname:'/account',params:{mode:'signin'}})} /></>:<Text style={ui.small}>Angemeldet · Sitzung auf diesem Gerät gespeichert</Text>}
        {auth.error&&<Text style={ui.small}>{auth.error}</Text>}
      </SectionCard>
      <SectionCard title="Persönliche Angaben"><Text style={ui.body}>{p?`${p.displayName||"Name nicht angegeben"} · ${p.sex ? germanLabel(p.sex) : "Geschlecht nicht angegeben"} · ${p.age??"Alter nicht angegeben"}`:"Lege persönliche Vorgaben fest – auch als Gast."}</Text><TextButton label={personal.pending?"Persönliches Profil fortsetzen":"Persönliche Angaben bearbeiten"} onPress={()=>editPersonal(0)} /></SectionCard>
      <SectionCard title="Ernährungsziele"><Text style={ui.body}>{p?`${germanLabel(p.primaryNutritionGoal)} · ${p.defaultDailyCalories??"Planziel"} kcal · ${germanLabel(p.proteinMode)} Eiweiß`:"Noch keine persönlichen Vorgaben."}</Text><TextButton label="Persönliche Ernährungsziele bearbeiten" onPress={()=>editPersonal(1)} /></SectionCard>
      <SectionCard title="Ernährungseinstellungen"><Text style={ui.body}>{p?.dietaryPreferences.map(d=>labels[d]).join(', ')??"Nicht festgelegt"}</Text><TextButton label="Persönliche Ernährungsweise bearbeiten" onPress={()=>editPersonal(2)} /></SectionCard>
      <SectionCard title="Persönliche Allergien und Unverträglichkeiten"><Text style={ui.body}>{p?[...p.allergens,...p.intolerances].map(germanLabel).join(', ')||"Keine ausgewählt":"Nicht festgelegt"}</Text><TextButton label="Persönliche Allergien und Unverträglichkeiten bearbeiten" onPress={()=>editPersonal(3)} /></SectionCard>
      {personal.error&&<Text style={ui.small}>{personal.error}</Text>}
      <DetailRow
        icon="users"
        title="Haushalt"
        value={
          saved
            ? `${saved.householdSize} ${saved.householdSize === 1 ? "Person" : "Personen"} · ${saved.dailyCalories.toLocaleString("de-DE")} kcal pro Tag im Schnitt`
            : "Noch nicht eingerichtet"
        }
        onPress={() => router.push("/household")}
      />
      <SectionCard title="Vorgaben für neue Pläne">
        {saved ? (
          <PreferenceSummary preferences={saved} />
        ) : (
          <Text style={ui.body}>

            Sag uns zum Start, was dir wichtig ist.
          </Text>
        )}
        <PrimaryButton
          label={
            editing
              ? "Bearbeitung der Einstellungen fortsetzen"
              : saved
                ? "Einstellungen bearbeiten"
                : "Meine Einstellungen festlegen"
          }
          disabled={flow.disabled}
          onPress={() => flow.edit()}
        />
      </SectionCard>
      <PersistenceStatus />
      <SectionCard title="Allergien und Unverträglichkeiten">
        <PreferenceRow
          label="Deine Auswahl"
          value={
            saved
              ? saved.allergens.map((a) => labels[a]).join(", ") ||
                "Keine ausgewählt"
              : "Nicht festgelegt"
          }
        />
        <TextButton
          label="Allergien bearbeiten"
          disabled={flow.disabled}
          onPress={() => flow.edit("allergies")}
        />
        <Text style={ui.small}>

          Prüfe immer die Verpackungsangaben. Gespeicherte Einstellungen garantieren keine Eignung bei Allergien.
        </Text>
      </SectionCard>
      <SectionCard title="Händler-Demo">
        <Text style={ui.body}>
          {demo.demo
            ? 'Der Produkte-Tab ist sichtbar. Seine Marken und Preise sind erfundene Demo-Daten.'
            : 'Aus. Der Produktkatalog besteht aus erfundenen Demo-Daten, um Händlern das Matching zu zeigen.'}
        </Text>
        <SecondaryButton label={demo.demo ? 'Produktkatalog ausblenden' : 'Produktkatalog anzeigen'}
          onPress={() => demo.set(!demo.demo)} />
        <Text style={ui.small}>
          Für echte Testnutzer ausgeschaltet lassen: erfundene Preise wirken wie echte.
        </Text>
      </SectionCard>
      <SectionCard title="Gespeicherte Warenkörbe">
        <Text style={ui.body}>

          Öffne deine gespeicherten Warenkörbe mit den zugehörigen Speiseplänen.
        </Text>
        <TextButton
          label="Warenkorb öffnen"
          onPress={() => router.navigate("/basket")}
        />
      </SectionCard>
      <SectionCard title="Gespeicherte Speisepläne"><TextButton label="Gespeicherte Speisepläne ansehen" onPress={()=>router.push('/saved-meal-plans')} /></SectionCard>
      <SectionCard title="Konto">
        {accountError&&<Text style={ui.small}>{accountError}</Text>}
        <TextButton label="Passwort zurücksetzen" onPress={()=>router.push({pathname:'/account',params:{mode:'forgot'}})} />
        {auth.session&&!auth.session.user.is_anonymous&&<PrimaryButton label="Abmelden" loading={signingOut} onPress={()=>{setSigningOut(true);void auth.service?.signOut().then(()=>router.dismissTo('/profile')).catch(e=>setAccountError(e.message)).finally(()=>setSigningOut(false));}} />}
        {auth.session&&!auth.session.user.is_anonymous&&<TextButton label="Konto löschen" disabled={deleting||signingOut} onPress={deleteAccount} />}
        {deleting&&<Text style={ui.small}>Dein Konto wird gelöscht …</Text>}
      </SectionCard>
      <InfoCard title="Benachrichtigungen">

        Erinnerungen folgen später. SmartBasket versendet derzeit keine Benachrichtigungen.
      </InfoCard>
      <SectionCard title="Hilfe und Rückmeldung">
        <Text style={ui.body}>

          Brauchst du Hilfe beim Speichern oder Ändern deiner Einstellungen?
        </Text>
        <TextButton
          label="Hilfe ansehen"
          onPress={() =>
            Alert.alert(
              "SmartBasket-Hilfe",
              "Unter Meine Einstellungen kannst du deine Angaben ändern. Nur lokal bedeutet, dass sie auf diesem Gerät gespeichert, aber nicht hochgeladen sind. Nutze nach dem Wiederverbinden Cloud-Synchronisierung wiederholen. Rückmeldungen können noch nicht direkt gesendet werden.",
            )
          }
        />
      </SectionCard>
      <InfoCard title="Über SmartBasket">

        Einkaufen passend zu deinen Zielen. Version 0.1.0 · Dein Assistent für Speiseplanung und Einkauf. Anonyme Cloud-Profile sind an diese Installation gebunden. Neuinstallation oder Löschen der App-Daten kann den Zugriff aufheben.
      </InfoCard>
    </Screen>
  );
}
