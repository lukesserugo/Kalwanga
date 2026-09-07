import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

export default function PricingPage() {
  const { colors } = useTheme();

  const plans = [
    {
      name: "Starter",
      price: "$29",
      period: "/month",
      features: ["1 User", "100 Products", "Basic Reports", "Cash Payments", "Email Support"],
      popular: false,
    },
    {
      name: "Professional",
      price: "$79",
      period: "/month",
      features: ["5 Users", "Unlimited Products", "Advanced Reports", "All Payment Methods", "Priority Support", "Inventory Management", "Customer Management"],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/month",
      features: ["Unlimited Users", "Unlimited Products", "Custom Reports", "All Payment Methods", "24/7 Priority Support", "Advanced Inventory", "Custom Integrations", "Dedicated Account Manager"],
      popular: false,
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pricing</Text>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Simple, Transparent Pricing</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Choose the plan that works best for your business.
        </Text>
      </View>

      {plans.map((plan, index) => (
        <View key={index} style={[styles.planCard, { backgroundColor: colors.card, borderColor: plan.popular ? colors.primary : 'transparent' }]}>
          {plan.popular && (
            <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={[styles.planPrice, { color: colors.text }]}>{plan.price}</Text>
            <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{plan.period}</Text>
          </View>
          {plan.features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>{feature}</Text>
            </View>
          ))}
          <TouchableOpacity 
            style={[styles.selectButton, { backgroundColor: plan.popular ? colors.primary : colors.card, borderColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}
          >
            <Text style={[styles.selectButtonText, { color: plan.popular ? '#fff' : colors.primary }]}>
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.faqSection}>
        <Text style={[styles.faqTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
        <View style={[styles.faqItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.faqQuestion, { color: colors.text }]}>Can I upgrade my plan later?</Text>
          <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>Yes, you can upgrade or downgrade at any time.</Text>
        </View>
        <View style={[styles.faqItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.faqQuestion, { color: colors.text }]}>Is there a free trial?</Text>
          <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>Yes, we offer a 14-day free trial on all plans.</Text>
        </View>
        <View style={[styles.faqItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.faqQuestion, { color: colors.text }]}>What payment methods do you accept?</Text>
          <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>We accept all major credit cards and PayPal.</Text>
        </View>
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
    paddingVertical: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
  },
  planCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  planPeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
  },
  selectButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
