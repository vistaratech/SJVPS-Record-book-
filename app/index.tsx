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
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  Layout,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useAuth } from '../lib/auth';
import { sendOtp, verifyOtp } from '../lib/api';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const { user, isLoading, login } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const logoScale = useSharedValue(0.8);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 10, stiffness: 80 });
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (user) return null;

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    setIsSending(true);
    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
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
      {/* Premium Background Elements */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <Animated.View 
            entering={FadeInUp.delay(200).duration(800)}
            style={[styles.logoContainer, logoAnimatedStyle]}
          >
            <View style={styles.logoRing}>
              <Image
                source={require('../assets/images/logo-transparent.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>AG Trust</Text>
            <Text style={styles.tagline}>Precision in Every Entry</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View 
            entering={FadeInDown.delay(400).duration(800)}
            style={styles.card}
            layout={Layout.springify()}
          >
            {step === 'phone' ? (
              <View key="phone-step">
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>
                  Enter your phone number to continue
                </Text>

                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.countryBadge}>
                      <Text style={styles.countryText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor={Colors.placeholder}
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      maxLength={10}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.mainButton, isSending && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={isSending}
                  activeOpacity={0.8}
                >
                  {isSending ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View key="otp-step">
                <Text style={styles.cardTitle}>Verify Code</Text>
                <Text style={styles.cardSubtitle}>
                  Code sent to <Text style={styles.boldText}>+91 {phone}</Text>
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
                  style={[styles.mainButton, isVerifying && styles.buttonDisabled]}
                  onPress={() => handleVerifyOtp()}
                  disabled={isVerifying || otp.join('').length !== 6}
                  activeOpacity={0.8}
                >
                  {isVerifying ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('phone')}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>Use a different number</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Footer Info */}
          <Animated.View 
            entering={FadeIn.delay(800).duration(1000)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Secure • Reliable • Enterprise Grade</Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  bgCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.navyLight,
    opacity: 0.3,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.navyDark,
    opacity: 0.5,
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
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.huge,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.premium,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  appName: {
    fontSize: 40,
    fontWeight: FontWeight.extrabold,
    color: Colors.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadows.lg,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
    textAlign: 'left',
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'left',
    marginBottom: Spacing.xxl,
  },
  boldText: {
    color: Colors.navy,
    fontWeight: FontWeight.bold,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputWrapper: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  countryBadge: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  countryText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.foreground,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxxl,
  },
  otpInput: {
    width: (width - (Spacing.xl * 2) - (Spacing.xxl * 2) - (Spacing.sm * 5)) / 6,
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.foreground,
  },
  otpInputFilled: {
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  mainButton: {
    backgroundColor: Colors.navy,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  buttonDisabled: {
    backgroundColor: Colors.mutedLight,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  backButton: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: Colors.navy,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    marginTop: Spacing.huge,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
