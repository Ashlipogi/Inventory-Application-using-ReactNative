"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import InventoryService, { type InventoryItem } from "@/lib/inventory"
import { useTheme } from "@/hooks/useTheme"
import { useSettings } from "@/hooks/useSettings"

export default function InventoryScreen() {
  const { theme, isDark } = useTheme()
  const { formatCurrency, formatCurrencyInt, shouldShowCostPrices, getDefaultLowStockThreshold, calculateProfit } = useSettings()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])

  // Form states
  const [productName, setProductName] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [minStockLevel, setMinStockLevel] = useState("")
  const [stockQuantity, setStockQuantity] = useState("")
  const [stockType, setStockType] = useState<"in" | "out">("in")

  // Sale form states
  const [saleQuantity, setSaleQuantity] = useState("")
  const [salePrice, setSalePrice] = useState("")

  useEffect(() => {
    initializeInventory()
  }, [])

  // Set default min stock level when opening add modal
  useEffect(() => {
    if (showAddModal) {
      setMinStockLevel(getDefaultLowStockThreshold().toString())
    }
  }, [showAddModal, getDefaultLowStockThreshold])

  const initializeInventory = async () => {
    try {
      await InventoryService.initializeDatabase()
      await loadInventory()
    } catch (error) {
      console.error("Failed to initialize inventory:", error)
      Alert.alert("Error", "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }

  const loadInventory = async () => {
    try {
      const inventoryItems = await InventoryService.getAllItems()
      setItems(inventoryItems)

      // Check for low stock items
      const lowStock = inventoryItems.filter((item) => item.quantity <= item.min_stock_level)
      setLowStockItems(lowStock)

      if (lowStock.length > 0) {
        showLowStockAlert(lowStock)
      }
    } catch (error) {
      console.error("Failed to load inventory:", error)
    }
  }

  const showLowStockAlert = (lowStockItems: InventoryItem[]) => {
    const itemNames = lowStockItems.map((item) => item.name).join(", ")
    Alert.alert("Low Stock Alert! ⚠️", `The following items are running low: ${itemNames}`, [{ text: "OK" }])
  }

  const handleAddProduct = async () => {
    if (!productName || !costPrice || !sellingPrice || !quantity || !minStockLevel) {
      Alert.alert("Missing Information", "Please fill in all fields")
      return
    }

    try {
      const newItem = {
        name: productName,
        cost_price: Number.parseFloat(costPrice),
        selling_price: Number.parseFloat(sellingPrice),
        quantity: Number.parseInt(quantity),
        min_stock_level: Number.parseInt(minStockLevel),
      }

      await InventoryService.addItem(newItem)
      await loadInventory()
      clearAddForm()
      setShowAddModal(false)
      Alert.alert("Success", "Product added successfully!")
    } catch (error) {
      console.error("Failed to add product:", error)
      Alert.alert("Error", "Failed to add product")
    }
  }

  const handleStockUpdate = async () => {
    if (!selectedItem || !stockQuantity) {
      Alert.alert("Missing Information", "Please enter quantity")
      return
    }

    try {
      const qty = Number.parseInt(stockQuantity)
      const newQuantity = stockType === "in" ? selectedItem.quantity + qty : selectedItem.quantity - qty

      if (newQuantity < 0) {
        Alert.alert("Invalid Quantity", "Cannot have negative stock")
        return
      }

      await InventoryService.updateStock(selectedItem.id!, newQuantity)
      await loadInventory()
      setStockQuantity("")
      setShowStockModal(false)
      setSelectedItem(null)

      const action = stockType === "in" ? "added to" : "removed from"
      Alert.alert("Success", `Stock ${action} ${selectedItem.name}`)
    } catch (error) {
      console.error("Failed to update stock:", error)
      Alert.alert("Error", "Failed to update stock")
    }
  }

  const handleSale = async () => {
    if (!selectedItem || !saleQuantity) {
      Alert.alert("Missing Information", "Please enter sale quantity")
      return
    }

    try {
      const qty = Number.parseInt(saleQuantity)
      const unitPrice = salePrice ? Number.parseFloat(salePrice) : selectedItem.selling_price

      // Validate quantity before attempting sale
      if (qty <= 0) {
        Alert.alert("Invalid Quantity", "Please enter a valid quantity")
        return
      }

      if (qty > selectedItem.quantity) {
        Alert.alert("Insufficient Stock", `Only ${selectedItem.quantity} units available in stock`)
        return
      }

      // Refresh item data to ensure we have the latest stock quantity
      const currentItem = await InventoryService.getItemById(selectedItem.id!)
      if (!currentItem) {
        Alert.alert("Error", "Item not found")
        return
      }

      if (qty > currentItem.quantity) {
        Alert.alert("Insufficient Stock", `Only ${currentItem.quantity} units available in stock`)
        return
      }

      await InventoryService.recordSale(selectedItem.id!, qty, unitPrice)
      await loadInventory()
      setSaleQuantity("")
      setSalePrice("")
      setShowSaleModal(false)
      setSelectedItem(null)

      const totalAmount = unitPrice * qty
      const profit = calculateProfit(selectedItem.cost_price, unitPrice, qty)
      const profitMessage = profit > 0 ? `\nProfit: ${formatCurrency(profit)}` : ""
      
      Alert.alert(
        "Sale Recorded! 💰",
        `Sold ${qty} units for ${formatCurrency(totalAmount)}${profitMessage}`,
      )
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message)
        Alert.alert("Error", error.message)
      } else {
        console.error("Unknown error:", error)
        Alert.alert("Error", "An unexpected error occurred.")
      }
    }
  }

  const clearAddForm = () => {
    setProductName("")
    setCostPrice("")
    setSellingPrice("")
    setQuantity("")
    setMinStockLevel(getDefaultLowStockThreshold().toString())
  }

  const openStockModal = (item: InventoryItem, type: "in" | "out") => {
    setSelectedItem(item)
    setStockType(type)
    setShowStockModal(true)
  }

  const openSaleModal = (item: InventoryItem) => {
    setSelectedItem(item)
    setSalePrice(item.selling_price.toString())
    setSaleQuantity("")
    setShowSaleModal(true)
  }

  const deleteItem = async (item: InventoryItem) => {
    Alert.alert("Delete Product", `Are you sure you want to delete ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await InventoryService.deleteItem(item.id!)
            await loadInventory()
            Alert.alert("Success", "Product deleted")
          } catch (error) {
            Alert.alert("Error", "Failed to delete product")
          }
        },
      },
    ])
  }

  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const totalStockValue = items.reduce((total, item) => {
    return total + item.cost_price * item.quantity
  }, 0)

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => {
    const isLowStock = item.quantity <= item.min_stock_level
    const stockValue = item.cost_price * item.quantity
    const totalSold = item.total_sold || 0
    const profit = calculateProfit(item.cost_price, item.selling_price, totalSold)

    return (
      <View style={[
        styles.itemCard, 
        { backgroundColor: theme.surface },
        isLowStock && { borderWidth: 2, borderColor: theme.error, backgroundColor: `${theme.error}10` }
      ]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
            {isLowStock && (
              <View style={[styles.lowStockBadge, { backgroundColor: theme.error }]}>
                <Ionicons name="warning" size={12} color="#FFFFFF" />
                <Text style={styles.lowStockText}>Low Stock</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item)}>
            <Ionicons name="trash-outline" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.itemDetails}>
          <View style={styles.priceRow}>
            {shouldShowCostPrices() && (
              <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Cost: {formatCurrency(item.cost_price)}
              </Text>
            )}
            <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Sell: {formatCurrency(item.selling_price)}
            </Text>
          </View>

          <View style={styles.stockRow}>
            <Text style={[styles.stockText, { color: theme.text }]}>Stock: {item.quantity}</Text>
            <Text style={[styles.valueText, { color: theme.primary }]}>
              Value: {formatCurrency(stockValue)}
            </Text>
          </View>

          <View style={styles.salesRow}>
            <Text style={[styles.soldText, { color: theme.success }]}>Sold: {totalSold} units</Text>
            {shouldShowCostPrices() && profit > 0 && (
              <Text style={[styles.profitText, { color: theme.success }]}>
                Profit: {formatCurrency(profit)}
              </Text>
            )}
            <Text style={[styles.minStockText, { color: theme.textSecondary }]}>Min Level: {item.min_stock_level}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: `${theme.success}20` }]}
            onPress={() => openStockModal(item, "in")}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.success} />
            <Text style={[styles.pullInText, { color: theme.success }]}>Pull In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: `${theme.accent}20` }]}
            onPress={() => openStockModal(item, "out")}
          >
            <Ionicons name="remove-circle-outline" size={18} color={theme.accent} />
            <Text style={[styles.pullOutText, { color: theme.accent }]}>Pull Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: item.quantity === 0 ? `${theme.textTertiary}20` : `${theme.primary}20` }]}
            onPress={() => openSaleModal(item)}
            disabled={item.quantity === 0}
          >
            <Ionicons name="cash-outline" size={18} color={item.quantity === 0 ? theme.textTertiary : theme.primary} />
            <Text style={[
              styles.saleText, 
              { color: item.quantity === 0 ? theme.textTertiary : theme.primary }
            ]}>Sell</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading inventory...</Text>
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
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginHorizontal: 24,
      marginBottom: 20,
      paddingHorizontal: 16,
      height: 44,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      height: 52,
      fontSize: 16,
      color: theme.text,
    },
    selectedItemInfo: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      alignItems: "center",
    },
    stockTypeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: theme.surface,
      gap: 8,
    },
    activeStockType: {
      backgroundColor: theme.primary,
    },
    previewContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    salePreviewContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
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
          <Text style={[styles.title, { color: theme.text }]}>Inventory Management</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={dynamicStyles.statCard}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Items</Text>
          </View>
          <View style={dynamicStyles.statCard}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{lowStockItems.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Low Stock</Text>
          </View>
          <View style={dynamicStyles.statCard}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{formatCurrencyInt(totalStockValue)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Value</Text>
          </View>
        </View>

        <View style={dynamicStyles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search products..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderInventoryItem}
          keyExtractor={(item) => item.id!.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No products found</Text>
              <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>Add your first product to get started</Text>
            </View>
          }
        />

        {/* Sale Modal */}
        <Modal visible={showSaleModal} animationType="slide" presentationStyle="pageSheet">
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSaleModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Record Sale</Text>
              <TouchableOpacity onPress={handleSale}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Sell</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedItem && (
                <>
                  <View style={dynamicStyles.selectedItemInfo}>
                    <Text style={[styles.selectedItemName, { color: theme.text }]}>{selectedItem.name}</Text>
                    <Text style={[styles.currentStock, { color: theme.textSecondary }]}>Available: {selectedItem.quantity} units</Text>
                    <Text style={[styles.soldInfo, { color: theme.success }]}>Total Sold: {selectedItem.total_sold || 0} units</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Quantity to Sell</Text>
                    <TextInput
                      style={dynamicStyles.input}
                      placeholder="Enter quantity"
                      placeholderTextColor={theme.textSecondary}
                      value={saleQuantity}
                      onChangeText={setSaleQuantity}
                      keyboardType="number-pad"
                    />
                    {saleQuantity && Number.parseInt(saleQuantity) > selectedItem.quantity && (
                      <Text style={[styles.errorText, { color: theme.error }]}>
                        Insufficient stock! Only {selectedItem.quantity} units available
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Sale Price per Unit</Text>
                    <TextInput
                      style={dynamicStyles.input}
                      placeholder="0.00"
                      placeholderTextColor={theme.textSecondary}
                      value={salePrice}
                      onChangeText={setSalePrice}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={dynamicStyles.salePreviewContainer}>
                    <View style={styles.salePreviewRow}>
                      <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Total Amount:</Text>
                      <Text style={[styles.salePreviewValue, { color: theme.primary }]}>
                        {formatCurrency((Number.parseFloat(salePrice) || 0) * (Number.parseInt(saleQuantity) || 0))}
                      </Text>
                    </View>
                    {shouldShowCostPrices() && (
                      <>
                        <View style={styles.salePreviewRow}>
                          <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Profit per Unit:</Text>
                          <Text style={[styles.profitValue, { color: theme.success }]}>
                            {formatCurrency((Number.parseFloat(salePrice) || 0) - selectedItem.cost_price)}
                          </Text>
                        </View>
                        <View style={styles.salePreviewRow}>
                          <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Total Profit:</Text>
                          <Text style={[styles.profitValue, { color: theme.success }]}>
                            {formatCurrency(calculateProfit(selectedItem.cost_price, Number.parseFloat(salePrice) || 0, Number.parseInt(saleQuantity) || 0))}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Add Product Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Product</Text>
              <TouchableOpacity onPress={handleAddProduct}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Product Name</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Enter product name"
                  placeholderTextColor={theme.textSecondary}
                  value={productName}
                  onChangeText={setProductName}
                />
              </View>

              <View style={styles.priceInputs}>
                <View style={styles.halfInput}>
                  <Text style={[styles.label, { color: theme.text }]}>Cost Price</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.label, { color: theme.text }]}>Selling Price</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.priceInputs}>
                <View style={styles.halfInput}>
                  <Text style={[styles.label, { color: theme.text }]}>Initial Quantity</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.label, { color: theme.text }]}>Min Stock Level</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder={getDefaultLowStockThreshold().toString()}
                    placeholderTextColor={theme.textSecondary}
                    value={minStockLevel}
                    onChangeText={setMinStockLevel}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Profit Preview (if auto calculate is enabled) */}
              {costPrice && sellingPrice && quantity && (
                <View style={dynamicStyles.salePreviewContainer}>
                  <View style={styles.salePreviewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Initial Stock Value:</Text>
                    <Text style={[styles.salePreviewValue, { color: theme.primary }]}>
                      {formatCurrency((Number.parseFloat(costPrice) || 0) * (Number.parseInt(quantity) || 0))}
                    </Text>
                  </View>
                  <View style={styles.salePreviewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Potential Selling Value:</Text>
                    <Text style={[styles.salePreviewValue, { color: theme.success }]}>
                      {formatCurrency((Number.parseFloat(sellingPrice) || 0) * (Number.parseInt(quantity) || 0))}
                    </Text>
                  </View>
                  <View style={styles.salePreviewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Profit per Unit:</Text>
                    <Text style={[styles.profitValue, { color: theme.success }]}>
                      {formatCurrency((Number.parseFloat(sellingPrice) || 0) - (Number.parseFloat(costPrice) || 0))}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Stock Update Modal */}
        <Modal visible={showStockModal} animationType="slide" presentationStyle="pageSheet">
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowStockModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{stockType === "in" ? "Pull In Stock" : "Pull Out Stock"}</Text>
              <TouchableOpacity onPress={handleStockUpdate}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Update</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedItem && (
                <>
                  <View style={dynamicStyles.selectedItemInfo}>
                    <Text style={[styles.selectedItemName, { color: theme.text }]}>{selectedItem.name}</Text>
                    <Text style={[styles.currentStock, { color: theme.textSecondary }]}>Current Stock: {selectedItem.quantity}</Text>
                  </View>

                  <View style={styles.stockTypeButtons}>
                    <TouchableOpacity
                      style={[
                        dynamicStyles.stockTypeButton, 
                        stockType === "in" && [styles.activeStockType, { backgroundColor: theme.primary }]
                      ]}
                      onPress={() => setStockType("in")}
                    >
                      <Ionicons name="add-circle" size={24} color={stockType === "in" ? "#FFFFFF" : theme.success} />
                      <Text style={[
                        styles.stockTypeText, 
                        { color: theme.textSecondary },
                        stockType === "in" && [styles.activeStockTypeText, { color: "#FFFFFF" }]
                      ]}>
                        Pull In
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        dynamicStyles.stockTypeButton, 
                        stockType === "out" && [styles.activeStockType, { backgroundColor: theme.primary }]
                      ]}
                      onPress={() => setStockType("out")}
                    >
                      <Ionicons name="remove-circle" size={24} color={stockType === "out" ? "#FFFFFF" : theme.accent} />
                      <Text style={[
                        styles.stockTypeText, 
                        { color: theme.textSecondary },
                        stockType === "out" && [styles.activeStockTypeText, { color: "#FFFFFF" }]
                      ]}>
                        Pull Out
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Quantity</Text>
                    <TextInput
                      style={dynamicStyles.input}
                      placeholder="Enter quantity"
                      placeholderTextColor={theme.textSecondary}
                      value={stockQuantity}
                      onChangeText={setStockQuantity}
                      keyboardType="number-pad"
                    />
                  </View>

                  <View style={dynamicStyles.previewContainer}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>New Stock Level:</Text>
                    <Text style={[styles.previewValue, { color: theme.primary }]}>
                      {stockQuantity
                        ? stockType === "in"
                          ? selectedItem.quantity + Number.parseInt(stockQuantity || "0")
                          : selectedItem.quantity - Number.parseInt(stockQuantity || "0")
                        : selectedItem.quantity}
                    </Text>
                  </View>
                </>
              )}
            </View>
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  addButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  lowStockBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  lowStockText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  deleteButton: {
    padding: 4,
  },
  itemDetails: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  stockText: {
    fontSize: 16,
    fontWeight: "600",
  },
  valueText: {
    fontSize: 16,
    fontWeight: "600",
  },
  salesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },
  soldText: {
    fontSize: 14,
    fontWeight: "500",
  },
  profitText: {
    fontSize: 12,
    fontWeight: "500",
  },
  minStockText: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  pullInText: {
    fontWeight: "600",
    fontSize: 12,
  },
  pullOutText: {
    fontWeight: "600",
    fontSize: 12,
  },
  saleText: {
    fontWeight: "600",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: "500",
  },
  priceInputs: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  halfInput: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  currentStock: {
    fontSize: 14,
  },
  soldInfo: {
    fontSize: 14,
    marginTop: 2,
  },
  stockTypeButtons: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  activeStockType: {
    // Applied dynamically
  },
  stockTypeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  activeStockTypeText: {
    // Applied dynamically
  },
  previewLabel: {
    fontSize: 16,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  salePreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  salePreviewValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  profitValue: {
    fontSize: 16,
    fontWeight: "600",
  },
})