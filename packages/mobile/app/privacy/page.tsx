import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export default function PrivacyPage() {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy Policy</Text>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last Updated: January 2024</Text>

        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          At POS System, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Point of Sale system.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Information We Collect</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We collect information that you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include your name, email address, phone number, and business information.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>How We Use Your Information</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We use the information we collect to provide, maintain, and improve our services, to process transactions, to send you technical notices and support messages, and to communicate with you about products, services, and promotions.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Data Security</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We implement appropriate technical and organizational measures to protect the security of your personal information. However, please note that no method of transmission over the internet or method of electronic storage is 100% secure.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Your Rights</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You have the right to access, correct, or delete your personal information at any time. You may also object to the processing of your information or request that we restrict the processing of your information.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Contact Us</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you have any questions about this Privacy Policy, please contact us at privacy@pos-system.com.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: 20,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
});
