import {BrandLogo} from '@/components/BrandAssets';
import { router } from "expo-router";
import { Alert, Text } from "react-native";
import {
  InfoCard,
  PreferenceRow,
  PrimaryButton,
  Screen,
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
export default function ProfileScreen() {
  const { saved, editing } = usePreferences();
  const flow = useBasketFlow();
  const auth=useAuth(),personal=useProfile(),p=personal.saved;
  const [accountError,setAccountError]=useState<string|null>(null),[signingOut,setSigningOut]=useState(false);
  const editPersonal=(step=0)=>{personal.store.update({},step);router.push('/personal-profile');};
  return (
    <Screen><BrandLogo compact />
      <ScreenHeader
        eyebrow="MADE FOR YOU"
        title="Profile"
        subtitle="Your preferences, all in one place."
      />
      <SectionCard title={auth.session?.user.is_anonymous||!auth.session?'Guest':p?.displayName||'Your account'}>
        <Text style={ui.body}>{auth.session?.user.email??'Anonymous SmartBasket session'}</Text>
        {auth.session?.user.is_anonymous||!auth.session?<><Text style={ui.small}>Create an account to keep your SmartBasket data across devices.</Text><PrimaryButton label="Create account" onPress={()=>router.push('/account')} /><TextButton label="Sign in" onPress={()=>router.push({pathname:'/account',params:{mode:'signin'}})} /></>:<Text style={ui.small}>Signed in · Session saved on this device</Text>}
        {auth.error&&<Text style={ui.small}>{auth.error}</Text>}
      </SectionCard>
      <SectionCard title="Personal details"><Text style={ui.body}>{p?`${p.displayName||'Name not set'} · ${p.sex??'Sex not set'} · ${p.age??'Age not set'}`:'Set long-term personal defaults, even as a guest.'}</Text><TextButton label={personal.pending?'Resume personal profile':'Edit personal details'} onPress={()=>editPersonal(0)} /></SectionCard>
      <SectionCard title="Nutrition goals"><Text style={ui.body}>{p?`${p.primaryNutritionGoal.replaceAll('_',' ')} · ${p.defaultDailyCalories??'Plan target'} kcal · ${p.proteinMode} protein`:'No personal defaults yet.'}</Text><TextButton label="Edit personal nutrition goals" onPress={()=>editPersonal(1)} /></SectionCard>
      <SectionCard title="Dietary preferences"><Text style={ui.body}>{p?.dietaryPreferences.map(d=>labels[d]).join(', ')??'Not set'}</Text><TextButton label="Edit personal diet" onPress={()=>editPersonal(2)} /></SectionCard>
      <SectionCard title="Personal allergies & intolerances"><Text style={ui.body}>{p?[...p.allergens,...p.intolerances].join(', ')||'None selected':'Not set'}</Text><TextButton label="Edit personal allergies & intolerances" onPress={()=>editPersonal(3)} /></SectionCard>
      {personal.error&&<Text style={ui.small}>{personal.error}</Text>}
      <SectionCard title="Plan setup preferences">
        {saved ? (
          <PreferenceSummary preferences={saved} />
        ) : (
          <Text style={ui.body}>
            Tell us what matters to you to get started.
          </Text>
        )}
        <PrimaryButton
          label={
            editing
              ? "Resume preference edits"
              : saved
                ? "Edit preferences"
                : "Set my preferences"
          }
          disabled={flow.disabled}
          onPress={() => flow.edit()}
        />
      </SectionCard>
      <PersistenceStatus />
      <SectionCard title="Allergies & intolerances">
        <PreferenceRow
          label="Your selections"
          value={
            saved
              ? saved.allergens.map((a) => labels[a]).join(", ") ||
                "None selected"
              : "Not set"
          }
        />
        <TextButton
          label="Edit allergies"
          disabled={flow.disabled}
          onPress={() => flow.edit("allergies")}
        />
        <Text style={ui.small}>
          Always check product labels. Saved selections do not guarantee allergy
          suitability.
        </Text>
      </SectionCard>
      <SectionCard title="Saved baskets">
        <Text style={ui.body}>
          Open your saved grocery baskets and their original plan snapshots.
        </Text>
        <TextButton
          label="Open basket"
          onPress={() => router.navigate("/basket")}
        />
      </SectionCard>
      <SectionCard title="Saved meal plans"><TextButton label="View saved meal plans" onPress={()=>router.push('/saved-meal-plans')} /></SectionCard>
      <SectionCard title="Account">
        {accountError&&<Text style={ui.small}>{accountError}</Text>}
        <TextButton label="Reset password" onPress={()=>router.push({pathname:'/account',params:{mode:'forgot'}})} />
        {auth.session&&!auth.session.user.is_anonymous&&<PrimaryButton label="Sign out" loading={signingOut} onPress={()=>{setSigningOut(true);void auth.service?.signOut().then(()=>router.dismissTo('/profile')).catch(e=>setAccountError(e.message)).finally(()=>setSigningOut(false));}} />}
      </SectionCard>
      <InfoCard title="Notifications">
        Reminders are coming later. SmartBasket does not send notifications yet.
      </InfoCard>
      <SectionCard title="Help & Feedback">
        <Text style={ui.body}>
          Need help saving or changing your preferences?
        </Text>
        <TextButton
          label="View help"
          onPress={() =>
            Alert.alert(
              "SmartBasket help",
              "Use My preferences to edit your answers. Local-only means your preferences are saved on this device but not uploaded. Use Retry cloud sync after reconnecting. Feedback submission is not available yet.",
            )
          }
        />
      </SectionCard>
      <InfoCard title="About SmartBasket">
        Fuel your goals. Version 0.1.0 · Your fitness-oriented grocery
        assistant. Anonymous cloud profiles are tied to this installation;
        reinstalling or clearing app data can lose access.
      </InfoCard>
    </Screen>
  );
}
