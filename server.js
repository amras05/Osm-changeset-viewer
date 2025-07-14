const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./changesets.db");

// /api/user.js (for Vercel or local Next.js API routes)
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { username, edits } = req.body;
    const { error } = await supabase.from("users").upsert({ username, edits });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase.from("users").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
}


// POST /api/user — insert or update user data
app.post("/api/user", (req, res) => {
  const { username, edits, csv } = req.body;

  if (!username || edits == null) {
    return res.status(400).json({ error: "Missing username or edits" });
  }

  db.run(
    `INSERT INTO users (user, edits) VALUES (?, ?)
     ON CONFLICT(user) DO UPDATE SET edits = excluded.edits`,
    [username, edits],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });

      // Save changeset CSV for user
      const filePath = path.join(__dirname, "changesets", `${username}.csv`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, csv);
      res.json({ success: true });
    }
  );
});

// GET /api/users — return all stored users
app.get("/api/users", (req, res) => {
  db.all("SELECT user, edits FROM users ORDER BY edits DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch users" });
    res.json(rows);
  });
});

// Serve CSV file for user
app.get("/changesets/:username.csv", (req, res) => {
  const file = path.join(__dirname, "changesets", `${req.params.username}.csv`);
  if (!fs.existsSync(file)) return res.status(404).send("CSV not found");
  res.sendFile(file);
});

// GET /dashdownload — serve entire dashboard CSV
app.get("/dashdownload", (req, res) => {
  db.all("SELECT user, edits FROM users ORDER BY edits DESC", [], (err, rows) => {
    if (err) return res.status(500).send("Error generating dashboard");

    const csv = ["user,edits", ...rows.map((r) => `${r.user},${r.edits}`)].join("\n");
    const filePath = path.join(__dirname, "dashboard.csv");
    fs.writeFileSync(filePath, csv);
    res.download(filePath, "dashboard.csv");
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
