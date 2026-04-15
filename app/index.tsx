import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { sendOtp, verifyOtp } from '../lib/api';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const { user, isLoading, login } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Auto-redirect removed by user request
  // Users will always land on sign-in and must manually sign in

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (user) return null;

  const handleSendOtp = async () => {
    setIsSending(true);
    
    // Artificial delay for "premium" feel
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', 'Login failed');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async (otpString?: string) => {
    const otpValue = otpString || otp.join('');
    if (otpValue.length !== 6) return;

    setIsVerifying(true);
    try {
      const result = await verifyOtp(phone, otpValue);
      await login(result.token, result.user);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid OTP');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all filled
    if (index === 5 && text) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {/* Background gradient effect */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo */}
          <Animated.View
            style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}
          >
            <Image
              source={require('../assets/images/logo-transparent.png')}
              style={styles.logoCircle}
              resizeMode="contain"
            />
            <Text style={styles.appName}>SJVPS Record Book</Text>
            <Text style={styles.tagline}>
              Your Digital Register, Simplified
            </Text>
          </Animated.View>

          {/* Card */}
          <View style={styles.card}>
            {step === 'phone' ? (
              <>
                <Text style={styles.cardTitle}>Welcome Back</Text>
                <Text style={styles.cardSubtitle}>
                  Sign in to manage your registers
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCode}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter your phone number"
                      placeholderTextColor={Colors.placeholder}
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      maxLength={15}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isSending && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={isSending}
                  activeOpacity={0.8}
                >
                  {isSending ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Login</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Verify OTP</Text>
                <Text style={styles.cardSubtitle}>
                  Enter the 6-digit code sent to {phone}
                </Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { otpRefs.current[index] = ref; }}
                      style={[
                        styles.otpInput,
                        digit ? styles.otpInputFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, index)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.button, isVerifying && styles.buttonDisabled]}
                  onPress={() => handleVerifyOtp()}
                  disabled={isVerifying || otp.join('').length !== 6}
                  activeOpacity={0.8}
                >
                  {isVerifying ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('phone')}
                  style={styles.changePhone}
                >
                  <Text style={styles.changePhoneText}>
                    Change phone number
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: Colors.navy,
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.navy,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    ...Shadows.card,
  },
  logoText: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadows.elevated,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
    marginBottom: Spacing.sm,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countryCode: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryCodeText: {
    fontSize: FontSize.md,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
  },
  phoneInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.foreground,
    backgroundColor: Colors.white,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  otpInput: {
    width: 46,
    height: 54,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    backgroundColor: Colors.surface,
  },
  otpInputFilled: {
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
  },
  button: {
    backgroundColor: Colors.navy,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  changePhone: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  changePhoneText: {
    color: Colors.navy,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
