import { Component, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import { t } from '../services/i18n';
import { colors, spacing, ui } from '../lib/theme';

/** A screen that fails to render used to close the app without a word: in a release build an
 *  unhandled error is fatal, and there is no developer overlay to read. Here it stays inside the
 *  app and says what happened, so a fault can be reported instead of guessed at. Everything
 *  entered is already on the device; only the screen is gone. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
  render() {
    if (this.state.message === null) return this.props.children;
    return <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }}>
      <Text accessibilityRole="header" style={ui.title}>{t('crash.title')}</Text>
      <Text style={ui.body}>{t('crash.body')}</Text>
      <ScrollView style={{ maxHeight: 220 }}>
        <Text style={ui.small} selectable>{this.state.message}</Text>
      </ScrollView>
      <PrimaryButton label={t('crash.again')} onPress={() => this.setState({ message: null })} />
    </View>;
  }
}
