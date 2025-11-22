import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import axios from "axios";
import io from "socket.io-client";

// ⚙️ CONFIGURATION
const API_URL = "http://localhost:5000"; // Change for production: 'https://your-backend.onrender.com'
const STUDENT_ID = "STU001";

export default function App() {
  // State Management
  const [quizScore, setQuizScore] = useState("");
  const [focusMinutes, setFocusMinutes] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusTime, setFocusTime] = useState(0);
  const [tabSwitched, setTabSwitched] = useState(false);

  const socketRef = useRef(null);
  const focusIntervalRef = useRef(null);

  // ==================== WEBSOCKET SETUP ====================
  useEffect(() => {
    console.log("🔌 Connecting to WebSocket...");
    socketRef.current = io(API_URL);

    socketRef.current.on("connect", () => {
      console.log("✅ WebSocket connected");
      socketRef.current.emit("register", STUDENT_ID);
    });

    socketRef.current.on("status-update", (data) => {
      console.log("📨 Status update received:", data);
      Alert.alert(
        "Status Update",
        `Your status changed to: ${data.intervention_state}`
      );
      fetchStudentData();
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ WebSocket disconnected");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ==================== FETCH STUDENT DATA ====================
  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      console.log("📥 Fetching student data...");
      const response = await axios.get(`${API_URL}/api/student/${STUDENT_ID}`);
      setStudentData(response.data.student);
      setIntervention(response.data.intervention);
      console.log(
        "✅ Student data loaded:",
        response.data.student.intervention_state
      );
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      Alert.alert(
        "Error",
        "Could not load student data. Make sure backend is running."
      );
    }
  };

  // ==================== BONUS: TAB SWITCH DETECTION ====================
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleVisibilityChange = () => {
      if (document.hidden && isFocusing && !tabSwitched) {
        console.log("⚠️  Tab switch detected!");
        setTabSwitched(true);
        stopFocusTimer(true);
        logPenalty("Tab switched during focus session");
        Alert.alert("Focus Lost!", "You switched tabs. Session failed.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isFocusing, tabSwitched]);

  // ==================== DAILY CHECK-IN ====================
  const handleDailyCheckin = async () => {
    if (!quizScore || !focusMinutes) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const score = parseInt(quizScore);
    const minutes = parseInt(focusMinutes);

    if (
      isNaN(score) ||
      isNaN(minutes) ||
      score < 0 ||
      score > 10 ||
      minutes < 0
    ) {
      Alert.alert("Error", "Invalid values. Quiz: 0-10, Minutes: >= 0");
      return;
    }

    setLoading(true);
    try {
      console.log("📤 Submitting check-in:", { score, minutes });
      const response = await axios.post(`${API_URL}/api/daily-checkin`, {
        student_id: STUDENT_ID,
        quiz_score: score,
        focus_minutes: minutes,
      });

      console.log("✅ Check-in response:", response.data);
      Alert.alert("Check-in Complete", response.data.message);

      setQuizScore("");
      setFocusMinutes("");

      await fetchStudentData();
    } catch (error) {
      console.error("❌ Check-in error:", error);
      Alert.alert("Error", error.response?.data?.error || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  // ==================== FOCUS TIMER ====================
  const startFocusTimer = () => {
    console.log("⏱️  Focus timer started");
    setIsFocusing(true);
    setFocusTime(0);
    setTabSwitched(false);

    focusIntervalRef.current = setInterval(() => {
      setFocusTime((prev) => prev + 1);
    }, 1000);
  };

  const stopFocusTimer = (penalty = false) => {
    if (focusIntervalRef.current) {
      clearInterval(focusIntervalRef.current);
    }

    if (!penalty) {
      const minutes = Math.floor(focusTime / 60);
      setFocusMinutes(minutes.toString());
      console.log(`✅ Focus completed: ${minutes} minutes`);
      Alert.alert("Focus Complete!", `You focused for ${minutes} minutes!`);
    } else {
      console.log("❌ Focus failed (penalty)");
    }

    setIsFocusing(false);
    setFocusTime(0);
  };

  // ==================== LOG PENALTY ====================
  const logPenalty = async (reason) => {
    try {
      await axios.post(`${API_URL}/api/log-penalty`, {
        student_id: STUDENT_ID,
        reason,
      });
      console.log("⚠️  Penalty logged:", reason);
    } catch (error) {
      console.error("❌ Error logging penalty:", error);
    }
  };

  // ==================== COMPLETE TASK ====================
  const completeTask = async () => {
    if (!intervention) return;

    setLoading(true);
    try {
      console.log("📤 Completing task...");
      await axios.post(`${API_URL}/api/complete-task`, {
        student_id: STUDENT_ID,
        intervention_id: intervention.id,
      });

      Alert.alert("Success!", "Task completed! You can now continue.");
      await fetchStudentData();
    } catch (error) {
      console.error("❌ Error completing task:", error);
      Alert.alert("Error", "Failed to complete task");
    } finally {
      setLoading(false);
    }
  };

  // ==================== UTILITY ====================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // ==================== RENDER BASED ON STATE ====================
  const renderContent = () => {
    if (!studentData) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    const state = studentData.intervention_state;

    // 🔒 LOCKED STATE
    if (state === "Locked") {
      return (
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedTitle}>Analysis in Progress</Text>
          <Text style={styles.lockedText}>Waiting for Mentor...</Text>
          <Text style={styles.lockedSubtext}>
            Your performance needs review. A mentor will assign you a remedial
            task shortly.
          </Text>
          <ActivityIndicator
            size="large"
            color="#ef4444"
            style={{ marginTop: 20 }}
          />
        </View>
      );
    }

    // 📚 REMEDIAL STATE
    if (state === "Remedial" && intervention && !intervention.completed) {
      return (
        <View style={styles.remedialContainer}>
          <Text style={styles.remedialIcon}>📚</Text>
          <Text style={styles.remedialTitle}>Remedial Task Assigned</Text>

          <View style={styles.taskCard}>
            <Text style={styles.taskLabel}>Your Task:</Text>
            <Text style={styles.taskText}>{intervention.assigned_task}</Text>
            <Text style={styles.taskMeta}>
              Assigned by: {intervention.assigned_by || "Mentor"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.completeButton}
            onPress={completeTask}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>✓ Mark Complete</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // ✅ NORMAL STATE
    return (
      <ScrollView style={styles.normalContainer}>
        <Text style={styles.welcomeText}>Welcome, {studentData.name}!</Text>
        <Text style={styles.statusBadge}>✅ Status: On Track</Text>

        {/* Focus Timer Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏱️ Focus Timer</Text>

          {isFocusing ? (
            <>
              <Text style={styles.timerText}>{formatTime(focusTime)}</Text>
              <Text style={styles.warningText}>⚠️ Don't switch tabs!</Text>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={() => stopFocusTimer(false)}
              >
                <Text style={styles.buttonText}>Stop Focus Session</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startFocusTimer}
            >
              <Text style={styles.buttonText}>Start Focus Timer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Daily Check-in Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Daily Check-in</Text>

          <Text style={styles.inputLabel}>Quiz Score (0-10)</Text>
          <TextInput
            style={styles.input}
            value={quizScore}
            onChangeText={setQuizScore}
            keyboardType="numeric"
            placeholder="Enter score"
            maxLength={2}
            editable={!loading}
          />

          <Text style={styles.inputLabel}>Focus Time (minutes)</Text>
          <TextInput
            style={styles.input}
            value={focusMinutes}
            onChangeText={setFocusMinutes}
            keyboardType="numeric"
            placeholder="Enter minutes"
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDailyCheckin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit Check-in</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.requirementText}>
            ✓ Required: Quiz Score {">"} 7 AND Focus {">"} 60 minutes
          </Text>
        </View>
      </ScrollView>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alcovia Student Portal</Text>
        <Text style={styles.headerSubtitle}>Student ID: {STUDENT_ID}</Text>
      </View>
      {renderContent()}
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#6366f1",
    padding: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#e0e7ff",
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  normalContainer: {
    padding: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1f2937",
  },
  statusBadge: {
    fontSize: 16,
    color: "#22c55e",
    fontWeight: "600",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#1f2937",
  },
  timerText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366f1",
    textAlign: "center",
    marginVertical: 20,
  },
  warningText: {
    fontSize: 14,
    color: "#f59e0b",
    textAlign: "center",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  stopButton: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  completeButton: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  requirementText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  lockedIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#ef4444",
  },
  lockedText: {
    fontSize: 18,
    marginBottom: 16,
    color: "#6b7280",
  },
  lockedSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
  remedialContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  remedialIcon: {
    fontSize: 64,
    textAlign: "center",
    marginBottom: 20,
  },
  remedialTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    color: "#1f2937",
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
    fontWeight: "500",
  },
  taskText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  taskMeta: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
