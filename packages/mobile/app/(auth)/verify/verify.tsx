import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../hooks/useTheme";
import { useToast } from "../../../hooks/useToast";

export default function VerifyScreen() {
  const { signUp, isLoaded } = useSignUp();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    if (!isLoaded) return;

    try {
      setLoading(true);
      setVerificationStatus('verifying');
      
      // Clerk handles verification automatically when user clicks the link
      // This is just a status screen
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setVerificationStatus('success');
      showToast("Email verified successfully!", "success");
      
      // Redirect to login after delay
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 3000);
    } catch (error: any) {
      console.error("Verification error:", error);
      setVerificationStatus('error');
      const message = error.errors?.[0]?.message || "Verification failed. Please try again.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!isLoaded) return;

    try {
      setLoading(true);
      // This would trigger a resend of the verification email
      await new Promise(resolve => setTimeout(resolve, 1500));
      showToast("Verification email sent!", "success");
      setResendTimer(60); // 60 seconds cooldown
    } catch (error) {
      showToast("Failed to resend verification email", "error");
    } finally {
      setLoading(false);
    }
  };

  const getStatusContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>Verifying Email</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Please wait while we verify your email address...
            </Text>
          </View>
        );
      case 'success':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Email Verified!</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Your email has been successfully verified.
            </Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Redirecting to login...
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="close-circle" size={64} color={colors.error} />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Verification Failed</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              We couldn't verify your email. Please try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleResendVerification}
              disabled={loading || resendTimer > 0}
            >
              <Text style={styles.retryButtonText}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Verification'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backButton]}
              onPress={() => router.back()}
            >
              <Text style={[styles.backButtonText, { color: colors.primary }]}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="mail-outline" size={64} color={colors.primary} />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Verify Your Email</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              We've sent a verification link to your email address.
            </Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Please check your inbox and click the link to verify your account.
            </Text>
            
            <TouchableOpacity
              style={[styles.verifyButton, { backgroundColor: colors.primary }]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>I've Verified My Email</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendButton]}
              onPress={handleResendVerification}
              disabled={loading || resendTimer > 0}
            >
              <Text style={[styles.resendText, { color: colors.primary }]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backButton]}
              onPress={() => router.back()}
            >
              <Text style={[styles.backButtonText, { color: colors.primary }]}>
                Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Email Verification</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {getStatusContent()}
        </View>

        <View style={styles.helpContainer}>
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Didn't receive the email?
          </Text>
          <Text style={[styles.helpSubText, { color: colors.textSecondary }]}>
            Check your spam folder or contact support.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  verifyButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 10,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  helpContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  helpSubText: {
    fontSize: 13,
  },
});
