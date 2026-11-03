import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import { t } from '../services/i18n';
import { colors, spacing, ui } from '../lib/theme';

/** A screen that fails to render used to close the app without a word: in a release build an
 *  unhandled error is fatal, and there is no developer overlay to read. Here it stays inside the
 *  app and says what happened, so a fault can be reported instead of guessed at. Everything
 *  entered is already on the device; only the screen is gone. */
const lines = (text: string | null | undefined, count: number) =>
  (text ?? '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, count).join('\n');
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const stack = error instanceof Error ? lines(error.stack, 8) : '';
    return { message: stack ? `${message}\n\n${stack}` : message };
  }
  /** Which screen it was is half the answer, so the component trail goes on screen too. */
  componentDidCatch(_error: Error, info: ErrorInfo) {
    const trail = lines(info.componentStack, 8);
    if (trail) this.setState(state => ({ message: `${state.message}\n\n${trail}` }));
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
