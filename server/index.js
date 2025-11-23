// index.js (DEBUG VERSION - paste/replace your existing file temporarily)
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const axios = require("axios");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // enable TLS, ignore cert validation
});

// Test DB Connection (log full error if any)
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Database connected:", res.rows[0].now);
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Global error handlers (helps capture background issues)
process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at Promise", p, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

// Store active WebSocket connections
const activeConnections = new Map();

// WebSocket Connection Handler
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("register", (studentId) => {
    activeConnections.set(studentId, socket.id);
    console.log(`📝 Student ${studentId} registered`);
  });

  socket.on("disconnect", () => {
    for (let [studentId, socketId] of activeConnections.entries()) {
      if (socketId === socket.id) {
        activeConnections.delete(studentId);
        console.log(`👋 Student ${studentId} disconnected`);
        break;
      }
    }
  });
});

// Helper: Notify student via WebSocket
function notifyStudent(studentId, data) {
  const socketId = activeConnections.get(studentId);
  if (socketId) {
    io.to(socketId).emit("status-update", data);
    console.log(`📤 Sent update to ${studentId}:`, data);
    return true;
  }
  return false;
}

// ==================== API ROUTES ====================

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "connected",
  });
});

// Get Student Status (DEBUGGED - returns details on error)
app.get("/api/student/:studentId", async (req, res) => {
  console.log("📥 GET /api/student called with:", req.params.studentId);
  try {
    const { studentId } = req.params;

    const studentResult = await pool.query(
      "SELECT * FROM students WHERE student_id = $1",
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      console.warn(`⚠️ Student ${studentId} not found`);
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentResult.rows[0];

    const interventionResult = await pool.query(
      "SELECT * FROM interventions WHERE student_id = $1 AND completed = false ORDER BY assigned_at DESC LIMIT 1",
      [studentId]
    );

    return res.json({
      student,
      intervention: interventionResult.rows[0] || null,
    });
  } catch (error) {
    console.error("❌ ERROR in /api/student/:studentId →", error);
    // TEMP: return error details for debugging. Remove before production.
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
      stack: error.stack,
    });
  }
});

