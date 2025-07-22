"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Modal } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import type { User } from "@/lib/database"
import InventoryService, { type InventoryItem } from "@/lib/inventory"
import { useFocusEffect } from "@react-navigation/native"
import { useCallback } from "react"

type FilterPeriod =
  | "today"
  | "yesterday"
  | "week"
  | "past_week"
  | "month"
  | "past_month"
  | "quarter"
  | "past_quarter"
  | "year"
  | "past_year"
  | "past_7_days"
  | "past_30_days"
  | "past_90_days"
  | "all"

interface FilterOption {
  key: FilterPeriod
  label: string
  icon: string
}

const filterOptions: FilterOption[] = [
  { key: "today", label: "Today", icon: "today-outline" },
  { key: "yesterday", label: "Yesterday", icon: "time-outline" },
  { key: "week", label: "This Week", icon: "calendar-outline" },
  { key: "past_week", label: "Past Week", icon: "time-outline" },
  { key: "month", label: "This Month", icon: "calendar-outline" },
  { key: "past_month", label: "Past Month", icon: "time-outline" },
  { key: "quarter", label: "This Quarter", icon: "calendar-outline" },
  { key: "past_quarter", label: "Past Quarter", icon: "time-outline" },
  { key: "year", label: "This Year", icon: "calendar-outline" },
  { key: "past_year", label: "Past Year", icon: "time-outline" },
  { key: "past_7_days", label: "Past 7 Days", icon: "time-outline" },
  { key: "past_30_days", label: "Past 30 Days", icon: "time-outline" },
  { key: "past_90_days", label: "Past 90 Days", icon: "time-outline" },
  { key: "all", label: "All Time", icon: "infinite-outline" },
]

