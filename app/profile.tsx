"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Modal, TextInput } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import DatabaseService, { type User } from "@/lib/database"
import InventoryService from "@/lib/inventory"
import { useTheme } from "@/hooks/useTheme"

interface UserProfile extends User {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  company?: string
  position?: string
  avatar?: string
}

interface ProfileStats {
  totalItems: number
  totalValue: number
  totalSales: number
  totalProfit: number
  totalTransactions: number
  averageOrderValue: number
  daysSinceStart: number
  joinDate: string
}

export default function ProfileScreen() {
  const { theme, isDark } = useTheme()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    company: "",
    position: "",
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      // Load saved profile data
      const savedProfile = await AsyncStorage.getItem("user_profile")
      if (savedProfile) {
        const profileData = JSON.parse(savedProfile)
        setProfile(profileData)
        setEditForm({
          firstName: profileData.firstName || "",
          lastName: profileData.lastName || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          address: profileData.address || "",
          company: profileData.company || "",
          position: profileData.position || "",
        })
      } else {
        // Create default profile for demo
        const defaultProfile: UserProfile = {
          id: 1,
          username: "Owner",
          email: "owner@stockbox.local",
          password: "stockbox123",
          firstName: "John",
          lastName: "Doe",
          phone: "+1 (555) 123-4567",
          company: "StockBox Inc.",
          position: "Inventory Manager",
          created_at: new Date().toISOString(),
        }
        await AsyncStorage.setItem("user_profile", JSON.stringify(defaultProfile))
        setProfile(defaultProfile)
        setEditForm({
          firstName: defaultProfile.firstName || "",
          lastName: defaultProfile.lastName || "",
          email: defaultProfile.email || "",
          phone: defaultProfile.phone || "",
          address: defaultProfile.address || "",
          company: defaultProfile.company || "",
          position: defaultProfile.position || "",
        })
      }
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    try {
      if (!profile) return

      const updatedProfile: UserProfile = {
        ...profile,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        company: editForm.company,
        position: editForm.position,
      }

      await AsyncStorage.setItem("user_profile", JSON.stringify(updatedProfile))
      setProfile(updatedProfile)
      setShowEditModal(false)
      Alert.alert("Success", "Profile updated successfully!")
    } catch (error) {
      console.error("Error saving profile:", error)
      Alert.alert("Error", "Failed to update profile")
    }
  }

  const changePassword = async () => {
    try {
      if (!profile) return

      if (passwordForm.currentPassword !== profile.password) {
        Alert.alert("Error", "Current password is incorrect")
        return
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        Alert.alert("Error", "New passwords do not match")
        return
      }

      if (passwordForm.newPassword.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters long")
        return
      }

      const updatedProfile = {
        ...profile,
        password: passwordForm.newPassword,
      }

      await AsyncStorage.setItem("user_profile", JSON.stringify(updatedProfile))
      setProfile(updatedProfile)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setShowChangePasswordModal(false)
      Alert.alert("Success", "Password changed successfully!")
    } catch (error) {
      console.error("Error changing password:", error)
      Alert.alert("Error", "Failed to change password")
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.clear()
              await DatabaseService.resetDatabase()
              await InventoryService.resetDatabase()
              Alert.alert("Account Deleted", "Your account has been deleted successfully", [
                { text: "OK", onPress: () => router.replace("/(tabs)") },
              ])
            } catch (error) {
              console.error("Error deleting account:", error)
              Alert.alert("Error", "Failed to delete account")
            }
          },
        },
      ],
    )
  }

  const ProfileSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  )

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color={theme.primary} />
        <Text style={[styles.infoLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading profile...</Text>
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Profile not found</Text>
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
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
    formInput: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: theme.text,
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <TouchableOpacity onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : profile.username}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{profile.email}</Text>
            {profile.position && profile.company && (
              <Text style={[styles.profilePosition, { color: theme.primary }]}>
                {profile.position} at {profile.company}
              </Text>
            )}
          </View>

          {/* Personal Information */}
          <ProfileSection title="Personal Information">
            <InfoRow icon="person-outline" label="Username" value={profile.username} />
            <InfoRow icon="mail-outline" label="Email" value={profile.email} />
            {profile.phone && <InfoRow icon="call-outline" label="Phone" value={profile.phone} />}
            {profile.address && <InfoRow icon="location-outline" label="Address" value={profile.address} />}
          </ProfileSection>

          {/* Work Information */}
          {(profile.company || profile.position) && (
            <ProfileSection title="Work Information">
              {profile.company && <InfoRow icon="business-outline" label="Company" value={profile.company} />}
              {profile.position && <InfoRow icon="briefcase-outline" label="Position" value={profile.position} />}
            </ProfileSection>
          )}

          {/* Account */}
          <ProfileSection title="Account">
            <TouchableOpacity style={dynamicStyles.actionRow} onPress={() => setShowChangePasswordModal(true)}>
              <View style={styles.actionLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.text }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.actionRow} onPress={() => router.push("/settings")}>
              <View style={styles.actionLeft}>
                <Ionicons name="settings-outline" size={20} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.text }]}>Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
          </ProfileSection>

          {/* Danger Zone */}
          <ProfileSection title="Danger Zone">
            <TouchableOpacity style={dynamicStyles.actionRow} onPress={handleDeleteAccount}>
              <View style={styles.actionLeft}>
                <Ionicons name="trash-outline" size={20} color={theme.error} />
                <Text style={[styles.actionText, { color: theme.error }]}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.error} />
            </TouchableOpacity>
          </ProfileSection>
        </ScrollView>

        {/* Edit Profile Modal */}
        <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={saveProfile}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>First Name</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.firstName}
                  onChangeText={(text) => setEditForm({ ...editForm, firstName: text })}
                  placeholder="Enter first name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Last Name</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.lastName}
                  onChangeText={(text) => setEditForm({ ...editForm, lastName: text })}
                  placeholder="Enter last name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Email</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="Enter email"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Phone</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Address</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.address}
                  onChangeText={(text) => setEditForm({ ...editForm, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Company</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.company}
                  onChangeText={(text) => setEditForm({ ...editForm, company: text })}
                  placeholder="Enter company name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Position</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={editForm.position}
                  onChangeText={(text) => setEditForm({ ...editForm, position: text })}
                  placeholder="Enter job position"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Change Password Modal */}
        <Modal visible={showChangePasswordModal} animationType="slide" presentationStyle="pageSheet">
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
              <TouchableOpacity onPress={changePassword}>
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Current Password</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={passwordForm.currentPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, currentPassword: text })}
                  placeholder="Enter current password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>New Password</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Confirm New Password</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, confirmPassword: text })}
                  placeholder="Confirm new password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                />
              </View>
              <Text style={[styles.passwordHint, { color: theme.textSecondary }]}>Password must be at least 6 characters long</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    marginBottom: 8,
  },
  profilePosition: {
    fontSize: 14,
    fontWeight: "500",
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 16,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
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
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  passwordHint: {
    fontSize: 14,
    marginTop: 8,
  },
})