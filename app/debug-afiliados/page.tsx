"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface DebugUser {
  id: string
  name: string
  email: string
  affiliateCode?: string
  referredBy?: string
  referredUsers?: string[]
  createdAt: any
}

export default function DebugAfiliadosPage() {
  const [users, setUsers] = useState<DebugUser[]>([])
  const [loading, setLoading] = useState(false)

  const loadAllUsers = async () => {
    setLoading(true)
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DebugUser[]
      
      // Ordenar por data de criação
      usersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0)
        const dateB = b.createdAt?.toDate?.() || new Date(0)
        return dateB.getTime() - dateA.getTime()
      })
      
      setUsers(usersData)
      console.log("👥 Total de usuários:", usersData.length)
      console.log("👥 Usuários com código de afiliado:", usersData.filter(u => u.affiliateCode).length)
      console.log("👥 Usuários referidos:", usersData.filter(u => u.referredBy).length)
    } catch (error) {
      console.error("Erro ao carregar usuários:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllUsers()
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debug - Sistema de Afiliados</h1>
          <p className="text-muted-foreground">Verificar dados de afiliação no sistema</p>
        </div>
        <Button onClick={loadAllUsers} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Com Código de Afiliado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.affiliateCode).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários Referidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.referredBy).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {users.map((user) => (
              <div key={user.id} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {user.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criado: {user.createdAt?.toDate?.()?.toLocaleDateString("pt-BR") || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {user.affiliateCode && (
                      <div className="text-sm">
                        <span className="font-medium">Código de Afiliado:</span>
                        <span className="ml-2 font-mono bg-blue-100 px-2 py-1 rounded">
                          {user.affiliateCode}
                        </span>
                      </div>
                    )}
                    {user.referredBy && (
                      <div className="text-sm">
                        <span className="font-medium">Referido por:</span>
                        <span className="ml-2 font-mono bg-green-100 px-2 py-1 rounded">
                          {user.referredBy}
                        </span>
                      </div>
                    )}
                    {user.referredUsers && user.referredUsers.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Referiu {user.referredUsers.length} usuário(s):</span>
                        <div className="mt-1 space-y-1">
                          {user.referredUsers.map((refId, index) => (
                            <div key={refId} className="text-xs font-mono bg-yellow-100 px-2 py-1 rounded">
                              {index + 1}. {refId}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
