import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import {
  signInWithGoogle, signInWithApple, onAuthStateChange, getSession, isSupabaseConfigured,
} from '../services/authService';

const { width, height } = Dimensions.get('window');

// Inline SVGs as text components (React Native SVG)
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

const PaddleLogo = () => (
  <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
    <Circle cx={18} cy={18} r={17} stroke={colors.text} strokeWidth={1} />
    <Line x1={18} y1={6} x2={18} y2={30} stroke={colors.text} strokeWidth={1.2} strokeLinecap="round" />
    <Ellipse cx={18} cy={10} rx={4.5} ry={3.5} stroke={colors.text} strokeWidth={1} fill="none" />
    <Ellipse cx={18} cy={26} rx={4.5} ry={3.5} stroke={colors.text} strokeWidth={1} fill="none" />
  </Svg>
);

const AppleLogo = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M11.5 2.3C10.6 3.4 10 5 10.3 6.6 11.8 6.7 13.3 5.9 14.2 4.8 15 3.8 15.5 2.3 15.1.7 13.7.8 12.3 1.5 11.5 2.3Z" fill={colors.bg} />
    <Path d="M15.2 7.1C13.5 6.1 11.2 6.4 9.8 7.7 8.3 9 8.5 11.4 10.1 13.3 10.9 14.3 11.9 15.5 13.3 15.4 14.5 15.4 15.2 14.6 16.7 14.6 18.2 14.6 18.9 15.4 20.2 15.4 21.7 15.4 22.7 14.1 23.6 13.1 24.2 12.2 24.8 11.1 25.1 10 21.5 8.7 21.7 3.5 25.2 2.3 24.2.6 22.4-.4 20.3-.3 18.9-.2 17.7.7 16.6.6 16.6-.5 16.4-.5" fill={colors.bg} transform="scale(0.65) translate(0, 2)" />
  </Svg>
);

const GoogleLogo = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M15.5 8.2c0-.6-.1-1.1-.2-1.6H8v3h4.2c-.2 1-.8 1.8-1.6 2.3v2h2.6c1.5-1.4 2.3-3.4 2.3-5.7z" fill="#4285F4" />
    <Path d="M8 16c2.1 0 3.9-.7 5.2-1.9l-2.6-2c-.7.5-1.6.8-2.6.8-2 0-3.7-1.3-4.3-3.2H1v2c1.3 2.6 4 4.3 7 4.3z" fill="#34A853" />
    <Path d="M3.7 9.7c-.3-.8-.5-1.6-.5-2.5 0-.9.2-1.7.5-2.5V2.7H1C.4 3.9 0 5.4 0 7.2c0 1.8.4 3.3 1 4.5l2.7-2z" fill="#FBBC05" />
    <Path d="M8 3.2c1.1 0 2.1.4 2.9 1.1l2.2-2.2C11.9 1 10.1.2 8 .2 5 .2 2.3 1.9 1 4.5l2.7 2C4.3 4.6 6 3.2 8 3.2z" fill="#EA4335" />
  </Svg>
);

