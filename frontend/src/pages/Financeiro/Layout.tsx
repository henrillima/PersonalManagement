import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/financeiro/caixa",         label: "Contas"        },
  { to: "/financeiro/faturas",       label: "Faturas"       },
  { to: "/financeiro/recorrentes",   label: "Recorrentes"   },
  { to: "/financeiro/pontuais",      label: "Pontuais"      },
  { to: "/financeiro/custo-vida",    label: "Custo de Vida" },
  { to: "/financeiro/investimentos", label: "Investimentos" },
  { to: "/financeiro/terceiros",     label: "Terceiros"     },
  { to: "/financeiro/pendencias",    label: "Pendências"    },
];

export default function FinanceiroLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-[#C8DA2D] text-[#C8DA2D]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
