import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { router } from "expo-router";
import { formatDate } from "../../utils/helpers";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              showToast("Signed out successfully", "success");
              router.replace("/(auth)/login");
            } catch (error) {
              console.error("Error signing out:", error);
              showToast("Failed to sign out", "error");
            }
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!user) return "U";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const menuItems = [
    {
      icon: "person-outline",
      label: "Personal Information",
      onPress: () => showToast("Coming soon", "info"),
    },
    {
      icon: "business-outline",
      label: "Business Units",
      onPress: () => showToast("Coming soon", "info"),
    },
    {
      icon: "card-outline",
      label: "Payment Methods",
      onPress: () => showToast("Coming soon", "info"),
    },
    {
      icon: "help-circle-outline",
      label: "Help & Support",
      onPress: () => showToast("Contact support: support@pos-system.com", "info"),
    },
    {
      icon: "log-out-outline",
      label: "Sign Out",
      onPress: handleSignOut,
      danger: true,
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {user?.emailAddresses?.[0]?.emailAddress || "No email"}
        </Text>
        <View style={styles.userMeta}>
          <View style={styles.userMetaItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.userMetaText, { color: colors.textSecondary }]}>
              Joined {formatDate(user?.createdAt || new Date())}
            </Text>
          </View>
          <View style={styles.userMetaItem}>
            <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.userMetaText, { color: colors.textSecondary }]}>
              {String(user?.publicMetadata?.role || "Employee")}
            </Text>
          </View>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              { 
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
              index === menuItems.length - 1 && styles.menuItemLast,
            ]}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons 
                name={item.icon as any} 
                size={22} 
                color={item.danger ? colors.error : colors.text} 
              />
              <Text 
                style={[
                  styles.menuItemLabel, 
                  { 
                    color: item.danger ? colors.error : colors.text 
                  }
                ]}
              >
                {item.label}
              </Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Version */}
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
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 12,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  userMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userMetaText: {
    fontSize: 13,
  },
  menu: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 16,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
});
