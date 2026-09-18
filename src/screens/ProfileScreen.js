import { ScaledSheet } from 'react-native-size-matters';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Switch,
    Platform,
    ActivityIndicator,
    Image,
    PermissionsAndroid,
    Dimensions,
    StatusBar,
    Modal,
} from 'react-native';
import { COLORS } from '../theme/colors';
import Card from '../components/Card';
import AppButton from '../components/AppButton';
import SectionHeader from '../components/SectionHeader';
import AppIcon from '../components/AppIcon';
import { doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { sendPasswordResetEmail, signOut } from '@react-native-firebase/auth';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { auth, db } from '../services/firebase';
import notificationService from '../services/notificationService';
import {
    deleteCurrentUserAccount,
    completeAuthDeletionWithPassword,
} from '../services/accountDeletionService';

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_SIZE = 84;

export default function ProfileScreen({ navigation }) {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [createdAt, setCreatedAt] = useState('');
    const [dailyGoalHours, setDailyGoalHours] = useState('4');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [activityRemindersEnabled, setActivityRemindersEnabled] = useState(true);
    const [remindLeadMinutes, setRemindLeadMinutes] = useState(5);
    const [soundsEnabled, setSoundsEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [avatarUri, setAvatarUri] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteStage, setDeleteStage] = useState('confirm'); // 'confirm' | 'reauth' | 'deleting'
    const [reauthPassword, setReauthPassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                setEmail(user.email || '');

                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDisplayName(data.displayName || '');
                    setDailyGoalHours(String(data.dailyGoalHours || '4'));
                    setNotificationsEnabled(data.notificationsEnabled !== false);
                    setActivityRemindersEnabled(data.activityRemindersEnabled !== false);
                    setRemindLeadMinutes(Number(data.remindLeadMinutes || 5));
                    setSoundsEnabled(data.soundsEnabled !== false);
                    setVibrationEnabled(data.vibrationEnabled !== false);
                    setAvatarUri(data.photoURL || data.avatarBase64 || null);

                    if (data.createdAt) {
                        setCreatedAt(data.createdAt.split('T')[0]);
                    }
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
                Alert.alert('Load Error', 'Failed to retrieve profile data.');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const handleSave = async () => {
        const hours = parseInt(dailyGoalHours, 10);
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            Alert.alert('Validation Error', 'Daily Focus Goal must be between 1 and 24 hours.');
            return;
        }

        setSaving(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            const docRef = doc(db, 'users', user.uid);
            await updateDoc(docRef, {
                displayName: displayName.trim(),
                dailyGoalHours: hours,
                notificationsEnabled,
                activityRemindersEnabled,
                remindLeadMinutes,
                soundsEnabled,
                vibrationEnabled,
            });

            if (!notificationsEnabled || !activityRemindersEnabled) {
                await notificationService.cancelAllReminders();
            }

            Alert.alert('Success', 'Profile and settings saved successfully.');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) return;

        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert(
                'Password Reset Sent',
                `A password reset link has been emailed to ${email}. Please check your inbox.`
            );
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    const requestCameraPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: 'Camera Permission',
                        message: 'TimeSlice needs access to your camera to take a profile picture.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const openCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            Alert.alert('Permission Denied', 'Camera permission is required to take pictures.');
            return;
        }

        const options = {
            mediaType: 'photo',
            includeBase64: true,
            maxHeight: 200,
            maxWidth: 200,
            quality: 0.7,
        };

        launchCamera(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled camera picker');
            } else if (response.errorCode) {
                Alert.alert('Camera Error', response.errorMessage || 'Failed to open camera');
            } else if (response.assets && response.assets.length > 0) {
                uploadAvatar(response.assets[0]);
            }
        });
    };

    const openGallery = () => {
        const options = {
            mediaType: 'photo',
            includeBase64: true,
            maxHeight: 200,
            maxWidth: 200,
            quality: 0.7,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled gallery picker');
            } else if (response.errorCode) {
                Alert.alert('Gallery Error', response.errorMessage || 'Failed to open gallery');
            } else if (response.assets && response.assets.length > 0) {
                uploadAvatar(response.assets[0]);
            }
        });
    };

    const uploadAvatar = async (asset) => {
        const user = auth.currentUser;
        if (!user) return;

        setUploadingAvatar(true);
        try {
            if (asset.base64) {
                const base64Data = `data:${asset.type};base64,${asset.base64}`;
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    avatarBase64: base64Data,
                    photoURL: null,
                });
                setAvatarUri(base64Data);
                Alert.alert('Success', 'Profile picture saved successfully.');
            } else {
                Alert.alert('Upload Error', 'Failed to retrieve image data.');
            }
        } catch (err) {
            console.log('Error saving avatar to Firestore:', err);
            Alert.alert('Upload Error', 'Failed to save profile picture.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleAvatarPress = () => {
        Alert.alert(
            'Upload Profile Picture',
            'Choose a source for your avatar:',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Camera', onPress: openCamera },
                { text: 'Photo Gallery', onPress: openGallery },
            ]
        );
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            Alert.alert('Logout Error', error.message);
        }
    };

    const handlePrivacyPolicyPress = () => {
        Alert.alert(
            'Privacy & Data Policy',
            'TimeSlice values your privacy. All your profile information, scheduled activities, and focus history are stored securely and remain private to you.\n\nWhen you delete your account, all personal records, activities, and focus sessions are immediately and permanently removed from our servers.\n\nAccount deletion is irreversible. If you uninstalled the application and need to request deletion of your account and associated data, contact TimeSlice support at deshrajstack@gmail.com.',
            [{ text: 'Close', style: 'default' }]
        );
    };

    const openDeleteModal = () => {
        setDeleteStage('confirm');
        setReauthPassword('');
        setDeleteError('');
        setDeleteModalVisible(true);
    };

    const closeDeleteModal = () => {
        if (deleteStage === 'deleting') return;
        setDeleteModalVisible(false);
        setDeleteStage('confirm');
        setReauthPassword('');
        setDeleteError('');
    };

    const handleInitialDelete = async () => {
        setDeleteStage('deleting');
        setDeleteError('');

        try {
            const res = await deleteCurrentUserAccount();

            if (res.success) {
                setDeleteModalVisible(false);
                return;
            }

            if (res.stage === 'requires-recent-login') {
                setDeleteStage('reauth');
                setDeleteError('Recent authentication required. Please enter your password to complete deletion.');
                return;
            }

            if (res.stage === 'firestore') {
                setDeleteStage('confirm');
                Alert.alert(
                    'Deletion Failed',
                    'Failed to delete account data from the server. Your account remains intact. Please check your network connection and try again.'
                );
                return;
            }

            setDeleteStage('confirm');
            Alert.alert(
                'Deletion Incomplete',
                'Your data was removed, but removing your login credentials could not be completed. Please try again.'
            );
        } catch (err) {
            setDeleteStage('confirm');
            Alert.alert('Error', 'An unexpected error occurred during account deletion.');
        }
    };

    const handleConfirmReauthDelete = async () => {
        if (!reauthPassword.trim()) {
            setDeleteError('Please enter your password to continue.');
            return;
        }

        const passToVerify = reauthPassword;
        setDeleteStage('deleting');
        setDeleteError('');

        try {
            const res = await completeAuthDeletionWithPassword({ password: passToVerify });

            if (res.success) {
                setDeleteModalVisible(false);
                setReauthPassword('');
                return;
            }

            if (res.stage === 'reauth') {
                setDeleteStage('reauth');
                setDeleteError('Incorrect password. Please verify your password and try again.');
                setReauthPassword('');
                return;
            }

            setDeleteStage('reauth');
            setDeleteError('Failed to complete account deletion. Please try again.');
            setReauthPassword('');
        } catch (err) {
            setDeleteStage('reauth');
            setDeleteError('An unexpected error occurred during re-authentication.');
            setReauthPassword('');
        }
    };

    const userInitial = displayName
        ? displayName.charAt(0).toUpperCase()
        : email
        ? email.charAt(0).toUpperCase()
        : 'U';

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }



    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.avatarSection}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={handleAvatarPress}
                        disabled={uploadingAvatar}
                    >
                        <View style={styles.avatarCircle}>
                            {uploadingAvatar ? (
                                <ActivityIndicator size="small" color="#08111F" />
                            ) : avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>{userInitial}</Text>
                            )}
                        </View>
                        <View style={styles.editBadge}>
                            <Text style={styles.editBadgeText}>+</Text>
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.profileEmail}>{email}</Text>
                    {createdAt ? (
                        <Text style={styles.joinedText}>Member since {createdAt}</Text>
                    ) : null}
                </View>



                <SectionHeader title="Profile Info" />
                <Card style={styles.card}>
                    <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                    <TextInput
                        placeholder="e.g. John Doe"
                        placeholderTextColor="#64748B"
                        value={displayName}
                        onChangeText={setDisplayName}
                        style={styles.input}
                    />

                    <Text style={styles.inputLabel}>EMAIL (READ-ONLY)</Text>
                    <TextInput
                        value={email}
                        editable={false}
                        style={[styles.input, styles.disabledInput]}
                    />
                </Card>

                <SectionHeader title="App Preferences" />
                <Card style={styles.card}>
                    <Text style={styles.inputLabel}>DAILY FOCUS GOAL (HOURS)</Text>
                    <TextInput
                        placeholder="e.g. 4"
                        placeholderTextColor="#64748B"
                        value={dailyGoalHours}
                        onChangeText={setDailyGoalHours}
                        keyboardType="numeric"
                        maxLength={2}
                        style={styles.input}
                    />

                    <View style={styles.settingRow}>
                        <View style={styles.settingTextContent}>
                            <Text style={styles.settingLabel}>Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Enable system notification services
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: COLORS.border, true: COLORS.primary }}
                            thumbColor={
                                notificationsEnabled
                                    ? COLORS.background
                                    : Platform.OS === 'ios'
                                    ? undefined
                                    : COLORS.gray
                            }
                        />
                    </View>

                    {notificationsEnabled && (
                        <>
                            <View style={styles.settingRow}>
                                <View style={styles.settingTextContent}>
                                    <Text style={styles.settingLabel}>Activity Reminders</Text>
                                    <Text style={styles.settingDescription}>
                                        Remind me of upcoming schedule tasks
                                    </Text>
                                </View>
                                <Switch
                                    value={activityRemindersEnabled}
                                    onValueChange={setActivityRemindersEnabled}
                                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                    thumbColor={
                                        activityRemindersEnabled
                                            ? COLORS.background
                                            : Platform.OS === 'ios'
                                            ? undefined
                                            : COLORS.gray
                                    }
                                />
                            </View>

                            {activityRemindersEnabled && (
                                <View style={styles.leadMinutesContainer}>
                                    <Text style={styles.inputLabel}>REMIND BEFORE START</Text>
                                    <View style={styles.leadMinutesRow}>
                                        {[5, 10, 15].map((mins) => {
                                            const isSelected = remindLeadMinutes === mins;
                                            return (
                                                <TouchableOpacity
                                                    key={mins}
                                                    style={[
                                                        styles.leadMinuteChip,
                                                        isSelected && styles.leadMinuteChipActive,
                                                    ]}
                                                    onPress={() => setRemindLeadMinutes(mins)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.leadMinuteText,
                                                            isSelected && styles.leadMinuteTextActive,
                                                        ]}
                                                    >
                                                        {mins} mins
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            <View style={styles.settingRow}>
                                <View style={styles.settingTextContent}>
                                    <Text style={styles.settingLabel}>Alert Sounds</Text>
                                    <Text style={styles.settingDescription}>
                                        Play custom alert tones when timer completes
                                    </Text>
                                </View>
                                <Switch
                                    value={soundsEnabled}
                                    onValueChange={setSoundsEnabled}
                                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                    thumbColor={
                                        soundsEnabled
                                            ? COLORS.background
                                            : Platform.OS === 'ios'
                                            ? undefined
                                            : COLORS.gray
                                    }
                                />
                            </View>

                            <View style={styles.settingRow}>
                                <View style={styles.settingTextContent}>
                                    <Text style={styles.settingLabel}>Vibration Alerts</Text>
                                    <Text style={styles.settingDescription}>
                                        Enable device vibration patterns
                                    </Text>
                                </View>
                                <Switch
                                    value={vibrationEnabled}
                                    onValueChange={setVibrationEnabled}
                                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                    thumbColor={
                                        vibrationEnabled
                                            ? COLORS.background
                                            : Platform.OS === 'ios'
                                            ? undefined
                                            : COLORS.gray
                                    }
                                />
                            </View>
                        </>
                    )}
                </Card>

                <AppButton
                    title={saving ? 'Saving Changes...' : 'Save Preferences'}
                    onPress={handleSave}
                    disabled={saving}
                    style={styles.saveButton}
                />

                <SectionHeader title="Account & Privacy" />
                <Card style={styles.card}>
                    <TouchableOpacity
                        style={styles.actionRowButton}
                        onPress={handlePasswordReset}
                    >
                        <Text style={styles.actionRowButtonText}>Change Password</Text>
                        <Text style={styles.actionRowArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionRowButton}
                        onPress={handlePrivacyPolicyPress}
                    >
                        <Text style={styles.actionRowButtonText}>Privacy & Data Policy</Text>
                        <Text style={styles.actionRowArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionRowButton}
                        onPress={handleLogout}
                    >
                        <Text style={styles.actionRowButtonText}>Logout Account</Text>
                        <Text style={styles.actionRowArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionRowButton, styles.lastActionRowButton]}
                        onPress={openDeleteModal}
                    >
                        <View style={styles.deleteRowContent}>
                            <AppIcon name="trash" size={16} color={COLORS.danger} />
                            <Text style={[styles.actionRowButtonText, styles.dangerText, styles.deleteRowText]}>
                                Delete Account
                            </Text>
                        </View>
                        <Text style={[styles.actionRowArrow, styles.dangerText]}>→</Text>
                    </TouchableOpacity>
                </Card>
            </ScrollView>

            <Modal
                visible={deleteModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeDeleteModal}
            >
                <View style={styles.deleteModalOverlay}>
                    <View style={styles.deleteModalContainer}>
                        {deleteStage === 'deleting' ? (
                            <View style={styles.deletingStateContainer}>
                                <ActivityIndicator size="large" color={COLORS.danger} />
                                <Text style={styles.deleteModalTitle}>Deleting Account...</Text>
                                <Text style={styles.deleteModalDescription}>
                                    Permanently removing your account and associated data from our servers. Please wait...
                                </Text>
                            </View>
                        ) : deleteStage === 'reauth' ? (
                            <View>
                                <View style={styles.deleteModalHeader}>
                                    <View style={styles.deleteIconBadge}>
                                        <AppIcon name="trash" size={24} color={COLORS.danger} />
                                    </View>
                                    <Text style={styles.deleteModalTitle}>Confirm Password</Text>
                                    <Text style={styles.deleteModalDescription}>
                                        For security, please enter your current password to authorize permanent account deletion.
                                    </Text>
                                </View>

                                {deleteError ? (
                                    <Text style={styles.deleteErrorMessage}>{deleteError}</Text>
                                ) : null}

                                <TextInput
                                    style={styles.deletePasswordInput}
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry={true}
                                    value={reauthPassword}
                                    onChangeText={setReauthPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                <View style={styles.deleteModalButtonRow}>
                                    <TouchableOpacity
                                        style={styles.deleteCancelButton}
                                        onPress={closeDeleteModal}
                                    >
                                        <Text style={styles.deleteCancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteConfirmButton}
                                        onPress={handleConfirmReauthDelete}
                                    >
                                        <Text style={styles.deleteConfirmButtonText}>Confirm & Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <View style={styles.deleteModalHeader}>
                                    <View style={styles.deleteIconBadge}>
                                        <AppIcon name="trash" size={24} color={COLORS.danger} />
                                    </View>
                                    <Text style={styles.deleteModalTitle}>Delete Account?</Text>
                                    <Text style={styles.deleteModalDescription}>
                                        This action is permanent and cannot be undone. All your activities, focus sessions, and profile data will be permanently erased.
                                    </Text>
                                </View>

                                {deleteError ? (
                                    <Text style={styles.deleteErrorMessage}>{deleteError}</Text>
                                ) : null}

                                <View style={styles.deleteModalButtonRow}>
                                    <TouchableOpacity
                                        style={styles.deleteCancelButton}
                                        onPress={closeDeleteModal}
                                    >
                                        <Text style={styles.deleteCancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteConfirmButton}
                                        onPress={handleInitialDelete}
                                    >
                                        <Text style={styles.deleteConfirmButtonText}>Delete My Account</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = ScaledSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: '16@ms',
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30),
        paddingBottom: '16@ms',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: '17@ms',
        fontWeight: '800',
    },
    scrollContent: {
        paddingHorizontal: '20@ms',
        paddingBottom: '40@ms',
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: '25@ms',
        marginBottom: '20@ms',
    },
    avatarContainer: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarCircle: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarClipContainer: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.secondary,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.background,
    },
    editBadgeText: {
        color: '#F8FAFC',
        fontSize: '14@ms',
        fontWeight: '900',
    },
    avatarText: {
        color: COLORS.background,
        fontSize: '32@ms',
        fontWeight: '800',
    },
    profileEmail: {
        color: COLORS.text,
        fontSize: '16@ms',
        fontWeight: '700',
        marginTop: '14@ms',
    },
    joinedText: {
        color: COLORS.textMuted,
        fontSize: '12@ms',
        marginTop: '4@ms',
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: '14@ms',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: '22@ms',
        marginBottom: '10@ms',
        paddingLeft: '4@ms',
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: '18@ms',
        paddingHorizontal: '18@ms',
        paddingTop: '18@ms',
        paddingBottom: '6@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputLabel: {
        color: COLORS.textMuted,
        fontSize: '10@ms',
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: '6@ms',
    },
    input: {
        backgroundColor: COLORS.cardElevated,
        borderRadius: '12@ms',
        padding: '14@ms',
        color: COLORS.text,
        fontSize: '14@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: '15@ms',
    },
    disabledInput: {
        color: COLORS.textMuted,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: '12@ms',
        borderTopWidth: 1,
        borderColor: COLORS.border,
    },
    settingTextContent: {
        flex: 1,
        paddingRight: '10@ms',
    },
    settingLabel: {
        color: COLORS.text,
        fontSize: '14@ms',
        fontWeight: '700',
    },
    settingDescription: {
        color: COLORS.textMuted,
        fontSize: '12@ms',
        marginTop: '3@ms',
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        padding: '16@ms',
        borderRadius: '14@ms',
        marginTop: '24@ms',
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
    actionRowButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: '14@ms',
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    lastActionRowButton: {
        borderBottomWidth: 0,
    },
    actionRowButtonText: {
        color: COLORS.text,
        fontSize: '14@ms',
        fontWeight: '700',
    },
    actionRowArrow: {
        color: COLORS.textMuted,
        fontSize: '16@ms',
        fontWeight: '600',
    },
    dangerText: {
        color: COLORS.danger,
    },
    statsCard: {
        backgroundColor: COLORS.card,
        borderRadius: '18@ms',
        padding: '20@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        marginBottom: '10@ms',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    statsFooter: {
        color: COLORS.primary,
        fontSize: '11@ms',
        fontWeight: '700',
        marginTop: '14@ms',
        textAlign: 'center',
        width: '100%',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        color: COLORS.primary,
        fontSize: '24@ms',
        fontWeight: '800',
    },
    statLabel: {
        color: COLORS.textMuted,
        fontSize: '10@ms',
        fontWeight: '800',
        marginTop: '6@ms',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: '40@vs',
        backgroundColor: COLORS.border,
    },
    leadMinutesContainer: {
        marginTop: '10@ms',
        marginBottom: '16@ms',
        paddingHorizontal: '12@ms',
        paddingVertical: '14@ms',
        backgroundColor: COLORS.cardElevated,
        borderRadius: '12@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    leadMinutesRow: {
        flexDirection: 'row',
        gap: '8@ms',
        marginTop: '8@ms',
    },
    leadMinuteChip: {
        flex: 1,
        paddingVertical: '10@ms',
        borderRadius: '10@ms',
        backgroundColor: COLORS.card,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    leadMinuteChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    leadMinuteText: {
        color: COLORS.textSecondary,
        fontSize: '13@ms',
        fontWeight: '700',
    },
    leadMinuteTextActive: {
        color: '#0B0E14',
        fontWeight: '800',
    },
    achievementsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '18@ms',
    },
    achievementsProgressText: {
        color: COLORS.primary,
        fontSize: '12@ms',
        fontWeight: '800',
    },
    achievementsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '10@ms',
        marginVertical: '12@ms',
    },
    badgeCard: {
        width: (screenWidth - 40 - 20) / 3,
        backgroundColor: COLORS.card,
        borderRadius: '14@ms',
        paddingVertical: '12@ms',
        paddingHorizontal: '8@ms',
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    badgeCardLocked: {
        borderColor: COLORS.border,
        opacity: 0.5,
    },
    badgeEmojiCircle: {
        width: '44@s',
        height: '44@vs',
        borderRadius: '22@ms',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    badgeEmojiCircleLocked: {
        backgroundColor: COLORS.cardElevated,
    },
    badgeEmoji: {
        fontSize: '20@ms',
    },
    badgeEmojiLocked: {
        opacity: 0.4,
    },
    badgeLockBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: COLORS.card,
        width: '14@s',
        height: '14@vs',
        borderRadius: '7@ms',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeLockText: {
        fontSize: '9@ms',
    },
    badgeTitle: {
        color: COLORS.text,
        fontSize: '11@ms',
        fontWeight: '800',
        marginTop: '8@ms',
        textAlign: 'center',
    },
    badgeRequirement: {
        color: COLORS.textMuted,
        fontSize: '9@ms',
        fontWeight: '600',
        marginTop: '3@ms',
        textAlign: 'center',
        lineHeight: 11,
    },
    deleteRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8@ms',
    },
    deleteRowText: {
        marginLeft: '4@ms',
    },
    deleteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24@ms',
    },
    deleteModalContainer: {
        backgroundColor: COLORS.card,
        borderRadius: '18@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: '22@ms',
        width: '100%',
        maxWidth: 400,
    },
    deleteModalHeader: {
        alignItems: 'center',
        marginBottom: '16@ms',
    },
    deleteIconBadge: {
        width: '48@ms',
        height: '48@ms',
        borderRadius: '24@ms',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '12@ms',
    },
    deleteModalTitle: {
        color: COLORS.text,
        fontSize: '18@ms',
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: '8@ms',
    },
    deleteModalDescription: {
        color: COLORS.textSecondary,
        fontSize: '13@ms',
        textAlign: 'center',
        lineHeight: 18,
    },
    deleteErrorMessage: {
        color: COLORS.danger,
        fontSize: '12@ms',
        textAlign: 'center',
        marginBottom: '12@ms',
        paddingHorizontal: '8@ms',
    },
    deletePasswordInput: {
        backgroundColor: COLORS.cardElevated,
        borderRadius: '12@ms',
        padding: '14@ms',
        color: COLORS.text,
        fontSize: '14@ms',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: '16@ms',
    },
    deleteModalButtonRow: {
        flexDirection: 'row',
        gap: '12@ms',
        marginTop: '6@ms',
    },
    deleteCancelButton: {
        flex: 1,
        paddingVertical: '13@ms',
        borderRadius: '12@ms',
        backgroundColor: COLORS.cardElevated,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    deleteCancelButtonText: {
        color: COLORS.textSecondary,
        fontSize: '14@ms',
        fontWeight: '700',
    },
    deleteConfirmButton: {
        flex: 1.2,
        paddingVertical: '13@ms',
        borderRadius: '12@ms',
        backgroundColor: COLORS.danger,
        alignItems: 'center',
    },
    deleteConfirmButtonText: {
        color: '#FFFFFF',
        fontSize: '14@ms',
        fontWeight: '800',
    },
    deletingStateContainer: {
        alignItems: 'center',
        paddingVertical: '20@ms',
        gap: '12@ms',
    },
});
