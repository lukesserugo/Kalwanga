import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

export default function HelpPage() {
  const { colors } = useTheme();

  const faqs = [
    { question: "How do I get started with the POS system?", answer: "Simply create an account, set up your business profile, and start adding products. Our onboarding guide will walk you through the process." },
    { question: "Can I use the POS system offline?", answer: "Yes, our POS system works offline. All transactions are stored locally and synced automatically when you reconnect to the internet." },
    { question: "How do I manage inventory?", answer: "You can add products, track stock levels, set reorder points, and receive low stock alerts. Our inventory management system makes it easy to keep track of your products." },
    { question: "What payment methods are supported?", answer: "We support cash, credit/debit cards, mobile money, bank transfers, and gift cards. You can also integrate with popular payment gateways." },
    { question: "How do I add staff members?", answer: "Go to Settings > Users to add staff members. You can assign different roles and permissions to control access." },
    { question: "Can I generate reports?", answer: "Yes, you can generate various reports including sales reports, inventory reports, customer reports, and financial reports." },
    { question: "How do I handle returns and refunds?", answer: "You can process returns and refunds directly from the POS interface. The system will automatically update inventory and customer records." },
    { question: "Is my data secure?", answer: "Yes, we use enterprise-grade security with encryption, secure authentication, and regular backups to protect your data." },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help Center</Text>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>How can we help you?</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Find answers to common questions and get started quickly.
        </Text>
      </View>

      <View style={styles.quickLinks}>
        <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card }]}>
          <Text style={styles.quickLinkIcon}>🚀</Text>
          <Text style={[styles.quickLinkText, { color: colors.text }]}>Getting Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card }]}>
          <Text style={styles.quickLinkIcon}>📦</Text>
          <Text style={[styles.quickLinkText, { color: colors.text }]}>Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card }]}>
          <Text style={styles.quickLinkIcon}>💳</Text>
          <Text style={[styles.quickLinkText, { color: colors.text }]}>Sales & Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card }]}>
          <Text style={styles.quickLinkIcon}>📊</Text>
          <Text style={[styles.quickLinkText, { color: colors.text }]}>Reports</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.faqSection}>
        <Text style={[styles.faqTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
        {faqs.map((faq, index) => (
          <View key={index} style={[styles.faqItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.answer}</Text>
          </View>
        ))}
      </View>

      <View style={styles.contactSupport}>
        <Text style={[styles.supportText, { color: colors.textSecondary }]}>Still have questions?</Text>
        <TouchableOpacity onPress={() => router.push("/contact")}>
          <Text style={[styles.supportLink, { color: colors.primary }]}>Contact Support →</Text>
        </TouchableOpacity>
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
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 16,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  quickLink: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickLinkIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  faqSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  faqItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactSupport: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  supportText: {
    fontSize: 14,
    marginBottom: 4,
  },
  supportLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});
