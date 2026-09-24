import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { formatCurrency } from "../../utils/helpers";
import { PaymentMethod } from "@pos/shared/types";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  total?: number;
  customer?: any;
  onSelect?: (customer: any) => void;
}

export default function PaymentModal({
  visible,
  onClose,
  onSuccess,
  total = 0,
  customer,
  onSelect,
}: PaymentModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(total.toString());
  const [loading, setLoading] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  const paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: "CASH", label: "Cash", icon: "cash-outline" },
    { value: "CREDIT_CARD", label: "Credit Card", icon: "card-outline" },
    { value: "DEBIT_CARD", label: "Debit Card", icon: "card-outline" },
    { value: "MOBILE_MONEY", label: "Mobile Money", icon: "phone-portrait-outline" },
  ];

  const handlePayment = () => {
    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      showToast("Please enter a valid amount", "warning");
      return;
    }

    if (paidAmount < total) {
      showToast("Amount must be at least the total", "warning");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      onSuccess?.({
        method: selectedMethod,
        amount: paidAmount,
        change: paidAmount - total,
        customer,
      });
      setLoading(false);
    }, 1000);
  };

  const handleCashPayment = () => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received <= 0) {
      showToast("Please enter the amount received", "warning");
      return;
    }

    if (received < total) {
      showToast("Amount received is less than total", "warning");
      return;
    }

    setAmount(received.toString());
  };

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
      <View style={[styles.modal, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {onSelect ? "Select Customer" : "Payment"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {onSelect ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Pick a customer for this sale
            </Text>
            <TouchableOpacity
              style={[styles.customerOption, { backgroundColor: colors.card }]}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
            >
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.customerOptionText, { color: colors.text }]}>
                Guest (no customer)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Total */}
            <View style={[styles.totalContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                Total Amount
              </Text>
              <Text style={[styles.totalAmount, { color: colors.primary }]}>
                {formatCurrency(total)}
              </Text>
            </View>

            {/* Payment Methods */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Payment Method
            </Text>
            <View style={styles.methodsContainer}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.methodButton,
                    {
                      backgroundColor:
                        selectedMethod === method.value ? colors.primary : colors.card,
                      borderColor:
                        selectedMethod === method.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMethod(method.value)}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={24}
                    color={selectedMethod === method.value ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodLabel,
                      { color: selectedMethod === method.value ? "#fff" : colors.text },
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount Input */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Amount Paid
            </Text>
            <TextInput
              style={[
                styles.amountInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  color: colors.text,
                },
              ]}
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            {/* Cash Payment - Show change calculation */}
            {selectedMethod === "CASH" && (
              <View style={styles.cashContainer}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
                  Cash Received
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Enter amount received"
                  placeholderTextColor={colors.textSecondary}
                  value={cashReceived}
                  onChangeText={(text) => {
                    setCashReceived(text);
                    handleCashPayment();
                  }}
                  keyboardType="numeric"
                />
                {cashReceived && parseFloat(cashReceived) > total && (
                  <View
                    style={[
                      styles.changeContainer,
                      { backgroundColor: colors.success + "15" },
                    ]}
                  >
                    <Text style={[styles.changeLabel, { color: colors.textSecondary }]}>
                      Change
                    </Text>
                    <Text style={[styles.changeAmount, { color: colors.success }]}>
                      {formatCurrency(parseFloat(cashReceived) - total)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Customer Info */}
            {customer && (
              <View style={[styles.customerInfo, { backgroundColor: colors.card }]}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.customerName, { color: colors.text }]}>
                  {customer.firstName} {customer.lastName}
                </Text>
              </View>
            )}

            {/* Payment Button */}
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  Pay {formatCurrency(parseFloat(amount) || 0)}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    width: "92%",
    maxHeight: "85%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  totalContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: "bold",
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  methodsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 20,
  },
  cashContainer: {
    marginBottom: 20,
  },
  changeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  changeLabel: {
    fontSize: 14,
  },
  changeAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "500",
  },
  customerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    gap: 10,
    marginBottom: 8,
  },
  customerOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  payButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
