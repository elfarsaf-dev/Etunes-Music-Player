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

type Mode = "register" | "key";

export default function AuthScreen() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, setApiKey } = useAuth();

  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (!email.trim() || !password.trim()) {
          setError("Email and password required");
          return;
        }
        await register(email.trim(), password);
      } else {
        if (!keyInput.trim()) {
          setError("API key required");
          return;
        }
        await setApiKey(keyInput.trim());
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
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
                onPress={() => setMode("register")}
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
                  Create account
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("key")}
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
                  I have a key
                </Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <View style={styles.form}>
                <Field
                  icon="mail"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  icon="lock"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secure
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Field
                  icon="key"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={keyInput}
                  onChangeText={setKeyInput}
                  autoCapitalize="none"
                  monospace
                />
                <Text
                  style={[styles.helper, { color: colors.mutedForeground }]}
                >
                  Use the API key you received when you registered.
                </Text>
              </View>
            )}

            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submit,
                {
                  borderRadius: radius,
                  opacity: pressed || loading ? 0.85 : 1,
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
                  {mode === "register" ? "Create account" : "Continue"}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.fineprint, { color: colors.mutedForeground }]}>
              Free accounts include 15 streams per day.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secure,
  keyboardType,
  autoCapitalize,
  monospace,
}: {
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences";
  monospace?: boolean;
}) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <View
      style={[
        styles.field,
        { backgroundColor: colors.muted, borderRadius: radius },
      ]}
    >
      <Feather name={icon} size={18} color={colors.mutedForeground} />
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
  tabs: { flexDirection: "row", gap: 6, padding: 4, backgroundColor: "transparent" },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  form: { gap: 10 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  helper: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -2 },
  submit: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 4,
  },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  error: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  fineprint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