export default function DashboardScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [totalValue, setTotalValue] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalSold, setTotalSold] = useState(0)
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [showNotificationModal, setShowNotificationModal] = useState(false)

  // Filter states
  const [mainStatsFilter, setMainStatsFilter] = useState<FilterPeriod>("all")
  const [salesStatsFilter, setSalesStatsFilter] = useState<FilterPeriod>("month")
  const [showMainStatsFilter, setShowMainStatsFilter] = useState(false)
  const [showSalesStatsFilter, setShowSalesStatsFilter] = useState(false)

  useEffect(() => {
    loadUserData()
    loadInventoryStats()
  }, [])

  useEffect(() => {
    loadInventoryStats()
  }, [mainStatsFilter, salesStatsFilter])

  // Add focus listener to refresh stats when returning to dashboard
  useFocusEffect(
    useCallback(() => {
      loadInventoryStats()
    }, [mainStatsFilter, salesStatsFilter]),
  )

  const loadUserData = async () => {
    try {
      // This is a placeholder - in a real app you'd have proper session management
      setLoading(false)
    } catch (error) {
      console.error("Error loading user data:", error)
      setLoading(false)
    }
  }

  const getDateRange = (period: FilterPeriod): { startDate: Date; endDate: Date } => {
    const now = new Date()
    let startDate = new Date(now)
    let endDate = new Date(now)

    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "yesterday":
        startDate.setDate(now.getDate() - 1)
        startDate.setHours(0, 0, 0, 0)
        endDate.setDate(now.getDate() - 1)
        endDate.setHours(23, 59, 59, 999)
        break
      case "week":
        const dayOfWeek = now.getDay()
        startDate.setDate(now.getDate() - dayOfWeek)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_week":
        const pastWeekStart = new Date(now)
        const pastWeekEnd = new Date(now)
        const currentDayOfWeek = now.getDay()
        pastWeekStart.setDate(now.getDate() - currentDayOfWeek - 7)
        pastWeekStart.setHours(0, 0, 0, 0)
        pastWeekEnd.setDate(now.getDate() - currentDayOfWeek - 1)
        pastWeekEnd.setHours(23, 59, 59, 999)
        startDate = pastWeekStart
        endDate = pastWeekEnd
        break
      case "month":
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        endDate.setMonth(endDate.getMonth() + 1, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_month":
        const pastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const pastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        pastMonthStart.setHours(0, 0, 0, 0)
        pastMonthEnd.setHours(23, 59, 59, 999)
        startDate = pastMonthStart
        endDate = pastMonthEnd
        break
      case "quarter":
        const currentQuarter = Math.floor(now.getMonth() / 3)
        startDate.setMonth(currentQuarter * 3, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate.setMonth((currentQuarter + 1) * 3, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_quarter":
        const pastQuarter = Math.floor(now.getMonth() / 3) - 1
        const pastQuarterYear = pastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear()
        const adjustedPastQuarter = pastQuarter < 0 ? 3 : pastQuarter
        const pastQuarterStart = new Date(pastQuarterYear, adjustedPastQuarter * 3, 1)
        const pastQuarterEnd = new Date(pastQuarterYear, (adjustedPastQuarter + 1) * 3, 0)
        pastQuarterStart.setHours(0, 0, 0, 0)
        pastQuarterEnd.setHours(23, 59, 59, 999)
        startDate = pastQuarterStart
        endDate = pastQuarterEnd
        break
      case "year":
        startDate.setMonth(0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate.setMonth(11, 31)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_year":
        const pastYearStart = new Date(now.getFullYear() - 1, 0, 1)
        const pastYearEnd = new Date(now.getFullYear() - 1, 11, 31)
        pastYearStart.setHours(0, 0, 0, 0)
        pastYearEnd.setHours(23, 59, 59, 999)
        startDate = pastYearStart
        endDate = pastYearEnd
        break
      case "past_7_days":
        startDate.setDate(now.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_30_days":
        startDate.setDate(now.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "past_90_days":
        startDate.setDate(now.getDate() - 90)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case "all":
      default:
        startDate = new Date("1970-01-01")
        endDate = new Date("2099-12-31")
        break
    }

    return { startDate, endDate }
  }

  const getFilterDescription = (period: FilterPeriod): string => {
    const { startDate, endDate } = getDateRange(period)
    const now = new Date()

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      })
    }

    switch (period) {
      case "today":
        return "Today"
      case "yesterday":
        return "Yesterday"
      case "week":
        return "This Week"
      case "past_week":
        return `${formatDate(startDate)} - ${formatDate(endDate)}`
      case "month":
        return "This Month"
      case "past_month":
        return startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      case "quarter":
        return "This Quarter"
      case "past_quarter":
        return `Q${Math.floor(startDate.getMonth() / 3) + 1} ${startDate.getFullYear()}`
      case "year":
        return "This Year"
      case "past_year":
        return startDate.getFullYear().toString()
      case "past_7_days":
        return "Past 7 Days"
      case "past_30_days":
        return "Past 30 Days"
      case "past_90_days":
        return "Past 90 Days"
      case "all":
        return "All Time"
      default:
        return "All Time"
    }
  }

  const getMainStatsLabels = (period: FilterPeriod) => {
    if (period === "all") {
      return {
        totalItemsLabel: "Total Items",
        lowStockLabel: "Low Stock",
        totalValueLabel: "Stock Value",
      }
    } else {
      return {
        totalItemsLabel: "Items Created",
        lowStockLabel: "Net Stock Change",
        totalValueLabel: "Value Change",
      }
    }
  }

  const loadInventoryStats = async () => {
    try {
      await InventoryService.initializeDatabase()

      // Get main stats with filter
      const mainDateRange = getDateRange(mainStatsFilter)
      const mainStats = await InventoryService.getMainStatsForPeriod(mainDateRange.startDate, mainDateRange.endDate)
      setTotalItems(mainStats.totalItems)
      setLowStockCount(mainStats.lowStockCount)
      setTotalValue(mainStats.totalValue)

      // Get low stock items for notifications (always current state)
      const lowStockItems = await InventoryService.getLowStockItems()
      setLowStockItems(lowStockItems)

      // Get sales data with filter
      const salesDateRange = getDateRange(salesStatsFilter)
      const salesData = await InventoryService.getSalesDataByDateRange(salesDateRange.startDate, salesDateRange.endDate)
      setTotalRevenue(salesData.totalRevenue)
      setTotalProfit(salesData.totalProfit)
      setTotalSold(salesData.totalSold)
    } catch (error) {
      console.error("Error loading inventory stats:", error)
    }
  }

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          // Clear user session and navigate back to auth
          router.replace("/(tabs)")
        },
      },
    ])
  }

  const handleNotificationPress = () => {
    if (lowStockItems.length > 0) {
      setShowNotificationModal(true)
    } else {
      Alert.alert("No Notifications", "All items are well stocked! 🎉")
    }
  }

  const menuItems = [
    {
      id: "inventory",
      title: "Inventory Management",
      subtitle: "Manage your stock items",
      icon: "cube-outline",
      color: "#007AFF",
      onPress: () => router.push("/inventory"),
    },
    {
      id: "reports",
      title: "Reports & Analytics",
      subtitle: "View detailed reports",
      icon: "bar-chart-outline",
      color: "#34C759",
      onPress: () => router.push("/reports"),
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "App preferences",
      icon: "settings-outline",
      color: "#8E8E93",
    },
    {
      id: "profile",
      title: "Profile",
      subtitle: "Manage your account",
      icon: "person-outline",
      color: "#FF9500",
    },
  ]

  const FilterModal = ({
    visible,
    onClose,
    currentFilter,
    onSelectFilter,
    title,
  }: {
    visible: boolean
    onClose: () => void
    currentFilter: FilterPeriod
    onSelectFilter: (filter: FilterPeriod) => void
    title: string
  }) => {
    const currentPeriods = filterOptions.filter((option) =>
      ["today", "week", "month", "quarter", "year"].includes(option.key),
    )

    const pastPeriods = filterOptions.filter((option) =>
      ["yesterday", "past_week", "past_month", "past_quarter", "past_year"].includes(option.key),
    )

    const rangePeriods = filterOptions.filter((option) =>
      ["past_7_days", "past_30_days", "past_90_days"].includes(option.key),
    )

    const allTime = filterOptions.filter((option) => option.key === "all")

    const renderFilterSection = (sectionTitle: string, options: FilterOption[]) => (
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>{sectionTitle}</Text>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterOption, currentFilter === option.key && styles.selectedFilterOption]}
            onPress={() => {
              onSelectFilter(option.key)
              onClose()
            }}
          >
            <Ionicons
              name={option.icon as any}
              size={24}
              color={currentFilter === option.key ? "#007AFF" : "#8E8E93"}
            />
            <Text style={[styles.filterOptionText, currentFilter === option.key && styles.selectedFilterOptionText]}>
              {option.label}
            </Text>
            {currentFilter === option.key && <Ionicons name="checkmark" size={20} color="#007AFF" />}
          </TouchableOpacity>
        ))}
      </View>
    )

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.filterModalContent} showsVerticalScrollIndicator={false}>
            {renderFilterSection("Current Periods", currentPeriods)}
            {renderFilterSection("Past Periods", pastPeriods)}
            {renderFilterSection("Date Ranges", rangePeriods)}
            {renderFilterSection("All Data", allTime)}
          </ScrollView>
        </View>
      </Modal>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    )
  }

  const mainStatsLabels = getMainStatsLabels(mainStatsFilter)

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.userText}>Ready to manage your inventory?</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Notification Bell */}
            <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationPress}>
              <Ionicons name="notifications-outline" size={24} color={lowStockItems.length > 0 ? "#FF3B30" : "#8E8E93"} />
              {lowStockItems.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{lowStockItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Stats */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Main Stats</Text>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowMainStatsFilter(true)}>
                <Text style={styles.filterButtonText}>
                  {filterOptions.find((f) => f.key === mainStatsFilter)?.label}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="cube" size={28} color="#007AFF" />
                <Text style={styles.statNumber}>{totalItems}</Text>
                <Text style={styles.statLabel}>{mainStatsLabels.totalItemsLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name={mainStatsFilter === "all" ? "warning" : "swap-vertical"} size={28} color={
                  mainStatsFilter === "all" 
                    ? (lowStockCount > 0 ? "#FF3B30" : "#34C759")
                    : (lowStockCount >= 0 ? "#34C759" : "#FF3B30")
                } />
                <Text style={[
                  styles.statNumber, 
                  mainStatsFilter === "all" && lowStockCount > 0 && styles.lowStockNumber,
                  mainStatsFilter !== "all" && lowStockCount < 0 && styles.lowStockNumber
                ]}>
                  {mainStatsFilter === "all" ? lowStockCount : (lowStockCount >= 0 ? `${lowStockCount}` : lowStockCount)}
                </Text>
                <Text style={styles.statLabel}>{mainStatsLabels.lowStockLabel}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="archive" size={28} color="#8E8E93" />
                <Text style={[
                  styles.statNumber,
                  mainStatsFilter !== "all" && totalValue < 0 && styles.lowStockNumber
                ]}>
                  {mainStatsFilter === "all" 
                    ? `₱${totalValue.toFixed(0)}` 
                    : `${totalValue >= 0 ? '' : ''}₱${totalValue.toFixed(0)}`
                  }
                </Text>
                <Text style={styles.statLabel}>{mainStatsLabels.totalValueLabel}</Text>
              </View>
            </View>
          </View>

          {/* Sales & Profit Stats */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sales & Profit Stats</Text>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowSalesStatsFilter(true)}>
                <Text style={styles.filterButtonText}>{getFilterDescription(salesStatsFilter)}</Text>
                <Ionicons name="chevron-down" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.salesStatsContainer}>
              <View style={styles.salesStatCard}>
                <Ionicons name="trending-up" size={24} color="#34C759" />
                <Text style={styles.salesStatNumber}>₱{totalRevenue.toFixed(0)}</Text>
                <Text style={styles.salesStatLabel}>Total Revenue</Text>
              </View>
              <View style={styles.salesStatCard}>
                <Ionicons name="cash" size={24} color="#FF9500" />
                <Text style={styles.salesStatNumber}>₱{totalProfit.toFixed(0)}</Text>
                <Text style={styles.salesStatLabel}>Total Profit</Text>
              </View>
              <View style={styles.salesStatCard}>
                <Ionicons name="bag-check" size={24} color="#007AFF" />
                <Text style={styles.salesStatNumber}>{totalSold}</Text>
                <Text style={styles.salesStatLabel}>Units Sold</Text>
              </View>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Quick Actions</Text>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={
                  item.onPress ||
                  (() => {
                    Alert.alert("Coming Soon", `${item.title} feature will be available soon!`)
                  })
                }
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Filter Modals */}
        <FilterModal
          visible={showMainStatsFilter}
          onClose={() => setShowMainStatsFilter(false)}
          currentFilter={mainStatsFilter}
          onSelectFilter={setMainStatsFilter}
          title="Main Stats Filter"
        />

        <FilterModal
          visible={showSalesStatsFilter}
          onClose={() => setShowSalesStatsFilter(false)}
          currentFilter={salesStatsFilter}
          onSelectFilter={setSalesStatsFilter}
          title="Sales & Profit Filter"
        />

        {/* Low Stock Notification Modal */}
        <Modal visible={showNotificationModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNotificationModal(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Low Stock Alerts</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowNotificationModal(false)
                  router.push("/inventory")
                }}
              >
                <Text style={styles.actionText}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.alertHeader}>
                <Ionicons name="warning" size={32} color="#FF3B30" />
                <Text style={styles.alertTitle}>Items Running Low</Text>
                <Text style={styles.alertSubtitle}>
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""} need{lowStockItems.length === 1 ? "s" : ""} restocking
                </Text>
              </View>
              {lowStockItems.map((item, index) => (
                <View key={index} style={styles.lowStockItem}>
                  <View style={styles.lowStockItemInfo}>
                    <Text style={styles.lowStockItemName}>{item.name}</Text>
                    <Text style={styles.lowStockItemDetails}>
                      Current: {item.quantity} units • Min: {item.min_stock_level} units
                    </Text>
                    <Text style={styles.lowStockItemValue}>Value: ₱{(item.cost_price * item.quantity).toFixed(2)}</Text>
                  </View>
                  <View style={styles.lowStockItemStatus}>
                    <View style={styles.urgencyBadge}>
                      <Text style={styles.urgencyText}>{item.quantity === 0 ? "OUT" : "LOW"}</Text>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.alertActions}>
                <TouchableOpacity
                  style={styles.alertActionButton}
                  onPress={() => {
                    setShowNotificationModal(false)
                    router.push("/inventory")
                  }}
                >
                  <Ionicons name="cube" size={20} color="#007AFF" />
                  <Text style={styles.alertActionText}>Manage Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.alertActionButton}
                  onPress={() => {
                    setShowNotificationModal(false)
                    router.push("/reports")
                  }}
                >
                  <Ionicons name="bar-chart" size={20} color="#34C759" />
                  <Text style={styles.alertActionText}>View Reports</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollContent: {
    flex: 1,
    marginTop: 150, // Account for fixed header height
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  userText: {
    fontSize: 16,
    color: "#8E8E93",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  signOutButton: {
    padding: 8,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "center",
  },
  salesStatsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
  },
  salesStatCard: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  salesStatNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 4,
  },
  salesStatLabel: {
    fontSize: 11,
    color: "#8E8E93",
    textAlign: "center",
  },
  menuContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
  },
  lowStockNumber: {
    color: "#FF3B30",
  },
  // Filter Modal Styles
  filterModalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  selectedFilterOption: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  filterOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  selectedFilterOptionText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  cancelText: {
    fontSize: 16,
    color: "#8E8E93",
  },
  actionText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  alertHeader: {
    alignItems: "center",
    paddingVertical: 32,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 16,
    marginBottom: 8,
  },
  alertSubtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
  lowStockItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFE5E5",
  },
  lowStockItemInfo: {
    flex: 1,
  },
  lowStockItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  lowStockItemDetails: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 2,
  },
  lowStockItemValue: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  lowStockItemStatus: {
    alignItems: "flex-end",
  },
  urgencyBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  urgencyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  alertActions: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 24,
  },
  alertActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  alertActionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
})