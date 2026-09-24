import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export default function TermsPage() {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Terms of Service</Text>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last Updated: January 2024</Text>

        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Welcome to POS System. By using our Point of Sale system, you agree to be bound by these Terms of Service.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          By creating an account, using our services, or accessing our platform, you agree to comply with and be bound by these Terms of Service.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>2. Description of Service</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          POS System provides a comprehensive Point of Sale solution that includes sales processing, inventory management, customer relationship management, and reporting tools.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>3. User Accounts</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You are responsible for maintaining the security of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>4. Payments and Subscriptions</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Some features of our service may require payment. You agree to pay all fees associated with your chosen subscription plan. Fees are non-refundable except as required by law.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>5. Intellectual Property</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          All content, features, and functionality of our platform are owned by POS System and are protected by intellectual property laws.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>6. Limitation of Liability</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          POS System shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>7. Termination</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may terminate or suspend your account immediately, without prior notice, for any reason, including without limitation if you breach these Terms.
        </Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>8. Contact Us</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you have any questions about these Terms, please contact us at legal@pos-system.com.
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
