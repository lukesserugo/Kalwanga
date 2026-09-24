import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useSocket } from "../../hooks/useSocket";
import { apiService } from "../../services/api";
import { formatCurrency, formatDate } from "@pos/shared/utils";
import type { SalesStats, Sale } from "@pos/shared/types";

export default function DashboardScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { socket, isConnected } = useSocket();

  const [stats, setStats] = useState<SalesStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [statsResponse, salesResponse] = await Promise.all([
        apiService.get<SalesStats>("/sales/stats"),
        apiService.get<Sale[]>("/sales?limit=5"),
      ]);
      setStats(statsResponse.data ?? null);
      setRecentSales(salesResponse.data || []);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!socket) return;
    socket.on("new-sale", (sale: Sale) => {
      showToast(`New sale: ${sale.receiptNumber}`, "success");
      loadDashboardData();
    });
    socket.on("low-stock-alert", (data: { productId: string }) => {
      showToast(`Low stock alert: ${data.productId}`, "warning");
    });
    return () => {
      socket.off("new-sale");
      socket.off("low-stock-alert");
    };
  }, [socket, loadDashboardData, showToast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const getInitials = () => {
    if (!user) return "U";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View>
            <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
        </View>
        <View style={[styles.connectionBadge, { backgroundColor: isConnected ? colors.success + "20" : colors.error + "20" }]}>
          <View style={[styles.connectionDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
          <Text style={[styles.connectionText, { color: isConnected ? colors.success : colors.error }]}>
            {isConnected ? "Connected" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {formatCurrency(stats?.totalRevenue || 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Revenue</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats?.totalSales || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sales</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {formatCurrency(stats?.averageTicket || 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg. Ticket</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {recentSales.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Recent Sales</Text>
        </View>
      </View>

      {/* Recent Sales */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Sales</Text>
          <TouchableOpacity onPress={() => showToast("View all sales", "info")}>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentSales.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              No recent sales
            </Text>
          </View>
        ) : (
          recentSales.map((sale) => (
            <TouchableOpacity
              key={sale.id}
              style={[styles.saleItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => showToast(`Sale ${sale.receiptNumber}`, "info")}
            >
              <View>
                <Text style={[styles.saleReceipt, { color: colors.text }]}>
                  #{sale.receiptNumber}
                </Text>
                <Text style={[styles.saleDate, { color: colors.textSecondary }]}>
                  {formatDate(sale.createdAt)}
                </Text>
              </View>
              <Text style={[styles.saleTotal, { color: colors.primary }]}>
                {formatCurrency(sale.total)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  userInfo: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  welcomeText: { fontSize: 13 },
  userName: { fontSize: 16, fontWeight: "600" },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  connectionText: { fontSize: 11, fontWeight: "500" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statCard: {
    width: "46%",
    margin: "2%",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 24, fontWeight: "bold" },
  statLabel: { fontSize: 13, marginTop: 4 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  sectionLink: { fontSize: 14, fontWeight: "500" },
  saleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  saleReceipt: { fontSize: 15, fontWeight: "500" },
  saleDate: { fontSize: 12, marginTop: 2 },
  saleTotal: { fontSize: 16, fontWeight: "600" },
  emptyState: { padding: 40, borderRadius: 12, alignItems: "center" },
  emptyStateText: { fontSize: 14, marginTop: 12 },
});
