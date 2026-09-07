import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { Customer } from "@pos/shared/types";
import CustomerModal from "../app/(modals)/customer";

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export default function CustomerSelector({
  selectedCustomer,
  onSelectCustomer,
}: CustomerSelectorProps) {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowModal(true)}
      >
        <View style={styles.content}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          {selectedCustomer ? (
            <Text style={[styles.customerName, { color: colors.text }]}>
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </Text>
          ) : (
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
              Select Customer
            </Text>
          )}
        </View>
        {selectedCustomer && (
          <TouchableOpacity
            onPress={() => onSelectCustomer(null)}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <CustomerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(customer) => {
          onSelectCustomer(customer);
          setShowModal(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "500",
  },
  placeholder: {
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
  },
});
