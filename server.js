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

db.run(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE,
    edits INTEGER
  )
`);

// POST /api/user — insert or update user data
app.post("/api/user", (req, res) => {
  const { username, edits, csv } = req.body;

  if (!username || edits == null) {
    return res.status(400).json({ error: "Missing username or edits" });
  }

  db.run(
    `INSERT INTO stats (user, edits) VALUES (?, ?)
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
  db.all("SELECT user, edits FROM stats ORDER BY edits DESC", [], (err, rows) => {
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
  db.all("SELECT user, edits FROM stats ORDER BY edits DESC", [], (err, rows) => {
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
