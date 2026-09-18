import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import CustomInput from '../components/CustomInput';
import AppButton from '../components/AppButton';
import Card from '../components/Card';
import AppIcon from '../components/AppIcon';
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from '@react-native-firebase/auth';
import { auth } from '../services/firebase';

const getFriendlyErrorMessage = (code, defaultMsg) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid. Please check your spelling.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    default:
      return defaultMsg || 'An authentication error occurred. Please try again.';
  }
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;
      if (!user.emailVerified) {
        Alert.alert(
          'Email Verification Notice',
          'For security, please verify your email address. (Continuing login for testing purposes)',
          [
            { text: 'OK' },
            {
              text: 'Resend Email',
              onPress: async () => {
                try {
                  await sendEmailVerification(user);
                  Alert.alert('Success', 'Verification email resent.');
                } catch (err) {
                  Alert.alert('Error', getFriendlyErrorMessage(err.code, err.message));
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Login Error', getFriendlyErrorMessage(error.code, error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Reset Password', 'Please enter your email address in the input field first.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'Password Reset Sent',
        `A password reset link has been emailed to ${email.trim()}. Please check your inbox.`
      );
    } catch (error) {
      Alert.alert('Error', getFriendlyErrorMessage(error.code, error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Branding Hero */}
        <View style={styles.brandingContainer}>
          <View style={styles.brandIconSquircle}>
            <AppIcon name="timer" size={moderateScale(32)} color="#06B6D4" strokeWidth={2.4} />
          </View>
          <Text style={styles.logo}>TimeSlice</Text>
          <Text style={styles.tagline}>Plan your day, slice your time.</Text>
        </View>

        {/* Recessed Form Surface Card */}
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue your focus streak</Text>
          </View>

          <Text style={styles.inputLabel}>EMAIL</Text>
          <CustomInput
            placeholder="Email"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            style={styles.inputField}
          />

          <View style={styles.passwordHeaderRow}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
          <CustomInput
            placeholder="Password"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            editable={!loading}
            style={styles.inputField}
          />

          <AppButton
            title="Login"
            onPress={handleLogin}
            disabled={loading}
            variant="primary"
            style={styles.loginButton}
            textStyle={styles.loginButtonText}
          >
            {loading && <ActivityIndicator size="small" color="#0B0E14" />}
          </AppButton>
        </Card>

        {/* Footer Navigation */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.signupLinkText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: '24@ms',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: '28@ms',
  },
  brandIconSquircle: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '18@ms',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '14@ms',
  },
  logo: {
    color: '#FFFFFF',
    fontSize: '30@ms',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: '#94A3B8',
    fontSize: '13@ms',
    fontWeight: '500',
    marginTop: '6@ms',
  },
  formCard: {
    backgroundColor: '#11141E',
    borderRadius: '20@ms',
    borderWidth: 1,
    borderColor: '#232936',
    padding: '20@ms',
    marginBottom: '20@ms',
  },
  formHeader: {
    marginBottom: '18@ms',
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: '18@ms',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  formSubtitle: {
    color: '#64748B',
    fontSize: '12@ms',
    fontWeight: '500',
    marginTop: '4@ms',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: '11@ms',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: '6@ms',
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6@ms',
  },
  forgotText: {
    color: '#06B6D4',
    fontSize: '11.5@ms',
    fontWeight: '700',
  },
  inputField: {
    backgroundColor: '#161B26',
    borderColor: '#232936',
    borderRadius: '12@ms',
    color: '#FFFFFF',
    fontSize: '14@ms',
    padding: '13@ms',
    marginBottom: '16@ms',
  },
  loginButton: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
    borderRadius: '14@ms',
    height: '48@vs',
    marginTop: '6@ms',
  },
  loginButtonText: {
    color: '#0B0E14',
    fontSize: '15@ms',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: '8@ms',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: '13@ms',
    fontWeight: '500',
  },
  signupLinkText: {
    color: '#8B5CF6',
    fontSize: '13@ms',
    fontWeight: '700',
  },
});