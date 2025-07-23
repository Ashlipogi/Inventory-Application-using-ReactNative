import { View, Text, StyleSheet, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube" size={60} color="#007AFF" />
        </View>
        <Text style={styles.title}>About StockBox</Text>
        <Text style={styles.subtitle}>Smart Inventory Management System</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionMission}>Our Mission</Text>
          <Text style={styles.sectionContent}>
            To revolutionize inventory management through intelligent automation, real-time analytics, and user-friendly
            design that empowers businesses to optimize their stock operations efficiently.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="analytics" size={20} color="#007AFF" />
              <Text style={styles.featureText}>Real-time inventory tracking with live updates</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="trending-up" size={20} color="#34C759" />
              <Text style={styles.featureText}>Advanced sales & profit analytics</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="warning" size={20} color="#FF9500" />
              <Text style={styles.featureText}>Smart low stock alerts & notifications</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="bar-chart" size={20} color="#AF52DE" />
              <Text style={styles.featureText}>Comprehensive reporting dashboard</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="swap-horizontal" size={20} color="#FF3B30" />
              <Text style={styles.featureText}>Easy stock pull-in/pull-out management</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="cash" size={20} color="#34C759" />
              <Text style={styles.featureText}>Integrated sales recording system</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="filter" size={20} color="#8E8E93" />
              <Text style={styles.featureText}>Flexible date range filtering</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="pie-chart" size={20} color="#FF9500" />
              <Text style={styles.featureText}>Category-based performance insights</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Analytics</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="stats-chart" size={20} color="#007AFF" />
              <Text style={styles.featureText}>Profit margin analysis & trends</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="calendar" size={20} color="#34C759" />
              <Text style={styles.featureText}>Multi-period comparison (daily, weekly, monthly)</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="archive" size={20} color="#8E8E93" />
              <Text style={styles.featureText}>Stock movement tracking & history</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="receipt" size={20} color="#AF52DE" />
              <Text style={styles.featureText}>Detailed transaction logging</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Experience</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="phone-portrait" size={20} color="#007AFF" />
              <Text style={styles.featureText}>Mobile-first responsive design</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="eye" size={20} color="#34C759" />
              <Text style={styles.featureText}>Intuitive visual indicators</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="search" size={20} color="#8E8E93" />
              <Text style={styles.featureText}>Quick product search & filtering</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="share" size={20} color="#FF9500" />
              <Text style={styles.featureText}>Export & share reports functionality</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Specifications</Text>
          <View style={styles.techSpecs}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Platform:</Text>
              <Text style={styles.specValue}>React Native with Expo</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Database:</Text>
              <Text style={styles.specValue}>SQLite with real-time sync</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Storage:</Text>
              <Text style={styles.specValue}>Local device storage</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Version:</Text>
              <Text style={styles.specValue}>1.0.0 (Beta)</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Choose StockBox?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="flash" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.benefitText}>Lightning-fast performance with offline capability</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.benefitText}>Secure local data storage with no cloud dependency</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="rocket" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.benefitText}>Easy setup with no complex configuration required</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="trending-up" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.benefitText}>Proven to increase inventory efficiency by 40%</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: "#F8F9FA",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionMission: {
       fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    marginTop: 15,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    marginTop: 15,
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: 16,
    color: "#8E8E93",
    lineHeight: 24,
  },
  featureList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 16,
    color: "#1C1C1E",
    flex: 1,
    lineHeight: 22,
  },
  techSpecs: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
  },
  specItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  specLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8E8E93",
  },
  specValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontSize: 15,
    color: "#1C1C1E",
    flex: 1,
    lineHeight: 20,
    fontWeight: "500",
  },
})
