import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, Image, ScrollView, SafeAreaView, Alert, Modal, ActivityIndicator 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// YOUR FIREBASE REALTIME DATABASE REST ENDPOINT:
const FIREBASE_DB_URL = 'https://eventhub-db-30125-default-rtdb.firebaseio.com';

const INITIAL_EVENTS = [
  {
    id: '1',
    name: 'Tech Innovators Summit',
    category: 'Tech',
    date: '2026-10-15 10:00 AM',
    location: 'Main Auditorium, Hall 3',
    price: 25.0,
    availableSeats: 5,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500',
    description: 'Explore the future of AI, mobile cross-platform systems, and cloud infrastructure with global leaders.'
  },
  {
    id: '2',
    name: 'Acoustic Sunset Concert',
    category: 'Music',
    date: '2026-10-20 06:30 PM',
    location: 'Riverside Amphitheater',
    price: 15.0,
    availableSeats: 8,
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500',
    description: 'An evening of unplugged live performances featuring top indie singer-songwriters.'
  },
  {
    id: '3',
    name: 'City Marathon 2026',
    category: 'Sports',
    date: '2026-11-05 06:00 AM',
    location: 'Central Plaza',
    price: 10.0,
    availableSeats: 0,
    image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=500',
    description: 'Annual 10K marathon run open to beginners, enthusiasts, and pro athletes.'
  }
];

