import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppLayout from "@/components/Layout/AppLayout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Tarefas from "@/pages/Tarefas";
import FinanceiroLayout from "@/pages/Financeiro/Layout";
import Caixa from "@/pages/Financeiro/Caixa";
import Faturas from "@/pages/Financeiro/Faturas";
import Recorrentes from "@/pages/Financeiro/Recorrentes";
import Pontuais from "@/pages/Financeiro/Pontuais";
import CustoVida from "@/pages/Financeiro/CustoVida";
import Investimentos from "@/pages/Financeiro/Investimentos";
import Terceiros from "@/pages/Financeiro/Terceiros";
import Pendencias from "@/pages/Financeiro/Pendencias";
import Saude from "@/pages/Saude";

function AuthGuard() {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="financeiro" element={<FinanceiroLayout />}>
              <Route index element={<Navigate to="caixa" replace />} />
              <Route path="caixa"          element={<Caixa />} />
              <Route path="faturas"        element={<Faturas />} />
              <Route path="recorrentes"    element={<Recorrentes />} />
              <Route path="pontuais"       element={<Pontuais />} />
              <Route path="custo-vida"     element={<CustoVida />} />
              <Route path="investimentos"  element={<Investimentos />} />
              <Route path="terceiros"      element={<Terceiros />} />
              <Route path="pendencias"     element={<Pendencias />} />
            </Route>
            <Route path="saude" element={<Saude />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
