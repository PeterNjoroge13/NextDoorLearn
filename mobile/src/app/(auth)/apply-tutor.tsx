import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowLeft, Camera, Check, CheckCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ErrorNotice, Field, Screen } from "@/components/ui";
import { request } from "@/lib/api";
import { colors, spacing, typography } from "@/theme";

const modes = ["online", "in-person", "both"];
function CheckRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={15} color={colors.white} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}
export default function ApplyTutorScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    subjects: "",
    education: "",
    experience: "",
    motivation: "",
    availability: "",
    tutoringMode: "online",
    hourlyRate: "0",
  });
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [consent, setConsent] = useState({
    adult: false,
    legal: false,
    safety: false,
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return setError(
        "Photo access is needed to choose your required tutor profile picture.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };
  const submit = async () => {
    const rate = Number(form.hourlyRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 25)
      return setError("Tutor rates must be between $0 and $25 per hour.");
    if (!photo)
      return setError(
        "A clear profile picture is required for tutor safety and trust.",
      );
    if (!consent.adult || !consent.legal || !consent.safety)
      return setError("Confirm the age, legal, and safety requirements.");
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append("isAdult", String(consent.adult));
      body.append("termsAccepted", String(consent.legal));
      body.append("privacyAccepted", String(consent.legal));
      body.append("safetyAccepted", String(consent.safety));
      body.append("profilePicture", {
        uri: photo,
        name: "tutor-profile.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      await request("/community/tutor-applications", {
        method: "POST",
        authenticated: false,
        body,
      });
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit application");
    } finally {
      setLoading(false);
    }
  };
  if (complete)
    return (
      <Screen>
        <View style={styles.successIcon}>
          <CheckCircle2 size={34} color={colors.brand} />
        </View>
        <Text style={styles.title}>Application received.</Text>
        <Text style={styles.copy}>
          We’ll review your experience, availability, and community fit.
          Approved tutors receive a secure email invitation to activate their
          account.
        </Text>
        <Button
          label="Return home"
          onPress={() => router.replace("/(auth)/welcome")}
        />
      </Screen>
    );
  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>VOLUNTEER OR LOW-COST TUTORING</Text>
        <Text style={styles.title}>
          Help a student feel less alone in a hard class.
        </Text>
        <Text style={styles.copy}>
          Every tutor is reviewed before joining. Tell us who you are and how
          you hope to help.
        </Text>
      </View>
      {error ? <ErrorNotice message={error} /> : null}
      <Pressable style={styles.photoPicker} onPress={choosePhoto}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <View style={styles.photoEmpty}>
            <Camera size={28} color={colors.brand} />
            <Text style={styles.photoTitle}>Add required profile picture</Text>
            <Text style={styles.photoHelp}>
              A clear, recent headshot helps students and families know who they
              are meeting.
            </Text>
          </View>
        )}
      </Pressable>
      <Field
        label="Full name"
        value={form.name}
        onChangeText={(v) => set("name", v)}
      />
      <Field
        label="Email"
        value={form.email}
        onChangeText={(v) => set("email", v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field
        label="Phone"
        value={form.phone}
        onChangeText={(v) => set("phone", v)}
        keyboardType="phone-pad"
      />
      <Field
        label="Location"
        value={form.location}
        onChangeText={(v) => set("location", v)}
        placeholder="City, state"
      />
      <Field
        label="Subjects"
        value={form.subjects}
        onChangeText={(v) => set("subjects", v)}
        placeholder="Math, Biology, Python"
      />
      <Field
        label="Education"
        value={form.education}
        onChangeText={(v) => set("education", v)}
        multiline
      />
      <Field
        label="Teaching or mentoring experience"
        value={form.experience}
        onChangeText={(v) => set("experience", v)}
        multiline
      />
      <Field
        label="Why do you want to tutor?"
        value={form.motivation}
        onChangeText={(v) => set("motivation", v)}
        multiline
      />
      <Field
        label="Typical availability"
        value={form.availability}
        onChangeText={(v) => set("availability", v)}
        multiline
      />
      <Text style={styles.label}>Tutoring format</Text>
      <View style={styles.modes}>
        {modes.map((mode) => (
          <Pressable
            key={mode}
            onPress={() => set("tutoringMode", mode)}
            style={[
              styles.mode,
              form.tutoringMode === mode && styles.modeActive,
            ]}
          >
            <Text
              style={[
                styles.modeText,
                form.tutoringMode === mode && styles.modeTextActive,
              ]}
            >
              {mode === "both"
                ? "Both"
                : mode === "online"
                  ? "Online"
                  : "In person"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Hourly rate (0 for volunteer, $25 maximum)"
        value={form.hourlyRate}
        onChangeText={(v) => set("hourlyRate", v)}
        keyboardType="decimal-pad"
      />
      <CheckRow
        checked={consent.adult}
        onPress={() =>
          setConsent((current) => ({ ...current, adult: !current.adult }))
        }
        label="I confirm that I am at least 18 years old."
      />
      <CheckRow
        checked={consent.legal}
        onPress={() =>
          setConsent((current) => ({ ...current, legal: !current.legal }))
        }
        label="I agree to the Terms of Service and acknowledge the Privacy Policy."
      />
      <View style={styles.links}>
        <Pressable
          onPress={() => Linking.openURL("https://nextdoorlearn.com/terms")}
        >
          <Text style={styles.link}>Read terms</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL("https://nextdoorlearn.com/privacy")}
        >
          <Text style={styles.link}>Read privacy</Text>
        </Pressable>
      </View>
      <CheckRow
        checked={consent.safety}
        onPress={() =>
          setConsent((current) => ({ ...current, safety: !current.safety }))
        }
        label="I agree to the Tutor Code of Conduct and Safety Guidelines."
      />
      <Pressable
        onPress={() => Linking.openURL("https://nextdoorlearn.com/guidelines")}
      >
        <Text style={styles.link}>Read safety guidelines</Text>
      </Pressable>
      <Button
        label="Submit tutor application"
        onPress={submit}
        loading={loading}
        disabled={
          !form.name ||
          !form.email ||
          !form.subjects ||
          !form.motivation ||
          !photo ||
          !consent.adult ||
          !consent.legal ||
          !consent.safety
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: { height: 44, justifyContent: "center" },
  heading: { gap: spacing.sm },
  eyebrow: { color: colors.coral, fontFamily: typography.bold, fontSize: 12 },
  title: {
    color: colors.ink,
    fontFamily: typography.bold,
    fontSize: 31,
    lineHeight: 37,
  },
  copy: {
    color: colors.muted,
    fontFamily: typography.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  photoPicker: {
    borderWidth: 1,
    borderColor: "#BFD7D2",
    borderStyle: "dashed",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceTint,
  },
  photo: { width: "100%", aspectRatio: 1.7 },
  photoEmpty: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  photoTitle: { color: colors.ink, fontFamily: typography.bold, fontSize: 16 },
  photoHelp: {
    color: colors.muted,
    fontFamily: typography.regular,
    textAlign: "center",
    lineHeight: 20,
  },
  label: { color: colors.ink, fontFamily: typography.medium, fontSize: 13 },
  modes: { flexDirection: "row", gap: spacing.sm },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  modeActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  modeText: {
    color: colors.muted,
    fontFamily: typography.medium,
    fontSize: 13,
  },
  modeTextActive: { color: colors.brandStrong },
  successIcon: {
    marginTop: 70,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  links: { flexDirection: "row", gap: spacing.lg, marginTop: -spacing.sm },
  link: {
    color: colors.brandStrong,
    fontFamily: typography.bold,
    fontSize: 13,
  },
});
