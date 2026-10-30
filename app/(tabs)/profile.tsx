import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatNumber, locales, setLocale, t, term } from "@/services/i18n";
import { useLocale } from "@/hooks/useLocale";
import { BrandLogo } from '@/components/BrandAssets';
import { router } from "expo-router";
import { Alert, Text, View } from "react-native";
import {
  DetailRow,
  InfoCard,
  PreferenceRow,
  PrimaryButton,
  Screen,
  SecondaryButton,
  ScreenHeader,
  SectionCard,
  SelectionChip,
  TextButton,
} from "@/components/ui";
import { PersistenceStatus } from "@/components/PersistenceStatus";
import { PreferenceSummary } from "@/components/PreferenceSummary";
import { usePreferences } from "@/context/PreferencesContext";
import { useBasketFlow } from "@/hooks/useBasketFlow";
import { ui } from "@/lib/theme";
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useState } from 'react';
import { useMerchantDemo } from '@/services/merchant-demo';
export default function ProfileScreen() {
  const { saved, editing } = usePreferences();
  const flow = useBasketFlow();
  const auth=useAuth(),personal=useProfile(),p=personal.saved;
  const demo=useMerchantDemo();
  const locale=useLocale();
  const [languageError,setLanguageError]=useState<string|null>(null);
  const [accountError,setAccountError]=useState<string|null>(null),[signingOut,setSigningOut]=useState(false),[deleting,setDeleting]=useState(false);
  const deleteAccount=()=>Alert.alert(
    t('profile.deleteTitle'),
    t('profile.deleteBody'),
    [
      {text:t('profile.cancel'),style:'cancel'},
      {text:t('profile.deleteConfirm'),style:'destructive',onPress:()=>{
        setAccountError(null);setDeleting(true);
        void auth.service?.deleteAccount()
          .then(()=>router.dismissTo('/account'))
          .catch(e=>setAccountError(e instanceof Error?e.message:t('profile.deleteFailed')))
          .finally(()=>setDeleting(false));
      }},
    ],
  );
  const editPersonal=(step=0)=>{personal.store.update({},step);router.push('/personal-profile');};
  return (
    <Screen><BrandLogo compact />
      <ScreenHeader
        eyebrow={t('profile.eyebrow')}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />
      <SectionCard title={t('profile.language')}>
        <Text style={ui.small}>{t('profile.languageHint')}</Text>
        <View style={ui.wrap}>
          {locales.map(choice => <SelectionChip key={choice} label={t(`language.${choice}`)}
            selected={locale === choice}
            onPress={() => { setLanguageError(null);
              void setLocale(choice, AsyncStorage).catch(() => setLanguageError(t('profile.languageFailed'))); }} />)}
        </View>
        {languageError && <Text style={ui.small}>{languageError}</Text>}
      </SectionCard>
      <SectionCard title={auth.session?.user.is_anonymous||!auth.session?t('profile.guest'):p?.displayName||t('profile.yourAccount')}>
        <Text style={ui.body}>{auth.session?.user.email??t('profile.guestSession')}</Text>
        {auth.session?.user.is_anonymous||!auth.session?<><Text style={ui.small}>{t('profile.createAccountHint')}</Text><PrimaryButton label={t('profile.createAccount')} onPress={()=>router.push('/account')} /><TextButton label={t('profile.signIn')} onPress={()=>router.push({pathname:'/account',params:{mode:'signin'}})} /></>:<Text style={ui.small}>{t('profile.signedIn')}</Text>}
        {auth.error&&<Text style={ui.small}>{auth.error}</Text>}
      </SectionCard>
      <SectionCard title={t('profile.personal')}><Text style={ui.body}>{p?`${p.displayName||t('profile.noName')} · ${p.sex ? term(p.sex) : t('profile.noSex')} · ${p.age??t('profile.noAge')}`:t('profile.personalEmpty')}</Text><TextButton label={t(personal.pending?'profile.personalResume':'profile.personalEdit')} onPress={()=>editPersonal(0)} /></SectionCard>
      <SectionCard title={t('profile.goals')}><Text style={ui.body}>{p?`${term(p.primaryNutritionGoal)} · ${p.defaultDailyCalories??t('profile.planTarget')} kcal · ${term(p.proteinMode)} ${t('profile.protein')}`:t('profile.noGoals')}</Text><TextButton label={t('profile.goalsEdit')} onPress={()=>editPersonal(1)} /></SectionCard>
      <SectionCard title={t('profile.diet')}><Text style={ui.body}>{p?.dietaryPreferences.map(d=>term(d)).join(', ')??t('profile.notSet')}</Text><TextButton label={t('profile.dietEdit')} onPress={()=>editPersonal(2)} /></SectionCard>
      <SectionCard title={t('profile.allergiesPersonal')}><Text style={ui.body}>{p?[...p.allergens,...p.intolerances].map(term).join(', ')||t('profile.noneSelected'):t('profile.notSet')}</Text><TextButton label={t('profile.allergiesPersonalEdit')} onPress={()=>editPersonal(3)} /></SectionCard>
      {personal.error&&<Text style={ui.small}>{personal.error}</Text>}
      <DetailRow
        icon="users"
        title={t('profile.household')}
        value={
          saved
            ? t('profile.householdValue', { count: saved.householdSize, calories: formatNumber(saved.dailyCalories) })
            : t('profile.householdEmpty')
        }
        onPress={() => router.push("/household")}
      />
      <SectionCard title={t('profile.defaults')}>
        {saved ? (
          <PreferenceSummary preferences={saved} />
        ) : (
          <Text style={ui.body}>{t('profile.defaultsEmpty')}</Text>
        )}
        <PrimaryButton
          label={t(editing ? 'profile.settingsResume' : saved ? 'profile.settingsEdit' : 'profile.settingsStart')}
          disabled={flow.disabled}
          onPress={() => flow.edit()}
        />
      </SectionCard>
      <PersistenceStatus />
      <SectionCard title={t('profile.allergies')}>
        <PreferenceRow
          label={t('profile.yourChoice')}
          value={
            saved
              ? saved.allergens.map((a) => term(a)).join(", ") || t('profile.noneSelected')
              : t('profile.notSet')
          }
        />
        <TextButton
          label={t('profile.allergiesEdit')}
          disabled={flow.disabled}
          onPress={() => flow.edit("allergies")}
        />
        <Text style={ui.small}>{t('profile.allergiesNote')}</Text>
      </SectionCard>
      <SectionCard title={t('profile.demo')}>
        <Text style={ui.body}>{t(demo.demo ? 'profile.demoOn' : 'profile.demoOff')}</Text>
        <SecondaryButton label={t(demo.demo ? 'profile.demoHide' : 'profile.demoShow')}
          onPress={() => demo.set(!demo.demo)} />
        <Text style={ui.small}>{t('profile.demoNote')}</Text>
      </SectionCard>
      <SectionCard title={t('profile.savedBaskets')}>
        <Text style={ui.body}>{t('profile.savedBasketsHint')}</Text>
        <TextButton
          label={t('profile.openBasket')}
          onPress={() => router.navigate("/basket")}
        />
      </SectionCard>
      <SectionCard title={t('route.savedPlans')}><TextButton label={t('profile.savedPlansView')} onPress={()=>router.push('/saved-meal-plans')} /></SectionCard>
      <SectionCard title={t('route.account')}>
        {accountError&&<Text style={ui.small}>{accountError}</Text>}
        <TextButton label={t('profile.resetPassword')} onPress={()=>router.push({pathname:'/account',params:{mode:'forgot'}})} />
        {auth.session&&!auth.session.user.is_anonymous&&<PrimaryButton label={t('profile.signOut')} loading={signingOut} onPress={()=>{setSigningOut(true);void auth.service?.signOut().then(()=>router.dismissTo('/profile')).catch(e=>setAccountError(e.message)).finally(()=>setSigningOut(false));}} />}
        {auth.session&&!auth.session.user.is_anonymous&&<TextButton label={t('profile.deleteAccount')} disabled={deleting||signingOut} onPress={deleteAccount} />}
        {deleting&&<Text style={ui.small}>{t('profile.deleting')}</Text>}
      </SectionCard>
      <InfoCard title={t('profile.notifications')}>{t('profile.notificationsBody')}</InfoCard>
      <SectionCard title={t('profile.help')}>
        <Text style={ui.body}>{t('profile.helpBody')}</Text>
        <TextButton
          label={t('profile.helpView')}
          onPress={() => Alert.alert(t('profile.helpTitle'), t('profile.helpText'))}
        />
      </SectionCard>
      <InfoCard title={t('profile.about')}>{t('profile.aboutBody')}</InfoCard>
    </Screen>
  );
}
