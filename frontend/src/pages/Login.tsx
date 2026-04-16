import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", res.token);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("Sessão expirada")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError("Não foi possível conectar ao servidor.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0C1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C8DA2D]/15 mb-4">
            <span className="text-[#C8DA2D] text-2xl font-bold">L</span>
          </div>
          <h1 className="text-white text-xl font-semibold">Life OS</h1>
          <p className="text-white/40 text-sm mt-1">Acesso pessoal</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-2xl p-7 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-white/70 text-xs font-medium">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8DA2D]/60"
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-white/70 text-xs font-medium">Senha</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8DA2D]/60"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#C8DA2D] text-[#0C1923] font-semibold text-sm hover:bg-[#d4e633] disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
