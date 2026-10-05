import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenHeader, SectionCard, SecondaryButton, TextButton } from './ui';
import { ui } from '../lib/theme';

/** Phase 0 landing view. Selection and meal editing arrive with the calendar flow. */
export function CalendarWelcome() {
  const [offset, setOffset] = useState(0);
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + offset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return date;
  });
  return <>
    <ScreenHeader title="Your week, your way." subtitle="Your household is ready. There is room for your favourite meals here." />
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <TextButton label="Previous week" onPress={() => setOffset(n => n - 1)} />
      <TextButton label="This week" onPress={() => setOffset(0)} />
      <TextButton label="Next week" onPress={() => setOffset(n => n + 1)} />
    </View>
    <SectionCard title={`Week of ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}>
      {days.map(date => <View key={date.toISOString()} style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.small}>{date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
        <Text style={ui.caption}>No meals planned</Text>
      </View>)}
    </SectionCard>
    <SecondaryButton label="Saved meal plans" onPress={() => router.push('/saved-meal-plans')} />
    <SecondaryButton label="Your basket" onPress={() => router.navigate('/basket')} />
  </>;
}
