import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useSocket } from "../../hooks/useSocket";
import { apiService } from "../../services/api";
import { CartService } from "../../services/CartService";
import { formatCurrency } from "../../utils/helpers";
import { Product, CartItem, Customer, ApiResponse } from "@pos/shared/types";
import BarcodeScanner from "../../components/BarcodeScanner";
import CustomerSelector from "../../components/CustomerSelector";
import PaymentModal from "../../components/PaymentModal";

export default function POSScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [productsResponse, categoriesResponse, savedCart] = await Promise.all([
        apiService.get<ApiResponse<Product[]>>("/products", {
          params: { businessUnitId: "default", limit: 50 },
        }),
        apiService.get<ApiResponse<any[]>>("/categories"),
        CartService.getCart(),
      ]);

      const productsData = productsResponse.data || [];
      setProducts(productsData);
      setCategories(categoriesResponse.data || []);
      
      if (savedCart.length > 0) {
        const validCart = savedCart.filter((item: CartItem) => 
          productsData.some((p: Product) => p.id === item.productId)
        );
        setCart(validCart);
        if (validCart.length !== savedCart.length) {
          await CartService.saveCart(validCart);
        }
      }
    } catch (error) {
      console.error("Error loading POS data:", error);
      showToast("Failed to load products", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;

    socket.on("product-updated", (product: Product) => {
      setProducts(prev => 
        prev.map(p => p.id === product.id ? { ...p, stock: product.stock || 0 } : p)
      );
    });

    socket.on("inventory-updated", (data: { productId: string; quantity: number }) => {
      setProducts(prev =>
        prev.map(p => {
          if (p.id === data.productId) {
            return { ...p, stock: data.quantity };
          }
          return p;
        })
      );
    });

    return () => {
      socket.off("product-updated");
      socket.off("inventory-updated");
    };
  }, [socket]);

  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? product.categoryId === selectedCategory : true;
    return matchesSearch && matchesCategory && product.isActive;
  });

  const addToCart = (product: Product) => {
    const currentStock = product.stock || 0;
    if (currentStock === 0) {
      showToast("Product out of stock", "warning");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= (product.stock || 0)) {
          showToast("Not enough stock available", "warning");
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: 1,
          unitPrice: product.unitPrice,
          total: product.unitPrice,
        },
      ];
    });
    showToast(`Added ${product.name} to cart`, "success");
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId));
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity > (product.stock || 0)) {
      showToast("Not enough stock available", "warning");
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item
      )
    );
  };

  const clearCart = () => {
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to clear the cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setCart([]);
            await CartService.clearCart();
          },
        },
      ]
    );
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      showToast("Product not found", "error");
    }
    setShowScanner(false);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast("Cart is empty", "warning");
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        customerId: selectedCustomer?.id,
        paymentMethod: paymentData.method,
        paidAmount: paymentData.amount,
        businessUnitId: "default",
      };

      const response = await apiService.post<ApiResponse<{ receiptNumber: string }>>("/sales", saleData);
      
      setCart([]);
      await CartService.clearCart();
      setShowPayment(false);
      setSelectedCustomer(null);
      
      showToast(`Sale completed: ${response.data?.receiptNumber || "Unknown"}`, "success");
      loadData();
    } catch (error) {
      console.error("Error processing sale:", error);
      showToast("Failed to process sale", "error");
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const currentStock = item.stock || 0;
    return (
      <TouchableOpacity
        style={[styles.productCard, { backgroundColor: colors.card }]}
        onPress={() => addToCart(item)}
        disabled={currentStock === 0}
      >
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.productPrice, { color: colors.primary }]}>
            {formatCurrency(item.unitPrice)}
          </Text>
          <Text style={[styles.productStock, { color: currentStock > 10 ? colors.textSecondary : colors.error }]}>
            Stock: {currentStock}
          </Text>
        </View>
        {currentStock === 0 && (
          <View style={[styles.outOfStockBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Point of Sale</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={() => setShowScanner(true)}
          >
            <Ionicons name="scan" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={clearCart}
          >
            <Ionicons name="trash" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Selector */}
      <CustomerSelector
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryChip,
            { backgroundColor: selectedCategory === null ? colors.primary : colors.card },
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryText,
              { color: selectedCategory === null ? '#fff' : colors.text },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map((category: any) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              { backgroundColor: selectedCategory === category.id ? colors.primary : colors.card },
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text
              style={[
                styles.categoryText,
                { color: selectedCategory === category.id ? '#fff' : colors.text },
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item: Product) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productsGrid}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No products found
            </Text>
          </View>
        }
      />

      {/* Cart Summary */}
      {cart.length > 0 && (
        <View style={[styles.cartSummary, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.cartHeader}>
            <Text style={[styles.cartTitle, { color: colors.text }]}>
              Cart ({cart.length} items)
            </Text>
            <TouchableOpacity onPress={clearCart}>
              <Text style={[styles.clearCartText, { color: colors.error }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={cart}
            renderItem={({ item }) => (
              <View style={[styles.cartItem, { borderBottomColor: colors.border }]}>
                <View style={styles.cartItemInfo}>
                  <Text style={[styles.cartItemName, { color: colors.text }]} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={[styles.cartItemPrice, { color: colors.textSecondary }]}>
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </Text>
                </View>
                <View style={styles.cartItemActions}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.background }]}
                    onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.quantityText, { color: colors.text }]}>
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.background }]}
                    onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item: CartItem) => item.productId}
            style={styles.cartItemsList}
          />

          <View style={styles.cartTotals}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                Subtotal
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                Tax (10%)
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatCurrency(tax)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={[styles.grandTotalLabel, { color: colors.text }]}>
                Total
              </Text>
              <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: colors.primary }]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      </Modal>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
        total={total}
        customer={selectedCustomer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  categoriesContainer: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  productsGrid: {
    padding: 8,
    paddingBottom: 8,
  },
  productCard: {
    flex: 1,
    margin: 8,
    padding: 12,
    borderRadius: 12,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 12,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartSummary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearCartText: {
    fontSize: 14,
  },
  cartItemsList: {
    maxHeight: 120,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '500',
  },
  cartItemPrice: {
    fontSize: 12,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  cartTotals: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
  },
  totalValue: {
    fontSize: 13,
  },
  grandTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
