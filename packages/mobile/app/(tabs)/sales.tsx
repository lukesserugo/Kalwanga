import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { apiService } from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/helpers";
import type { Sale } from "@pos/shared/types";

export default function SalesScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "today" | "week" | "month">("all");

  const loadSales = useCallback(async () => {
    try {
      const response = await apiService.get<Sale[]>("/sales", {
        params: {
          businessUnitId: "default",
          limit: 50,
        },
      });
      setSales(response.data ?? []);
    } catch (error) {
      console.error("Error loading sales:", error);
      showToast("Failed to load sales", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales();
  }, [loadSales]);

  const filterSales = (sales: Sale[]) => {
    const filtered = sales.filter((sale) => {
      const search = searchQuery.toLowerCase();
      return (
        sale.receiptNumber.toLowerCase().includes(search) ||
        sale.customer?.firstName?.toLowerCase().includes(search) ||
        sale.customer?.lastName?.toLowerCase().includes(search)
      );
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    switch (selectedFilter) {
      case "today":
        return filtered.filter((sale) => new Date(sale.createdAt) >= today);
      case "week":
        return filtered.filter((sale) => new Date(sale.createdAt) >= weekAgo);
      case "month":
        return filtered.filter((sale) => new Date(sale.createdAt) >= monthAgo);
      default:
        return filtered;
    }
  };

  const filteredSales = filterSales(sales);
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

  const renderItem = ({ item }: { item: Sale }) => (
    <TouchableOpacity
      style={[styles.saleCard, { backgroundColor: colors.card }]}
      onPress={() => showToast(`Sale ${item.receiptNumber} details`, "info")}
    >
      <View style={styles.saleHeader}>
        <Text style={[styles.saleReceipt, { color: colors.text }]}>
          #{item.receiptNumber}
        </Text>
        <Text style={[styles.saleTotal, { color: colors.primary }]}>
          {formatCurrency(item.total)}
        </Text>
      </View>

      <View style={styles.saleDetails}>
        <Text style={[styles.saleDate, { color: colors.textSecondary }]}>
          {formatDate(item.createdAt)}
        </Text>
        <Text style={[styles.saleCustomer, { color: colors.textSecondary }]}>
          {item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : "Guest"}
        </Text>
      </View>

      <View style={[styles.saleFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.saleItems, { color: colors.textSecondary }]}>
          {item.items?.length || 0} items
        </Text>
        <Text style={[styles.saleStatus, { color: colors.success }]}>
          {item.status || "Completed"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sales</Text>
        <Text style={[styles.headerTotal, { color: colors.primary }]}>
          {formatCurrency(totalRevenue)}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search sales..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {(["all", "today", "week", "month"] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              { backgroundColor: selectedFilter === filter ? colors.primary : colors.card },
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                { color: selectedFilter === filter ? "#fff" : colors.text },
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sales List */}
      <FlatList
        data={filteredSales}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No sales found
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  headerTotal: { fontSize: 18, fontWeight: "600" },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 16 },
  filterContainer: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: "500" },
  list: { padding: 16 },
  saleCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  saleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  saleReceipt: { fontSize: 15, fontWeight: "600" },
  saleTotal: { fontSize: 16, fontWeight: "bold" },
  saleDetails: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  saleDate: { fontSize: 13 },
  saleCustomer: { fontSize: 13 },
  saleFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  saleItems: { fontSize: 13 },
  saleStatus: { fontSize: 13, fontWeight: "500" },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 16, marginTop: 16 },
});
