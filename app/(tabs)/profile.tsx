import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { PreferenceRow, Screen } from '@/components/ui';
import { colors, ui } from '@/lib/theme';

export default function ProfileScreen() {
  return <Screen>
    <Text style={ui.eyebrow}>FOOD THAT FITS YOUR LIFE</Text><Text style={ui.title}>Your preferences</Text>
    <View style={ui.row}><View style={{ backgroundColor: colors.pale, padding: 18, borderRadius: 24 }}><Feather name="user" size={30} color={colors.primary} /></View>
      <View style={{ flex: 1 }}><Text style={ui.heading}>Make it yours</Text><Text style={ui.body}>Your everyday starts here.</Text></View></View>
    <View style={ui.card}>
      <Text style={ui.heading}>A place for your goals</Text>
      <Text style={ui.body}>Soon you’ll be able to set and save these preferences.</Text>
      <PreferenceRow label="Daily calorie target" value="Not set" />
      <PreferenceRow label="Dietary preferences" value="Not set" />
      <PreferenceRow label="Allergies & intolerances" value="Not set" />
      <PreferenceRow label="Grocery budget" value="Not set" />
      <PreferenceRow label="Household size" value="Not set" />
    </View>
    <Text style={[ui.body, { fontSize: 14 }]}>You’re exploring as a guest. Profile editing and accounts are coming later.</Text>
  </Screen>;
}
