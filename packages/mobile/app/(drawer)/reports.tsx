import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { apiService } from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/helpers";

type ReportType = "sales" | "inventory" | "customers" | "products";

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType>("sales");
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "quarter" | "year">("week");

  const loadReport = async (type: ReportType) => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const response = await apiService.get(`/reports/${type}`, {
        params: {
          businessUnitId: "default",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      setReportData(response.data);
    } catch (error) {
      console.error("Error loading report:", error);
      showToast("Failed to load report", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport(selectedReport);
  }, [selectedReport, dateRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReport(selectedReport);
  }, [selectedReport]);

  const reportTypes: { label: string; value: ReportType; icon: string }[] = [
    { label: "Sales", value: "sales", icon: "stats-chart" },
    { label: "Inventory", value: "inventory", icon: "cube" },
    { label: "Customers", value: "customers", icon: "people" },
    { label: "Products", value: "products", icon: "pricetag" },
  ];

  const dateRangeOptions = [
    { label: "Today", value: "today" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "Quarter", value: "quarter" },
    { label: "Year", value: "year" },
  ];

  const renderSalesReport = () => (
    <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Sales</Text>
        <Text style={[styles.reportValue, { color: colors.primary }]}>
          {reportData?.totalSales || 0}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Revenue</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {formatCurrency(reportData?.totalRevenue || 0)}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Average Ticket</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {formatCurrency(reportData?.averageTicket || 0)}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Items Sold</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {reportData?.totalItems || 0}
        </Text>
      </View>
    </View>
  );

  const renderInventoryReport = () => (
    <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Items</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {reportData?.totalItems || 0}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Value</Text>
        <Text style={[styles.reportValue, { color: colors.primary }]}>
          {formatCurrency(reportData?.totalValue || 0)}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Cost</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {formatCurrency(reportData?.totalCost || 0)}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Low Stock Items</Text>
        <Text style={[styles.reportValue, { color: colors.warning }]}>
          {reportData?.lowStockItems || 0}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Out of Stock</Text>
        <Text style={[styles.reportValue, { color: colors.error }]}>
          {reportData?.outOfStockItems || 0}
        </Text>
      </View>
    </View>
  );

  const renderCustomersReport = () => (
    <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Customers</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {reportData?.totalCustomers || 0}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Total Revenue</Text>
        <Text style={[styles.reportValue, { color: colors.primary }]}>
          {formatCurrency(reportData?.totalRevenue || 0)}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Average Spent</Text>
        <Text style={[styles.reportValue, { color: colors.text }]}>
          {formatCurrency(reportData?.averageSpent || 0)}
        </Text>
      </View>
    </View>
  );

  const renderProductsReport = () => (
    <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
      <Text style={[styles.reportSubtitle, { color: colors.text }]}>
        Top Products
      </Text>
      {reportData?.topProducts?.map((item: any, index: number) => (
        <View key={index} style={[styles.productItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.productRank, { color: colors.textSecondary }]}>
            #{index + 1}
          </Text>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
            {item.product?.name || "Unknown Product"}
          </Text>
          <Text style={[styles.productRevenue, { color: colors.primary }]}>
            {formatCurrency(item._sum?.total || 0)}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderReport = () => {
    if (loading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    switch (selectedReport) {
      case "sales":
        return renderSalesReport();
      case "inventory":
        return renderInventoryReport();
      case "customers":
        return renderCustomersReport();
      case "products":
        return renderProductsReport();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Report Type Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeSelector}
        contentContainerStyle={styles.typeSelectorContent}
      >
        {reportTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeButton,
              {
                backgroundColor: selectedReport === type.value ? colors.primary : colors.card,
              },
            ]}
            onPress={() => setSelectedReport(type.value)}
          >
            <Ionicons
              name={type.icon as any}
              size={20}
              color={selectedReport === type.value ? "#fff" : colors.textSecondary}
            />
            <Text
              style={[
                styles.typeLabel,
                { color: selectedReport === type.value ? "#fff" : colors.text },
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Range Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateRangeSelector}
        contentContainerStyle={styles.dateRangeContent}
      >
        {dateRangeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.dateRangeButton,
              {
                backgroundColor: dateRange === option.value ? colors.primary : colors.card,
              },
            ]}
            onPress={() => setDateRange(option.value as any)}
          >
            <Text
              style={[
                styles.dateRangeText,
                { color: dateRange === option.value ? "#fff" : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Report Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={[styles.reportTitle, { color: colors.text }]}>
          {selectedReport.charAt(0).toUpperCase() + selectedReport.slice(1)} Report
        </Text>
        <Text style={[styles.reportPeriod, { color: colors.textSecondary }]}>
          {dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} Range
        </Text>
        {renderReport()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  typeSelector: {
    maxHeight: 60,
    paddingTop: 8,
  },
  typeSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateRangeSelector: {
    maxHeight: 50,
    paddingTop: 8,
    paddingBottom: 8,
  },
  dateRangeContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateRangeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportPeriod: {
    fontSize: 14,
    marginBottom: 16,
  },
  reportContent: {
    padding: 16,
    borderRadius: 8,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  reportLabel: {
    fontSize: 14,
  },
  reportValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  productRank: {
    fontSize: 13,
    fontWeight: '500',
    width: 30,
  },
  productName: {
    flex: 1,
    fontSize: 14,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    borderRadius: 8,
    alignItems: 'center',
  },
});
