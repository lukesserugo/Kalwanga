import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { apiService } from "../../services/api";
import { formatCurrency } from "../../utils/helpers";
import type { Inventory, Product } from "@pos/shared/types";

export default function InventoryScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuantity, setEditQuantity] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const response = await apiService.get<Inventory[]>("/inventory", {
        params: {
          businessUnitId: "default",
          lowStock: showLowStock || undefined,
        },
      });
      setInventory(response.data ?? []);
    } catch (error) {
      console.error("Error loading inventory:", error);
      showToast("Failed to load inventory", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showLowStock, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInventory();
  }, [loadInventory]);

  const filteredInventory = inventory.filter((item) => {
    const search = searchQuery.toLowerCase();
    return (
      item.product.name.toLowerCase().includes(search) ||
      item.product.sku.toLowerCase().includes(search)
    );
  });

  const handleUpdateStock = async () => {
    if (!selectedItem) return;
    const quantity = parseInt(editQuantity);
    if (isNaN(quantity)) {
      showToast("Please enter a valid number", "warning");
      return;
    }

    try {
      await apiService.put(`/inventory/${selectedItem.productId}/stock`, {
        quantity,
        transactionType: "ADJUSTMENT",
        notes: "Manual stock adjustment",
        businessUnitId: selectedItem.businessUnitId,
      });
      showToast("Stock updated successfully", "success");
      setShowEditModal(false);
      loadInventory();
    } catch (error) {
      console.error("Error updating stock:", error);
      showToast("Failed to update stock", "error");
    }
  };

  const getStockStatus = (item: Inventory) => {
    if (item.quantity === 0) return { label: "Out of Stock", color: colors.error };
    if (item.quantity <= item.reorderPoint) return { label: "Low Stock", color: colors.warning };
    return { label: "In Stock", color: colors.success };
  };

  const renderItem = ({ item }: { item: Inventory }) => {
    const status = getStockStatus(item);
    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.card }]}
        onPress={() => {
          setSelectedItem(item);
          setEditQuantity(item.quantity.toString());
          setShowEditModal(true);
        }}
      >
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.product.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.itemDetails}>
          <Text style={[styles.itemSku, { color: colors.textSecondary }]}>
            SKU: {item.product.sku}
          </Text>
          <Text style={[styles.itemPrice, { color: colors.primary }]}>
            {formatCurrency(item.product.unitPrice)}
          </Text>
        </View>

        <View style={styles.itemFooter}>
          <Text style={[styles.itemStock, { color: colors.text }]}>
            Stock:{" "}
            <Text
              style={[
                styles.itemStockValue,
                { color: item.quantity <= item.reorderPoint ? colors.error : colors.text },
              ]}
            >
              {item.quantity}
            </Text>
          </Text>
          <Text style={[styles.itemReorder, { color: colors.textSecondary }]}>
            Reorder at: {item.reorderPoint}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Inventory</Text>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: showLowStock ? colors.primary : colors.card }]}
          onPress={() => setShowLowStock(!showLowStock)}
        >
          <Ionicons
            name="filter"
            size={20}
            color={showLowStock ? "#fff" : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search inventory..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {inventory.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Items</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.error }]}>
            {inventory.filter((i) => i.quantity === 0).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Out of Stock</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {inventory.filter((i) => i.quantity > 0 && i.quantity <= i.reorderPoint).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
        </View>
      </View>

      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {showLowStock ? "No low stock items" : "No inventory items found"}
            </Text>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Update Stock</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <>
                <Text style={[styles.modalProductName, { color: colors.text }]}>
                  {selectedItem.product.name}
                </Text>
                <Text style={[styles.modalProductSku, { color: colors.textSecondary }]}>
                  SKU: {selectedItem.product.sku}
                </Text>

                <View style={styles.modalInputContainer}>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>
                    Current Stock: {selectedItem.quantity}
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        color: colors.text,
                      },
                    ]}
                    placeholder="New quantity"
                    placeholderTextColor={colors.textSecondary}
                    value={editQuantity}
                    onChangeText={setEditQuantity}
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleUpdateStock}
                >
                  <Text style={styles.modalButtonText}>Update Stock</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  filterButton: { padding: 8, borderRadius: 8 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 16 },
  statsContainer: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  statCard: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4 },
  list: { padding: 16 },
  itemCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemName: { fontSize: 16, fontWeight: "500", flex: 1, marginRight: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: "500" },
  itemDetails: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  itemSku: { fontSize: 13 },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  itemFooter: { flexDirection: "row", justifyContent: "space-between" },
  itemStock: { fontSize: 13 },
  itemStockValue: { fontWeight: "600" },
  itemReorder: { fontSize: 13 },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 16, marginTop: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: { width: "90%", padding: 20, borderRadius: 12 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalProductName: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  modalProductSku: { fontSize: 14, marginBottom: 16 },
  modalInputContainer: { marginBottom: 16 },
  modalLabel: { fontSize: 14, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  modalButton: { padding: 14, borderRadius: 8, alignItems: "center" },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
