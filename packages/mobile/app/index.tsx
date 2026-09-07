import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";

export default function LandingPage() {
  const { colors } = useTheme();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn]);

  const features = [
    { icon: "cart-outline", title: "Point of Sale", desc: "Fast and intuitive POS interface for processing sales quickly with barcode scanning and customer management." },
    { icon: "cube-outline", title: "Inventory Management", desc: "Track stock levels, manage products, and get low stock alerts in real-time." },
    { icon: "people-outline", title: "Team Management", desc: "Manage staff, assign roles, and track performance with ease." },
    { icon: "stats-chart-outline", title: "Sales Analytics", desc: "Get insights with detailed reports and analytics to grow your business." },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation */}
      <View style={[styles.nav, { backgroundColor: colors.background }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>POS System</Text>
        <View style={styles.navButtons}>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={[styles.navLogin, { color: colors.textSecondary }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navSignup, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}
          >
            <Text style={styles.navSignupText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Modern Point of Sale
          <Text style={{ color: colors.primary }}> System</Text>
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Streamline your business with our powerful POS solution. 
          Manage sales, inventory, customers, and staff all in one place.
        </Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity 
            style={[styles.heroPrimaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}
          >
            <Text style={styles.heroPrimaryButtonText}>Start Free Trial</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.heroSecondaryButton, { borderColor: colors.border }]}
            onPress={() => router.push("/features")}
          >
            <Text style={[styles.heroSecondaryButtonText, { color: colors.text }]}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Everything You Need to Run Your Business
        </Text>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View key={index} style={[styles.featureCard, { backgroundColor: colors.card }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={feature.icon as any} size={28} color={colors.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{feature.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA Section */}
      <View style={[styles.ctaSection, { backgroundColor: colors.primary }]}>
        <Text style={styles.ctaTitle}>Ready to Get Started?</Text>
        <Text style={styles.ctaSubtitle}>Join thousands of businesses using our POS system today.</Text>
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={() => router.push("/(auth)/sign-up")}
        >
          <Text style={styles.ctaButtonText}>Create Free Account</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerLogo, { color: colors.primary }]}>POS System</Text>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Modern point of sale solution for businesses of all sizes.
        </Text>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => router.push("/features")}>
            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Features</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/pricing")}>
            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Pricing</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/help")}>
            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/contact")}>
            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Contact</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.footerCopyright, { color: colors.textSecondary }]}>
          © {new Date().getFullYear()} POS System. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLogin: {
    fontSize: 14,
    fontWeight: '500',
  },
  navSignup: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navSignupText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroPrimaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  heroPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  heroSecondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  ctaSection: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 20,
  },
  ctaTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ctaSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerLogo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  footerLink: {
    fontSize: 14,
  },
  footerCopyright: {
    fontSize: 12,
  },
});
