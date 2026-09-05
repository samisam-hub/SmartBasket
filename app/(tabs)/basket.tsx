import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { colors, ui } from '@/lib/theme';

export default function BasketScreen() {
  return <Screen>
    <Text style={ui.eyebrow}>ROOM FOR GOOD THINGS</Text><Text style={ui.title}>Your basket</Text>
    <View style={[ui.card, { paddingVertical: 40, alignItems: 'center', marginTop: 24, gap: 22 }]}>
      <View style={{ backgroundColor: colors.pale, borderRadius: 72, width: 144, height: 144, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={62} color={colors.primary} /></View>
      <Text style={[ui.heading, { textAlign: 'center' }]}>Your basket is empty.</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>Create a personalized basket based on your goals.</Text>
      <View style={{ alignSelf: 'stretch', gap: 12 }}><Button label="Create my basket" onPress={() => router.push('/basket-setup')} /><Button label="Browse products" secondary onPress={() => router.navigate('/products')} /></View>
    </View>
    <Text style={[ui.body, { textAlign: 'center', fontSize: 14 }]}>Personalized baskets and saving are coming soon.</Text>
  </Screen>;
}
