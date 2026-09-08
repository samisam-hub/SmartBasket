import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { BasketWarning, SelectionReason } from '../types/basket';
import { colors, ui } from '../lib/theme';

export function BasketProductHeading({ name, notes, report }: { name: string; notes: BasketWarning[]; report: SelectionReason[] }) {
  const [expanded, setExpanded] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[ui.subheading, { flex: 1 }]}>{name}</Text>
      <View>
        {!!report.length && <Pressable onPress={() => setReportExpanded(value => !value)}
          accessibilityRole="button" accessibilityLabel={`Selection report for ${name}`}
          accessibilityHint="Show or hide product matching and quantity adjustment details" accessibilityState={{ expanded: reportExpanded }}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="file-text" size={20} color={colors.muted} />
        </Pressable>}
        {!!notes.length && <Pressable onPress={() => setExpanded(value => !value)}
          accessibilityRole="button" accessibilityLabel={`Dietary information unverified for ${name}`}
          accessibilityHint="Show or hide the product's dietary notes" accessibilityState={{ expanded }}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="alert-triangle" size={20} color={colors.warning} />
        </Pressable>}
      </View>
    </View>
    {reportExpanded && report.map(reason => <Text key={reason.code} style={ui.small}>{reason.detail}</Text>)}
    {expanded && notes.map(note => <Text key={note.code} style={ui.small}>{note.message}</Text>)}
  </View>;
}
