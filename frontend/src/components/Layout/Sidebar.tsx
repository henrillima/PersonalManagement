import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  CheckSquare,
  Wallet,
  Building2,
  CreditCard,
  RefreshCw,
  Target,
  ShoppingCart,
  TrendingUp,
  Users,
  AlertTriangle,
  Heart,
  ShoppingBag,
  CalendarClock,
  LogOut,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const financeiroLinks = [
  { to: "/financeiro/dashboard",     icon: TrendingUp,    label: "Dashboard"     },
  { to: "/financeiro/caixa",         icon: Building2,     label: "Contas"        },
  { to: "/financeiro/faturas",       icon: CreditCard,    label: "Faturas"       },
  { to: "/financeiro/recorrentes",   icon: RefreshCw,     label: "Recorrentes"   },
  { to: "/financeiro/pontuais",      icon: Target,        label: "Pontuais"      },
  { to: "/financeiro/custo-vida",    icon: ShoppingCart,  label: "Custo de Vida" },
  { to: "/financeiro/investimentos", icon: TrendingUp,    label: "Investimentos" },
  { to: "/financeiro/terceiros",     icon: Users,         label: "Terceiros"     },
  { to: "/financeiro/pendencias",    icon: AlertTriangle, label: "Pendências"    },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFinanceiro = location.pathname.startsWith("/financeiro");
  const [finOpen, setFinOpen] = useState(isFinanceiro);

  useEffect(() => {
    onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFinanceiro) setFinOpen(true);
  }, [isFinanceiro]);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 bg-[#0C1923] flex flex-col h-full border-r border-white/5",
        "transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:translate-x-0 md:z-auto md:transition-none"
      )}
    >
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <rect width="32" height="32" rx="7" fill="#C8DA2D"/>
          <line x1="16" y1="7" x2="16" y2="14.5" stroke="#0C1923" strokeWidth="2.8" strokeLinecap="round"/>
          <path d="M21.7 10.2 A8 8 0 1 1 10.3 10.2" stroke="#0C1923" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        </svg>
        <div>
          <div className="text-white text-[15px] font-bold tracking-tight leading-none">Life OS</div>
          <div className="text-white/30 text-[10px] mt-1 leading-none">Henri Lima</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <Home size={16} />
          Home
        </NavLink>

        <NavLink
          to="/tarefas"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <CheckSquare size={16} />
          Tarefas
        </NavLink>

        {/* Financeiro expandable */}
        <div>
          <button
            onClick={() => setFinOpen((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isFinanceiro ? "text-[#C8DA2D]" : "text-white/60 hover:text-white hover:bg-white/8"
            )}
          >
            <span className="flex items-center gap-3">
              <Wallet size={16} />
              Financeiro
            </span>
            <ChevronDown
              size={13}
              className={cn("transition-transform duration-150", finOpen && "rotate-180")}
            />
          </button>

          {finOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
              {financeiroLinks.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn("flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-medium transition-colors",
                      isActive ? "text-[#C8DA2D] bg-[#C8DA2D]/10" : "text-white/50 hover:text-white hover:bg-white/8")
                  }
                >
                  <Icon size={13} />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink
          to="/rotina"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <CalendarClock size={16} />
          Agenda
        </NavLink>

        <NavLink
          to="/lista-compras"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <ShoppingBag size={16} />
          Lista de Compras
        </NavLink>

        <NavLink
          to="/estudos"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <BookOpen size={16} />
          Estudos
        </NavLink>

        <NavLink
          to="/saude"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-[#C8DA2D] text-[#0C1923]" : "text-white/60 hover:text-white hover:bg-white/8")
          }
        >
          <Heart size={16} />
          Saúde
        </NavLink>

      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-white/20 text-xs">Life OS v1.0</span>
        <button
          onClick={handleLogout}
          title="Sair"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors text-xs"
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
