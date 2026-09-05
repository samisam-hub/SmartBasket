import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Chips, PreferenceRow, Screen } from '@/components/ui';
import { ui } from '@/lib/theme';

export default function BasketSetupScreen() {
  return <Screen top={false}>
    <Text style={ui.eyebrow}>A PREVIEW OF WHAT’S NEXT</Text>
    <Text style={ui.title}>A basket built around you.</Text>
    <Text style={ui.body}>Soon, your needs will become a thoughtfully chosen grocery basket. Here’s an example of the preferences you’ll be able to set.</Text>
    <View style={ui.card}>
      <Text style={ui.heading}>An example week</Text>
      <PreferenceRow label="Shopping for" value="1 person · 7 days" />
      <PreferenceRow label="Daily calorie target" value="1,700 kcal per person" />
      <PreferenceRow label="Total grocery budget" value="€70" />
      <Chips labels={['High protein', 'Lactose-free']} />
    </View>
    <Text style={ui.body}>Basket creation isn’t available yet. These example preferences aren’t saved or used to select products.</Text>
    <Button label="Explore the sample catalog" onPress={() => router.dismissTo('/products')} />
  </Screen>;
}
