"use client"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Modal } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import type { User } from "@/lib/database"
import InventoryService, { type InventoryItem } from "@/lib/inventory"
import NotificationService, { type NotificationData } from "@/lib/notificationService"
import { useFocusEffect } from "@react-navigation/native"
import { useCallback } from "react"
import { useTheme } from "@/hooks/useTheme"
import { useSettings } from "@/hooks/useSettings"

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
  const { theme, isDark } = useTheme()
  const { formatCurrency, formatCurrencyInt, formatDate } = useSettings()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [totalValue, setTotalValue] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalSold, setTotalSold] = useState(0)
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [showNotificationModal, setShowNotificationModal] = useState(false)

  // Filter states
  const [mainStatsFilter, setMainStatsFilter] = useState<FilterPeriod>("all")
  const [salesStatsFilter, setSalesStatsFilter] = useState<FilterPeriod>("month")
  const [showMainStatsFilter, setShowMainStatsFilter] = useState(false)
  const [showSalesStatsFilter, setShowSalesStatsFilter] = useState(false)

  const notificationService = NotificationService.getInstance()

  useEffect(() => {
    loadUserData()
    loadInventoryStats()
    initializeNotifications()
  }, [])

  useEffect(() => {
    loadInventoryStats()
  }, [mainStatsFilter, salesStatsFilter])

  // Add focus listener to refresh stats when returning to dashboard
  useFocusEffect(
    useCallback(() => {
      loadInventoryStats()
      // Trigger a fresh low stock check when dashboard is focused
      notificationService.triggerLowStockCheck(InventoryService)
    }, [mainStatsFilter, salesStatsFilter]),
  )

  const initializeNotifications = async () => {
    try {
      // Request notification permissions
      await notificationService.requestPermissions()

      // Listen for notification updates
      notificationService.addListener((updatedNotifications) => {
        setNotifications(updatedNotifications)
      })

      // Wait a bit for inventory service to be ready, then trigger initial check
      setTimeout(async () => {
        await notificationService.triggerLowStockCheck(InventoryService)
      }, 1000)

      console.log('🔔 Notification system initialized in dashboard')
    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
  }

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

    const formatShortDate = (date: Date) => {
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
        return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
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
    const unreadNotifications = notifications.filter(n => !n.read)
    
    if (unreadNotifications.length > 0 || lowStockItems.length > 0) {
      setShowNotificationModal(true)
    } else {
      Alert.alert("No Notifications", "All caught up! No new notifications. 🎉")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return 'warning'
      case 'daily_report':
        return 'bar-chart'
      case 'sales':
        return 'cash'
      default:
        return 'notifications'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'low_stock':
        return theme.error
      case 'daily_report':
        return theme.primary
      case 'sales':
        return theme.success
      default:
        return theme.textSecondary
    }
  }

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return formatDate(date)
  }

  const menuItems = [
    {
      id: "inventory",
      title: "Inventory Management",
      subtitle: "Manage your stock items",
      icon: "cube-outline",
      color: theme.primary,
      onPress: () => router.push("/inventory"),
    },
    {
      id: "reports",
      title: "Reports & Analytics",
      subtitle: "View detailed reports",
      icon: "bar-chart-outline",
      color: theme.success,
      onPress: () => router.push("/reports"),
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "App preferences",
      icon: "settings-outline",
      color: theme.textSecondary,
      onPress: () => router.push("/settings"),
    },
    {
      id: "profile",
      title: "Profile",
      subtitle: "Manage your account",
      icon: "person-outline",
      color: theme.accent,
      onPress: () => router.push("/profile"),
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
        <Text style={[styles.filterSectionTitle, { color: theme.text }]}>{sectionTitle}</Text>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterOption, 
              { backgroundColor: theme.surface },
              currentFilter === option.key && [styles.selectedFilterOption, { borderColor: theme.primary }]
            ]}
            onPress={() => {
              onSelectFilter(option.key)
              onClose()
            }}
          >
            <Ionicons
              name={option.icon as any}
              size={24}
              color={currentFilter === option.key ? theme.primary : theme.textSecondary}
            />
            <Text style={[
              styles.filterOptionText, 
              { color: theme.text },
              currentFilter === option.key && [styles.selectedFilterOptionText, { color: theme.primary }]
            ]}>
              {option.label}
            </Text>
            {currentFilter === option.key && <Ionicons name="checkmark" size={20} color={theme.primary} />}
          </TouchableOpacity>
        ))}
      </View>
    )

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    )
  }

  const mainStatsLabels = getMainStatsLabels(mainStatsFilter)
  const unreadNotifications = notifications.filter(n => !n.read)
  const totalUnreadCount = unreadNotifications.length + (lowStockItems.length > 0 ? 1 : 0)

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    fixedHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: theme.background,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
    },
    salesStatCard: {
      flex: 1,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
    },
  })

  return (
    <>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.background} 
      />
      <View style={dynamicStyles.container}>
        {/* Fixed Header */}
        <View style={dynamicStyles.fixedHeader}>
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>Welcome back!</Text>
            <Text style={[styles.userText, { color: theme.textSecondary }]}>Ready to manage your inventory?</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Notification Bell */}
            <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationPress}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color={totalUnreadCount > 0 ? theme.error : theme.textSecondary}
              />
              {totalUnreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}>
                  <Text style={styles.notificationBadgeText}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Stats */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Main Stats</Text>
              <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setShowMainStatsFilter(true)}>
                <Text style={[styles.filterButtonText, { color: theme.primary }]}>
                  {filterOptions.find((f) => f.key === mainStatsFilter)?.label}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.statsContainer}>
              <View style={dynamicStyles.statCard}>
                <Ionicons name="cube" size={28} color={theme.primary} />
                <Text style={[styles.statNumber, { color: theme.text }]}>{totalItems}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{mainStatsLabels.totalItemsLabel}</Text>
              </View>
              <View style={dynamicStyles.statCard}>
                <Ionicons
                  name={mainStatsFilter === "all" ? "warning" : "swap-vertical"}
                  size={28}
                  color={
                    mainStatsFilter === "all"
                      ? lowStockCount > 0
                        ? theme.error
                        : theme.success
                      : lowStockCount >= 0
                        ? theme.success
                        : theme.error
                  }
                />
                <Text
                  style={[
                    styles.statNumber,
                    { color: theme.text },
                    mainStatsFilter === "all" && lowStockCount > 0 && { color: theme.error },
                    mainStatsFilter !== "all" && lowStockCount < 0 && { color: theme.error },
                  ]}
                >
                  {mainStatsFilter === "all" ? lowStockCount : lowStockCount >= 0 ? `${lowStockCount}` : lowStockCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{mainStatsLabels.lowStockLabel}</Text>
              </View>
              <View style={dynamicStyles.statCard}>
                <Ionicons name="archive" size={28} color={theme.textSecondary} />
                <Text style={[
                  styles.statNumber, 
                  { color: theme.text },
                  mainStatsFilter !== "all" && totalValue < 0 && { color: theme.error }
                ]}>
                  {mainStatsFilter === "all"
                    ? formatCurrencyInt(totalValue)
                    : `${totalValue >= 0 ? "" : ""}${formatCurrencyInt(totalValue)}`}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{mainStatsLabels.totalValueLabel}</Text>
              </View>
            </View>
          </View>

          {/* Sales & Profit Stats */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Sales & Profit Stats</Text>
              <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setShowSalesStatsFilter(true)}>
                <Text style={[styles.filterButtonText, { color: theme.primary }]}>{getFilterDescription(salesStatsFilter)}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.salesStatsContainer}>
              <View style={dynamicStyles.salesStatCard}>
                <Ionicons name="trending-up" size={24} color={theme.success} />
                <Text style={[styles.salesStatNumber, { color: theme.text }]}>{formatCurrencyInt(totalRevenue)}</Text>
                <Text style={[styles.salesStatLabel, { color: theme.textSecondary }]}>Total Revenue</Text>
              </View>
              <View style={dynamicStyles.salesStatCard}>
                <Ionicons name="cash" size={24} color={theme.accent} />
                <Text style={[styles.salesStatNumber, { color: theme.text }]}>{formatCurrencyInt(totalProfit)}</Text>
                <Text style={[styles.salesStatLabel, { color: theme.textSecondary }]}>Total Profit</Text>
              </View>
              <View style={dynamicStyles.salesStatCard}>
                <Ionicons name="bag-check" size={24} color={theme.primary} />
                <Text style={[styles.salesStatNumber, { color: theme.text }]}>{totalSold}</Text>
                <Text style={[styles.salesStatLabel, { color: theme.textSecondary }]}>Units Sold</Text>
              </View>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Quick Actions</Text>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.id} style={dynamicStyles.menuItem} onPress={item.onPress}>
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuItemTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
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

        {/* Enhanced Notification Modal */}
        <Modal visible={showNotificationModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowNotificationModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Notifications</Text>
              <TouchableOpacity
                onPress={async () => {
                  await notificationService.markAllAsRead()
                }}
              >
                <Text style={[styles.actionText, { color: theme.primary }]}>Mark All Read</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Quick Actions */}
              <View style={styles.notificationActions}>
                <TouchableOpacity
                  style={[styles.notificationActionButton, { backgroundColor: theme.surface }]}
                  onPress={async () => {
                    await notificationService.triggerLowStockCheck(InventoryService)
                    Alert.alert("Check Complete", "Low stock check completed!")
                  }}
                >
                  <Ionicons name="refresh" size={20} color={theme.primary} />
                  <Text style={[styles.notificationActionText, { color: theme.text }]}>Check Low Stock</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notificationActionButton, { backgroundColor: theme.surface }]}
                  onPress={async () => {
                    await notificationService.triggerDailyReport(InventoryService)
                    Alert.alert("Report Generated", "Daily report has been generated!")
                  }}
                >
                  <Ionicons name="document-text" size={20} color={theme.success} />
                  <Text style={[styles.notificationActionText, { color: theme.text }]}>Generate Report</Text>
                </TouchableOpacity>
              </View>

              {/* Test Sales Notification */}
              <View style={styles.testSection}>
                <TouchableOpacity
                  style={[styles.testButton, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}40` }]}
                  onPress={async () => {
                    await notificationService.sendSalesNotification("Test Product", 2, 25.99)
                    Alert.alert("Test Sent", "Sales notification sent!")
                  }}
                >
                  <Ionicons name="flask" size={20} color={theme.accent} />
                  <Text style={[styles.testButtonText, { color: theme.accent }]}>Test Sales Notification</Text>
                </TouchableOpacity>
              </View>

              {/* Notifications List */}
              {notifications.length === 0 && lowStockItems.length === 0 ? (
                <View style={styles.emptyNotifications}>
                  <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
                  <Text style={[styles.emptyNotificationsTitle, { color: theme.text }]}>No notifications</Text>
                  <Text style={[styles.emptyNotificationsSubtitle, { color: theme.textSecondary }]}>All caught up! You'll see important updates here.</Text>
                </View>
              ) : (
                <>
                  {/* Show current low stock as a special notification */}
                  {lowStockItems.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.notificationItem, 
                        styles.lowStockNotificationItem,
                        { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}30` }
                      ]}
                      onPress={() => {
                        setShowNotificationModal(false)
                        router.push("/inventory")
                      }}
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons name="warning" size={24} color={theme.error} />
                      </View>
                      <View style={styles.notificationContent}>
                        <Text style={[styles.notificationTitle, { color: theme.text }]}>Low Stock Alert! ⚠️</Text>
                        <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>
                          {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} running low
                        </Text>
                        <Text style={[styles.notificationTime, { color: theme.textTertiary }]}>Current Status</Text>
                      </View>
                      <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                    </TouchableOpacity>
                  )}

                  {/* Regular notifications */}
                  {notifications.map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationItem,
                        { backgroundColor: theme.surfaceSecondary },
                        !notification.read && [styles.unreadNotificationItem, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]
                      ]}
                      onPress={async () => {
                        if (!notification.read) {
                          await notificationService.markAsRead(notification.id)
                        }
                        
                        // Handle notification action based on type
                        if (notification.type === 'low_stock') {
                          setShowNotificationModal(false)
                          router.push("/inventory")
                        } else if (notification.type === 'daily_report') {
                          setShowNotificationModal(false)
                          router.push("/reports")
                        }
                      }}
                    >
                      <View style={[
                        styles.notificationIcon,
                        { backgroundColor: `${getNotificationColor(notification.type)}15` }
                      ]}>
                        <Ionicons 
                          name={getNotificationIcon(notification.type) as any} 
                          size={24} 
                          color={getNotificationColor(notification.type)} 
                        />
                      </View>
                      <View style={styles.notificationContent}>
                        <Text style={[
                          styles.notificationTitle,
                          { color: theme.text },
                          !notification.read && { color: theme.primary }
                        ]}>
                          {notification.title}
                        </Text>
                        <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>{notification.body}</Text>
                        <Text style={[styles.notificationTime, { color: theme.textTertiary }]}>
                          {formatNotificationTime(notification.timestamp)}
                        </Text>
                      </View>
                      {!notification.read && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={async (e) => {
                          e.stopPropagation()
                          await notificationService.removeNotification(notification.id)
                        }}
                      >
                        <Ionicons name="close" size={16} color={theme.textTertiary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Low Stock Items Detail (if any) */}
              {lowStockItems.length > 0 && (
                <View style={[styles.lowStockSection, { borderTopColor: theme.border }]}>
                  <Text style={[styles.lowStockSectionTitle, { color: theme.text }]}>Items Running Low:</Text>
                  {lowStockItems.slice(0, 5).map((item, index) => (
                    <View key={index} style={[
                      styles.lowStockItem, 
                      { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}30` }
                    ]}>
                      <View style={styles.lowStockItemInfo}>
                        <Text style={[styles.lowStockItemName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.lowStockItemDetails, { color: theme.textSecondary }]}>
                          Current: {item.quantity} units • Min: {item.min_stock_level} units
                        </Text>
                        <Text style={[styles.lowStockItemValue, { color: theme.primary }]}>
                          Value: {formatCurrency(item.cost_price * item.quantity)}
                        </Text>
                      </View>
                      <View style={styles.lowStockItemStatus}>
                        <View style={[styles.urgencyBadge, { backgroundColor: theme.error }]}>
                          <Text style={styles.urgencyText}>{item.quantity === 0 ? "OUT" : "LOW"}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {lowStockItems.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewMoreButton}
                      onPress={() => {
                        setShowNotificationModal(false)
                        router.push("/inventory")
                      }}
                    >
                      <Text style={[styles.viewMoreText, { color: theme.primary }]}>View {lowStockItems.length - 5} more items</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 4,
  },
  userText: {
    fontSize: 16,
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
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  salesStatsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
  },
  salesStatNumber: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  salesStatLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  menuContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
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
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
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
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  selectedFilterOption: {
    borderWidth: 1,
  },
  filterOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  selectedFilterOptionText: {
    fontWeight: "600",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // Enhanced Notification Styles
  notificationActions: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 20,
  },
  notificationActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  notificationActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  testSection: {
    marginBottom: 20,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyNotifications: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyNotificationsTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyNotificationsSubtitle: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  lowStockNotificationItem: {
    borderWidth: 1,
  },
  unreadNotificationItem: {
    borderWidth: 1,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    paddingRight: 24,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteButton: {
    position: "absolute",
    top: 16,
    right: 40,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  lowStockSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  lowStockItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  lowStockItemInfo: {
    flex: 1,
  },
  lowStockItemName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  lowStockItemDetails: {
    fontSize: 14,
    marginBottom: 2,
  },
  lowStockItemValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  lowStockItemStatus: {
    alignItems: "flex-end",
  },
  urgencyBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  urgencyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  viewMoreButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  viewMoreText: {
    fontSize: 16,
    fontWeight: "600",
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
})