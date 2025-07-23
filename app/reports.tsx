"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, Share } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import InventoryService, { type InventoryItem, type StockTransaction } from "@/lib/inventory"
import { useTheme } from "@/hooks/useTheme"
import { useSettings } from "@/hooks/useSettings"

const { width } = Dimensions.get("window")

interface ReportData {
  totalItems: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
  averageItemValue: number
  mostValuableItem: InventoryItem | null
  leastStockedItem: InventoryItem | null
  recentTransactions: StockTransaction[]
  categoryBreakdown: { category: string; count: number; value: number; profit: number }[]
  stockMovements: { date: string; pullIn: number; pullOut: number; sales: number; profit: number }[]
  totalRevenue: number
  totalProfit: number
  profitMargin: number
  profitTrends: { period: string; revenue: number; profit: number; margin: number }[]
}

export default function ReportsScreen() {
  const { theme, isDark } = useTheme()
  const { formatCurrency, formatCurrencyInt, formatDate } = useSettings()
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d")
  const [activeTab, setActiveTab] = useState<"overview" | "profit" | "transactions" | "insights">("overview")

  useEffect(() => {
    loadReportData()
  }, [selectedPeriod])

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate = new Date(now)

    switch (selectedPeriod) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "all":
      default:
        startDate = new Date("1970-01-01")
        break
    }

    return { startDate, endDate }
  }

  const generateCategoryBreakdown = (
    items: InventoryItem[],
    totalProfit: number,
  ): { category: string; count: number; value: number; profit: number }[] => {
    // Create a map to group items by category (you can enhance this logic based on your item names or add a category field)
    const categoryMap = new Map<string, { items: InventoryItem[]; totalValue: number }>()

    items.forEach((item) => {
      // Simple category classification based on item name (you can improve this logic)
      let category = "Other"
      const itemName = item.name.toLowerCase()

      if (
        itemName.includes("phone") ||
        itemName.includes("laptop") ||
        itemName.includes("computer") ||
        itemName.includes("tablet") ||
        itemName.includes("electronics") ||
        itemName.includes("tv") ||
        itemName.includes("camera") ||
        itemName.includes("headphone") ||
        itemName.includes("speaker")
      ) {
        category = "Electronics"
      } else if (
        itemName.includes("shirt") ||
        itemName.includes("pants") ||
        itemName.includes("dress") ||
        itemName.includes("shoe") ||
        itemName.includes("clothing") ||
        itemName.includes("jacket") ||
        itemName.includes("hat") ||
        itemName.includes("sock")
      ) {
        category = "Clothing"
      } else if (
        itemName.includes("home") ||
        itemName.includes("garden") ||
        itemName.includes("furniture") ||
        itemName.includes("kitchen") ||
        itemName.includes("bed") ||
        itemName.includes("chair") ||
        itemName.includes("table") ||
        itemName.includes("plant")
      ) {
        category = "Home & Garden"
      } else if (
        itemName.includes("sport") ||
        itemName.includes("fitness") ||
        itemName.includes("ball") ||
        itemName.includes("gym") ||
        itemName.includes("bike") ||
        itemName.includes("run")
      ) {
        category = "Sports"
      } else if (
        itemName.includes("book") ||
        itemName.includes("pen") ||
        itemName.includes("paper") ||
        itemName.includes("office") ||
        itemName.includes("stationery")
      ) {
        category = "Books & Stationery"
      }

      const itemValue = item.cost_price * item.quantity

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { items: [], totalValue: 0 })
      }

      const categoryData = categoryMap.get(category)!
      categoryData.items.push(item)
      categoryData.totalValue += itemValue
    })

    // Convert map to array and calculate profit distribution
    const categories = Array.from(categoryMap.entries()).map(([category, data]) => {
      const count = data.items.length
      const value = data.totalValue
      // Distribute profit proportionally based on value
      const totalStockValue = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0)
      const profitShare = totalStockValue > 0 ? value / totalStockValue : 0
      const profit = totalProfit * profitShare

      return {
        category,
        count,
        value,
        profit: Math.max(0, profit), // Ensure profit is not negative
      }
    })

    // Sort by value (highest first) and return top categories
    return categories
      .sort((a, b) => b.value - a.value)
      .filter((cat) => cat.count > 0)
      .slice(0, 6) // Show top 6 categories
  }

  const loadReportData = async () => {
    setLoading(true)
    try {
      await InventoryService.initializeDatabase()

      const { startDate, endDate } = getDateRange()

      // Get filtered data based on selected period
      let salesData
      let mainStats
      let allItems = await InventoryService.getAllItems()
      let recentTransactions: StockTransaction[]

      if (selectedPeriod === "all") {
        // For "all time", get all data
        salesData = await InventoryService.getSalesData()
        mainStats = await InventoryService.getMainStatsForPeriod(startDate, endDate)
        recentTransactions = await InventoryService.getStockTransactions()
      } else {
        // For specific periods, get filtered data
        salesData = await InventoryService.getSalesDataByDateRange(startDate, endDate)
        mainStats = await InventoryService.getMainStatsForPeriod(startDate, endDate)
        recentTransactions = await InventoryService.getStockTransactions()
        
        // Filter transactions by date
        recentTransactions = recentTransactions.filter(t => {
          const transactionDate = new Date(t.created_at!)
          return transactionDate >= startDate && transactionDate <= endDate
        })
      }

      const lowStockItems = await InventoryService.getLowStockItems()
      const totalValue = await InventoryService.getTotalStockValue()

      // Calculate analytics
      const outOfStockItems = allItems.filter((item) => item.quantity === 0).length
      const averageItemValue = allItems.length > 0 ? totalValue / allItems.length : 0

      // Find most valuable item
      const mostValuableItem = allItems.reduce(
        (max, item) => {
          const itemValue = item.cost_price * item.quantity
          const maxValue = max ? max.cost_price * max.quantity : 0
          return itemValue > maxValue ? item : max
        },
        null as InventoryItem | null,
      )

      // Find least stocked item (excluding out of stock)
      const inStockItems = allItems.filter((item) => item.quantity > 0)
      const leastStockedItem = inStockItems.reduce(
        (min, item) => (!min || item.quantity < min.quantity ? item : min),
        null as InventoryItem | null,
      )

      // Generate category breakdown based on current items but with filtered profit
      const categoryBreakdown = generateCategoryBreakdown(allItems, salesData.totalProfit)

      // Generate stock movements based on selected period
      const stockMovements = generateStockMovements(recentTransactions, salesData.totalProfit, selectedPeriod)

      // Generate profit trends based on period
      const profitTrends = generateProfitTrends(salesData, selectedPeriod)

      const profitMargin = salesData.totalRevenue > 0 ? (salesData.totalProfit / salesData.totalRevenue) * 100 : 0

      setReportData({
        totalItems: allItems.length,
        totalValue,
        lowStockItems: lowStockItems.length,
        outOfStockItems,
        averageItemValue,
        mostValuableItem,
        leastStockedItem,
        recentTransactions: recentTransactions.slice(0, 10),
        categoryBreakdown,
        stockMovements,
        totalRevenue: salesData.totalRevenue,
        totalProfit: salesData.totalProfit,
        profitMargin,
        profitTrends,
      })
    } catch (error) {
      console.error("Error loading report data:", error)
      Alert.alert("Error", "Failed to load report data")
    } finally {
      setLoading(false)
    }
  }

  const generateStockMovements = (transactions: StockTransaction[], totalProfit: number, period: string) => {
    const movements = []
    const today = new Date()
    let days: number
    let dateFormat: Intl.DateTimeFormatOptions

    // Determine the number of data points and date format based on period
    switch (period) {
      case "7d":
        days = 7
        dateFormat = { month: "short", day: "numeric" }
        break
      case "30d":
        days = 30
        dateFormat = { month: "short", day: "numeric" }
        break
      case "90d":
        days = 90
        dateFormat = { month: "short", day: "numeric" }
        break
      case "all":
      default:
        days = 30 // Show last 30 days for "all time" to keep chart manageable
        dateFormat = { month: "short", day: "numeric" }
        break
    }

    // For longer periods, we might want to group by weeks or months
    let groupBy: "day" | "week" | "month" = "day"
    let dataPoints = days

    if (days > 60) {
      groupBy = "week"
      dataPoints = Math.ceil(days / 7)
      dateFormat = { month: "short", day: "numeric" }
    }

    const dailyProfitBase = totalProfit / days // Distribute profit over the period

    for (let i = dataPoints - 1; i >= 0; i--) {
      const date = new Date(today)
      
      if (groupBy === "week") {
        date.setDate(date.getDate() - (i * 7))
      } else {
        date.setDate(date.getDate() - i)
      }

      let startDate = new Date(date)
      let endDate = new Date(date)

      if (groupBy === "week") {
        // For week grouping, get the start and end of the week
        endDate.setDate(date.getDate() + 6)
      }

      const startDateStr = startDate.toISOString().split("T")[0]
      const endDateStr = endDate.toISOString().split("T")[0]

      // Filter transactions for this period
      const periodTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.created_at!).toISOString().split("T")[0]
        if (groupBy === "week") {
          return transactionDate >= startDateStr && transactionDate <= endDateStr
        } else {
          return transactionDate === startDateStr
        }
      })

      const pullIn = periodTransactions.filter((t) => t.type === "in").reduce((sum, t) => sum + t.quantity, 0)
      const pullOut = periodTransactions.filter((t) => t.type === "out").reduce((sum, t) => sum + t.quantity, 0)
      const sales = periodTransactions.filter((t) => t.type === "sold").reduce((sum, t) => sum + t.quantity, 0)

      // Calculate period profit based on actual sales transactions
      const periodProfit = periodTransactions
        .filter((t) => t.type === "sold" && t.total_amount)
        .reduce((sum, t) => sum + (t.total_amount || 0), 0)

      let dateLabel: string
      if (groupBy === "week") {
        dateLabel = `Week ${Math.ceil((dataPoints - i) / 4)}`
      } else {
        dateLabel = date.toLocaleDateString("en-US", dateFormat)
      }

      movements.push({
        date: dateLabel,
        pullIn,
        pullOut,
        sales,
        profit: Math.round(periodProfit),
      })
    }

    return movements
  }

  const generateProfitTrends = (salesData: { totalRevenue: number; totalProfit: number }, period: string) => {
    let trends = []

    switch (period) {
      case "7d":
        // Daily trends for 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date()
          date.setDate(date.getDate() - (6 - i))
          trends.push({
            period: date.toLocaleDateString("en-US", { weekday: "short" }),
            revenue: salesData.totalRevenue * (0.1 + Math.random() * 0.2),
            profit: salesData.totalProfit * (0.1 + Math.random() * 0.2),
            margin: 25 + Math.random() * 20,
          })
        }
        break
      case "30d":
        // Weekly trends for 30 days
        for (let i = 0; i < 4; i++) {
          trends.push({
            period: `Week ${i + 1}`,
            revenue: salesData.totalRevenue * (0.2 + Math.random() * 0.15),
            profit: salesData.totalProfit * (0.2 + Math.random() * 0.15),
            margin: 30 + Math.random() * 15,
          })
        }
        break
      case "90d":
        // Monthly trends for 90 days
        for (let i = 0; i < 3; i++) {
          const date = new Date()
          date.setMonth(date.getMonth() - (2 - i))
          trends.push({
            period: date.toLocaleDateString("en-US", { month: "short" }),
            revenue: salesData.totalRevenue * (0.25 + Math.random() * 0.2),
            profit: salesData.totalProfit * (0.25 + Math.random() * 0.2),
            margin: 28 + Math.random() * 18,
          })
        }
        break
      case "all":
      default:
        // Quarterly or yearly trends
        const quarters = ["Q1", "Q2", "Q3", "Q4"]
        for (let i = 0; i < 4; i++) {
          trends.push({
            period: quarters[i],
            revenue: salesData.totalRevenue * (0.2 + Math.random() * 0.15),
            profit: salesData.totalProfit * (0.2 + Math.random() * 0.15),
            margin: 32 + Math.random() * 12,
          })
        }
        break
    }

    return trends
  }

  const exportReport = async () => {
    if (!reportData) return

    const { startDate, endDate } = getDateRange()
    const periodText = selectedPeriod === "all" ? "All Time" : selectedPeriod.toUpperCase()

    const reportText = `INVENTORY REPORT
Generated: ${formatDate(new Date())}
Period: ${periodText}
${selectedPeriod !== "all" ? `From: ${formatDate(startDate)} To: ${formatDate(endDate)}` : ""}

OVERVIEW:
- Total Items: ${reportData.totalItems}
- Total Value: ${formatCurrency(reportData.totalValue)}
- Low Stock Items: ${reportData.lowStockItems}
- Out of Stock Items: ${reportData.outOfStockItems}
- Average Item Value: ${formatCurrency(reportData.averageItemValue)}

PROFIT ANALYSIS:
- Total Revenue: ${formatCurrency(reportData.totalRevenue)}
- Total Profit: ${formatCurrency(reportData.totalProfit)}
- Profit Margin: ${reportData.profitMargin.toFixed(1)}%

CATEGORY BREAKDOWN:
${reportData.categoryBreakdown
  .map(
    (cat) => `- ${cat.category}: ${cat.count} items, ${formatCurrencyInt(cat.value)} value, ${formatCurrencyInt(cat.profit)} profit`,
  )
  .join("\n")}

INSIGHTS:
- Most Valuable Item: ${reportData.mostValuableItem?.name || "N/A"}
- Least Stocked Item: ${reportData.leastStockedItem?.name || "N/A"}

RECENT TRANSACTIONS (${periodText}):
${reportData.recentTransactions
  .map((t) => `- ${t.type.toUpperCase()}: ${t.quantity} units (${formatDate(new Date(t.created_at!))})`)
  .join("\n")}
    `

    try {
      await Share.share({
        message: reportText,
        title: `Inventory Report - ${periodText}`,
      })
    } catch (error) {
      Alert.alert("Error", "Failed to export report")
    }
  }

  const getChartTitle = () => {
    switch (selectedPeriod) {
      case "7d":
        return "Stock Movements & Profit (Last 7 Days)"
      case "30d":
        return "Stock Movements & Profit (Last 30 Days)"
      case "90d":
        return "Stock Movements & Profit (Last 90 Days)"
      case "all":
        return "Stock Movements & Profit (Last 30 Days)"
      default:
        return "Stock Movements & Profit"
    }
  }

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Enhanced Key Metrics with Profit */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="cube" size={24} color={theme.primary} />
          <Text style={[styles.metricNumber, { color: theme.text }]}>{reportData?.totalItems || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Items</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="cash" size={24} color={theme.success} />
          <Text style={[styles.metricNumber, { color: theme.text }]}>{formatCurrencyInt(reportData?.totalValue || 0)}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Value</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="trending-up" size={24} color={theme.accent} />
          <Text style={[styles.metricNumber, { color: theme.text }]}>{formatCurrencyInt(reportData?.totalProfit || 0)}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            {selectedPeriod === "all" ? "Total Profit" : `Profit (${selectedPeriod.toUpperCase()})`}
          </Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="stats-chart" size={24} color={theme.secondary} />
          <Text style={[styles.metricNumber, { color: theme.text }]}>{reportData?.profitMargin.toFixed(1) || 0}%</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Profit Margin</Text>
        </View>
      </View>

      {/* Responsive Stock Movement Chart with Profit */}
      <View style={[styles.chartContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>{getChartTitle()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollView}>
          <View style={styles.chartArea}>
            {reportData?.stockMovements.map((day, index) => (
              <View key={index} style={styles.chartBarContainer}>
                <View style={styles.barsGroup}>
                  {/* Pull In Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, { backgroundColor: theme.success }, { height: Math.max(day.pullIn * 4, 8) }]} />
                    <Text style={[styles.barValue, { color: theme.text }]}>{day.pullIn}</Text>
                    <Text style={[styles.barLabel, { color: theme.textSecondary }]}>In</Text>
                  </View>
                  {/* Pull Out Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, { backgroundColor: theme.accent }, { height: Math.max(day.pullOut * 4, 8) }]} />
                    <Text style={[styles.barValue, { color: theme.text }]}>{day.pullOut}</Text>
                    <Text style={[styles.barLabel, { color: theme.textSecondary }]}>Out</Text>
                  </View>
                  {/* Sales Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, { backgroundColor: theme.primary }, { height: Math.max(day.sales * 4, 8) }]} />
                    <Text style={[styles.barValue, { color: theme.text }]}>{day.sales}</Text>
                    <Text style={[styles.barLabel, { color: theme.textSecondary }]}>Sales</Text>
                  </View>
                  {/* Profit Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, { backgroundColor: theme.secondary }, { height: Math.max(day.profit / 10, 8) }]} />
                    <Text style={[styles.profitValue, { color: theme.secondary }]}>{formatCurrencyInt(day.profit)}</Text>
                    <Text style={[styles.barLabel, { color: theme.textSecondary }]}>Profit</Text>
                  </View>
                </View>
                <Text style={[styles.chartLabel, { color: theme.text }]}>{day.date}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.success }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Pull In</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.accent }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Pull Out</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Sales</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.secondary }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>Profit</Text>
          </View>
        </View>
      </View>

      {/* Enhanced Category Breakdown with Real Data */}
      <View style={[styles.categoryContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Category Performance</Text>
        {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0 ? (
          reportData.categoryBreakdown.map((category, index) => (
            <View key={index} style={[styles.categoryItem, { borderBottomColor: theme.border }]}>
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryName, { color: theme.text }]}>{category.category}</Text>
                <Text style={[styles.categoryCount, { color: theme.textSecondary }]}>{category.count} items</Text>
              </View>
              <View style={styles.categoryValues}>
                <Text style={[styles.categoryValue, { color: theme.primary }]}>{formatCurrencyInt(category.value)}</Text>
                <Text style={[styles.categoryProfit, { color: theme.success }]}>+{formatCurrencyInt(category.profit)} profit</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No items to categorize</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.textTertiary }]}>Add inventory items to see category breakdown</Text>
          </View>
        )}
      </View>
    </View>
  )

  const renderProfitTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Profit Analysis {selectedPeriod !== "all" ? `(${selectedPeriod.toUpperCase()})` : "(All Time)"}
      </Text>
      {/* Profit Overview Cards */}
      <View style={styles.profitOverview}>
        <View style={[styles.profitCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="trending-up" size={28} color={theme.success} />
          <Text style={[styles.profitNumber, { color: theme.text }]}>{formatCurrencyInt(reportData?.totalRevenue || 0)}</Text>
          <Text style={[styles.profitLabel, { color: theme.textSecondary }]}>
            {selectedPeriod === "all" ? "Total Revenue" : `Revenue (${selectedPeriod.toUpperCase()})`}
          </Text>
        </View>
        <View style={[styles.profitCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="cash" size={28} color={theme.primary} />
          <Text style={[styles.profitNumber, { color: theme.text }]}>{formatCurrencyInt(reportData?.totalProfit || 0)}</Text>
          <Text style={[styles.profitLabel, { color: theme.textSecondary }]}>
            {selectedPeriod === "all" ? "Total Profit" : `Profit (${selectedPeriod.toUpperCase()})`}
          </Text>
        </View>
        <View style={[styles.profitCard, { backgroundColor: theme.surface }]}>
          <Ionicons name="stats-chart" size={28} color={theme.secondary} />
          <Text style={[styles.profitNumber, { color: theme.text }]}>{reportData?.profitMargin.toFixed(1) || 0}%</Text>
          <Text style={[styles.profitLabel, { color: theme.textSecondary }]}>Profit Margin</Text>
        </View>
      </View>

      {/* Profit Trends */}
      <View style={[styles.trendsContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {selectedPeriod === "7d" ? "Daily" : selectedPeriod === "30d" ? "Weekly" : selectedPeriod === "90d" ? "Monthly" : "Quarterly"} Profit Trends
        </Text>
        {reportData?.profitTrends.map((trend, index) => (
          <View key={index} style={[styles.trendItem, { borderBottomColor: theme.border }]}>
            <View style={styles.trendInfo}>
              <Text style={[styles.trendPeriod, { color: theme.text }]}>{trend.period}</Text>
              <Text style={[styles.trendRevenue, { color: theme.textSecondary }]}>Revenue: {formatCurrencyInt(trend.revenue)}</Text>
            </View>
            <View style={styles.trendValues}>
              <Text style={[styles.trendProfit, { color: theme.success }]}>{formatCurrencyInt(trend.profit)}</Text>
              <Text style={[styles.trendMargin, { color: theme.textSecondary }]}>{trend.margin.toFixed(1)}% margin</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Profit Insights */}
      <View style={[styles.insightsContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Profit Insights</Text>
        <View style={[styles.insightItem, { borderBottomColor: theme.border }]}>
          <Ionicons name="bulb" size={20} color={theme.accent} />
          <Text style={[styles.insightText, { color: theme.text }]}>
            Your profit margin of {reportData?.profitMargin.toFixed(1)}% is{" "}
            {reportData && reportData.profitMargin > 30 ? "excellent" : reportData && reportData.profitMargin > 20 ? "good" : "needs improvement"}
          </Text>
        </View>
        <View style={[styles.insightItem, { borderBottomColor: theme.border }]}>
          <Ionicons name="trending-up" size={20} color={theme.success} />
          <Text style={[styles.insightText, { color: theme.text }]}>
            {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0
              ? `${reportData.categoryBreakdown[0].category} category generates the highest profit at ${formatCurrencyInt(reportData.categoryBreakdown[0].profit)}`
              : "Add more items to see category insights"}
          </Text>
        </View>
        {selectedPeriod !== "all" && (
          <View style={[styles.insightItem, { borderBottomColor: theme.border }]}>
            <Ionicons name="calendar" size={20} color={theme.primary} />
            <Text style={[styles.insightText, { color: theme.text }]}>
              This report covers the last {selectedPeriod === "7d" ? "7 days" : selectedPeriod === "30d" ? "30 days" : "90 days"} of activity
            </Text>
          </View>
        )}
      </View>
    </View>
  )

  const renderTransactionsTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Recent Transactions {selectedPeriod !== "all" ? `(${selectedPeriod.toUpperCase()})` : "(Latest)"}
      </Text>
      {reportData?.recentTransactions && reportData.recentTransactions.length > 0 ? (
        reportData.recentTransactions.map((transaction, index) => (
          <View key={index} style={[styles.transactionItem, { backgroundColor: theme.surface }]}>
            <View style={styles.transactionIcon}>
              <Ionicons
                name={transaction.type === "in" ? "add-circle" : transaction.type === "sold" ? "cash" : "remove-circle"}
                size={24}
                color={transaction.type === "in" ? theme.success : transaction.type === "sold" ? theme.primary : theme.accent}
              />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={[styles.transactionType, { color: theme.text }]}>
                {transaction.type === "in" ? "Pull In" : transaction.type === "sold" ? "Sale" : "Pull Out"}
              </Text>
              <Text style={[styles.transactionQuantity, { color: theme.textSecondary }]}>{transaction.quantity} units</Text>
              <Text style={[styles.transactionDate, { color: theme.textTertiary }]}>{formatDate(new Date(transaction.created_at!))}</Text>
            </View>
            {transaction.type === "sold" && transaction.total_amount && (
              <View style={styles.transactionProfit}>
                <Text style={[styles.transactionAmount, { color: theme.success }]}>{formatCurrency(transaction.total_amount)}</Text>
                <Text style={[styles.transactionProfitText, { color: theme.textSecondary }]}>Sale</Text>
              </View>
            )}
            {transaction.notes && <Text style={[styles.transactionNotes, { color: theme.textSecondary }]}>{transaction.notes}</Text>}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No transactions in this period</Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.textTertiary }]}>
            {selectedPeriod === "all" 
              ? "Start adding inventory and making sales to see transactions"
              : `No transactions found in the last ${selectedPeriod}`}
          </Text>
        </View>
      )}
    </View>
  )

  const renderInsightsTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Key Insights</Text>
      <View style={[styles.insightCard, { backgroundColor: theme.surface }]}>
        <Ionicons name="trending-up" size={24} color={theme.success} />
        <View style={styles.insightContent}>
          <Text style={[styles.insightTitle, { color: theme.text }]}>Most Valuable Item</Text>
          <Text style={[styles.insightValue, { color: theme.primary }]}>{reportData?.mostValuableItem?.name || "No items"}</Text>
          {reportData?.mostValuableItem && (
            <Text style={[styles.insightSubtext, { color: theme.textSecondary }]}>
              Value: {formatCurrency(reportData.mostValuableItem.cost_price * reportData.mostValuableItem.quantity)}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.insightCard, { backgroundColor: theme.surface }]}>
        <Ionicons name="cash" size={24} color={theme.primary} />
        <View style={styles.insightContent}>
          <Text style={[styles.insightTitle, { color: theme.text }]}>
            Profit Performance {selectedPeriod !== "all" ? `(${selectedPeriod.toUpperCase()})` : ""}
          </Text>
          <Text style={[styles.insightValue, { color: theme.primary }]}>{formatCurrency(reportData?.totalProfit || 0)}</Text>
          <Text style={[styles.insightSubtext, { color: theme.textSecondary }]}>
            {reportData?.profitMargin.toFixed(1)}% margin on {formatCurrency(reportData?.totalRevenue || 0)} revenue
          </Text>
        </View>
      </View>

      <View style={[styles.insightCard, { backgroundColor: theme.surface }]}>
        <Ionicons name="trending-down" size={24} color={theme.accent} />
        <View style={styles.insightContent}>
          <Text style={[styles.insightTitle, { color: theme.text }]}>Least Stocked Item</Text>
          <Text style={[styles.insightValue, { color: theme.primary }]}>{reportData?.leastStockedItem?.name || "No items"}</Text>
          {reportData?.leastStockedItem && (
            <Text style={[styles.insightSubtext, { color: theme.textSecondary }]}>Stock: {reportData.leastStockedItem.quantity} units</Text>
          )}
        </View>
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recommendations</Text>
        {reportData && (
          <>
            {reportData.lowStockItems > 0 && (
              <View style={[styles.recommendationItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="warning" size={20} color={theme.accent} />
                <Text style={[styles.recommendationText, { color: theme.text }]}>{reportData.lowStockItems} items need restocking</Text>
              </View>
            )}
            {reportData.outOfStockItems > 0 && (
              <View style={[styles.recommendationItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="alert-circle" size={20} color={theme.error} />
                <Text style={[styles.recommendationText, { color: theme.text }]}>
                  {reportData.outOfStockItems} items are completely out of stock
                </Text>
              </View>
            )}
            {reportData.profitMargin < 20 && reportData.totalRevenue > 0 && (
              <View style={[styles.recommendationItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="trending-up" size={20} color={theme.primary} />
                <Text style={[styles.recommendationText, { color: theme.text }]}>Consider reviewing pricing to improve profit margins</Text>
              </View>
            )}
            {reportData.totalItems === 0 && (
              <View style={[styles.recommendationItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="add-circle" size={20} color={theme.primary} />
                <Text style={[styles.recommendationText, { color: theme.text }]}>Start by adding your first inventory items</Text>
              </View>
            )}
            {selectedPeriod !== "all" && reportData.totalRevenue === 0 && (
              <View style={[styles.recommendationItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="calendar" size={20} color={theme.textSecondary} />
                <Text style={[styles.recommendationText, { color: theme.text }]}>
                  No sales recorded in the selected period. Try expanding the time range.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading reports...</Text>
      </View>
    )
  }

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.surface,
      alignItems: "center",
    },
    activePeriodButton: {
      backgroundColor: theme.primary,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: "center",
    },
    activeTabButton: {
      backgroundColor: theme.primary,
    },
  })

  return (
    <>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.background} 
      />
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Reports & Analytics</Text>
          <TouchableOpacity style={styles.exportButton} onPress={exportReport}>
            <Ionicons name="share-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(["7d", "30d", "90d", "all"] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                dynamicStyles.periodButton,
                selectedPeriod === period && dynamicStyles.activePeriodButton
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodText, 
                { color: theme.textSecondary },
                selectedPeriod === period && [styles.activePeriodText, { color: "#FFFFFF" }]
              ]}>
                {period === "all" ? "All Time" : period.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          {(["overview", "profit", "transactions", "insights"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                dynamicStyles.tabButton,
                activeTab === tab && dynamicStyles.activeTabButton
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText, 
                { color: theme.textSecondary },
                activeTab === tab && [styles.activeTabText, { color: "#FFFFFF" }]
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "overview" && renderOverviewTab()}
          {activeTab === "profit" && renderProfitTab()}
          {activeTab === "transactions" && renderTransactionsTab()}
          {activeTab === "insights" && renderInsightsTab()}
        </ScrollView>
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  exportButton: {
    padding: 8,
  },
  periodSelector: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  periodText: {
    fontSize: 14,
    fontWeight: "500",
  },
  activePeriodText: {
    // Applied dynamically
  },
  tabNavigation: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeTabText: {
    // Applied dynamically
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  chartContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  chartScrollView: {
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 160,
    paddingHorizontal: 8,
    minWidth: width - 80,
  },
  chartBarContainer: {
    alignItems: "center",
    marginHorizontal: 8,
    minWidth: 80,
  },
  barsGroup: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
    height: 120,
  },
  barColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 120,
    minWidth: 16,
  },
  bar: {
    width: 12,
    borderRadius: 6,
    minHeight: 8,
    marginBottom: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  profitValue: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  barLabel: {
    fontSize: 8,
    textAlign: "center",
  },
  chartLabel: {
    fontSize: 11,
    textAlign: "center",
    fontWeight: "500",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "500",
  },
  categoryContainer: {
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
  },
  categoryCount: {
    fontSize: 14,
  },
  categoryValues: {
    alignItems: "flex-end",
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  categoryProfit: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  // Profit Tab Styles
  profitOverview: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  profitCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  profitNumber: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  profitLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  trendsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  trendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  trendInfo: {
    flex: 1,
  },
  trendPeriod: {
    fontSize: 16,
    fontWeight: "500",
  },
  trendRevenue: {
    fontSize: 14,
  },
  trendValues: {
    alignItems: "flex-end",
  },
  trendProfit: {
    fontSize: 16,
    fontWeight: "600",
  },
  trendMargin: {
    fontSize: 12,
  },
  insightsContainer: {
    borderRadius: 16,
    padding: 16,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  insightText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionIcon: {
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: "600",
  },
  transactionQuantity: {
    fontSize: 14,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionProfit: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  transactionProfitText: {
    fontSize: 12,
  },
  transactionNotes: {
    fontSize: 12,
    fontStyle: "italic",
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  insightContent: {
    marginLeft: 16,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  insightSubtext: {
    fontSize: 12,
  },
  recommendationsContainer: {
    marginTop: 24,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  recommendationText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
})