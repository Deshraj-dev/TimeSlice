import { ScaledSheet, moderateScale } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { auth, db } from '../services/firebase';
import { checkTimeOverlap, parseTimeToMinutes } from '../utils/dateHelpers';
import notificationService from '../services/notificationService';
import AppIcon from './AppIcon';

const CATEGORIES = [
    { id: 'work', label: 'Work', icon: 'work', color: COLORS.primary },
    { id: 'study', label: 'Study', icon: 'study', color: COLORS.secondary },
    { id: 'exercise', label: 'Exercise', icon: 'exercise', color: COLORS.success },
    { id: 'lunch', label: 'Lunch', icon: 'lunch', color: COLORS.warning },
    { id: 'leisure', label: 'Leisure', icon: 'leisure', color: '#3B82F6' },
    { id: 'other', label: 'Other', icon: 'other', color: COLORS.textMuted },
];

export default function ActivityModal({
    visible,
    onClose,
    activity,
    selectedDate,
    existingActivities = [],
    onSaveSuccess,
}) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('work');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activity) {
            setTitle(activity.title || '');
            setCategory(activity.category || 'work');
            setDate(activity.date || selectedDate || '');
            setStartTime(activity.startTime || '');
            setEndTime(activity.endTime || '');
            setNotes(activity.notes || '');
        } else {
            setTitle('');
            setCategory('work');
            setDate(selectedDate || '');
            setStartTime('');
            setEndTime('');
            setNotes('');
        }
    }, [activity, selectedDate, visible]);

    const formatTimeInput = (text, setter) => {
        // Strip non-numeric
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 2) {
            setter(cleaned);
        } else {
            setter(`${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`);
        }
    };

    const formatDateInput = (text) => {
        // Strip non-numeric
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 4) {
            setDate(cleaned);
        } else if (cleaned.length <= 6) {
            setDate(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`);
        } else {
            setDate(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`);
        }
    };

    const validateInputs = () => {
        if (!title.trim()) {
            Alert.alert('Validation Error', 'Please enter an activity name.');
            return false;
        }

        // Date validation: YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            Alert.alert('Validation Error', 'Please enter a valid date in YYYY-MM-DD format.');
            return false;
        }

        // Time format validation: HH:MM
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime)) {
            Alert.alert('Validation Error', 'Start time must be a valid 24h format (e.g. 08:30 or 14:00).');
            return false;
        }
        if (!timeRegex.test(endTime)) {
            Alert.alert('Validation Error', 'End time must be a valid 24h format (e.g. 09:30 or 15:00).');
            return false;
        }

        // Logical time validation
        const startMin = parseTimeToMinutes(startTime);
        const endMin = parseTimeToMinutes(endTime);

        if (endMin <= startMin) {
            Alert.alert('Validation Error', 'End time must be after start time.');
            return false;
        }

        // Overlap validation
        const conflict = existingActivities.find((act) => {
            if (activity && act.id === activity.id) return false; // Ignore itself
            if (act.date !== date) return false; // Match date
            return checkTimeOverlap(startTime, endTime, act.startTime, act.endTime);
        });

        if (conflict) {
            Alert.alert(
                'Schedule Conflict',
                `This timeslot overlaps with "${conflict.title}" (${conflict.startTime} - ${conflict.endTime}).`
            );
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!validateInputs()) return;

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'User not authenticated');
                setLoading(false);
                return;
            }

            try {
                await user.getIdToken();
            } catch (tokenErr) {
                console.warn('Token validation before save:', tokenErr);
            }

            const data = {
                title: title.trim(),
                category,
                date,
                startTime,
                endTime,
                notes: notes.trim(),
            };

            if (activity) {
                // Edit mode
                const docRef = doc(db, 'users', user.uid, 'activities', activity.id);
                await updateDoc(docRef, {
                    ...data,
                    updatedAt: serverTimestamp(),
                });
                console.log('Activity updated successfully');
                // Reschedule notifications
                await notificationService.scheduleActivityReminders({
                    id: activity.id,
                    ...data,
                });
            } else {
                // Add mode
                const colRef = collection(db, 'users', user.uid, 'activities');
                const docRef = await addDoc(colRef, {
                    ...data,
                    createdAt: serverTimestamp(),
                });
                console.log('Activity created successfully');
                // Schedule notifications
                await notificationService.scheduleActivityReminders({
                    id: docRef.id,
                    ...data,
                });
            }

            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (error) {
            Alert.alert('Database Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this activity?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const user = auth.currentUser;
                            if (!user || !activity) return;

                            const docRef = doc(db, 'users', user.uid, 'activities', activity.id);
                            await deleteDoc(docRef);
                            console.log('Activity deleted successfully');
                            // Cancel notifications
                            await notificationService.cancelActivityReminders(activity.id);

                            if (onSaveSuccess) onSaveSuccess();
                            onClose();
                        } catch (error) {
                            Alert.alert('Delete Error', error.message);
                        }
                    },
                },
            ]
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {activity ? 'Edit Activity' : 'Add Activity'}
                        </Text>
                        <TouchableOpacity style={styles.closeIconButton} onPress={onClose}>
                            <Text style={styles.closeIconText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Title input */}
                        <Text style={styles.inputLabel}>ACTIVITY NAME</Text>
                        <TextInput
                            placeholder="Study, Work, Exercise..."
                            placeholderTextColor="#64748B"
                            value={title}
                            onChangeText={setTitle}
                            style={styles.input}
                        />

                        {/* Category selection */}
                        <Text style={styles.inputLabel}>CATEGORY</Text>
                        <View style={styles.categoryGrid}>
                            {CATEGORIES.map((cat) => {
                                const isSelected = category === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryChip,
                                            isSelected && {
                                                backgroundColor: cat.color,
                                                borderColor: cat.color,
                                            },
                                        ]}
                                        onPress={() => setCategory(cat.id)}
                                    >
                                        <AppIcon
                                            name={cat.icon}
                                            size={moderateScale(15)}
                                            color={isSelected ? '#0B0E14' : cat.color}
                                            style={styles.categoryIcon}
                                        />
                                        <Text
                                            style={[
                                                styles.categoryText,
                                                isSelected && styles.categoryTextActive,
                                            ]}
                                        >
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Date field */}
                        <Text style={styles.inputLabel}>DATE (YYYY-MM-DD)</Text>
                        <TextInput
                            placeholder="e.g. 2026-08-19"
                            placeholderTextColor="#64748B"
                            value={date}
                            maxLength={10}
                            onChangeText={formatDateInput}
                            style={styles.input}
                            keyboardType="numeric"
                        />

                        {/* Start and End Times */}
                        <View style={styles.timeRow}>
                            <View style={styles.timeColumn}>
                                <Text style={styles.inputLabel}>START (HH:MM)</Text>
                                <TextInput
                                    placeholder="09:00"
                                    placeholderTextColor="#64748B"
                                    value={startTime}
                                    maxLength={5}
                                    onChangeText={(text) => formatTimeInput(text, setStartTime)}
                                    style={styles.input}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.timeColumn}>
                                <Text style={styles.inputLabel}>END (HH:MM)</Text>
                                <TextInput
                                    placeholder="10:30"
                                    placeholderTextColor="#64748B"
                                    value={endTime}
                                    maxLength={5}
                                    onChangeText={(text) => formatTimeInput(text, setEndTime)}
                                    style={styles.input}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Notes field */}
                        <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
                        <TextInput
                            placeholder="Any details or description..."
                            placeholderTextColor="#64748B"
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                            style={[styles.input, styles.textArea]}
                        />

                        {/* Action buttons */}
                        <TouchableOpacity
                            style={[styles.saveButton, loading && styles.disabledButton]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            <Text style={styles.saveButtonText}>
                                {loading ? 'Saving...' : activity ? 'Save Changes' : 'Add Activity'}
                            </Text>
                        </TouchableOpacity>

                        {activity && (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={handleDelete}
                            >
                                <Text style={styles.deleteButtonText}>Delete Activity</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = ScaledSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 21, 0.85)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: '24@ms',
        paddingTop: '20@ms',
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20@ms',
    },
    modalTitle: {
        color: COLORS.text,
        fontSize: '20@ms',
        fontWeight: '800',
    },
    closeIconButton: {
        padding: '5@ms',
    },
    closeIconText: {
        color: COLORS.textSecondary,
        fontSize: '18@ms',
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingBottom: '20@ms',
    },
    inputLabel: {
        color: COLORS.textSecondary,
        fontSize: '10@ms',
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: '8@ms',
        marginTop: '10@ms',
    },
    input: {
        backgroundColor: COLORS.cardElevated,
        borderRadius: '12@ms',
        padding: '14@ms',
        color: COLORS.text,
        fontSize: '15@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: '10@ms',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '8@ms',
        marginBottom: '10@ms',
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: '12@ms',
        paddingVertical: '8@ms',
        borderRadius: '20@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.cardElevated,
    },
    categoryIcon: {
        marginRight: '6@ms',
    },
    categoryText: {
        color: COLORS.textSecondary,
        fontSize: '13@ms',
        fontWeight: '600',
    },
    categoryTextActive: {
        color: '#0B0E14',
        fontWeight: '800',
    },
    timeRow: {
        flexDirection: 'row',
        gap: '15@ms',
    },
    timeColumn: {
        flex: 1,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        padding: '16@ms',
        borderRadius: '14@ms',
        marginTop: '18@ms',
        alignItems: 'center',
    },
    saveButtonText: {
        color: COLORS.background,
        fontWeight: '800',
        fontSize: '15@ms',
    },
    disabledButton: {
        opacity: 0.6,
    },
    deleteButton: {
        backgroundColor: COLORS.danger,
        padding: '16@ms',
        borderRadius: '14@ms',
        marginTop: '10@ms',
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: '15@ms',
    },
    cancelButton: {
        padding: '16@ms',
        borderRadius: '14@ms',
        marginTop: '5@ms',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
        fontWeight: '700',
        fontSize: '14@ms',
    },
});