export default function App() {
  // Session & UI States
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('browse');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auth Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('attendee');

  // Core Data
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal (Event Details & Booking)
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [ticketCount, setTicketCount] = useState(1);

  // Organizer Form State
  const [editingEventId, setEditingEventId] = useState(null);
  const [orgTitle, setOrgTitle] = useState('');
  const [orgCategory, setOrgCategory] = useState('Tech');
  const [orgSeats, setOrgSeats] = useState('');
  const [orgPrice, setOrgPrice] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [orgLocation, setOrgLocation] = useState('');

  // Profile Edit State
  const [profileName, setProfileName] = useState('');

  // 1. Initial Load: Restore Local Session & Fetch Remote Database
  useEffect(() => {
    restoreLocalData();
    fetchEventsFromDB();
  }, []);

  const restoreLocalData = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('@user_session');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        setProfileName(u.name);
        fetchUserBookingsFromDB(u.email);
      }
    } catch (e) {
      console.log('Error reading storage', e);
    }
  };

  // REST API: GET Events from Firebase
  const fetchEventsFromDB = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${FIREBASE_DB_URL}/events.json`);
      const data = await res.json();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEvents(list);
      } else {
        // Seed initial events to Firebase if completely empty
        seedFirebase();
      }
    } catch (e) {
      console.log('Error fetching DB events', e);
    } finally {
      setLoading(false);
    }
  };

  const seedFirebase = async () => {
    for (let ev of INITIAL_EVENTS) {
      await fetch(`${FIREBASE_DB_URL}/events.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev)
      });
    }
    fetchEventsFromDB();
  };

  // REST API: GET User Bookings from Firebase
  const fetchUserBookingsFromDB = async (email) => {
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/bookings.json`);
      const data = await res.json();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(b => b.userEmail === email);
        setBookings(list);
      }
    } catch (e) {
      console.log('Error fetching bookings', e);
    }
  };

  // Notification Banner Trigger
  const triggerNotification = (text) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 4000);
  };

  // 2. User Authentication
  const handleAuth = async () => {
    if (!authEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (authPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    const userObj = {
      name: authMode === 'register' ? authName || 'User' : 'Active User',
      email: authEmail,
      role: authRole
    };

    // Save user in Firebase Cloud Database via POST
    await fetch(`${FIREBASE_DB_URL}/users.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userObj)
    });

    // Save locally in AsyncStorage
    await AsyncStorage.setItem('@user_session', JSON.stringify(userObj));
    setCurrentUser(userObj);
    setProfileName(userObj.name);
    fetchUserBookingsFromDB(userObj.email);
    triggerNotification(`Welcome, ${userObj.name}!`);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@user_session');
    setCurrentUser(null);
    setBookings([]);
    setActiveTab('browse');
    triggerNotification('Logged out successfully.');
  };

  // 3. Profile Update
  const handleUpdateProfile = async () => {
    if (!profileName.trim()) return;
    const updated = { ...currentUser, name: profileName };
    setCurrentUser(updated);
    await AsyncStorage.setItem('@user_session', JSON.stringify(updated));
    triggerNotification('Profile updated successfully!');
  };

  // 4. Booking Flow with Firebase REST API
  const handleConfirmBooking = async () => {
    if (ticketCount <= 0 || ticketCount > selectedEvent.availableSeats) {
      Alert.alert('Invalid Selection', `Please select between 1 and ${selectedEvent.availableSeats} tickets.`);
      return;
    }

    setLoading(true);
    try {
      // POST new booking to Firebase Realtime Database
      await fetch(`${FIREBASE_DB_URL}/bookings.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          eventName: selectedEvent.name,
          tickets: ticketCount,
          totalPrice: selectedEvent.price * ticketCount,
          date: selectedEvent.date,
          userEmail: currentUser.email,
          status: 'Confirmed'
        })
      });

      // PATCH update seat count in Firebase
      await fetch(`${FIREBASE_DB_URL}/events/${selectedEvent.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availableSeats: selectedEvent.availableSeats - ticketCount
        })
      });

      setSelectedEvent(null);
      setTicketCount(1);
      triggerNotification(`Booking confirmed for ${ticketCount} ticket(s) to ${selectedEvent.name}!`);
      
      // Refresh live database data
      fetchEventsFromDB();
      fetchUserBookingsFromDB(currentUser.email);
    } catch (err) {
      Alert.alert('Database Error', 'Could not record booking.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Booking Cancellation via Firebase REST API
  const handleCancelBooking = async (booking) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // DELETE booking from Firebase
              await fetch(`${FIREBASE_DB_URL}/bookings/${booking.id}.json`, {
                method: 'DELETE'
              });

              // PATCH restore seats in Firebase
              const matchedEvent = events.find(e => e.id === booking.eventId);
              if (matchedEvent) {
                await fetch(`${FIREBASE_DB_URL}/events/${booking.eventId}.json`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    availableSeats: matchedEvent.availableSeats + booking.tickets
                  })
                });
              }

              triggerNotification(`Booking for "${booking.eventName}" cancelled.`);
              fetchEventsFromDB();
              fetchUserBookingsFromDB(currentUser.email);
            } catch (err) {
              Alert.alert('Error', 'Could not cancel booking.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // 6. Organizer Operations (Add, Edit, Delete) with Firebase REST
  const handleSaveOrganizerEvent = async () => {
    if (!orgTitle.trim() || !orgSeats.trim() || !orgPrice.trim()) {
      Alert.alert('Validation Error', 'Please complete title, seats, and price.');
      return;
    }

    setLoading(true);
    try {
      if (editingEventId) {
        // PATCH update existing event
        await fetch(`${FIREBASE_DB_URL}/events/${editingEventId}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: orgTitle,
            category: orgCategory,
            availableSeats: parseInt(orgSeats, 10),
            price: parseFloat(orgPrice),
            description: orgDesc || 'Updated event',
            location: orgLocation || 'Hall'
          })
        });
        triggerNotification('Event updated in cloud database!');
        setEditingEventId(null);
      } else {
        // POST new event to Firebase
        await fetch(`${FIREBASE_DB_URL}/events.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: orgTitle,
            category: orgCategory,
            date: '2026-11-20 10:00 AM',
            location: orgLocation || 'Downtown Center',
            price: parseFloat(orgPrice) || 0,
            availableSeats: parseInt(orgSeats, 10) || 10,
            image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=500',
            description: orgDesc || 'Organizer-managed event.'
          })
        });
        triggerNotification('Event created in cloud database!');
      }

      setOrgTitle('');
      setOrgSeats('');
      setOrgPrice('');
      setOrgDesc('');
      setOrgLocation('');
      fetchEventsFromDB();
      setActiveTab('browse');
    } catch (e) {
      Alert.alert('Error', 'Failed to save event.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (event) => {
    setEditingEventId(event.id);
    setOrgTitle(event.name);
    setOrgCategory(event.category);
    setOrgSeats(event.availableSeats.toString());
    setOrgPrice(event.price.toString());
    setOrgDesc(event.description);
    setOrgLocation(event.location);
    setActiveTab('organizer');
  };

  const handleDeleteEvent = async (id) => {
    Alert.alert('Delete Event', 'Are you sure you want to remove this event from cloud DB?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await fetch(`${FIREBASE_DB_URL}/events/${id}.json`, { method: 'DELETE' });
            triggerNotification('Event deleted from database.');
            fetchEventsFromDB();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete event.');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  // Filtered List
  const filteredEvents = events.filter(e => {
    const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;
    const matchesSearch = (e.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Render Login/Register if unauthenticated
  if (!currentUser) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <Text style={styles.authLogo}>EventHub</Text>
        <Text style={styles.authSubtitle}>Discover & Book Regional Activities</Text>
        <View style={styles.cardBox}>
          <Text style={styles.modalTitle}>{authMode === 'login' ? 'Login' : 'Create Account'}</Text>
          {authMode === 'register' && (
            <TextInput style={styles.input} placeholder="Full Name" value={authName} onChangeText={setAuthName} />
          )}
          <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={authEmail} onChangeText={setAuthEmail} />
          <TextInput style={styles.input} placeholder="Password (min 6 chars)" secureTextEntry value={authPassword} onChangeText={setAuthPassword} />
          {authMode === 'register' && (
            <View style={styles.rolePicker}>
              <TouchableOpacity style={[styles.roleBtn, authRole === 'attendee' && styles.activeRole]} onPress={() => setAuthRole('attendee')}>
                <Text style={authRole === 'attendee' ? styles.activeRoleText : styles.roleText}>Attendee</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleBtn, authRole === 'organizer' && styles.activeRole]} onPress={() => setAuthRole('organizer')}>
                <Text style={authRole === 'organizer' ? styles.activeRoleText : styles.roleText}>Organizer</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}>
            <Text style={styles.btnText}>{authMode === 'login' ? 'Sign In' : 'Register'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            <Text style={{ color: '#2563eb', fontSize: 12 }}>
              {authMode === 'login' ? "Don't have an account? Register" : "Already registered? Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EventHub</Text>
        <Text style={styles.headerSubtitle}>{currentUser.name} ({currentUser.role})</Text>
      </View>

      {/* Cloud Indicator */}
      {loading && <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 4 }} />}

      {/* In-App Notification Banner */}
      {notification && (
        <View style={styles.notifBanner}>
          <Text style={styles.notifText}>🔔 {notification}</Text>
        </View>
      )}

      {/* Tab 1: Browse Screen */}
      {activeTab === 'browse' && (
        <View style={{ flex: 1 }}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search events..." 
            value={search} 
            onChangeText={setSearch} 
          />
          <View style={styles.categoryRow}>
            {['All', 'Tech', 'Music', 'Sports'].map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.catBadge, selectedCategory === cat && styles.activeCatBadge]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={selectedCategory === cat ? styles.activeCatText : styles.catText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredEvents}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.eventCard} onPress={() => setSelectedEvent(item)}>
                <Image source={{ uri: item.image || 'https://via.placeholder.com/300' }} style={styles.cardImage} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>📅 {item.date} | 📍 {item.location}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardPrice}>${Number(item.price).toFixed(2)}</Text>
                    <Text style={Number(item.availableSeats) > 0 ? styles.seatBadge : styles.soldBadge}>
                      {Number(item.availableSeats) > 0 ? `${item.availableSeats} seats left` : 'Sold Out'}
                    </Text>
                    <Text style={styles.viewDetailsText}>Tap to View Details →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Tab 2: My Bookings Screen */}
      {activeTab === 'myBookings' && (
        <ScrollView style={styles.screenPadding}>
          <Text style={styles.sectionTitle}>My Cloud Database Bookings</Text>
          {bookings.length === 0 ? (
            <Text style={styles.emptyText}>You have no bookings recorded.</Text>
          ) : (
            bookings.map(b => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.cardTitle}>{b.eventName}</Text>
                <Text style={styles.cardMeta}>Tickets: {b.tickets} | Total Paid: ${Number(b.totalPrice).toFixed(2)}</Text>
                <Text style={[styles.cardMeta, { color: '#16a34a' }]}>Status: {b.status}</Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelBooking(b)}>
                  <Text style={styles.btnText}>Cancel Booking</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Tab 3: Organizer Dashboard */}
      {activeTab === 'organizer' && (
        <ScrollView style={styles.screenPadding}>
          <Text style={styles.sectionTitle}>{editingEventId ? 'Edit Event' : 'Create New Event'}</Text>
          <TextInput style={styles.input} placeholder="Event Name" value={orgTitle} onChangeText={setOrgTitle} />
          <TextInput style={styles.input} placeholder="Location / Address" value={orgLocation} onChangeText={setOrgLocation} />
          <TextInput style={styles.input} placeholder="Available Seats" keyboardType="numeric" value={orgSeats} onChangeText={setOrgSeats} />
          <TextInput style={styles.input} placeholder="Ticket Price ($)" keyboardType="numeric" value={orgPrice} onChangeText={setOrgPrice} />
          <TextInput style={styles.input} placeholder="Description" multiline value={orgDesc} onChangeText={setOrgDesc} />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveOrganizerEvent}>
            <Text style={styles.btnText}>{editingEventId ? 'Save Changes to Cloud' : 'Publish to Cloud DB'}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Manage Hosted Events & Bookings</Text>
          {events.map(ev => {
            const attendeeCount = bookings.filter(b => b.eventId === ev.id).reduce((acc, cur) => acc + (cur.tickets || 1), 0);
            return (
              <View key={ev.id} style={styles.orgEventItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{ev.name}</Text>
                  <Text style={styles.cardMeta}>Available: {ev.availableSeats} | Price: ${ev.price}</Text>
                  <Text style={[styles.cardMeta, { color: '#2563eb' }]}>Total Booked Attendees: {attendeeCount}</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={styles.smallEditBtn} onPress={() => handleStartEdit(ev)}>
                    <Text style={styles.btnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallDeleteBtn} onPress={() => handleDeleteEvent(ev.id)}>
                    <Text style={styles.btnText}>Del</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Tab 4: Profile Screen */}
      {activeTab === 'profile' && (
        <View style={styles.screenPadding}>
          <Text style={styles.sectionTitle}>User Profile & Settings</Text>
          <View style={styles.cardBox}>
            <Text style={styles.cardMeta}>Email: {currentUser.email}</Text>
            <Text style={styles.cardMeta}>Account Role: {currentUser.role}</Text>
            <Text style={[styles.cardMeta, { marginTop: 10 }]}>Display Name:</Text>
            <TextInput style={styles.input} value={profileName} onChangeText={setProfileName} />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdateProfile}>
              <Text style={styles.btnText}>Update Profile</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.btnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Event Details & Booking Modal */}
      {selectedEvent && (
        <Modal animationType="slide" transparent={true} visible={true}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Image source={{ uri: selectedEvent.image || 'https://via.placeholder.com/300' }} style={styles.modalImage} />
              <ScrollView style={{ padding: 15 }}>
                <Text style={styles.modalTitle}>{selectedEvent.name}</Text>
                <Text style={styles.cardMeta}>📍 {selectedEvent.location}</Text>
                <Text style={styles.cardMeta}>📅 {selectedEvent.date}</Text>
                <Text style={styles.modalDesc}>{selectedEvent.description}</Text>
                <Text style={styles.cardPrice}>Price: ${Number(selectedEvent.price).toFixed(2)} / seat</Text>
                <Text style={Number(selectedEvent.availableSeats) > 0 ? styles.seatBadge : styles.soldBadge}>
                  {Number(selectedEvent.availableSeats) > 0 ? `Seats Available: ${selectedEvent.availableSeats}` : 'Sold Out'}
                </Text>

                {Number(selectedEvent.availableSeats) > 0 && (
                  <View style={styles.ticketSection}>
                    <Text style={styles.cardMeta}>Number of Tickets:</Text>
                    <View style={styles.counterRow}>
                      <TouchableOpacity 
                        style={styles.counterBtn} 
                        onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}
                      >
                        <Text style={styles.counterText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.countValue}>{ticketCount}</Text>
                      <TouchableOpacity 
                        style={styles.counterBtn} 
                        onPress={() => setTicketCount(Math.min(selectedEvent.availableSeats, ticketCount + 1))}
                      >
                        <Text style={styles.counterText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.totalPrice}>Total: ${(selectedEvent.price * ticketCount).toFixed(2)}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmBooking}>
                      <Text style={styles.btnText}>Confirm & Book Tickets via REST</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={() => { setSelectedEvent(null); setTicketCount(1); }}>
                  <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 12 }}>Close Window</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Bottom Tabs */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('browse')}>
          <Text style={[styles.navLabel, activeTab === 'browse' && styles.activeNavLabel]}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('myBookings')}>
          <Text style={[styles.navLabel, activeTab === 'myBookings' && styles.activeNavLabel]}>Bookings ({bookings.length})</Text>
        </TouchableOpacity>
        {currentUser.role === 'organizer' && (
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('organizer')}>
            <Text style={[styles.navLabel, activeTab === 'organizer' && styles.activeNavLabel]}>Organizer</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.activeNavLabel]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 14, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#94a3b8' },
  notifBanner: { backgroundColor: '#16a34a', padding: 8, alignItems: 'center' },
  notifText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  authContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 20 },
  authLogo: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  authSubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  cardBox: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 15, elevation: 1 },
  searchInput: { margin: 10, padding: 8, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  categoryRow: { flexDirection: 'row', paddingHorizontal: 10, marginBottom: 8 },
  catBadge: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#e2e8f0', borderRadius: 14, marginRight: 6 },
  activeCatBadge: { backgroundColor: '#2563eb' },
  catText: { fontSize: 11, color: '#475569' },
  activeCatText: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
  eventCard: { backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  cardImage: { width: '100%', height: 120 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  cardMeta: { fontSize: 11, color: '#64748b', marginTop: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cardPrice: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
  seatBadge: { fontSize: 11, color: '#2563eb', fontWeight: 'bold' },
  soldBadge: { fontSize: 11, color: '#dc2626', fontWeight: 'bold' },
  viewDetailsText: { fontSize: 11, color: '#2563eb' },
  screenPadding: { padding: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#0f172a' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 25 },
  bookingCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cancelBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  orgEventItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  smallEditBtn: { backgroundColor: '#2563eb', padding: 6, borderRadius: 4, marginRight: 6 },
  smallDeleteBtn: { backgroundColor: '#ef4444', padding: 6, borderRadius: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 13 },
  rolePicker: { flexDirection: 'row', marginBottom: 10 },
  roleBtn: { flex: 1, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, marginHorizontal: 2 },
  activeRole: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  roleText: { fontSize: 12, color: '#64748b' },
  activeRoleText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#2563eb', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 6 },
  logoutBtn: { backgroundColor: '#ef4444', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row', height: 48, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navLabel: { fontSize: 11, color: '#64748b' },
  activeNavLabel: { color: '#2563eb', fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' },
  modalImage: { width: '100%', height: 160 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  modalDesc: { fontSize: 13, color: '#334155', marginVertical: 10, lineHeight: 18 },
  ticketSection: { marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  counterBtn: { backgroundColor: '#e2e8f0', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  counterText: { fontSize: 18, fontWeight: 'bold' },
  countValue: { marginHorizontal: 15, fontSize: 16, fontWeight: 'bold' },
  totalPrice: { fontSize: 15, fontWeight: 'bold', color: '#16a34a', marginBottom: 8 }
});