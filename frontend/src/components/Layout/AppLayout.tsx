import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ServerCrash, Menu } from "lucide-react";
import Sidebar from "@/components/Layout/Sidebar";
import { BASE } from "@/lib/api";

type BackendStatus = "checking" | "up" | "starting";

export default function AppLayout() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<BackendStatus>("checking");

  const ping = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${BASE}/api/v1/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        setStatus((prev) => {
          // Se estava em "starting", invalida todas as queries para recarregar os dados
          if (prev === "starting") qc.invalidateQueries();
          return "up";
        });
        return true;
      }
    } catch {
      // abortado ou rede inacessível
    }
    setStatus("starting");
    return false;
  }, [qc]);

  useEffect(() => {
    ping();
    // Fica tentando a cada 7 s enquanto o backend não responder
    const interval = setInterval(async () => {
      const ok = await ping();
      if (ok) clearInterval(interval);
    }, 7_000);
    return () => clearInterval(interval);
  }, [ping]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center h-12 px-4 bg-[#0C1923] border-b border-white/10 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-[#C8DA2D] text-sm font-medium ml-3">Life OS</span>
        </div>

        {/* Cold-start banner */}
        {status === "starting" && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span>
              Servidor iniciando após período de inatividade — os dados carregarão automaticamente em alguns segundos.
            </span>
          </div>
        )}
        {status === "checking" && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span>Conectando ao servidor...</span>
          </div>
        )}
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {status === "up" ? (
            <div className="p-3 sm:p-6 max-w-7xl mx-auto">
              <Outlet />
            </div>
          ) : (
            /* Enquanto o backend não está pronto, mostra skeleton neutro */
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              {status === "checking" ? (
                <Loader2 size={28} className="animate-spin text-[#C8DA2D]" />
              ) : (
                <ServerCrash size={28} className="text-amber-400" />
              )}
              <p className="text-sm">
                {status === "checking"
                  ? "Verificando conexão..."
                  : "Aguardando o servidor acordar..."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
