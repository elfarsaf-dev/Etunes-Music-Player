import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors, useRadius } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";

type Mode = "register" | "key";

const PASSWORD_MIN_LEN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, setApiKey } = useAuth();

  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const trimmedEmail = email.trim();
  const trimmedKey = keyInput.trim();

  const emailError = useMemo(() => {
    if (!submitted && !trimmedEmail) return null;
    if (!trimmedEmail) return "Email wajib diisi.";
    if (!EMAIL_RE.test(trimmedEmail)) return "Format email tidak valid.";
    return null;
  }, [trimmedEmail, submitted]);

  const passwordError = useMemo(() => {
    if (!submitted && !password) return null;
    if (!password) return "Password wajib diisi.";
    if (password.length < PASSWORD_MIN_LEN)
      return `Password minimal ${PASSWORD_MIN_LEN} karakter.`;
    return null;
  }, [password, submitted]);

  const keyError = useMemo(() => {
    if (!submitted && !trimmedKey) return null;
    if (!trimmedKey) return "API key wajib diisi.";
    if (trimmedKey.length < 8) return "API key terlalu pendek.";
    return null;
  }, [trimmedKey, submitted]);

  const formInvalid =
    mode === "register" ? !!(emailError || passwordError) : !!keyError;

  const handleSubmit = async () => {
    setSubmitted(true);
    setError(null);

    if (mode === "register") {
      if (emailError || passwordError) return;
    } else if (keyError) {
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        await register(trimmedEmail, password);
      } else {
        await setApiKey(trimmedKey);
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Terjadi kesalahan. Coba lagi.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSubmitted(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd, colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View
              style={[
                styles.logo,
                { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22 },
              ]}
            >
              <Feather name="music" size={32} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>etunes</Text>
            <Text style={styles.brandSub}>
              Stream the world. Play your library. One quiet place for music.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cardElevated,
                borderRadius: radius * 1.4,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.tabs}>
              <Pressable
                onPress={() => switchMode("register")}
                style={[
                  styles.tab,
                  mode === "register" && {
                    backgroundColor: colors.background,
                    borderRadius: radius,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        mode === "register"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Buat akun
                </Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode("key")}
                style={[
                  styles.tab,
                  mode === "key" && {
                    backgroundColor: colors.background,
                    borderRadius: radius,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        mode === "key"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Punya API key
                </Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <View style={styles.form}>
                <Field
                  icon="mail"
                  label="Email"
                  placeholder="kamu@email.com"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (error) setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  errorText={emailError}
                />
                <Field
                  icon="lock"
                  label="Password"
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secure={!showPassword}
                  rightIcon={showPassword ? "eye-off" : "eye"}
                  onRightIconPress={() => setShowPassword((v) => !v)}
                  errorText={passwordError}
                  helperText={
                    !passwordError
                      ? `Minimal ${PASSWORD_MIN_LEN} karakter, kombinasi huruf & angka lebih aman.`
                      : undefined
                  }
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Field
                  icon="key"
                  label="API key"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={keyInput}
                  onChangeText={(t) => {
                    setKeyInput(t);
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                  monospace
                  errorText={keyError}
                  helperText={
                    !keyError
                      ? "Pakai API key yang kamu dapat saat daftar."
                      : undefined
                  }
                />
              </View>
            )}

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.destructive + "20",
                    borderColor: colors.destructive + "55",
                    borderRadius: radius,
                  },
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={colors.destructive}
                />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={loading || (submitted && formInvalid)}
              style={({ pressed }) => [
                styles.submit,
                {
                  borderRadius: radius,
                  opacity:
                    pressed || loading || (submitted && formInvalid) ? 0.7 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
              />
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "register" ? "Buat akun" : "Masuk"}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.fineprint, { color: colors.mutedForeground }]}>
              Akun gratis dapat 15 stream per hari.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon,
  label,
  placeholder,
  value,
  onChangeText,
  secure,
  keyboardType,
  autoCapitalize,
  monospace,
  errorText,
  helperText,
  rightIcon,
  onRightIconPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences";
  monospace?: boolean;
  errorText?: string | null;
  helperText?: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}) {
  const colors = useColors();
  const radius = useRadius();
  const hasError = !!errorText;
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.muted,
            borderRadius: radius,
            borderColor: hasError ? colors.destructive : "transparent",
            borderWidth: hasError ? 1 : 0,
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={hasError ? colors.destructive : colors.mutedForeground}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: monospace
                ? Platform.select({ ios: "Menlo", android: "monospace" })
                : "Inter_500Medium",
            },
          ]}
        />
        {rightIcon && onRightIconPress ? (
          <Pressable onPress={onRightIconPress} hitSlop={10}>
            <Feather name={rightIcon} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {errorText ? (
        <Text style={[styles.fieldHint, { color: colors.destructive }]}>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 28 },
  brand: { alignItems: "center", gap: 10 },
  logo: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 38,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  brandSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    backgroundColor: "transparent",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  form: { gap: 12 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  fieldHint: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  submit: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 4,
  },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  fineprint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