export default function SignInScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    // If already signed in (e.g. returning from OAuth redirect on web), go straight to Home
    getSession().then(session => {
      if (session) navigation.replace('Home');
    });

    // Listen for sign-in completing (fires after mobile OAuth or web redirect returns)
    const unsubscribe = onAuthStateChange(user => {
      if (user) navigation.replace('Home');
    });
    return unsubscribe;
  }, []);

  const handleAuth = async (provider) => {
    if (!isSupabaseConfigured) {
      navigation.replace('Home');
      return;
    }
    setAuthError(null);
    setLoading(true);
    try {
      if (provider === 'google') await signInWithGoogle();
      else if (provider === 'apple') await signInWithApple();
      // Web: browser now redirects to Google — component will unmount, no further action needed.
      // Mobile: WebBrowser session finishes, onAuthStateChange fires and navigates to Home.
    } catch (err) {
      setAuthError(err.message);
      setLoading(false);
    }
    // On web the page redirects away, so don't clear loading state there.
    if (Platform.OS !== 'web') setLoading(false);
  };

  return (
    <View style={s.container}>
      {/* Subtle map background */}
      <View style={s.mapBg}>
        <View style={s.mapWater} />
        <View style={s.mapLand1} />
        <View style={s.mapLand2} />
        <View style={s.mapGreen} />
        <View style={s.mapFade} />
      </View>

      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <PaddleLogo />
          <Text style={s.title}>Paddle</Text>
          <Text style={s.tagline}>Know the water before you go</Text>

          <View style={s.divider} />

          {authError ? <Text style={s.errorText}>{authError}</Text> : null}

          {/* Apple */}
          <TouchableOpacity style={s.btnDark} onPress={() => handleAuth('apple')} activeOpacity={0.85} disabled={loading}>
            <View style={s.btnLogo}><AppleLogo /></View>
            <Text style={s.btnTextDark}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity style={s.btnLight} onPress={() => handleAuth('google')} activeOpacity={0.85} disabled={loading}>
            <View style={s.btnLogo}><GoogleLogo /></View>
            <Text style={s.btnTextLight}>{loading ? 'Signing in…' : 'Continue with Google'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orText}>or</Text>
            <View style={s.orLine} />
          </View>

          <TouchableOpacity style={s.btnGhost} onPress={() => navigation.replace('Home')} activeOpacity={0.7}>
            <Text style={s.btnTextGhost}>Continue as guest</Text>
          </TouchableOpacity>

          <Text style={s.terms}>
            By continuing you agree to our{'\n'}
            <Text style={s.termsLink}>Terms of Service</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapBg: { position: 'absolute', inset: 0, overflow: 'hidden' },
  mapWater: { position: 'absolute', inset: 0, backgroundColor: colors.mapWater, opacity: 0.4 },
  mapLand1: { position: 'absolute', top: 0, left: 0, width: 115, height: 230, borderBottomRightRadius: 38, backgroundColor: colors.mapLand, opacity: 0.35 },
  mapLand2: { position: 'absolute', top: 0, right: 0, width: 95, height: 190, borderBottomLeftRadius: 28, backgroundColor: colors.mapLand, opacity: 0.3 },
  mapGreen: { position: 'absolute', top: 18, left: 14, width: 58, height: 50, borderRadius: 8, backgroundColor: colors.mapGreen, opacity: 0.45 },
  mapFade: { position: 'absolute', inset: 0, backgroundColor: colors.bg, opacity: 0, top: '28%' },
  safe: { flex: 1 },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 32,
  },
  title: { fontSize: 26, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 3 },
  tagline: { fontSize: 12, fontWeight: '300', color: colors.textMuted, marginBottom: 36 },
  divider: { width: 32, height: 1, backgroundColor: colors.border, marginBottom: 32 },
  btnDark: { width: '100%', backgroundColor: colors.text, borderRadius: 10, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  btnLight: { width: '100%', backgroundColor: colors.white, borderRadius: 10, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  btnGhost: { width: '100%', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  btnLogo: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnTextDark: { flex: 1, textAlign: 'center', fontSize: 13.5, fontWeight: '400', color: colors.bg },
  btnTextLight: { flex: 1, textAlign: 'center', fontSize: 13.5, fontWeight: '400', color: colors.text },
  btnTextGhost: { fontSize: 13.5, fontWeight: '400', color: colors.textMid },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6, width: '100%' },
  orLine: { flex: 1, height: 0.5, backgroundColor: colors.border },
  orText: { fontSize: 10, fontWeight: '300', color: colors.textFaint },
  terms: { fontSize: 10, fontWeight: '300', color: colors.textFaint, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  termsLink: { color: '#7a9a8a' },
  errorText: { fontSize: 11, color: '#8a4a3a', textAlign: 'center', marginBottom: 8 },
});
