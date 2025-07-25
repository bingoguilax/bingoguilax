"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs } from "firebase/firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { CreditCard, Banknote, Users, Trophy } from "lucide-react"

interface DashboardStats {
  totalDeposits: number
  totalWithdrawals: number
  totalUsers: number
  totalDraws: number
}

export default function AdminDashboardPage() {
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalUsers: 0,
    totalDraws: 0,
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [depositsSnapshot, withdrawalsSnapshot, usersSnapshot, drawsSnapshot] = await Promise.all([
          getDocs(collection(db, "deposits")),
          getDocs(collection(db, "withdrawals")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "draws")),
        ])

        setStats({
          totalDeposits: depositsSnapshot.size,
          totalWithdrawals: withdrawalsSnapshot.size,
          totalUsers: usersSnapshot.size,
          totalDraws: drawsSnapshot.size,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoadingStats(false)
      }
    }

    if (user?.role === "admin") {
      fetchStats()
    }
  }, [user])

  if (loading || loadingStats) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin") {
    return null
  }

  const statCards = [
    {
      title: "Total de Depósitos",
      value: stats.totalDeposits,
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total de Saques",
      value: stats.totalWithdrawals,
      icon: Banknote,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total de Usuários",
      value: stats.totalUsers,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Bingos Criados",
      value: stats.totalDraws,
      icon: Trophy,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>Últimas atividades do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Novo usuário registrado</p>
                    <p className="text-xs text-muted-foreground">2 minutos atrás</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Depósito aprovado</p>
                    <p className="text-xs text-muted-foreground">5 minutos atrás</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Novo sorteio criado</p>
                    <p className="text-xs text-muted-foreground">10 minutos atrás</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estatísticas Rápidas</CardTitle>
              <CardDescription>Métricas importantes do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Usuários Ativos</span>
                  <span className="text-sm font-medium">85%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Taxa de Conversão</span>
                  <span className="text-sm font-medium">12.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Sorteios Ativos</span>
                  <span className="text-sm font-medium">3</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
