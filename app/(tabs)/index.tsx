"use client"
import { Image } from "react-native"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import DatabaseService from "@/lib/database"

export default function SignInScreen() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      await DatabaseService.initializeDatabase()
      console.log("Database initialized")
    } catch (error) {
      console.error("Failed to initialize database:", error)
      Alert.alert("Error", "Failed to initialize app")
    }
  }

const validateInputs = () => {
  if (!username || !password) {
    Alert.alert("Missing Information", "Please enter both username and password");
    return false;
  }
  return true;
};

const handleSignIn = async () => {
  if (!validateInputs()) return;

  setLoading(true);
  try {
    const user = await DatabaseService.getUserByUsernameAndPassword(username, password); // <-- NEW method
    if (user) {
      router.replace("/dashboard");
    } else {
      Alert.alert("Sign In Failed", "Invalid username or password");
    }
  } catch (error) {
    console.error("Sign in error:", error);
    Alert.alert("Error", "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
};


  // const navigateToSignUp = () => {
  //   router.push("/signup")
  // }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
<View>
  <Image
    source={require("../imgs/WLOGO.png")}
    style={{ width: 100, height: 100 }}
    resizeMode="contain"
  />
</View>
            <Text style={styles.title}>StockBox</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.formContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Username</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            placeholderTextColor="#C7C7CC"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>
      </View>


            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor="#C7C7CC"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.signInButtonText}>{loading ? "Signing In..." : "Sign In"}</Text>
            </TouchableOpacity>

            {/* <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View> */}

            {/* <TouchableOpacity style={styles.signUpButton} onPress={navigateToSignUp}>
              <Text style={styles.signUpButtonText}>Create New Account</Text>
            </TouchableOpacity> */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  signInButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5EA",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#8E8E93",
  },
  signUpButton: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  signUpButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
})
