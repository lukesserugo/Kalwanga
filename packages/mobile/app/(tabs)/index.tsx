import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "../../hooks/useToast";
import { useSocket } from "../../hooks/useSocket";
import { apiService } from "../../services/api";
import { formatCurrency, formatDate } from "@pos/shared/utils";
import type { SalesStats, Sale } from "@pos/shared/types";

export default function DashboardScreen() {
  const { user } = useUser();
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
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#F97316"]} />
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full items-center justify-center mr-3 bg-brand-500">
            <Text className="text-white text-lg font-bold">{getInitials()}</Text>
          </View>
          <View>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Welcome back,</Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
        </View>
        <View
          className={`flex-row items-center px-2.5 py-1 rounded-xl ${
            isConnected ? "bg-success-100" : "bg-danger-100"
          }`}
        >
          <View
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              isConnected ? "bg-success-500" : "bg-danger-500"
            }`}
          />
          <Text
            className={`text-[11px] font-medium ${
              isConnected ? "text-success-700" : "text-danger-700"
            }`}
          >
            {isConnected ? "Connected" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View className="flex-row flex-wrap px-4 pt-2">
        <View className="w-[46%] m-[2%] p-4 rounded-xl bg-white dark:bg-gray-900 shadow-soft">
          <Text className="text-2xl font-bold text-brand-500">
            {formatCurrency(stats?.totalRevenue || 0)}
          </Text>
          <Text className="text-xs mt-1 text-gray-500 dark:text-gray-400">Revenue</Text>
        </View>
        <View className="w-[46%] m-[2%] p-4 rounded-xl bg-white dark:bg-gray-900 shadow-soft">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.totalSales || 0}
          </Text>
          <Text className="text-xs mt-1 text-gray-500 dark:text-gray-400">Sales</Text>
        </View>
        <View className="w-[46%] m-[2%] p-4 rounded-xl bg-white dark:bg-gray-900 shadow-soft">
          <Text className="text-2xl font-bold text-success-500">
            {formatCurrency(stats?.averageTicket || 0)}
          </Text>
          <Text className="text-xs mt-1 text-gray-500 dark:text-gray-400">Avg. Ticket</Text>
        </View>
        <View className="w-[46%] m-[2%] p-4 rounded-xl bg-white dark:bg-gray-900 shadow-soft">
          <Text className="text-2xl font-bold text-warning-500">
            {recentSales.length}
          </Text>
          <Text className="text-xs mt-1 text-gray-500 dark:text-gray-400">Recent Sales</Text>
        </View>
      </View>

      {/* Recent Sales */}
      <View className="px-5 pt-4 pb-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Sales
          </Text>
          <TouchableOpacity onPress={() => showToast("View all sales", "info")}>
            <Text className="text-sm font-medium text-brand-500">See All</Text>
          </TouchableOpacity>
        </View>

        {recentSales.length === 0 ? (
          <View className="p-10 rounded-xl items-center bg-white dark:bg-gray-900">
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text className="text-sm mt-3 text-gray-500 dark:text-gray-400">
              No recent sales
            </Text>
          </View>
        ) : (
          recentSales.map((sale) => (
            <TouchableOpacity
              key={sale.id}
              className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800"
              onPress={() => showToast(`Sale ${sale.receiptNumber}`, "info")}
            >
              <View>
                <Text className="text-[15px] font-medium text-gray-900 dark:text-white">
                  #{sale.receiptNumber}
                </Text>
                <Text className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                  {formatDate(sale.createdAt)}
                </Text>
              </View>
              <Text className="text-base font-semibold text-brand-500">
                {formatCurrency(sale.total)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
