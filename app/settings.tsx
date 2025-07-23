"use client"
import { useState, useEffect } from "react"
import type React from "react"

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Modal,
  TextInput,
  Switch,
  Share,
  Appearance,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import InventoryService from "@/lib/inventory"
import NotificationService from "@/lib/notificationService"
import { useSettings } from "@/hooks/useSettings"
import { useTheme } from "@/hooks/useTheme"
import BackupService from "@/lib/backupService"
import SettingsService from "@/lib/settingsService"

export default function SettingsScreen() {
  const { settings, updateSetting } = useSettings()
  const { theme, isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [showThresholdModal, setShowThresholdModal] = useState(false)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [showDateFormatModal, setShowDateFormatModal] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showBackupFrequencyModal, setShowBackupFrequencyModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBackupHistoryModal, setShowBackupHistoryModal] = useState(false)
  const [tempThreshold, setTempThreshold] = useState("10")
  const [importText, setImportText] = useState("")
  const [backupHistory, setBackupHistory] = useState<any[]>([])

  const notificationService = NotificationService.getInstance()
  const backupService = BackupService.getInstance()

  useEffect(() => {
    initializeSettings()
    initializeNotifications()
    setupAutoBackupMonitoring()
  }, [])

  const initializeSettings = async () => {
    try {
      await SettingsService.getInstance().initialize()
      await loadBackupHistory()
    } catch (error) {
      console.error('Error initializing settings:', error)
    }
  }

  const initializeNotifications = async () => {
    const hasPermission = await notificationService.requestPermissions()
    if (!hasPermission) {
      Alert.alert(
        "Notification Permissions",
        "Notifications are optimized for in-app use in Expo Go. For full system notifications, create a development build.",
        [{ text: "OK" }]
      )
    }
  }

  const setupAutoBackupMonitoring = () => {
    // Check for auto backup every time settings screen loads
    const checkAutoBackup = async () => {
      try {
        if (settings.backup.autoBackup) {
          await backupService.performAutoBackup()
        }
      } catch (error) {
        console.error('Auto backup check failed:', error)
      }
    }

    checkAutoBackup()
  }

  const loadBackupHistory = async () => {
    try {
      const history = await backupService.getAutoBackupHistory()
      setBackupHistory(history)
    } catch (error) {
      console.error('Error loading backup history:', error)
    }
  }

  const handleUpdateSetting = async (section: keyof typeof settings, key: string, value: any) => {
    try {
      await updateSetting(section, key, value)

      // Handle specific setting changes
      if (section === "inventory" && key === "defaultLowStockThreshold") {
        await checkLowStockWithNewThreshold(value)
      }

      if (section === "notifications") {
        await handleNotificationSettingChange(key, value)
      }

      if (section === "backup") {
        await handleBackupSettingChange(key, value)
      }
    } catch (error) {
      console.error('Error updating setting:', error)
      Alert.alert("Error", "Failed to update setting")
    }
  }

  const handleBackupSettingChange = async (key: string, value: any) => {
    if (key === "autoBackup" && value) {
      Alert.alert(
        "Auto Backup Enabled! 📦",
        `Your inventory will be automatically backed up ${settings.backup.backupFrequency}.\n\nFeatures:\n• Automatic data protection\n• Local backup storage\n• Configurable frequency\n• Background operation`,
        [
          { text: "OK" },
          { 
            text: "Backup Now", 
            onPress: () => handleCreateBackup()
          }
        ]
      )

      // Perform immediate backup when auto backup is enabled
      setTimeout(async () => {
        try {
          await backupService.performAutoBackup()
        } catch (error) {
          console.error('Initial auto backup failed:', error)
        }
      }, 1000)
    }

    if (key === "backupFrequency") {
      Alert.alert(
        "Backup Frequency Updated",
        `Your backup frequency has been set to ${value}.\n\n${value === 'daily' ? 'Your data will be backed up every day.' : 
          value === 'weekly' ? 'Your data will be backed up every week.' : 
          'Your data will be backed up every month.'}\n\nNext backup will occur automatically based on this schedule.`,
        [{ text: "OK" }]
      )
    }
  }

  const checkLowStockWithNewThreshold = async (threshold: number) => {
    try {
      await InventoryService.initializeDatabase()
      const items = await InventoryService.getAllItems()
      const lowStockItems = items.filter((item) => item.quantity <= threshold)

      if (lowStockItems.length > 0) {
        Alert.alert(
          "Low Stock Alert",
          `With the new threshold of ${threshold}, you currently have ${lowStockItems.length} items that are low in stock: ${lowStockItems
            .map((item) => item.name)
            .slice(0, 3)
            .join(", ")}${lowStockItems.length > 3 ? "..." : ""}`,
          [{ text: "OK" }],
        )
        await notificationService.triggerLowStockCheck(InventoryService)
      }
    } catch (error) {
      console.error("Error checking low stock items:", error)
    }
  }

  const handleNotificationSettingChange = async (key: string, value: boolean) => {
    if (key === "lowStockAlerts" && value) {
      await notificationService.triggerLowStockCheck(InventoryService)
    } else if (key === "dailyReports" && value) {
      Alert.alert(
        "Daily Reports Enabled",
        "You'll receive daily inventory summaries with sales data, stock levels, and alerts.",
        [{ text: "OK" }]
      )
    } else if (key === "salesNotifications" && value) {
      Alert.alert(
        "Sales Notifications Enabled",
        "You'll receive notifications whenever a sale is recorded in your inventory.",
        [{ text: "OK" }]
      )
    }
  }

  const handleTestNotifications = async () => {
    Alert.alert(
      "Test Notifications",
      "Choose which notification to test:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Low Stock Alert",
          onPress: async () => {
            if (settings.notifications.lowStockAlerts) {
              await notificationService.triggerLowStockCheck(InventoryService)
              Alert.alert("Test Sent", "Check your notifications!")
            } else {
              Alert.alert("Disabled", "Low stock alerts are currently disabled.")
            }
          }
        },
        {
          text: "Daily Report",
          onPress: async () => {
            if (settings.notifications.dailyReports) {
              await notificationService.triggerDailyReport(InventoryService)
              Alert.alert("Test Sent", "Daily report generated!")
            } else {
              Alert.alert("Disabled", "Daily reports are currently disabled.")
            }
          }
        },
        {
          text: "Sales Notification",
          onPress: async () => {
            if (settings.notifications.salesNotifications) {
              await notificationService.sendSalesNotification("Test Product", 2, 25.99)
              Alert.alert("Test Sent", "Sales notification sent!")
            } else {
              Alert.alert("Disabled", "Sales notifications are currently disabled.")
            }
          }
        }
      ]
    )
  }

  const handleResetDatabase = () => {
    Alert.alert(
      "Reset Database",
      "This will permanently delete all your inventory data, users, and transactions. This action cannot be undone.\n\nRecommendation: Create a backup first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create Backup First",
          onPress: () => handleCreateBackup(),
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)
              await InventoryService.resetDatabase()
              await notificationService.clearAllNotifications()
              Alert.alert("Success", "Database has been reset successfully")
            } catch (error) {
              console.error("Error resetting database:", error)
              Alert.alert("Error", "Failed to reset database")
            } finally {
              setLoading(false)
            }
          },
        },
      ],
    )
  }

  const handleExportData = async () => {
    try {
      setLoading(true)
      await backupService.exportCSV()
    } catch (error) {
      console.error("Error exporting data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setLoading(true)
      await backupService.exportBackup()
      await loadBackupHistory() // Refresh backup history
    } catch (error) {
      console.error("Error creating backup:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportData = () => {
    Alert.alert(
      "Import Data 📥",
      "Choose import method:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CSV Import",
          onPress: () => setShowImportModal(true)
        },
        {
          text: "Sample Format",
          onPress: async () => {
            try {
              const sampleData = await backupService.generateSampleCSV()
              await Share.share({
                message: sampleData,
                title: "Sample CSV Format for Import",
              })
            } catch (error) {
              Alert.alert("Error", "Failed to generate sample CSV")
            }
          },
        },
        {
          text: "View Guide",
          onPress: () => {
            Alert.alert(
              "Import Guide 📖",
              "CSV Format Requirements:\n\n1. First row must be headers\n2. Required column: Name\n3. Optional columns: Cost Price, Selling Price, Quantity, Min Stock Level\n\nTips:\n• Use quotes for text with commas\n• Numbers only for prices and quantities\n• Missing prices default to 0\n• Missing min level defaults to 10",
              [{ text: "Got it!" }]
            )
          }
        }
      ],
    )
  }

  const processImport = async () => {
    if (!importText.trim()) {
      Alert.alert("Error", "Please enter CSV data to import")
      return
    }

    try {
      setLoading(true)
      const items = backupService.parseCSVImport(importText)
      
      if (items.length === 0) {
        Alert.alert("Error", "No valid items found in CSV data")
        return
      }

      Alert.alert(
        "Confirm Import 📥",
        `Found ${items.length} items to import:\n\n${items.slice(0, 3).map(item => `• ${item.name}`).join('\n')}${items.length > 3 ? `\n• ... and ${items.length - 3} more` : ''}\n\nThis will add new items to your inventory. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: async () => {
              try {
                let successCount = 0
                let errorCount = 0
                const errors: string[] = []

                for (const item of items) {
                  try {
                    await InventoryService.addItem(item)
                    successCount++
                  } catch (error) {
                    errorCount++
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                    if (errorMessage.includes('UNIQUE constraint failed')) {
                      errors.push(`${item.name}: Already exists (duplicate name)`)
                    } else {
                      errors.push(`${item.name}: ${errorMessage}`)
                    }
                  }
                }

                setImportText("")
                setShowImportModal(false)

                if (successCount > 0) {
                  const message = errorCount > 0 
                    ? `Successfully imported ${successCount} items.\n\n${errorCount} items failed:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n... and more' : ''}`
                    : `Successfully imported ${successCount} items! 🎉`

                  Alert.alert("Import Complete! 📦", message)
                } else {
                  Alert.alert(
                    "Import Failed", 
                    `No items were imported.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n... and more' : ''}`,
                    [{ text: "OK" }]
                  )
                }
              } catch (error) {
                console.error("Import error:", error)
                Alert.alert("Error", "Failed to import some items")
              }
            }
          }
        ]
      )
    } catch (error) {
      Alert.alert("Error", `Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const showBackupHistory = async () => {
    await loadBackupHistory()
    setShowBackupHistoryModal(true)
  }

  const formatBackupDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'Unknown date'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const currencies = ["₱", "$", "€", "£", "¥", "₹", "₦", "R", "¢"]
  const dateFormats = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "YYYY/MM/DD"]
  const themes = [
    { key: "light", label: "Light", icon: "sunny-outline" },
    { key: "dark", label: "Dark", icon: "moon-outline" },
    { key: "system", label: "System", icon: "phone-portrait-outline" },
  ]
  const backupFrequencies = [
    { key: "daily", label: "Daily", description: "Backup every day" },
    { key: "weekly", label: "Weekly", description: "Backup every week" },
    { key: "monthly", label: "Monthly", description: "Backup every month" },
  ]

  const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: theme.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  )

  const SettingRow = ({
    icon,
    title,
    subtitle,
    rightComponent,
    onPress,
    showBadge = false,
    badgeText = "",
  }: {
    icon: string
    title: string
    subtitle?: string
    rightComponent?: React.ReactNode
    onPress?: () => void
    showBadge?: boolean
    badgeText?: string
  }) => (
    <TouchableOpacity 
      style={[styles.settingRow, { borderBottomColor: theme.border }]} 
      onPress={onPress} 
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIconContainer}>
          <Ionicons name={icon as any} size={24} color={theme.primary} />
          {showBadge && (
            <View style={[styles.settingBadge, { backgroundColor: theme.error }]}>
              <Text style={styles.settingBadgeText}>{badgeText}</Text>
            </View>
          )}
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent}
    </TouchableOpacity>
  )

  const getLastBackupText = () => {
    const lastBackup = settings.backup.lastBackupDate
    if (!lastBackup) return "Never"
    
    const date = new Date(lastBackup)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff === 0) return "Today"
    if (daysDiff === 1) return "Yesterday"
    if (daysDiff < 7) return `${daysDiff} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading settings...</Text>
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
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
  })

  return (
    <>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.background} 
      />
      <View style={dynamicStyles.container}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          <TouchableOpacity onPress={showBackupHistory}>
            <Ionicons name="time-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Notifications */}
          <SettingSection title="Notifications">
            <SettingRow
              icon="notifications-outline"
              title="Low Stock Alerts"
              subtitle="Get notified when items are running low"
              rightComponent={
                <Switch
                  value={settings.notifications.lowStockAlerts}
                  onValueChange={(value) => handleUpdateSetting("notifications", "lowStockAlerts", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <SettingRow
              icon="document-text-outline"
              title="Daily Reports"
              subtitle="Receive daily inventory summaries"
              rightComponent={
                <Switch
                  value={settings.notifications.dailyReports}
                  onValueChange={(value) => handleUpdateSetting("notifications", "dailyReports", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <SettingRow
              icon="cash-outline"
              title="Sales Notifications"
              subtitle="Get notified about sales transactions"
              rightComponent={
                <Switch
                  value={settings.notifications.salesNotifications}
                  onValueChange={(value) => handleUpdateSetting("notifications", "salesNotifications", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <SettingRow
              icon="flask-outline"
              title="Test Notifications"
              subtitle="Test different notification types"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={handleTestNotifications}
            />
          </SettingSection>

          {/* Inventory */}
          <SettingSection title="Inventory">
            <SettingRow
              icon="warning-outline"
              title="Low Stock Threshold"
              subtitle={`Default minimum stock level: ${settings.inventory.defaultLowStockThreshold} units`}
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={() => {
                setTempThreshold(settings.inventory.defaultLowStockThreshold.toString())
                setShowThresholdModal(true)
              }}
            />
            <SettingRow
              icon="calculator-outline"
              title="Auto Calculate Profit"
              subtitle="Automatically calculate profit margins"
              rightComponent={
                <Switch
                  value={settings.inventory.autoCalculateProfit}
                  onValueChange={(value) => handleUpdateSetting("inventory", "autoCalculateProfit", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <SettingRow
              icon="eye-outline"
              title="Show Cost Prices"
              subtitle="Display cost prices in inventory views"
              rightComponent={
                <Switch
                  value={settings.inventory.showCostPrices}
                  onValueChange={(value) => handleUpdateSetting("inventory", "showCostPrices", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </SettingSection>

          {/* Display */}
          <SettingSection title="Display">
            <SettingRow
              icon="card-outline"
              title="Currency"
              subtitle={`Current: ${settings.display.currency}`}
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={() => setShowCurrencyModal(true)}
            />
            <SettingRow
              icon="calendar-outline"
              title="Date Format"
              subtitle={`Current: ${settings.display.dateFormat}`}
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={() => setShowDateFormatModal(true)}
            />
            <SettingRow
              icon="color-palette-outline"
              title="Theme"
              subtitle={`Current: ${settings.display.theme.charAt(0).toUpperCase() + settings.display.theme.slice(1)}`}
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={() => setShowThemeModal(true)}
            />
          </SettingSection>

          {/* Enhanced Backup & Data */}
          <SettingSection title="Backup & Data">
            <SettingRow
              icon="cloud-upload-outline"
              title="Auto Backup"
              subtitle={`Automatically backup data ${settings.backup.backupFrequency} • Last: ${getLastBackupText()}`}
              rightComponent={
                <Switch
                  value={settings.backup.autoBackup}
                  onValueChange={(value) => handleUpdateSetting("backup", "autoBackup", value)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#FFFFFF"
                />
              }
              showBadge={settings.backup.autoBackup}
              badgeText="AUTO"
            />
            <SettingRow
              icon="time-outline"
              title="Backup Frequency"
              subtitle={`Backup schedule: ${settings.backup.backupFrequency.charAt(0).toUpperCase() + settings.backup.backupFrequency.slice(1)}`}
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={() => setShowBackupFrequencyModal(true)}
            />
            <SettingRow
              icon="cloud-upload-outline"
              title="Create Backup Now"
              subtitle="Manually create a complete backup of your data"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={handleCreateBackup}
            />
            <SettingRow
              icon="download-outline"
              title="Export Data"
              subtitle="Export your inventory data as CSV with analytics"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={handleExportData}
            />
            <SettingRow
              icon="cloud-download-outline"
              title="Import Data"
              subtitle="Import inventory data from CSV files"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={handleImportData}
            />
            <SettingRow
              icon="archive-outline"
              title="Backup History"
              subtitle="View your automatic backup history"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
              onPress={showBackupHistory}
            />
          </SettingSection>

          {/* Danger Zone */}
          <SettingSection title="Danger Zone">
            <SettingRow
              icon="trash-outline"
              title="Reset Database"
              subtitle="Delete all data and start fresh"
              rightComponent={<Ionicons name="chevron-forward" size={20} color={theme.error} />}
              onPress={handleResetDatabase}
            />
          </SettingSection>
        </ScrollView>

        {/* All Modals */}
        {/* Threshold Modal */}
        <Modal visible={showThresholdModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowThresholdModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Low Stock Threshold</Text>
              <TouchableOpacity
                onPress={() => {
                  const threshold = parseInt(tempThreshold) || 10
                  handleUpdateSetting("inventory", "defaultLowStockThreshold", threshold)
                  setShowThresholdModal(false)
                }}
              >
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                Set the default minimum stock level for new items. You'll be alerted when items fall below this threshold.
              </Text>
              <TextInput
                style={[styles.thresholdInput, { backgroundColor: theme.surface, color: theme.text }]}
                value={tempThreshold}
                onChangeText={setTempThreshold}
                keyboardType="numeric"
                placeholder="Enter threshold"
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
            </View>
          </View>
        </Modal>

        {/* Currency Modal */}
        <Modal visible={showCurrencyModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Currency</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalContent}>
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.optionRow, 
                    { backgroundColor: theme.surface },
                    settings.display.currency === currency && [styles.selectedOption, { borderColor: theme.primary }]
                  ]}
                  onPress={() => {
                    handleUpdateSetting("display", "currency", currency)
                    setShowCurrencyModal(false)
                  }}
                >
                  <Text
                    style={[
                      styles.optionText, 
                      { color: theme.text },
                      settings.display.currency === currency && [styles.selectedOptionText, { color: theme.primary }]
                    ]}
                  >
                    {currency}
                  </Text>
                  {settings.display.currency === currency && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Date Format Modal */}
        <Modal visible={showDateFormatModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowDateFormatModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Date Format</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalContent}>
              {dateFormats.map((format) => (
                <TouchableOpacity
                  key={format}
                  style={[
                    styles.optionRow, 
                    { backgroundColor: theme.surface },
                    settings.display.dateFormat === format && [styles.selectedOption, { borderColor: theme.primary }]
                  ]}
                  onPress={() => {
                    handleUpdateSetting("display", "dateFormat", format)
                    setShowDateFormatModal(false)
                  }}
                >
                  <View style={styles.dateFormatOption}>
                    <Text
                      style={[
                        styles.optionText, 
                        { color: theme.text },
                        settings.display.dateFormat === format && [styles.selectedOptionText, { color: theme.primary }]
                      ]}
                    >
                      {format}
                    </Text>
                    <Text style={[styles.dateExample, { color: theme.textSecondary }]}>
                      {new Date().toLocaleDateString(
                        format === "MM/DD/YYYY" ? "en-US" : 
                        format === "DD/MM/YYYY" ? "en-GB" : 
                        format === "YYYY-MM-DD" ? "sv-SE" :
                        format === "DD-MM-YYYY" ? "en-GB" : "ja-JP"
                      )}
                    </Text>
                  </View>
                  {settings.display.dateFormat === format && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Theme Modal */}
        <Modal visible={showThemeModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowThemeModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Theme</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalContent}>
              {themes.map((themeOption) => (
                <TouchableOpacity
                  key={themeOption.key}
                  style={[
                    styles.optionRow, 
                    { backgroundColor: theme.surface },
                    settings.display.theme === themeOption.key && [styles.selectedOption, { borderColor: theme.primary }]
                  ]}
                  onPress={() => {
                    handleUpdateSetting("display", "theme", themeOption.key)
                    setShowThemeModal(false)
                  }}
                >
                  <View style={styles.themeOption}>
                    <Ionicons name={themeOption.icon as any} size={24} color={theme.primary} />
                    <View style={styles.themeOptionText}>
                      <Text
                        style={[
                          styles.optionText, 
                          { color: theme.text },
                          settings.display.theme === themeOption.key && [styles.selectedOptionText, { color: theme.primary }]
                        ]}
                      >
                        {themeOption.label}
                      </Text>
                      <Text style={[styles.themeDescription, { color: theme.textSecondary }]}>
                        {themeOption.key === "system" 
                          ? `Follows system theme (${Appearance.getColorScheme()})`
                          : `Uses ${themeOption.key} theme`
                        }
                      </Text>
                    </View>
                  </View>
                  {settings.display.theme === themeOption.key && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Enhanced Backup Frequency Modal */}
        <Modal visible={showBackupFrequencyModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowBackupFrequencyModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Backup Frequency</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                Choose how often you want your inventory data to be automatically backed up.
              </Text>
              {backupFrequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.key}
                  style={[
                    styles.optionRow, 
                    { backgroundColor: theme.surface },
                    settings.backup.backupFrequency === freq.key && [styles.selectedOption, { borderColor: theme.primary }]
                  ]}
                  onPress={() => {
                    handleUpdateSetting("backup", "backupFrequency", freq.key)
                    setShowBackupFrequencyModal(false)
                  }}
                >
                  <View style={styles.backupFrequencyOption}>
                    <Text
                      style={[
                        styles.optionText, 
                        { color: theme.text },
                        settings.backup.backupFrequency === freq.key && [styles.selectedOptionText, { color: theme.primary }]
                      ]}
                    >
                      {freq.label}
                    </Text>
                    <Text style={[styles.backupDescription, { color: theme.textSecondary }]}>
                      {freq.description}
                    </Text>
                  </View>
                  {settings.backup.backupFrequency === freq.key && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Enhanced Import Modal */}
        <Modal visible={showImportModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Import CSV Data</Text>
              <TouchableOpacity onPress={processImport}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Import</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                Paste your CSV data below. Required: Name column. Optional: Cost Price, Selling Price, Quantity, Min Stock Level
              </Text>
              
              <View style={styles.importHelp}>
                <TouchableOpacity 
                  style={[styles.helpButton, { backgroundColor: `${theme.primary}15` }]}
                  onPress={async () => {
                    try {
                      const sampleData = await backupService.generateSampleCSV()
                      setImportText(sampleData)
                    } catch (error) {
                      Alert.alert("Error", "Failed to load sample data")
                    }
                  }}
                >
                  <Ionicons name="document-outline" size={16} color={theme.primary} />
                  <Text style={[styles.helpButtonText, { color: theme.primary }]}>Load Sample</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.helpButton, { backgroundColor: `${theme.textSecondary}15` }]}
                  onPress={() => setImportText("")}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.helpButtonText, { color: theme.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.helpButton, { backgroundColor: `${theme.accent}15` }]}
                  onPress={() => {
                    Alert.alert(
                      "Import Guide 📖",
                      "CSV Format Requirements:\n\n• First row must be headers\n• Required: Name column\n• Optional: Cost Price, Selling Price, Quantity, Min Stock Level\n\nTips:\n• Use quotes for text with commas\n• Duplicate names will be skipped\n• Missing prices default to 0\n• Missing quantities default to 0",
                      [{ text: "Got it!" }]
                    )
                  }}
                >
                  <Ionicons name="help-circle-outline" size={16} color={theme.accent} />
                  <Text style={[styles.helpButtonText, { color: theme.accent }]}>Help</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.importInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                value={importText}
                onChangeText={setImportText}
                placeholder="Paste CSV data here..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
              
              {importText.length > 0 && (
                <Text style={[styles.importPreview, { color: theme.textSecondary }]}>
                  {importText.split('\n').length - 1} rows detected
                </Text>
              )}
            </View>
          </View>
        </Modal>

        {/* Backup History Modal */}
        <Modal visible={showBackupHistoryModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <TouchableOpacity onPress={() => setShowBackupHistoryModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Backup History</Text>
              <TouchableOpacity onPress={loadBackupHistory}>
                <Ionicons name="refresh-outline" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                Your recent automatic backups. These are stored locally on your device.
              </Text>
              
              {backupHistory.length === 0 ? (
                <View style={styles.emptyBackupHistory}>
                  <Ionicons name="archive-outline" size={48} color={theme.textTertiary} />
                  <Text style={[styles.emptyBackupText, { color: theme.textSecondary }]}>No backup history</Text>
                  <Text style={[styles.emptyBackupSubtext, { color: theme.textTertiary }]}>
                    Enable auto backup to see your backup history here
                  </Text>
                </View>
              ) : (
                <>
                  {backupHistory.map((backup, index) => (
                    <View key={index} style={[styles.backupHistoryItem, { backgroundColor: theme.surface }]}>
                      <View style={styles.backupHistoryInfo}>
                        <Text style={[styles.backupHistoryDate, { color: theme.text }]}>
                          {formatBackupDate(backup.date)}
                        </Text>
                        <Text style={[styles.backupHistoryDetails, { color: theme.textSecondary }]}>
                          {backup.items} items • {formatFileSize(backup.size)}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                    </View>
                  ))}
                  
                  <View style={[styles.backupStats, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.backupStatsTitle, { color: theme.text }]}>Statistics</Text>
                    <Text style={[styles.backupStatsText, { color: theme.textSecondary }]}>
                      Total backups: {backupHistory.length}
                    </Text>
                    <Text style={[styles.backupStatsText, { color: theme.textSecondary }]}>
                      Auto backup: {settings.backup.autoBackup ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Text style={[styles.backupStatsText, { color: theme.textSecondary }]}>
                      Frequency: {settings.backup.backupFrequency}
                    </Text>
                  </View>
                </>
              )}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionContent: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIconContainer: {
    position: "relative",
    marginRight: 12,
  },
  settingBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  settingBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
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
  saveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  thresholdInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  importInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    height: 200,
    borderWidth: 1,
  },
  importHelp: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  importPreview: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedOption: {
    borderWidth: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  selectedOptionText: {
    fontWeight: "600",
  },
  dateFormatOption: {
    flex: 1,
  },
  dateExample: {
    fontSize: 12,
    marginTop: 2,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  themeOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  themeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  backupFrequencyOption: {
    flex: 1,
  },
  backupDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyBackupHistory: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyBackupText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyBackupSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  backupHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  backupHistoryInfo: {
    flex: 1,
  },
  backupHistoryDate: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  backupHistoryDetails: {
    fontSize: 14,
  },
  backupStats: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  backupStatsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  backupStatsText: {
    fontSize: 14,
    marginBottom: 4,
  },
})