// Daily Check-in Endpoint (MAIN LOGIC) (unchanged)
app.post("/api/daily-checkin", async (req, res) => {
  const client = await pool.connect();

  try {
    const { student_id, quiz_score, focus_minutes } = req.body;

    console.log("📥 Check-in received:", {
      student_id,
      quiz_score,
      focus_minutes,
    });

    // Validation
    if (
      !student_id ||
      quiz_score === undefined ||
      focus_minutes === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await client.query("BEGIN");

    // Check student exists
    const studentCheck = await client.query(
      "SELECT * FROM students WHERE student_id = $1",
      [student_id]
    );

    if (studentCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }

    // ⚡ THE LOGIC GATE ⚡
    const isSuccess = quiz_score > 7 && focus_minutes > 60;
    const logStatus = isSuccess ? "On Track" : "Needs Intervention";

    console.log("🎯 Logic Gate:", { isSuccess, logStatus });

    // Insert daily log
    await client.query(
      "INSERT INTO daily_logs (student_id, quiz_score, focus_minutes, status) VALUES ($1, $2, $3, $4)",
      [student_id, quiz_score, focus_minutes, logStatus]
    );

    if (isSuccess) {
      // ✅ SUCCESS PATH
      await client.query(
        "UPDATE students SET intervention_state = $1 WHERE student_id = $2",
        ["Normal", student_id]
      );

      await client.query("COMMIT");

      notifyStudent(student_id, {
        status: "Normal",
        intervention_state: "Normal",
      });

      return res.json({
        status: "On Track",
        intervention_state: "Normal",
        message: "Great work! Keep it up.",
      });
    } else {
      // ❌ FAILURE PATH - LOCK THE STUDENT
      await client.query(
        "UPDATE students SET intervention_state = $1 WHERE student_id = $2",
        ["Locked", student_id]
      );

      // Create intervention record
      const interventionResult = await client.query(
        "INSERT INTO interventions (student_id, trigger_reason) VALUES ($1, $2) RETURNING id",
        [
          student_id,
          `Low performance: Quiz=${quiz_score}, Focus=${focus_minutes}min`,
        ]
      );

      await client.query("COMMIT");

      const interventionId = interventionResult.rows[0].id;

      console.log("🔒 Student locked, intervention ID:", interventionId);

      // Notify student via WebSocket
      notifyStudent(student_id, {
        status: "Locked",
        intervention_state: "Locked",
      });

      // 🚨 TRIGGER n8n WEBHOOK
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (
        webhookUrl &&
        webhookUrl !==
          "https://your-instance.app.n8n.cloud/webhook/student-intervention"
      ) {
        console.log("📞 Calling n8n webhook...");
        axios
          .post(webhookUrl, {
            student_id,
            student_name: studentCheck.rows[0].name,
            student_email: studentCheck.rows[0].email,
            quiz_score,
            focus_minutes,
            intervention_id: interventionId,
            callback_url: `${
              process.env.BACKEND_URL || "http://localhost:5000"
            }/api/assign-intervention`,
          })
          .then(() => {
            console.log("✅ n8n webhook triggered");
          })
          .catch((err) => {
            console.error("❌ n8n webhook error:", err.message);
          });
      } else {
        console.log("⚠️  n8n webhook not configured");
      }

      return res.json({
        status: "Pending Mentor Review",
        intervention_state: "Locked",
        message: "Analysis in progress. Waiting for Mentor...",
        intervention_id: interventionId,
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Assign Intervention (Called by n8n)
app.post("/api/assign-intervention", async (req, res) => {
  const client = await pool.connect();

  try {
    const { student_id, intervention_id, assigned_task, assigned_by } =
      req.body;

    console.log("📥 Intervention assignment:", {
      student_id,
      intervention_id,
      assigned_task,
    });

    if (!student_id || !assigned_task) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await client.query("BEGIN");

    // Update intervention
    await client.query(
      "UPDATE interventions SET assigned_task = $1, assigned_by = $2, assigned_at = NOW() WHERE id = $3",
      [assigned_task, assigned_by || "Mentor", intervention_id]
    );

    // Update student to Remedial state
    await client.query(
      "UPDATE students SET intervention_state = $1 WHERE student_id = $2",
      ["Remedial", student_id]
    );

    await client.query("COMMIT");

    // Get updated data
    const interventionResult = await client.query(
      "SELECT * FROM interventions WHERE id = $1",
      [intervention_id]
    );

    console.log("🔓 Student unlocked to Remedial state");

    // 🚀 INSTANT WEBSOCKET UPDATE
    notifyStudent(student_id, {
      status: "Remedial",
      intervention_state: "Remedial",
      intervention: interventionResult.rows[0],
    });

    res.json({
      success: true,
      message: "Intervention assigned successfully",
      intervention: interventionResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Complete Remedial Task
app.post("/api/complete-task", async (req, res) => {
  const client = await pool.connect();

  try {
    const { student_id, intervention_id } = req.body;

    console.log("📥 Task completion:", { student_id, intervention_id });

    await client.query("BEGIN");

    // Mark intervention completed
    await client.query(
      "UPDATE interventions SET completed = true, completed_at = NOW() WHERE id = $1",
      [intervention_id]
    );

    // Return to Normal state
    await client.query(
      "UPDATE students SET intervention_state = $1 WHERE student_id = $2",
      ["Normal", student_id]
    );

    await client.query("COMMIT");

    console.log("✅ Task completed, student back to Normal");

    // Notify via WebSocket
    notifyStudent(student_id, {
      status: "Normal",
      intervention_state: "Normal",
    });

    res.json({
      success: true,
      message: "Task completed successfully",
      intervention_state: "Normal",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Log Penalty (BONUS: Tab Switch)
app.post("/api/log-penalty", async (req, res) => {
  try {
    const { student_id, reason } = req.body;

    await pool.query(
      "INSERT INTO daily_logs (student_id, quiz_score, focus_minutes, status) VALUES ($1, $2, $3, $4)",
      [student_id, 0, 0, `Penalty: ${reason}`]
    );

    console.log("⚠️  Penalty logged:", { student_id, reason });

    res.json({ success: true, message: "Penalty logged" });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});
