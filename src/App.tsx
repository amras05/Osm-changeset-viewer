import { useEffect, useState } from "react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Map } from "lucide-react";
import { PieChart as RChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from "recharts";

/**
 * OSM Changeset Viewer — v8
 * • Persists fetched usernames + total edits in browser localStorage (simple DB)
 * • Dashboard now reloads saved users on page refresh
 */
interface StatRow {
  user: string;
  edits: number;
}

export default function App() {
  const [username, setUsername] = useState("");
  const [userStats, setUserStats] = useState<StatRow[]>(() => {
    try {
      const raw = localStorage.getItem("osmUserStats");
      return raw ? (JSON.parse(raw) as StatRow[]) : [];
    } catch {
      return [];
    }
  });
  const [currentStats, setCurrentStats] = useState<{
    edits: number;
    days: number;
    editors: Record<string, number>;
    csvUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c", "#d0ed57", "#d066ff"];

  /** save stats to localStorage whenever list changes */
  useEffect(() => {
    localStorage.setItem("osmUserStats", JSON.stringify(userStats));
  }, [userStats]);

  const fetchChangesets = async (user: string) => {
    setLoading(true);
    setError(null);
    setCurrentStats(null);

    const EPOCH = "2004-01-01T00:00:00Z";
    let windowEnd = new Date().toISOString();
    let edits = 0;
    const daySet = new Set<string>();
    const editors: Record<string, number> = {};
    const csvLines: string[] = [
      "id,created_at,closed_at,changes_count,min_lon,min_lat,max_lon,max_lat,editor,comment",
    ];
    let firstLoop = true;

    try {
      while (true) {
        const url = `https://api.openstreetmap.org/api/0.6/changesets?display_name=${encodeURIComponent(user)}&time=${EPOCH},${windowEnd}&limit=100`;
        const res = await fetch(url);
        if (res.status === 404) throw new Error("Wrong username");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        if (firstLoop && !xml.includes("<changeset")) throw new Error(`User "${user}" has no contributions yet`);
        firstLoop = false;
        if (!xml.includes("<changeset")) break;
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const sets = Array.from(doc.getElementsByTagName("changeset"));
        if (!sets.length) break;
        let earliest = windowEnd;
        sets.forEach((cs) => {
          const created = cs.getAttribute("created_at") || "";
          edits += parseInt(cs.getAttribute("changes_count") || "0", 10);
          daySet.add(created.slice(0, 10));
          const tag = Array.from(cs.getElementsByTagName("tag")).find((t) => t.getAttribute("k") === "created_by");
          let editor = tag?.getAttribute("v") || "unknown";
          editor = editor.split("/")[0].split(" ")[0];
          editors[editor] = (editors[editor] || 0) + 1;
          if (created < earliest) earliest = created;
        });
        windowEnd = new Date(new Date(earliest).getTime() - 1000).toISOString().replace(/\.\d+Z$/, "Z");
        await new Promise((r) => setTimeout(r, 1100));
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return;
    }

    const csvUrl = URL.createObjectURL(new Blob([csvLines.join("\n")], { type: "text/csv" }));
    const updated: StatRow = { user, edits };

    setUserStats((prev) => {
      const next = [...prev.filter((row) => row.user !== user), updated].sort((a, b) => b.edits - a.edits);
      return next;
    });

    setCurrentStats({ edits, days: daySet.size, editors, csvUrl });
    setLoading(false);
  };

  // periodic refresh of stored users
  useEffect(() => {
    const id = setInterval(() => userStats.forEach((u) => fetchChangesets(u.user)), 1200000);
    return () => clearInterval(id);
  }, [userStats]);

  const editorData = currentStats ? Object.entries(currentStats.editors).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 gap-6">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold"><Map className="w-7 h-7" /> OSM Changeset Viewer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex gap-2">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter OSM username" disabled={loading} />
            <Button onClick={() => fetchChangesets(username)} disabled={!username || loading}>{loading ? "Loading…" : "Fetch"}</Button>
          </div>

          {error && <p className="text-red-600 font-medium">Error: {error}</p>}

          {currentStats && !error && (
            <>
              <div className="grid grid-cols-2 gap-4 text-lg font-medium">
                <div>Total edits: <span className="font-bold">{currentStats.edits.toLocaleString()}</span></div>
                <div>Mapping days: <span className="font-bold">{currentStats.days}</span></div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="w-full h-64">
                  <ResponsiveContainer>
                    <RChart>
                      <Pie data={editorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                        {editorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </RChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm"><thead><tr className="border-b font-medium"><th className="py-1 px-2 text-left">Editor</th><th className="py-1 px-2 text-right">Count</th></tr></thead><tbody>
                    {editorData.map((r) => <tr key={r.name} className="border-b last:border-0"><td className="py-1 px-2">{r.name}</td><td className="py-1 px-2 text-right font-semibold">{r.value.toLocaleString()}</td></tr>)}
                  </tbody></table>
                </div>
              </div>
              <a href={currentStats.csvUrl} download={`${username}_changesets.csv`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">Download CSV</a>
            </>
          )}

          {userStats.length > 0 && (
            <div className="mt-8"><h2 className="text-xl font-semibold mb-2">Fetched Users (persistent)</h2><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b font-medium"><th className="py-1 px-2 text-left">User</th><th className="py-1 px-2 text-right">Total edits</th></tr></thead><tbody>
              {userStats.map((u) => <tr key={u.user} className="border-b last:border-0"><td className="py-1 px-2">{u.user}</td><td className="py-1 px-2 text-right font-semibold">{u.edits.toLocaleString()}</td></tr>)}
            </tbody></table></div></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
