import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";

export default function SettingsScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { showToast } = useToast();
  const { signOut } = useAuth();

  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    autoSync: true,
    offlineMode: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    showToast(`${key} ${!settings[key] ? 'enabled' : 'disabled'}`, "info");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast("Signed out successfully", "success");
      router.replace("/(auth)/login/login");
    } catch (error) {
      console.error("Error signing out:", error);
      showToast("Failed to sign out", "error");
    }
  };

  const settingsSections = [
    {
      title: "Preferences",
      items: [
        {
          icon: "moon-outline",
          label: "Dark Mode",
          type: "switch",
          value: isDark,
          onPress: toggleTheme,
        },
        {
          icon: "notifications-outline",
          label: "Push Notifications",
          type: "switch",
          value: settings.notifications,
          onPress: () => toggleSetting("notifications"),
        },
        {
          icon: "volume-high-outline",
          label: "Sound Effects",
          type: "switch",
          value: settings.sound,
          onPress: () => toggleSetting("sound"),
        },
      ],
    },
    {
      title: "Data",
      items: [
        {
          icon: "sync-outline",
          label: "Auto Sync",
          type: "switch",
          value: settings.autoSync,
          onPress: () => toggleSetting("autoSync"),
        },
        {
          icon: "wifi-outline",
          label: "Offline Mode",
          type: "switch",
          value: settings.offlineMode,
          onPress: () => toggleSetting("offlineMode"),
        },
        {
          icon: "cloud-download-outline",
          label: "Sync Now",
          type: "button",
          onPress: () => showToast("Syncing data...", "info"),
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          icon: "lock-closed-outline",
          label: "Change Password",
          type: "button",
          onPress: () => showToast("Coming soon", "info"),
        },
        {
          icon: "finger-print-outline",
          label: "Biometric Login",
          type: "button",
          onPress: () => showToast("Coming soon", "info"),
        },
      ],
    },
    {
      title: "About",
      items: [
        {
          icon: "information-circle-outline",
          label: "Version",
          type: "text",
          value: "1.0.0",
        },
        {
          icon: "document-text-outline",
          label: "Terms of Service",
          type: "button",
          onPress: () => showToast("View terms", "info"),
        },
        {
          icon: "shield-checkmark-outline",
          label: "Privacy Policy",
          type: "button",
          onPress: () => showToast("View privacy policy", "info"),
        },
      ],
    },
  ];

  const renderItem = (item: any) => {
    if (item.type === "switch") {
      return (
        <Switch
          value={item.value}
          onValueChange={item.onPress}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      );
    }
    if (item.type === "text") {
      return (
        <Text style={[styles.itemValue, { color: colors.textSecondary }]}>
          {item.value}
        </Text>
      );
    }
    return (
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sign Out Button at top */}
      <TouchableOpacity
        style={[styles.signOutButton, { backgroundColor: colors.error + '10' }]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={24} color={colors.error} />
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>

      {settingsSections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {section.title}
          </Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.settingItem,
                  { 
                    borderBottomColor: colors.border,
                    borderBottomWidth: itemIndex === section.items.length - 1 ? 0 : 1,
                  }
                ]}
                onPress={item.onPress}
                disabled={item.type === "text"}
              >
                <View style={styles.settingItemLeft}>
                  <Ionicons name={item.icon as any} size={22} color={colors.text} />
                  <Text style={[styles.settingItemLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
                </View>
                {renderItem(item)}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={[styles.version, { color: colors.textSecondary }]}>
        Version 1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingItemLabel: {
    fontSize: 16,
  },
  itemValue: {
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
});
