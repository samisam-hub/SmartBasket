import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chips, Screen } from '@/components/ui';
import { colors, ui } from '@/lib/theme';

export default function HomeScreen() {
  return <Screen>
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <View style={ui.row}><View style={styles.logo}><Feather name="shopping-bag" size={22} color="white" /></View><Text style={styles.wordmark}>SmartBasket</Text></View>
      <Text style={styles.small}>A fresher start</Text>
    </View>
    <View style={styles.hero}>
      <Text style={ui.eyebrow}>GOOD FOOD. LESS GUESSWORK.</Text>
      <Text style={styles.headline}>Your groceries,{"\n"}optimized for{"\n"}your goals.</Text>
      <Text style={ui.body}>A little planning. A basket full of possibilities.</Text>
      <View style={styles.foodArt} accessibilityLabel="Illustration of fresh groceries">
        <View style={styles.foodCircle}><Text style={styles.food}>🥑</Text></View>
        <View style={[styles.foodCircle, { backgroundColor: colors.peach, marginTop: 34 }]}><Text style={styles.food}>🥕</Text></View>
        <View style={[styles.foodCircle, { backgroundColor: '#DFE9C9' }]}><Text style={styles.food}>🥦</Text></View>
      </View>
      <Button label="Create my basket  →" onPress={() => router.push('/basket-setup')} />
    </View>
    <View style={{ gap: 12 }}><Text style={ui.heading}>Made for your everyday</Text><Text style={ui.body}>Imagine a week that looks like this.</Text>
      <Chips labels={['7 days', '1 person', '1,700 kcal', 'High protein', 'Lactose-free']} />
    </View>
    <View style={ui.card}>
      <Text style={ui.eyebrow}>COMING TO YOUR BASKET</Text>
      <Text style={ui.heading}>Your goals. Your budget.</Text>
      <Text style={ui.body}>Tell us what matters to you. Personalized grocery baskets are on their way — explore a taste of the catalog today.</Text>
      <Button label="Explore products" secondary onPress={() => router.navigate('/products')} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  logo: { backgroundColor: colors.primary, borderRadius: 13, padding: 10 },
  wordmark: { fontSize: 21, letterSpacing: -0.7, fontWeight: '700', color: colors.ink },
  small: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: 'right' },
  hero: { gap: 19, paddingTop: 14 },
  headline: { color: colors.ink, fontWeight: '700', fontSize: 39, lineHeight: 44, letterSpacing: -1.7 },
  foodArt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, minHeight: 170 },
  foodCircle: { flex: 1, maxWidth: 115, aspectRatio: 1, borderRadius: 60, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  food: { fontSize: 62 },
});
