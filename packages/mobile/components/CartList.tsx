import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { formatCurrency } from "../utils/helpers";
import { CartItem } from "@pos/shared/types";

interface CartListProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export default function CartList({
  items,
  onUpdateQuantity,
  onRemove,
}: CartListProps) {
  const { colors } = useTheme();

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { borderBottomColor: colors.border }]}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
          {item.product.name}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
          {formatCurrency(item.unitPrice)} × {item.quantity}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.quantityButton, { backgroundColor: colors.background }]}
          onPress={() => onUpdateQuantity(item.productId, item.quantity - 1)}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.quantityText, { color: colors.text }]}>
          {item.quantity}
        </Text>

        <TouchableOpacity
          style={[styles.quantityButton, { backgroundColor: colors.background }]}
          onPress={() => onUpdateQuantity(item.productId, item.quantity + 1)}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.removeButton, { marginLeft: 8 }]}
          onPress={() => onRemove(item.productId)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={48} color="#ccc" />
        <Text style={[styles.emptyText, { color: "#999" }]}>Your cart is empty</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.productId}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemPrice: {
    fontSize: 13,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  removeButton: {
    padding: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
});
