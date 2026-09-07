import React, { createContext, ReactNode, useState, useCallback } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

type ToastType = "info" | "success" | "warning" | "error";

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const [fadeAnim] = useState(new Animated.Value(0));

  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case "success":
        return { icon: "checkmark-circle", color: colors.success };
      case "warning":
        return { icon: "warning", color: colors.warning };
      case "error":
        return { icon: "close-circle", color: colors.error };
      default:
        return { icon: "information-circle", color: colors.primary };
    }
  };

  const showToast = useCallback(
    (msg: string, type: ToastType = "info", duration: number = TOAST_DURATION) => {
      setMessage(msg);
      setType(type);
      setVisible(true);

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
      });
    },
    [fadeAnim]
  );

  const hideToast = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  }, [fadeAnim]);

  const config = getToastConfig(type);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              backgroundColor: colors.card,
              shadowColor: colors.text,
            },
          ]}
        >
          <View style={[styles.toastContent, { borderLeftColor: config.color }]}>
            <Ionicons name={config.icon as any} size={24} color={config.color} />
            <Text style={[styles.toastMessage, { color: colors.text }]}>{message}</Text>
            <TouchableOpacity onPress={hideToast} style={styles.toastClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderLeftWidth: 4,
    borderRadius: 8,
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 12,
    marginRight: 8,
  },
  toastClose: {
    padding: 4,
  },
});
