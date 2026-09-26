import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { tokens } from '@vargly/ui';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f17" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              True<Text style={{ color: tokens.colors.primary[500] }}>CO</Text> Mobile
            </Text>
            <Text style={styles.subTitle}>Apex IIT-JEE Academy</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>WhatsApp Live</Text>
          </View>
        </View>

        {/* Quick Summary Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Students</Text>
            <Text style={styles.statValue}>1,248</Text>
            <Text style={styles.statSub}>14 Batches</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today Attendance</Text>
            <Text style={[styles.statValue, { color: tokens.colors.primary[500] }]}>94.8%</Text>
            <Text style={styles.statSub}>487 Present</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>⚡ Quick Mark Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>💬 Send WhatsApp Update</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Alerts Feed */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>High-Priority Institute Alerts</Text>

          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertType}>⚠️ AI Risk Engine</Text>
              <Text style={styles.alertTime}>12m ago</Text>
            </View>
            <Text style={styles.alertText}>
              Student Kabir Joshi attendance dropped to 58%. Risk Score: 84 (Critical).
            </Text>
          </View>

          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertType}>💵 Fee Collection</Text>
              <Text style={styles.alertTime}>35m ago</Text>
            </View>
            <Text style={styles.alertText}>
              ₹7,500 collected via UPI from Ananya Iyer. WhatsApp receipt dispatched.
            </Text>
          </View>

          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertType}>🔄 Batch Transfer</Text>
              <Text style={styles.alertTime}>1h ago</Text>
            </View>
            <Text style={styles.alertText}>
              Aarav Sharma transferred from Morning to Evening batch. Timeline updated.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  subTitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(19, 27, 46, 0.8)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginVertical: 4,
  },
  statSub: {
    fontSize: 11,
    color: '#64748b',
  },
  actionContainer: {
    gap: 10,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: 'rgba(19, 27, 46, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  alertCard: {
    backgroundColor: '#131b2e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  alertType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  alertTime: {
    fontSize: 10,
    color: '#64748b',
  },
  alertText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
});
