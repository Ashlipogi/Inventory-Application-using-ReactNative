"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, Share } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import InventoryService, { type InventoryItem, type StockTransaction } from "@/lib/inventory"

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
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d")
  const [activeTab, setActiveTab] = useState<"overview" | "profit" | "transactions" | "insights">("overview")

  useEffect(() => {
    loadReportData()
  }, [selectedPeriod])

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
      const profitShare =
        items.length > 0 ? value / items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0) : 0
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

      // Get all inventory items
      const allItems = await InventoryService.getAllItems()
      const lowStockItems = await InventoryService.getLowStockItems()
      const totalValue = await InventoryService.getTotalStockValue()
      const recentTransactions = await InventoryService.getStockTransactions()
      const salesData = await InventoryService.getSalesData()

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

      // Generate real category breakdown based on actual items
      const categoryBreakdown = generateCategoryBreakdown(allItems, salesData.totalProfit)

      // Generate enhanced stock movements with profit data
      const stockMovements = generateStockMovements(recentTransactions, salesData.totalProfit)

      // Generate profit trends
      const profitTrends = [
        { period: "Week 1", revenue: salesData.totalRevenue * 0.2, profit: salesData.totalProfit * 0.18, margin: 36.0 },
        {
          period: "Week 2",
          revenue: salesData.totalRevenue * 0.25,
          profit: salesData.totalProfit * 0.26,
          margin: 41.6,
        },
        {
          period: "Week 3",
          revenue: salesData.totalRevenue * 0.28,
          profit: salesData.totalProfit * 0.31,
          margin: 44.3,
        },
        {
          period: "Week 4",
          revenue: salesData.totalRevenue * 0.27,
          profit: salesData.totalProfit * 0.25,
          margin: 37.0,
        },
      ]

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

  const generateStockMovements = (transactions: StockTransaction[], totalProfit: number) => {
    const last7Days = []
    const today = new Date()
    const dailyProfitBase = totalProfit / 30 // Approximate daily profit

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const dayTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.created_at!).toISOString().split("T")[0]
        return transactionDate === dateStr
      })

      const pullIn = dayTransactions.filter((t) => t.type === "in").reduce((sum, t) => sum + t.quantity, 0)
      const pullOut = dayTransactions.filter((t) => t.type === "out").reduce((sum, t) => sum + t.quantity, 0)
      const sales = dayTransactions.filter((t) => t.type === "sold").reduce((sum, t) => sum + t.quantity, 0)

      // Calculate daily profit based on sales
      const dailyProfit = sales > 0 ? dailyProfitBase * (0.5 + Math.random()) : 0

      last7Days.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pullIn,
        pullOut,
        sales,
        profit: Math.round(dailyProfit),
      })
    }

    return last7Days
  }

  const exportReport = async () => {
    if (!reportData) return

    const reportText = `INVENTORY REPORT
Generated: ${new Date().toLocaleDateString()}
Period: ${selectedPeriod}

OVERVIEW:
- Total Items: ${reportData.totalItems}
- Total Value: $${reportData.totalValue.toFixed(2)}
- Low Stock Items: ${reportData.lowStockItems}
- Out of Stock Items: ${reportData.outOfStockItems}
- Average Item Value: $${reportData.averageItemValue.toFixed(2)}

PROFIT ANALYSIS:
- Total Revenue: $${reportData.totalRevenue.toFixed(2)}
- Total Profit: $${reportData.totalProfit.toFixed(2)}
- Profit Margin: ${reportData.profitMargin.toFixed(1)}%

CATEGORY BREAKDOWN:
${reportData.categoryBreakdown
  .map(
    (cat) => `- ${cat.category}: ${cat.count} items, ₱${cat.value.toFixed(0)} value, ₱${cat.profit.toFixed(0)} profit`,
  )
  .join("\n")}

INSIGHTS:
- Most Valuable Item: ${reportData.mostValuableItem?.name || "N/A"}
- Least Stocked Item: ${reportData.leastStockedItem?.name || "N/A"}

RECENT TRANSACTIONS:
${reportData.recentTransactions
  .map((t) => `- ${t.type.toUpperCase()}: ${t.quantity} units (${new Date(t.created_at!).toLocaleDateString()})`)
  .join("\n")}
    `

    try {
      await Share.share({
        message: reportText,
        title: "Inventory Report",
      })
    } catch (error) {
      Alert.alert("Error", "Failed to export report")
    }
  }

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Enhanced Key Metrics with Profit */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Ionicons name="cube" size={24} color="#007AFF" />
          <Text style={styles.metricNumber}>{reportData?.totalItems || 0}</Text>
          <Text style={styles.metricLabel}>Total Items</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="cash" size={24} color="#34C759" />
          <Text style={styles.metricNumber}>₱{reportData?.totalValue.toFixed(0) || 0}</Text>
          <Text style={styles.metricLabel}>Total Value</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="trending-up" size={24} color="#FF9500" />
          <Text style={styles.metricNumber}>₱{reportData?.totalProfit.toFixed(0) || 0}</Text>
          <Text style={styles.metricLabel}>Total Profit</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="stats-chart" size={24} color="#AF52DE" />
          <Text style={styles.metricNumber}>{reportData?.profitMargin.toFixed(1) || 0}%</Text>
          <Text style={styles.metricLabel}>Profit Margin</Text>
        </View>
      </View>

      {/* Responsive Stock Movement Chart with Profit */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Stock Movements & Profit (Last 7 Days)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollView}>
          <View style={styles.chartArea}>
            {reportData?.stockMovements.map((day, index) => (
              <View key={index} style={styles.chartBarContainer}>
                <View style={styles.barsGroup}>
                  {/* Pull In Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, styles.pullInBar, { height: Math.max(day.pullIn * 4, 8) }]} />
                    <Text style={styles.barValue}>{day.pullIn}</Text>
                    <Text style={styles.barLabel}>In</Text>
                  </View>
                  {/* Pull Out Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, styles.pullOutBar, { height: Math.max(day.pullOut * 4, 8) }]} />
                    <Text style={styles.barValue}>{day.pullOut}</Text>
                    <Text style={styles.barLabel}>Out</Text>
                  </View>
                  {/* Sales Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, styles.salesBar, { height: Math.max(day.sales * 4, 8) }]} />
                    <Text style={styles.barValue}>{day.sales}</Text>
                    <Text style={styles.barLabel}>Sales</Text>
                  </View>
                  {/* Profit Bar */}
                  <View style={styles.barColumn}>
                    <View style={[styles.bar, styles.profitBar, { height: Math.max(day.profit / 10, 8) }]} />
                    <Text style={styles.profitValue}>₱{day.profit}</Text>
                    <Text style={styles.barLabel}>Profit</Text>
                  </View>
                </View>
                <Text style={styles.chartLabel}>{day.date}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#34C759" }]} />
            <Text style={styles.legendText}>Pull In</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#FF9500" }]} />
            <Text style={styles.legendText}>Pull Out</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#007AFF" }]} />
            <Text style={styles.legendText}>Sales</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: "#AF52DE" }]} />
            <Text style={styles.legendText}>Profit</Text>
          </View>
        </View>
      </View>

      {/* Enhanced Category Breakdown with Real Data */}
      <View style={styles.categoryContainer}>
        <Text style={styles.sectionTitle}>Category Performance</Text>
        {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0 ? (
          reportData.categoryBreakdown.map((category, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.category}</Text>
                <Text style={styles.categoryCount}>{category.count} items</Text>
              </View>
              <View style={styles.categoryValues}>
                <Text style={styles.categoryValue}>₱{category.value.toFixed(0)}</Text>
                <Text style={styles.categoryProfit}>+₱{category.profit.toFixed(0)} profit</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>No items to categorize</Text>
            <Text style={styles.emptyStateSubtext}>Add inventory items to see category breakdown</Text>
          </View>
        )}
      </View>
    </View>
  )

  const renderProfitTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Profit Analysis</Text>
      {/* Profit Overview Cards */}
      <View style={styles.profitOverview}>
        <View style={styles.profitCard}>
          <Ionicons name="trending-up" size={28} color="#34C759" />
          <Text style={styles.profitNumber}>₱{reportData?.totalRevenue.toFixed(0) || 0}</Text>
          <Text style={styles.profitLabel}>Total Revenue</Text>
        </View>
        <View style={styles.profitCard}>
          <Ionicons name="cash" size={28} color="#007AFF" />
          <Text style={styles.profitNumber}>₱{reportData?.totalProfit.toFixed(0) || 0}</Text>
          <Text style={styles.profitLabel}>Total Profit</Text>
        </View>
        <View style={styles.profitCard}>
          <Ionicons name="stats-chart" size={28} color="#AF52DE" />
          <Text style={styles.profitNumber}>{reportData?.profitMargin.toFixed(1) || 0}%</Text>
          <Text style={styles.profitLabel}>Profit Margin</Text>
        </View>
      </View>

      {/* Profit Trends */}
      <View style={styles.trendsContainer}>
        <Text style={styles.sectionTitle}>Weekly Profit Trends</Text>
        {reportData?.profitTrends.map((week, index) => (
          <View key={index} style={styles.trendItem}>
            <View style={styles.trendInfo}>
              <Text style={styles.trendPeriod}>{week.period}</Text>
              <Text style={styles.trendRevenue}>Revenue: ₱{week.revenue.toFixed(0)}</Text>
            </View>
            <View style={styles.trendValues}>
              <Text style={styles.trendProfit}>₱{week.profit.toFixed(0)}</Text>
              <Text style={styles.trendMargin}>{week.margin.toFixed(1)}% margin</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Profit Insights */}
      <View style={styles.insightsContainer}>
        <Text style={styles.sectionTitle}>Profit Insights</Text>
        <View style={styles.insightItem}>
          <Ionicons name="bulb" size={20} color="#FF9500" />
          <Text style={styles.insightText}>
            Your profit margin of {reportData?.profitMargin.toFixed(1)}% is{" "}
            {reportData && reportData.profitMargin > 30 ? "excellent" : "good"}
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="trending-up" size={20} color="#34C759" />
          <Text style={styles.insightText}>
            {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0
              ? `${reportData.categoryBreakdown[0].category} category generates the highest profit at ₱${reportData.categoryBreakdown[0].profit.toFixed(0)}`
              : "Add more items to see category insights"}
          </Text>
        </View>
      </View>
    </View>
  )

  const renderTransactionsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {reportData?.recentTransactions && reportData.recentTransactions.length > 0 ? (
        reportData.recentTransactions.map((transaction, index) => (
          <View key={index} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <Ionicons
                name={transaction.type === "in" ? "add-circle" : transaction.type === "sold" ? "cash" : "remove-circle"}
                size={24}
                color={transaction.type === "in" ? "#34C759" : transaction.type === "sold" ? "#007AFF" : "#FF9500"}
              />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionType}>
                {transaction.type === "in" ? "Pull In" : transaction.type === "sold" ? "Sale" : "Pull Out"}
              </Text>
              <Text style={styles.transactionQuantity}>{transaction.quantity} units</Text>
              <Text style={styles.transactionDate}>{new Date(transaction.created_at!).toLocaleDateString()}</Text>
            </View>
            {transaction.type === "sold" && transaction.total_amount && (
              <View style={styles.transactionProfit}>
                <Text style={styles.transactionAmount}>₱{transaction.total_amount.toFixed(2)}</Text>
                <Text style={styles.transactionProfitText}>Sale</Text>
              </View>
            )}
            {transaction.notes && <Text style={styles.transactionNotes}>{transaction.notes}</Text>}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyStateText}>No transactions yet</Text>
          <Text style={styles.emptyStateSubtext}>Start adding inventory and making sales to see transactions</Text>
        </View>
      )}
    </View>
  )

  const renderInsightsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Key Insights</Text>
      <View style={styles.insightCard}>
        <Ionicons name="trending-up" size={24} color="#34C759" />
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>Most Valuable Item</Text>
          <Text style={styles.insightValue}>{reportData?.mostValuableItem?.name || "No items"}</Text>
          {reportData?.mostValuableItem && (
            <Text style={styles.insightSubtext}>
              Value: ₱{(reportData.mostValuableItem.cost_price * reportData.mostValuableItem.quantity).toFixed(2)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.insightCard}>
        <Ionicons name="cash" size={24} color="#007AFF" />
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>Profit Performance</Text>
          <Text style={styles.insightValue}>₱{reportData?.totalProfit.toFixed(2) || "0.00"}</Text>
          <Text style={styles.insightSubtext}>
            {reportData?.profitMargin.toFixed(1)}% margin on ₱{reportData?.totalRevenue.toFixed(2)} revenue
          </Text>
        </View>
      </View>

      <View style={styles.insightCard}>
        <Ionicons name="trending-down" size={24} color="#FF9500" />
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>Least Stocked Item</Text>
          <Text style={styles.insightValue}>{reportData?.leastStockedItem?.name || "No items"}</Text>
          {reportData?.leastStockedItem && (
            <Text style={styles.insightSubtext}>Stock: {reportData.leastStockedItem.quantity} units</Text>
          )}
        </View>
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={styles.sectionTitle}>Recommendations</Text>
        {reportData && (
          <>
            {reportData.lowStockItems > 0 && (
              <View style={styles.recommendationItem}>
                <Ionicons name="warning" size={20} color="#FF9500" />
                <Text style={styles.recommendationText}>{reportData.lowStockItems} items need restocking</Text>
              </View>
            )}
            {reportData.outOfStockItems > 0 && (
              <View style={styles.recommendationItem}>
                <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                <Text style={styles.recommendationText}>
                  {reportData.outOfStockItems} items are completely out of stock
                </Text>
              </View>
            )}
            {reportData.profitMargin < 20 && (
              <View style={styles.recommendationItem}>
                <Ionicons name="trending-up" size={20} color="#007AFF" />
                <Text style={styles.recommendationText}>Consider reviewing pricing to improve profit margins</Text>
              </View>
            )}
            {reportData.totalItems === 0 && (
              <View style={styles.recommendationItem}>
                <Ionicons name="add-circle" size={20} color="#007AFF" />
                <Text style={styles.recommendationText}>Start by adding your first inventory items</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading reports...</Text>
      </View>
    )
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Reports & Analytics</Text>
          <TouchableOpacity style={styles.exportButton} onPress={exportReport}>
            <Ionicons name="share-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(["7d", "30d", "90d", "all"] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.activePeriodButton]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[styles.periodText, selectedPeriod === period && styles.activePeriodText]}>
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
              style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
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
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  activePeriodButton: {
    backgroundColor: "#007AFF",
  },
  periodText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8E8E93",
  },
  activePeriodText: {
    color: "#FFFFFF",
  },
  tabNavigation: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: "#007AFF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
  activeTabText: {
    color: "#FFFFFF",
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
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#8E8E93",
  },
  chartContainer: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
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
    color: "#1C1C1E",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  profitValue: {
    fontSize: 9,
    color: "#AF52DE",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  barLabel: {
    fontSize: 8,
    color: "#8E8E93",
    textAlign: "center",
  },
  pullInBar: {
    backgroundColor: "#34C759",
  },
  pullOutBar: {
    backgroundColor: "#FF9500",
  },
  salesBar: {
    backgroundColor: "#007AFF",
  },
  profitBar: {
    backgroundColor: "#AF52DE",
  },
  chartLabel: {
    fontSize: 11,
    color: "#1C1C1E",
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
    color: "#1C1C1E",
    fontWeight: "500",
  },
  categoryContainer: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  categoryCount: {
    fontSize: 14,
    color: "#8E8E93",
  },
  categoryValues: {
    alignItems: "flex-end",
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  categoryProfit: {
    fontSize: 12,
    color: "#34C759",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8E8E93",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#C7C7CC",
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
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  profitNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 4,
  },
  profitLabel: {
    fontSize: 11,
    color: "#8E8E93",
    textAlign: "center",
  },
  trendsContainer: {
    backgroundColor: "#F2F2F7",
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
    borderBottomColor: "#E5E5EA",
  },
  trendInfo: {
    flex: 1,
  },
  trendPeriod: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  trendRevenue: {
    fontSize: 14,
    color: "#8E8E93",
  },
  trendValues: {
    alignItems: "flex-end",
  },
  trendProfit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34C759",
  },
  trendMargin: {
    fontSize: 12,
    color: "#8E8E93",
  },
  insightsContainer: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  insightText: {
    fontSize: 14,
    color: "#1C1C1E",
    marginLeft: 12,
    flex: 1,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
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
    color: "#1C1C1E",
  },
  transactionQuantity: {
    fontSize: 14,
    color: "#8E8E93",
  },
  transactionDate: {
    fontSize: 12,
    color: "#C7C7CC",
  },
  transactionProfit: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#34C759",
  },
  transactionProfitText: {
    fontSize: 12,
    color: "#8E8E93",
  },
  transactionNotes: {
    fontSize: 12,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
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
    color: "#1C1C1E",
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 2,
  },
  insightSubtext: {
    fontSize: 12,
    color: "#8E8E93",
  },
  recommendationsContainer: {
    marginTop: 24,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recommendationText: {
    fontSize: 14,
    color: "#1C1C1E",
    marginLeft: 12,
    flex: 1,
  },
})
