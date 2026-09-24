import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export default function FeaturesPage() {
  const { colors } = useTheme();

  const features = [
    { icon: "cart-outline", title: "Point of Sale", desc: "Fast and intuitive POS interface for processing sales quickly with barcode scanning and customer management." },
    { icon: "cube-outline", title: "Inventory Management", desc: "Track stock levels, manage products, get low stock alerts, and handle multiple business units." },
    { icon: "people-outline", title: "Customer Management", desc: "Build customer relationships with loyalty programs, purchase history, and personalized service." },
    { icon: "stats-chart-outline", title: "Sales Analytics", desc: "Comprehensive reports and analytics to understand your business performance." },
    { icon: "person-add-outline", title: "Multi-User Support", desc: "Role-based access control for staff management with different permission levels." },
    { icon: "card-outline", title: "Payment Processing", desc: "Accept multiple payment methods including cash, credit/debit cards, and mobile money." },
    { icon: "sync-outline", title: "Real-time Sync", desc: "All data syncs in real-time across all devices, ensuring your team always has the latest information." },
    { icon: "wifi-outline", title: "Offline Mode", desc: "Continue processing sales even without internet connection. Data syncs automatically when back online." },
    { icon: "gift-outline", title: "Gift Cards & Loyalty", desc: "Increase customer retention with gift cards and loyalty programs that reward repeat business." },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Features</Text>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Everything You Need to Run Your Business</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          From sales to inventory to customer management, our POS system has all the features you need.
        </Text>
      </View>

      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={[styles.featureItem, { backgroundColor: colors.card }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={feature.icon as any} size={28} color={colors.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.ctaButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(auth)/sign-up")}
      >
        <Text style={styles.ctaButtonText}>Get Started Today</Text>
      </TouchableOpacity>
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
    lineHeight: 24,
  },
  featuresList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
