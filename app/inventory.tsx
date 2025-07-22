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

export default function InventoryScreen() {
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
      const profit = (unitPrice - selectedItem.cost_price) * qty
      Alert.alert(
        "Sale Recorded! 💰",
        `Sold ${qty} units for $${totalAmount.toFixed(2)}\nProfit: $${profit.toFixed(2)}`,
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
    setMinStockLevel("")
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

    return (
      <View style={[styles.itemCard, isLowStock && styles.lowStockCard]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            {isLowStock && (
              <View style={styles.lowStockBadge}>
                <Ionicons name="warning" size={12} color="#FF3B30" />
                <Text style={styles.lowStockText}>Low Stock</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item)}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemDetails}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Cost: ₱{item.cost_price.toFixed(2)}</Text>
            <Text style={styles.priceLabel}>Sell: ₱{item.selling_price.toFixed(2)}</Text>
          </View>

          <View style={styles.stockRow}>
            <Text style={styles.stockText}>Stock: {item.quantity}</Text>
            <Text style={styles.valueText}>Value: ₱{stockValue.toFixed(2)}</Text>
          </View>

          <View style={styles.salesRow}>
            <Text style={styles.soldText}>Sold: {totalSold} units</Text>
            <Text style={styles.minStockText}>Min Level: {item.min_stock_level}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.pullInButton]}
            onPress={() => openStockModal(item, "in")}
          >
            <Ionicons name="add-circle-outline" size={18} color="#34C759" />
            <Text style={styles.pullInText}>Pull In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.pullOutButton]}
            onPress={() => openStockModal(item, "out")}
          >
            <Ionicons name="remove-circle-outline" size={18} color="#FF9500" />
            <Text style={styles.pullOutText}>Pull Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saleButton]}
            onPress={() => openSaleModal(item)}
            disabled={item.quantity === 0}
          >
            <Ionicons name="cash-outline" size={18} color={item.quantity === 0 ? "#C7C7CC" : "#007AFF"} />
            <Text style={[styles.saleText, item.quantity === 0 && styles.disabledText]}>Sell</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading inventory...</Text>
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
          <Text style={styles.title}>Inventory Management</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{items.length}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{lowStockItems.length}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>₱{totalStockValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
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
              <Ionicons name="cube-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySubtext}>Add your first product to get started</Text>
            </View>
          }
        />

        {/* Sale Modal */}
        <Modal visible={showSaleModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSaleModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Record Sale</Text>
              <TouchableOpacity onPress={handleSale}>
                <Text style={styles.saveText}>Sell</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedItem && (
                <>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName}>{selectedItem.name}</Text>
                    <Text style={styles.currentStock}>Available: {selectedItem.quantity} units</Text>
                    <Text style={styles.soldInfo}>Total Sold: {selectedItem.total_sold || 0} units</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity to Sell</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter quantity"
                      value={saleQuantity}
                      onChangeText={setSaleQuantity}
                      keyboardType="number-pad"
                    />
                    {saleQuantity && Number.parseInt(saleQuantity) > selectedItem.quantity && (
                      <Text style={styles.errorText}>
                        Insufficient stock! Only {selectedItem.quantity} units available
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Sale Price per Unit</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      value={salePrice}
                      onChangeText={setSalePrice}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.salePreviewContainer}>
                    <View style={styles.salePreviewRow}>
                      <Text style={styles.previewLabel}>Total Amount:</Text>
                      <Text style={styles.salePreviewValue}>
                        ₱{((Number.parseFloat(salePrice) || 0) * (Number.parseInt(saleQuantity) || 0)).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.salePreviewRow}>
                      <Text style={styles.previewLabel}>Profit per Unit:</Text>
                      <Text style={styles.profitValue}>
                        ₱{((Number.parseFloat(salePrice) || 0) - selectedItem.cost_price).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.salePreviewRow}>
                      <Text style={styles.previewLabel}>Total Profit:</Text>
                      <Text style={styles.profitValue}>
                        ₱
                        {(
                          ((Number.parseFloat(salePrice) || 0) - selectedItem.cost_price) *
                          (Number.parseInt(saleQuantity) || 0)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Add Product Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={handleAddProduct}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter product name"
                  value={productName}
                  onChangeText={setProductName}
                />
              </View>

              <View style={styles.priceInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Cost Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Selling Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.priceInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Initial Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Min Stock Level</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={minStockLevel}
                    onChangeText={setMinStockLevel}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Stock Update Modal */}
        <Modal visible={showStockModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowStockModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{stockType === "in" ? "Pull In Stock" : "Pull Out Stock"}</Text>
              <TouchableOpacity onPress={handleStockUpdate}>
                <Text style={styles.saveText}>Update</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedItem && (
                <>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName}>{selectedItem.name}</Text>
                    <Text style={styles.currentStock}>Current Stock: {selectedItem.quantity}</Text>
                  </View>

                  <View style={styles.stockTypeButtons}>
                    <TouchableOpacity
                      style={[styles.stockTypeButton, stockType === "in" && styles.activeStockType]}
                      onPress={() => setStockType("in")}
                    >
                      <Ionicons name="add-circle" size={24} color={stockType === "in" ? "#FFFFFF" : "#34C759"} />
                      <Text style={[styles.stockTypeText, stockType === "in" && styles.activeStockTypeText]}>
                        Pull In
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.stockTypeButton, stockType === "out" && styles.activeStockType]}
                      onPress={() => setStockType("out")}
                    >
                      <Ionicons name="remove-circle" size={24} color={stockType === "out" ? "#FFFFFF" : "#FF9500"} />
                      <Text style={[styles.stockTypeText, stockType === "out" && styles.activeStockTypeText]}>
                        Pull Out
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter quantity"
                      value={stockQuantity}
                      onChangeText={setStockQuantity}
                      keyboardType="number-pad"
                    />
                  </View>

                  <View style={styles.previewContainer}>
                    <Text style={styles.previewLabel}>New Stock Level:</Text>
                    <Text style={styles.previewValue}>
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
  addButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  itemCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  lowStockCard: {
    borderWidth: 2,
    borderColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
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
    color: "#1C1C1E",
    marginBottom: 4,
  },
  lowStockBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
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
    color: "#8E8E93",
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  stockText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  valueText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  salesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  soldText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#34C759",
  },
  minStockText: {
    fontSize: 12,
    color: "#8E8E93",
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
  pullInButton: {
    backgroundColor: "#E8F5E8",
  },
  pullOutButton: {
    backgroundColor: "#FFF3E0",
  },
  saleButton: {
    backgroundColor: "#E3F2FD",
  },
  pullInText: {
    color: "#34C759",
    fontWeight: "600",
    fontSize: 12,
  },
  pullOutText: {
    color: "#FF9500",
    fontWeight: "600",
    fontSize: 12,
  },
  saleText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 12,
  },
  disabledText: {
    color: "#C7C7CC",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 4,
  },
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
  saveText: {
    fontSize: 16,
    color: "#007AFF",
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
    color: "#1C1C1E",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: "#1C1C1E",
  },
  errorText: {
    color: "#FF3B30",
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
  selectedItemInfo: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  selectedItemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  currentStock: {
    fontSize: 14,
    color: "#8E8E93",
  },
  soldInfo: {
    fontSize: 14,
    color: "#34C759",
    marginTop: 2,
  },
  stockTypeButtons: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  stockTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    gap: 8,
  },
  activeStockType: {
    backgroundColor: "#007AFF",
  },
  stockTypeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeStockTypeText: {
    color: "#FFFFFF",
  },
  previewContainer: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 16,
    color: "#8E8E93",
  },
  previewValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
  },
  salePreviewContainer: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
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
    color: "#007AFF",
  },
  profitValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34C759",
  },
})
