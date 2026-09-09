import Feather from "@expo/vector-icons/Feather";
import {StateIllustration,type IllustrationKind} from './BrandAssets';
import type { ComponentProps, PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography, ui } from "@/lib/theme";

type Icon = ComponentProps<typeof Feather>["name"];
type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};
export function Screen({
  children,
  top = true,
  bottom = false,
  compact = false,
}: PropsWithChildren<{ top?: boolean; bottom?: boolean; compact?: boolean }>) {
  return (
    <SafeAreaView
      style={ui.page}
      edges={[
        ...(top ? ["top" as const] : []),
        "left",
        "right",
        ...(bottom ? ["bottom" as const] : []),
      ]}
    >
      <KeyboardAvoidingView
        style={ui.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[ui.content, compact && { padding: 16, gap: 12 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  label,
  onPress,
  disabled,
  loading,
  secondary = false,
  text = false,
}: ButtonProps & { secondary?: boolean; text?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        text && styles.textButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={secondary || text ? colors.primary : colors.onPrimary}
        />
      )}
      <Text
        style={[
          styles.buttonText,
          (secondary || text) && { color: colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export const PrimaryButton = (props: ButtonProps) => <Button {...props} />;
export const SecondaryButton = (props: ButtonProps) => (
  <Button {...props} secondary />
);
export const TextButton = (props: ButtonProps) => <Button {...props} text />;
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}
export function ErrorMessage({ message }: { message?: string | null }) {
  return message ? (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.error}
    >
      {message}
    </Text>
  ) : null;
}
export function SuccessMessage({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.success}>
      {message}
    </Text>
  );
}
export function TextInput({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <NativeInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          props.editable === false && styles.disabled,
          !!error && { borderColor: colors.error },
          props.style,
        ]}
      />
      {hint && <Text style={ui.small}>{hint}</Text>}
      <ErrorMessage message={error} />
    </View>
  );
}
export function SearchInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.search}>
      <Feather name="search" size={20} color={colors.muted} />
      <NativeInput
        style={styles.searchText}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Search products"
        placeholder="Search foods or brands"
        maxLength={120}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value ? (
        <IconButton
          label="Clear search"
          icon="x"
          onPress={() => onChangeText("")}
        />
      ) : null}
    </View>
  );
}
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={ui.stack}>
      <Text style={styles.label}>{label}</Text>
      <View style={ui.row}>
        <IconButton
          label={`Decrease ${label}`}
          icon="minus"
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
        />
        <Text style={ui.heading} accessibilityLiveRegion="polite">
          {value}
        </Text>
        <IconButton
          label={`Increase ${label}`}
          icon="plus"
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + 1))}
        />
      </View>
    </View>
  );
}
export function SelectionChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selection,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Feather
        name={selected ? "check-circle" : "circle"}
        size={18}
        color={selected ? colors.primary : colors.muted}
      />
      <Text
        style={[
          ui.small,
          selected && { color: colors.primary, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function PreferenceChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}
export function InfoChip({ label }: { label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.background }]}>
      <Text style={ui.caption}>{label}</Text>
    </View>
  );
}
export function Chips({ labels }: { labels: readonly string[] }) {
  return (
    <View style={ui.wrap}>
      {labels.map((label) => (
        <PreferenceChip key={label} label={label} />
      ))}
    </View>
  );
}
export function SectionCard({
  children,
  title,
  compact = false,
  pale = false,
}: PropsWithChildren<{ title?: string; compact?: boolean; pale?: boolean }>) {
  return (
    <View style={[ui.card, compact && { padding: 16, gap: 12 }, pale && { backgroundColor: colors.pale }]}>
      {title && <Text style={ui.subheading}>{title}</Text>}
      {children}
    </View>
  );
}
export function InfoCard({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={[ui.card, { backgroundColor: colors.pale }]}>
      <Text style={ui.subheading}>{title}</Text>
      <Text style={ui.body}>{children}</Text>
    </View>
  );
}
export function PreferenceRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.preference}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={ui.small}>{label}</Text>
        <Text style={styles.label}>{value}</Text>
      </View>
      {onEdit && (
        <IconButton icon="edit-2" label={`Edit ${label}`} onPress={onEdit} />
      )}
    </View>
  );
}
export function ProgressIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <View
      style={{ gap: spacing.sm }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      <Text style={ui.caption}>
        Step {current} of {total}
      </Text>
      <View style={styles.track}>
        <View
          style={[styles.progress, { width: `${(current / total) * 100}%` }]}
        />
      </View>
    </View>
  );
}
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <View style={ui.stack}>
      {eyebrow && <Text style={ui.eyebrow}>{eyebrow}</Text>}
      <Text accessibilityRole="header" style={ui.title}>
        {title}
      </Text>
      {subtitle && <Text style={ui.body}>{subtitle}</Text>}
    </View>
  );
}
export function EmptyState({
  title,
  description,
  icon = "shopping-bag",
  children,
  illustration,
}: PropsWithChildren<{ title: string; description: string; icon?: Icon; illustration?:IllustrationKind }>) {
  return (
    <SectionCard>
      <View style={ui.centered}>
        {illustration?<StateIllustration kind={illustration} />:<View style={styles.emptyIcon}>
          <Feather name={icon} size={40} color={colors.primary} />
        </View>}
        <Text style={[ui.heading, { textAlign: "center" }]}>{title}</Text>
        <Text style={[ui.body, { textAlign: "center" }]}>{description}</Text>
      </View>
      {children}
    </SectionCard>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    padding: spacing.lg,
    borderRadius: radii.large,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  textButton: { backgroundColor: colors.background },
  buttonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  disabled: { opacity: 0.5, backgroundColor: colors.disabled },
  pressed: { opacity: 0.72 },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pale,
  },
  label: { ...typography.body, fontWeight: "600", color: colors.ink },
  input: {
    ...typography.body,
    minHeight: 56,
    color: colors.ink,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.large,
  },
  searchText: {
    ...typography.small,
    color: colors.ink,
    flex: 1,
    minHeight: 56,
  },
  selection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 48,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.pale },
  chip: {
    borderRadius: radii.pill,
    backgroundColor: colors.pale,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  preference: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  track: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.pill,
  },
  progress: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  error: {
    ...typography.small,
    color: colors.errorText,
    backgroundColor: colors.errorBackground,
    padding: spacing.md,
    borderRadius: radii.small,
  },
  success: {
    ...typography.small,
    color: colors.successText,
    backgroundColor: colors.successBackground,
    padding: spacing.md,
    borderRadius: radii.small,
  },
  emptyIcon: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.pale,
  },
});
