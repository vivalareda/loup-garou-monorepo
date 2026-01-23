import { Activity, Cpu, Globe, Server, Users } from 'lucide-react';
import { useState } from 'react';

type ServerStats = {
  uptime: string;
  activeLobbies: number;
  connectedPlayers: number;
  memoryUsage: string;
  cpuUsage: string;
};

export function ServerDashboard() {
  const [isDarkMode] = useState(true);
  const [serverStats] = useState<ServerStats>({
    uptime: '00:00:00',
    activeLobbies: 0,
    connectedPlayers: 0,
    memoryUsage: '0 MB',
    cpuUsage: '0%',
  });

  return (
    <div
      className={`flex h-screen w-full transition-colors ${isDarkMode ? 'dark bg-gray-950' : 'bg-gray-100'}`}
    >
      <aside className="flex h-screen w-72 flex-col border-r border-border bg-card p-6">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Server className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Server</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Server Monitoring Dashboard
          </p>
        </div>

        <nav className="space-y-2">
          <a
            className="flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground"
            href="/server"
          >
            <Globe className="h-5 w-5" />
            <span className="font-medium">Overview</span>
          </a>
          <a
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            href="/"
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">Players</span>
          </a>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              Server Overview
            </h2>
            <p className="mt-1 text-muted-foreground">
              Monitor server performance and activity in real-time
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Lobbies
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {serverStats.activeLobbies}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <Server className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Connected Players
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {serverStats.connectedPlayers}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {serverStats.cpuUsage}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {serverStats.memoryUsage}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Server Status
            </h3>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-foreground">Server Online</span>
              <span className="text-muted-foreground ml-auto">
                Uptime: {serverStats.uptime}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
