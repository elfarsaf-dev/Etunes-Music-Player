import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

type Mode = "register" | "login";
type LoginCred = "password" | "key";

export default function AuthScreen() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, login } = useAuth();

  const [mode, setMode] = useState<Mode>("register");
  const [loginCred, setLoginCred] = useState<LoginCred>("password");

  // Shared field state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when register hits USERNAME_TAKEN — used to nudge the user to login.
  const [takenUsername, setTakenUsername] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const u = username.trim();
    const k = keyInput.trim();

    try {
      if (mode === "register") {
        if (!u) return setError("Username wajib diisi.");
        if (!password) return setError("Password wajib diisi.");
        setLoading(true);
        await register(u, password);
      } else if (loginCred === "password") {
        if (!u) return setError("Username wajib diisi.");
        if (!password) return setError("Password wajib diisi.");
        setLoading(true);
        await login({ username: u, password });
      } else {
        // key mode — username opsional
        if (!k) return setError("API key wajib diisi.");
        setLoading(true);
        if (u) await login({ username: u, apiKey: k });
        else await login({ apiKey: k });
      }
      router.replace("/(tabs)");
    } catch (err) {
      // username sudah dipakai → otomatis pindah ke tab Masuk
      if (err instanceof ApiError && err.code === "USERNAME_TAKEN") {
        setTakenUsername(u);
        setMode("login");
        setLoginCred("password");
        setError(null);
        setLoading(false);
        return;
      }
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
    if (next === "register") setTakenUsername(null);
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
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
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
                onPress={() => switchMode("login")}
                style={[
                  styles.tab,
                  mode === "login" && {
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
                        mode === "login"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Masuk
                </Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <View style={styles.form}>
                <Field
                  icon="user"
                  label="Username"
                  placeholder="Pilih username"
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                />
                <Field
                  icon="lock"
                  label="Password"
                  placeholder="Bebas, gak ada batas minimal"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secure={!showPassword}
                  rightIcon={showPassword ? "eye-off" : "eye"}
                  onRightIconPress={() => setShowPassword((v) => !v)}
                  helperText="Pakai apa aja, makin panjang makin aman."
                />
              </View>
            ) : (
              <View style={styles.form}>
                {takenUsername ? (
                  <View
                    style={[
                      styles.noticeBox,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                        borderRadius: radius,
                      },
                    ]}
                  >
                    <Feather
                      name="info"
                      size={16}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[styles.noticeText, { color: colors.foreground }]}
                    >
                      Username{" "}
                      <Text style={{ fontFamily: "Inter_700Bold" }}>
                        {takenUsername}
                      </Text>{" "}
                      udah ada. Masuk pakai password atau API key kamu.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.credPills}>
                  <CredPill
                    active={loginCred === "password"}
                    onPress={() => {
                      setLoginCred("password");
                      setError(null);
                    }}
                    label="Password"
                  />
                  <CredPill
                    active={loginCred === "key"}
                    onPress={() => {
                      setLoginCred("key");
                      setError(null);
                    }}
                    label="API key"
                  />
                </View>

                {loginCred === "password" ? (
                  <>
                    <Field
                      icon="user"
                      label="Username"
                      placeholder="Username kamu"
                      value={username}
                      onChangeText={(t) => {
                        setUsername(t);
                        if (error) setError(null);
                      }}
                      autoCapitalize="none"
                    />
                    <Field
                      icon="lock"
                      label="Password"
                      placeholder="Password kamu"
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (error) setError(null);
                      }}
                      secure={!showPassword}
                      rightIcon={showPassword ? "eye-off" : "eye"}
                      onRightIconPress={() => setShowPassword((v) => !v)}
                    />
                  </>
                ) : (
                  <>
                    <Field
                      icon="user"
                      label="Username (opsional)"
                      placeholder="Boleh kosong kalau lupa"
                      value={username}
                      onChangeText={(t) => {
                        setUsername(t);
                        if (error) setError(null);
                      }}
                      autoCapitalize="none"
                    />
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
                      helperText="Pakai API key yang kamu dapat saat daftar."
                    />
                  </>
                )}
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
              disabled={loading}
              style={({ pressed }) => [
                styles.submit,
                {
                  borderRadius: radius,
                  opacity: pressed || loading ? 0.7 : 1,
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

function CredPill({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.credPill,
        {
          backgroundColor: active ? colors.primary : "transparent",
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primaryForeground : colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
  content: { paddingHorizontal: 22, gap: 22 },
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
  credPills: {
    flexDirection: "row",
    gap: 8,
  },
  credPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
