import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily } from '../theme';
import {
  signInWithGoogle, onAuthStateChange, getSession, isSupabaseConfigured,
} from '../services/authService';

const { width, height } = Dimensions.get('window');

import Svg, { Path } from 'react-native-svg';

const GoogleLogo = () => (
  <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
    <Path d="M15.5 8.2c0-.6-.1-1.1-.2-1.6H8v3h4.2c-.2 1-.8 1.8-1.6 2.3v2h2.6c1.5-1.4 2.3-3.4 2.3-5.7z" fill="#4285F4" />
    <Path d="M8 16c2.1 0 3.9-.7 5.2-1.9l-2.6-2c-.7.5-1.6.8-2.6.8-2 0-3.7-1.3-4.3-3.2H1v2c1.3 2.6 4 4.3 7 4.3z" fill="#34A853" />
    <Path d="M3.7 9.7c-.3-.8-.5-1.6-.5-2.5 0-.9.2-1.7.5-2.5V2.7H1C.4 3.9 0 5.4 0 7.2c0 1.8.4 3.3 1 4.5l2.7-2z" fill="#FBBC05" />
    <Path d="M8 3.2c1.1 0 2.1.4 2.9 1.1l2.2-2.2C11.9 1 10.1.2 8 .2 5 .2 2.3 1.9 1 4.5l2.7 2C4.3 4.6 6 3.2 8 3.2z" fill="#EA4335" />
  </Svg>
);

export default function SignInScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    getSession().then(session => {
      if (session) navigation.replace('Home');
    });

    const unsubscribe = onAuthStateChange(user => {
      if (user) navigation.replace('Home');
    });
    return unsubscribe;
  }, []);

  const handleGoogleAuth = async () => {
    if (!isSupabaseConfigured) {
      navigation.replace('Home');
      return;
    }
    setAuthError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err.message);
      setLoading(false);
    }
    if (Platform.OS !== 'web') setLoading(false);
  };

  return (
    <View style={s.container}>
      {/* Gradient background matching the turtle icon */}
      <LinearGradient
        colors={['#00D4FF', '#1479E8', '#2A5CE8', '#4040D0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradient}
      />

      {/* Subtle water-like decorative shapes */}
      <View style={s.decorWrap}>
        <View style={s.decorCircle1} />
        <View style={s.decorCircle2} />
        <View style={s.decorCircle3} />
      </View>

      <SafeAreaView style={s.safe}>
        {/* Top section: logo + branding */}
        <Animated.View style={[s.logoSection, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <View style={s.logoContainer}>
            <Image
              source={require('../../assets/icons/tortuga/ios/AppIcon-1024.png')}
              style={s.logoImage}
            />
          </View>
          <Text style={s.title}>Solvaa</Text>
          <Text style={s.tagline}>Know the water before you go</Text>
        </Animated.View>

        {/* Bottom section: auth buttons */}
        <Animated.View style={[s.bottomSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.authCard}>
            {authError ? <Text style={s.errorText}>{authError}</Text> : null}

            <TouchableOpacity style={s.btnGoogle} onPress={handleGoogleAuth} activeOpacity={0.85} disabled={loading}>
              <View style={s.btnLogo}><GoogleLogo /></View>
              <Text style={s.btnGoogleText}>{loading ? 'Signing in...' : 'Continue with Google'}</Text>
            </TouchableOpacity>

            <Text style={s.terms}>
              By continuing you agree to our{'\n'}
              <Text style={s.termsLink}>Terms of Service</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const FF = fontFamily;
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1479E8' },

  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Decorative translucent circles for depth
  decorWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,212,255,0.12)' },
  decorCircle2: { position: 'absolute', top: height * 0.25, left: -100, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(64,64,208,0.1)' },
  decorCircle3: { position: 'absolute', bottom: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,180,255,0.08)' },

  safe: { flex: 1 },

  // Logo section (centered in upper half)
  logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  logoContainer: {
    width: 110, height: 110, borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
    marginBottom: 20,
  },
  logoImage: { width: 110, height: 110 },
  title: { fontSize: 32, fontWeight: '600', fontFamily: FF.semibold, color: '#fff', letterSpacing: 0.5 },
  tagline: { fontSize: 15, fontWeight: '400', fontFamily: FF.regular, color: 'rgba(255,255,255,0.7)', marginTop: 6 },

  // Bottom auth section
  bottomSection: { paddingHorizontal: 24, paddingBottom: 28 },
  authCard: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 22,
    padding: 24, paddingTop: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },

  btnGoogle: {
    width: '100%', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  btnLogo: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnGoogleText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '500', fontFamily: FF.medium, color: '#1a1a1a' },

  terms: { fontSize: 12, fontWeight: '400', fontFamily: FF.regular, color: '#9a9590', textAlign: 'center', marginTop: 20, lineHeight: 18 },
  termsLink: { color: '#1479E8' },
  errorText: { fontSize: 13, color: '#C54A3A', textAlign: 'center', marginBottom: 12, fontWeight: '500', fontFamily: FF.medium },
});
