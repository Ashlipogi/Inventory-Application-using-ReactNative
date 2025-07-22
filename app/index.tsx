"use client"

import { useEffect, useRef } from "react"
import { View, Text, StyleSheet, Animated, Image, StatusBar } from "react-native"
import { router } from "expo-router"

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const logoFadeAnim = useRef(new Animated.Value(0)).current
  const textFadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animationSequence = () => {
      // Start with logo fade in and scale
      Animated.parallel([
        Animated.timing(logoFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Then fade in the text
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          // Wait a bit, then fade everything out
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(logoFadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(textFadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Navigate to tabs after animation completes
              router.replace("/(tabs)")
            })
          }, 1500) // Show for 1.5 seconds before fading out
        })
      })
    }

    // Start animation after a short delay
    setTimeout(animationSequence, 300)
  }, [fadeAnim, scaleAnim, logoFadeAnim, textFadeAnim])

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: logoFadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image source={require("./imgs/LOGO.png")} style={styles.logo} resizeMode="contain" />
          </View>

          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textFadeAnim,
              },
            ]}
          >
            <Text style={styles.appName}>StockBox</Text>
            <Text style={styles.tagline}>Smart Inventory Management</Text>
          </Animated.View>
        </Animated.View>

        {/* Loading indicator */}
        <Animated.View
          style={[
            styles.loadingContainer,
            {
              opacity: textFadeAnim,
            },
          ]}
        >
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.dot, styles.dot1]} />
            <Animated.View style={[styles.dot, styles.dot2]} />
            <Animated.View style={[styles.dot, styles.dot3]} />
          </View>
        </Animated.View>

        {/* Overlay for fade out effect */}
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
            },
          ]}
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
width: 100,
  height: 100,
  borderRadius: 100, // Half of width/height to make it circular
  backgroundColor: "#F2F2F7",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
  overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 150,
    height: 150,
  },
  textContainer: {
    alignItems: "center",
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    position: "absolute",
    bottom: 100,
    alignItems: "center",
  },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  dot1: {
    animationDelay: "0s",
  },
  dot2: {
    animationDelay: "0.2s",
  },
  dot3: {
    animationDelay: "0.4s",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#007AFF",
  },
})
