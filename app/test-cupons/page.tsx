"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ticket, Trash2, RefreshCw } from "lucide-react"
import { Coupon } from "@/lib/types"

export default function TestCuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCoupons = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log("🔄 Carregando cupons...")
      const response = await fetch('/api/coupons/list')
      
      if (response.ok) {
        const data = await response.json()
        console.log("✅ Resposta da API:", data)
        
        if (data.success && data.coupons) {
          setCoupons(data.coupons)
        } else {
          setError("Formato de resposta inválido")
        }
      } else {
        const errorData = await response.json()
        console.error("❌ Erro na API:", errorData)
        setError(errorData.error || "Erro desconhecido")
      }
    } catch (err) {
      console.error("❌ Erro ao carregar cupons:", err)
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando cupons...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-8 w-8" />
            Teste de Cupons
          </h1>
          <p className="text-muted-foreground">
            Página para verificar se os cupons estão sendo criados corretamente
          </p>
        </div>
        <Button onClick={loadCoupons} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <Trash2 className="h-4 w-4" />
              <span className="font-medium">Erro:</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cupons Encontrados</CardTitle>
          <CardDescription>
            Total de {coupons.length} cupons no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum cupom encontrado</p>
              <p className="text-sm">
                Tente criar um sorteio com cupons e depois recarregue esta página
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {coupons.map((coupon) => (
                <Card key={coupon.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-mono">
                        {coupon.code}
                      </CardTitle>
                      <Badge 
                        variant={coupon.isActive ? "default" : "secondary"}
                      >
                        {coupon.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <CardDescription className="font-medium">
                      {coupon.drawTitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Cartelas:</span>
                        <p className="text-lg font-bold text-blue-600">
                          {coupon.cardsAmount}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Usos:</span>
                        <p className="text-lg font-bold">
                          {coupon.currentUses}/{coupon.maxUses}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <p>ID: {coupon.id}</p>
                      <p>Sorteio: {coupon.drawId}</p>
                      <p>Criado: {new Date(coupon.createdAt).toLocaleString()}</p>
                      <p>Por: {coupon.createdBy}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <Ticket className="h-4 w-4" />
            <span className="font-medium">Como Testar:</span>
          </div>
          <ol className="text-blue-700 text-sm space-y-1 ml-4">
            <li>1. Vá para /backoffice/sorteios</li>
            <li>2. Crie um novo sorteio</li>
            <li>3. Na seção "Cupons de Resgate", clique "Adicionar Cupom"</li>
            <li>4. Preencha: Código (ex: TESTE10), Cartelas (ex: 5), Máx. Usos (ex: 100)</li>
            <li>5. Salve o sorteio</li>
            <li>6. Volte aqui e clique "Recarregar"</li>
            <li>7. O cupom deve aparecer na lista</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
