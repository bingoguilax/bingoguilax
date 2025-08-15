"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, orderBy, query, where, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw, Coupon } from "@/lib/types"
import { Trash2, Edit, Plus, Trophy, Calendar, BarChart3, Users, DollarSign, Ticket, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DrawFormData {
  name: string
  dateTime: string
  cardPrice: string
  type: "fixed" | "accumulated"
  mode: "manual" | "automatic"
  prizes: {
    quadra: string
    quina: string
    cheia: string
  }
  percentages: {
    quadraPercent: string
    quinaPercent: string
    cheiaPercent: string
  }
  coupons: Array<{
    code: string
    cardsAmount: string
    maxUses: string
  }>
}

interface DrawStats {
  totalPlayers: number
  totalCards: number
  totalRevenue: number
  playerStats: {
    userId: string
    userName: string
    cardCount: number
  }[]
}

export default function AdminDrawsPage() {
  const { user, loading } = useAuth()
  const [draws, setDraws] = useState<Draw[]>([])
  const [loadingDraws, setLoadingDraws] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null)
  const [formData, setFormData] = useState<DrawFormData>({
    name: "",
    dateTime: "",
    cardPrice: "",
    type: "fixed",
    mode: "automatic",
    prizes: {
      quadra: "",
      quina: "",
      cheia: "",
    },
    percentages: {
      quadraPercent: "10",
      quinaPercent: "30",
      cheiaPercent: "60",
    },
    coupons: [],
  })
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [selectedDrawStats, setSelectedDrawStats] = useState<DrawStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  // Estados para cupons
  const [drawCoupons, setDrawCoupons] = useState<Record<string, Coupon[]>>({})
  const [loadingCoupons, setLoadingCoupons] = useState<Record<string, boolean>>({})
  // Estados para modais de cupons
  const [couponDetailsOpen, setCouponDetailsOpen] = useState(false)
  const [couponEditOpen, setCouponEditOpen] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [couponUsages, setCouponUsages] = useState<any[]>([])
  const [loadingCouponDetails, setLoadingCouponDetails] = useState(false)
  const [editCouponData, setEditCouponData] = useState({
    code: "",
    cardsAmount: "",
    maxUses: "",
    isActive: true
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDraws = async () => {
      try {
        const drawsQuery = query(collection(db, "draws"), orderBy("dateTime", "desc"))
        const drawsSnapshot = await getDocs(drawsQuery)
        const drawsData = drawsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          dateTime: doc.data().dateTime.toDate(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Draw[]

        setDraws(drawsData)
        
        // Carregar cupons para cada sorteio
        console.log("🎯 MAIN - Carregando cupons para", drawsData.length, "sorteios")
        drawsData.forEach((draw) => {
          loadDrawCoupons(draw.id)
        })
      } catch (error) {
        console.error("Error fetching draws:", error)
      } finally {
        setLoadingDraws(false)
      }
    }

    if (user?.role === "admin") {
      fetchDraws()
    }
  }, [user])

  // Funções para gerenciar cupons
  const addCoupon = () => {
    setFormData(prev => ({
      ...prev,
      coupons: [...prev.coupons, { code: "", cardsAmount: "", maxUses: "" }]
    }))
  }

  const removeCoupon = (index: number) => {
    setFormData(prev => ({
      ...prev,
      coupons: prev.coupons.filter((_, i) => i !== index)
    }))
  }

  const updateCoupon = (index: number, field: keyof typeof formData.coupons[0], value: string) => {
    setFormData(prev => ({
      ...prev,
      coupons: prev.coupons.map((coupon, i) => 
        i === index ? { ...coupon, [field]: value } : coupon
      )
    }))
  }

  const loadDrawCoupons = async (drawId: string) => {
    if (drawCoupons[drawId]) return // Já carregado
    
    setLoadingCoupons(prev => ({ ...prev, [drawId]: true }))
    
    try {
      const response = await fetch(`/api/coupons/by-draw/${drawId}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.coupons) {
          const processedCoupons = data.coupons.map((coupon: any) => ({
            ...coupon,
            createdAt: new Date(coupon.createdAt)
          }))
          
          setDrawCoupons(prev => ({
            ...prev,
            [drawId]: processedCoupons
          }))
        }
      } else {
        console.error("Erro ao carregar cupons:", response.status)
      }
    } catch (error) {
      console.error("Erro ao carregar cupons:", error)
    } finally {
      setLoadingCoupons(prev => ({ ...prev, [drawId]: false }))
    }
  }

  const handleViewCouponDetails = async (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setCouponDetailsOpen(true)
    setLoadingCouponDetails(true)
    setCouponUsages([])
    
    try {
      console.log("📋 Carregando detalhes do cupom:", coupon.id)
      const response = await fetch(`/api/coupons/${coupon.id}/usage`)
      
      if (response.ok) {
        const data = await response.json()
        console.log("📋 Detalhes carregados:", data)
        
        if (data.success) {
          setCouponUsages(data.usages || [])
        } else {
          console.error("❌ API retornou erro:", data.error)
        }
      } else {
        console.error("❌ Erro HTTP:", response.status)
        
        // Tentar obter detalhes do erro
        try {
          const errorData = await response.json()
          console.error("❌ Detalhes do erro:", errorData)
        } catch (e) {
          console.error("❌ Erro ao obter detalhes:", e)
        }
      }
    } catch (error) {
      console.error("❌ Erro na requisição:", error)
    } finally {
      setLoadingCouponDetails(false)
    }
  }

  const handleEditCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setEditCouponData({
      code: coupon.code,
      cardsAmount: coupon.cardsAmount.toString(),
      maxUses: coupon.maxUses.toString(),
      isActive: coupon.isActive
    })
    setCouponEditOpen(true)
  }

  const handleSaveCouponEdit = async () => {
    if (!selectedCoupon) return
    
    try {
      console.log("✏️ Salvando edição do cupom:", selectedCoupon.id)
      const response = await fetch(`/api/coupons/${selectedCoupon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCouponData)
      })
      
      if (response.ok) {
        toast({
          title: "Cupom editado",
          description: "O cupom foi editado com sucesso.",
        })
        
        // Recarregar cupons do sorteio
        const drawId = selectedCoupon.drawId
        setDrawCoupons(prev => ({ ...prev, [drawId]: [] })) // Limpar cache
        loadDrawCoupons(drawId)
        
        setCouponEditOpen(false)
      } else {
        const error = await response.json()
        toast({
          title: "Erro",
          description: error.error || "Erro ao editar cupom",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("❌ Erro ao editar cupom:", error)
      toast({
        title: "Erro",
        description: "Erro ao editar cupom",
        variant: "destructive"
      })
    }
  }

  const handleDeleteCoupon = async () => {
    if (!selectedCoupon) return
    
    if (!confirm("Tem certeza que deseja excluir este cupom? Esta ação não pode ser desfeita.")) {
      return
    }
    
    try {
      console.log("🗑️ Excluindo cupom:", selectedCoupon.id)
      const response = await fetch(`/api/coupons/${selectedCoupon.id}`, {
        method: "DELETE"
      })
      
      if (response.ok) {
        toast({
          title: "Cupom excluído",
          description: "O cupom foi excluído com sucesso.",
        })
        
        // Recarregar cupons do sorteio
        const drawId = selectedCoupon.drawId
        setDrawCoupons(prev => ({ ...prev, [drawId]: [] })) // Limpar cache
        loadDrawCoupons(drawId)
        
        setCouponEditOpen(false)
      } else {
        const error = await response.json()
        toast({
          title: "Erro",
          description: error.error || "Erro ao excluir cupom",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("❌ Erro ao excluir cupom:", error)
      toast({
        title: "Erro",
        description: "Erro ao excluir cupom",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (drawId: string) => {
    if (confirm("Tem certeza que deseja deletar este sorteio? Esta ação não pode ser desfeita.")) {
      try {
        await deleteDoc(doc(db, "draws", drawId))
        setDraws((prev) => prev.filter((d) => d.id !== drawId))
        toast({
          title: "Sorteio deletado",
          description: "O sorteio foi removido com sucesso.",
        })
      } catch (error) {
        console.error("Error deleting draw:", error)
        toast({
          title: "Erro",
          description: "Não foi possível deletar o sorteio.",
          variant: "destructive",
        })
      }
    }
  }

  const handleCreateDraw = () => {
    setIsEditing(false)
    setSelectedDrawId(null)
    setFormData({
      name: "",
      dateTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16), // Amanhã
      cardPrice: "10",
      type: "fixed",
      mode: "automatic",
      prizes: {
        quadra: "100",
        quina: "300",
        cheia: "1000",
      },
      percentages: {
        quadraPercent: "10",
        quinaPercent: "30",
        cheiaPercent: "60",
      },
      coupons: [],
    })
    setIsDialogOpen(true)
  }

  const handleEditDraw = async (draw: Draw) => {
    console.log("Editing draw:", draw)
    setIsEditing(true)
    setSelectedDrawId(draw.id)

    // Formatar data para o formato esperado pelo input datetime-local
    const dateTimeStr = new Date(draw.dateTime.getTime() - draw.dateTime.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)

    // Carregar cupons existentes
    let existingCoupons: any[] = []
    try {
      console.log("🎫 EDIT - Carregando cupons existentes para:", draw.id)
      const response = await fetch(`/api/coupons/by-draw/${draw.id}`)
      if (response.ok) {
        const data = await response.json()
        console.log("🎫 EDIT - Cupons carregados:", data)
        
        if (data.success && data.coupons && data.coupons.length > 0) {
          existingCoupons = data.coupons.map((coupon: any) => ({
            id: coupon.id, // ID para identificar cupons existentes
            code: coupon.code,
            cardsAmount: coupon.cardsAmount.toString(),
            maxUses: coupon.maxUses.toString(),
            isExisting: true, // Flag para identificar cupons existentes
            currentUses: coupon.currentUses || 0,
            isActive: coupon.isActive
          }))
          console.log("🎫 EDIT - Cupons convertidos:", existingCoupons)
        }
      }
    } catch (error) {
      console.error("❌ EDIT - Erro ao carregar cupons:", error)
    }

    if (draw.type === "fixed") {
      const prizes = draw.prizes as { quadra: number; quina: number; cheia: number }
      setFormData({
        name: draw.name,
        dateTime: dateTimeStr,
        cardPrice: draw.cardPrice.toString(),
        type: draw.type,
        mode: draw.mode,
        prizes: {
          quadra: prizes.quadra.toString(),
          quina: prizes.quina.toString(),
          cheia: prizes.cheia.toString(),
        },
        percentages: {
          quadraPercent: "10",
          quinaPercent: "30",
          cheiaPercent: "60",
        },
        coupons: existingCoupons,
      })
    } else {
      const percentages = draw.prizes as { quadraPercent: number; quinaPercent: number; cheiaPercent: number }
      setFormData({
        name: draw.name,
        dateTime: dateTimeStr,
        cardPrice: draw.cardPrice.toString(),
        type: draw.type,
        mode: draw.mode,
        prizes: {
          quadra: "100",
          quina: "300",
          cheia: "1000",
        },
        percentages: {
          quadraPercent: percentages.quadraPercent.toString(),
          quinaPercent: percentages.quinaPercent.toString(),
          cheiaPercent: percentages.cheiaPercent.toString(),
        },
        coupons: existingCoupons,
      })
    }

    setIsDialogOpen(true)
  }

  const handleShowStats = async (draw: Draw) => {
    setLoadingStats(true)
    setStatsDialogOpen(true)
    
    try {
      // Buscar todas as cartelas deste sorteio
      const cardsQuery = query(collection(db, "cards"), where("drawId", "==", draw.id))
      const cardsSnapshot = await getDocs(cardsQuery)
      
      // Contar jogadores únicos e suas cartelas
      const playerCardCounts = new Map<string, number>()
      const uniquePlayers = new Set<string>()
      
      cardsSnapshot.docs.forEach(doc => {
        const userId = doc.data().userId
        uniquePlayers.add(userId)
        playerCardCounts.set(userId, (playerCardCounts.get(userId) || 0) + 1)
      })
      
      // Buscar informações dos usuários
      const playerStats = []
      for (const [userId, cardCount] of playerCardCounts) {
        try {
          const userDoc = await getDoc(doc(db, "users", userId))
          let userName = "Usuário Desconhecido"
          if (userDoc.exists()) {
            const userData = userDoc.data()
            userName = userData.name || userData.email || "Usuário Desconhecido"
          }
          playerStats.push({
            userId,
            userName,
            cardCount
          })
        } catch (error) {
          console.error("Error fetching user data:", error)
          playerStats.push({
            userId,
            userName: "Usuário Desconhecido",
            cardCount
          })
        }
      }
      
      // Ordenar por número de cartelas em ordem decrescente
      playerStats.sort((a, b) => b.cardCount - a.cardCount)
      
      const stats: DrawStats = {
        totalPlayers: uniquePlayers.size,
        totalCards: cardsSnapshot.size,
        totalRevenue: cardsSnapshot.size * draw.cardPrice,
        playerStats
      }
      
      setSelectedDrawStats(stats)
    } catch (error) {
      console.error("Error fetching draw stats:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar as estatísticas do sorteio.",
        variant: "destructive",
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    try {
      const dateTime = new Date(formData.dateTime)
      const cardPrice = Number.parseFloat(formData.cardPrice)

      if (isNaN(cardPrice) || cardPrice <= 0) {
        toast({
          title: "Valor inválido",
          description: "O valor da cartela deve ser maior que zero.",
          variant: "destructive",
        })
        return
      }

      let prizes: any
      if (formData.type === "fixed") {
        const quadra = Number.parseFloat(formData.prizes.quadra)
        const quina = Number.parseFloat(formData.prizes.quina)
        const cheia = Number.parseFloat(formData.prizes.cheia)

        if (isNaN(quadra) || isNaN(quina) || isNaN(cheia) || quadra <= 0 || quina <= 0 || cheia <= 0) {
          toast({
            title: "Valores inválidos",
            description: "Os valores dos prêmios devem ser maiores que zero.",
            variant: "destructive",
          })
          return
        }

        prizes = {
          quadra,
          quina,
          cheia,
        }
      } else {
        const quadraPercent = Number.parseFloat(formData.percentages.quadraPercent)
        const quinaPercent = Number.parseFloat(formData.percentages.quinaPercent)
        const cheiaPercent = Number.parseFloat(formData.percentages.cheiaPercent)

        if (
          isNaN(quadraPercent) ||
          isNaN(quinaPercent) ||
          isNaN(cheiaPercent) ||
          quadraPercent <= 0 ||
          quinaPercent <= 0 ||
          cheiaPercent <= 0 ||
          quadraPercent + quinaPercent + cheiaPercent !== 100
        ) {
          toast({
            title: "Percentuais inválidos",
            description: "Os percentuais devem ser maiores que zero e somar 100%.",
            variant: "destructive",
          })
          return
        }

        prizes = {
          quadraPercent,
          quinaPercent,
          cheiaPercent,
        }
      }

      const drawData = {
        name: formData.name,
        dateTime,
        cardPrice,
        type: formData.type,
        mode: formData.mode,
        prizes,
        // Só adicionar externalUrl se for modo manual
        ...(formData.mode === "manual" && {
          externalUrl:
            "https://gerador.livecenter.host/player.html?data=U2FsdGVkX1%2FjdQmVsznNeMJgbgOAnHaMmSc5q9vghBn7E81fcA1MDcqFiCpCB%2BOYbbW5NizD6A72OTAJ%2FidvXFacGg17j5VYN44PmJFI4ok%3D",
        }),
      }

      if (isEditing && selectedDrawId) {
        console.log("Updating draw:", selectedDrawId, drawData)

        // Atualizar sorteio existente
        await updateDoc(doc(db, "draws", selectedDrawId), drawData)

        // Atualizar a lista local
        setDraws((prev) =>
          prev.map((d) =>
            d.id === selectedDrawId
              ? {
                  ...d,
                  ...drawData,
                }
              : d,
          ),
        )

        toast({
          title: "Sorteio atualizado",
          description: "O sorteio foi atualizado com sucesso.",
        })
      } else {
        // Criar novo sorteio
        const newDrawData = {
          ...drawData,
          status: "waiting" as const,
          drawnNumbers: [],
          currentPhase: "quadra" as const,
          winners: {
            quadra: [],
            quina: [],
            cheia: []
          },
          createdAt: new Date(),
        }

        const docRef = await addDoc(collection(db, "draws"), newDrawData)

        // Criar cupons associados ao sorteio
        console.log("🎫 CUPONS - Iniciando criação de cupons...")
        console.log("🎫 CUPONS - FormData.coupons:", formData.coupons)
        console.log("🎫 CUPONS - Quantidade de cupons:", formData.coupons.length)
        
        for (const [index, coupon] of formData.coupons.entries()) {
          console.log(`🎫 CUPONS - Processando cupom ${index + 1}:`, coupon)
          
          if (coupon.code && coupon.cardsAmount && coupon.maxUses) {
            console.log(`🎫 CUPONS - Cupom ${index + 1} válido, criando...`)
            
            const couponData = {
              code: coupon.code.toUpperCase(),
              drawId: docRef.id,
              drawTitle: formData.name,
              cardsAmount: parseInt(coupon.cardsAmount),
              maxUses: parseInt(coupon.maxUses),
              currentUses: 0,
              isActive: true,
              createdAt: new Date(),
              createdBy: user?.id || "",
              usedBy: []
            }
            
            console.log(`🎫 CUPONS - Dados do cupom ${index + 1}:`, couponData)
            
            try {
              const couponRef = await addDoc(collection(db, "coupons"), couponData)
              console.log(`✅ CUPONS - Cupom ${index + 1} criado com sucesso! ID:`, couponRef.id)
            } catch (couponError) {
              console.error(`❌ CUPONS - Erro ao criar cupom ${index + 1}:`, couponError)
              throw couponError // Re-throw para parar o processo
            }
          } else {
            console.log(`⚠️ CUPONS - Cupom ${index + 1} inválido (campos faltando):`, {
              code: coupon.code,
              cardsAmount: coupon.cardsAmount,
              maxUses: coupon.maxUses
            })
          }
        }
        
        console.log("✅ CUPONS - Finalizada criação de cupons!")

        // Adicionar à lista local
        const newDraw = {
          id: docRef.id,
          ...newDrawData,
        } as Draw
        
        setDraws((prev) => [newDraw, ...prev])

        // Carregar cupons para o novo sorteio
        if (formData.coupons.length > 0) {
          setTimeout(() => loadDrawCoupons(docRef.id), 1000) // Pequeno delay para garantir que os cupons foram criados
        }

        const cuponsCount = formData.coupons.filter(c => c.code && c.cardsAmount && c.maxUses).length
        toast({
          title: "Sorteio criado",
          description: `O sorteio foi criado com sucesso${cuponsCount > 0 ? ` com ${cuponsCount} cupons` : ""}.`,
        })
      }

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving draw:", error)
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? "atualizar" : "criar"} o sorteio. Tente novamente.`,
        variant: "destructive",
      })
    }
  }

  const handleAdminister = (drawId: string) => {
    router.push(`/backoffice/sorteios/${drawId}/administrar`)
  }

  if (loading || loadingDraws) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin") {
    return null
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>
      case "finished":
        return <Badge variant="secondary">Finalizado</Badge>
      default:
        return <Badge variant="outline">Aguardando</Badge>
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sorteios</h1>
            <p className="text-muted-foreground">Gerencie todos os sorteios do sistema</p>
          </div>
          <Button onClick={handleCreateDraw}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Sorteio
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Sorteios</CardTitle>
            <CardDescription>Total de {draws.length} sorteios registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {draws.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum sorteio encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Valor da Cartela</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draws.map((draw) => (
                      <TableRow key={draw.id}>
                        <TableCell className="font-medium">{draw.name}</TableCell>
                        <TableCell>{formatDateTime(draw.dateTime)}</TableCell>
                        <TableCell>R$ {draw.cardPrice.toFixed(2)}</TableCell>
                        <TableCell>{draw.type === "fixed" ? "Fixo" : "Acumulado"}</TableCell>
                        <TableCell>{draw.mode === "automatic" ? "Automático" : "Manual"}</TableCell>
                        <TableCell>{getStatusBadge(draw.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleShowStats(draw)}
                              className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEditDraw(draw)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {draw.mode === "manual" && draw.status !== "finished" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                                onClick={() => handleAdminister(draw.id)}
                              >
                                Administrar
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(draw.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Criação/Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar Sorteio" : "Criar Sorteio"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Edite as informações do sorteio existente."
                  : "Preencha as informações para criar um novo sorteio."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Sorteio</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Bingo da Sorte"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTime">Data e Hora</Label>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="dateTime"
                    name="dateTime"
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardPrice">Valor da Cartela (R$)</Label>
                <Input
                  id="cardPrice"
                  name="cardPrice"
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.cardPrice}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Sorteio</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value) => handleSelectChange("type", value as "fixed" | "accumulated")}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed">Fixo (valores pré-definidos)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="accumulated" id="accumulated" />
                    <Label htmlFor="accumulated">Acumulado (percentuais)</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.type === "fixed" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prizes.quadra">Prêmio Quadra (R$)</Label>
                    <Input
                      id="prizes.quadra"
                      name="prizes.quadra"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.quadra}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizes.quina">Prêmio Quina (R$)</Label>
                    <Input
                      id="prizes.quina"
                      name="prizes.quina"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.quina}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizes.cheia">Prêmio Cartela Cheia (R$)</Label>
                    <Input
                      id="prizes.cheia"
                      name="prizes.cheia"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.cheia}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentages.quadraPercent">Quadra (%)</Label>
                    <Input
                      id="percentages.quadraPercent"
                      name="percentages.quadraPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.quadraPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentages.quinaPercent">Quina (%)</Label>
                    <Input
                      id="percentages.quinaPercent"
                      name="percentages.quinaPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.quinaPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentages.cheiaPercent">Cartela Cheia (%)</Label>
                    <Input
                      id="percentages.cheiaPercent"
                      name="percentages.cheiaPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.cheiaPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Modo de Sorteio</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value) => handleSelectChange("mode", value as "manual" | "automatic")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automático</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seção de Cupons de Resgate */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      Cupons de Resgate
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Crie códigos que os usuários podem resgatar para ganhar cartelas gratuitas
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCoupon}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Cupom
                  </Button>
                </div>

                {formData.coupons.length > 0 && (
                  <div className="space-y-3">
                    {formData.coupons.map((coupon, index) => (
                      <div key={coupon.id || index} className={`p-4 border rounded-lg space-y-3 ${coupon.isExisting ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">
                              {coupon.isExisting ? 'Cupom Existente' : `Cupom #{index + 1}`}
                            </Label>
                            {coupon.isExisting && (
                              <Badge variant="outline" className="text-xs">
                                {coupon.currentUses || 0}/{coupon.maxUses} usos
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {coupon.isExisting && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleViewCouponDetails(coupon as any)}
                                >
                                  👁️ Ver
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleEditCoupon(coupon as any)}
                                >
                                  ✏️ Editar
                                </Button>
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCoupon(index)}
                              className="h-8 w-8 p-0"
                              title={coupon.isExisting ? "Remover da lista (não exclui da base)" : "Remover cupom"}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`coupon-code-${index}`} className="text-xs">
                              Código do Cupom
                            </Label>
                            <Input
                              id={`coupon-code-${index}`}
                              placeholder="Ex: CUPOM10"
                              value={coupon.code}
                              onChange={(e) => updateCoupon(index, 'code', e.target.value.toUpperCase())}
                              className="text-sm"
                              readOnly={coupon.isExisting}
                              disabled={coupon.isExisting}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`coupon-cards-${index}`} className="text-xs">
                              Cartelas Grátis
                            </Label>
                            <Input
                              id={`coupon-cards-${index}`}
                              type="number"
                              min="1"
                              max="50"
                              placeholder="10"
                              value={coupon.cardsAmount}
                              onChange={(e) => updateCoupon(index, 'cardsAmount', e.target.value)}
                              className="text-sm"
                              readOnly={coupon.isExisting}
                              disabled={coupon.isExisting}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`coupon-uses-${index}`} className="text-xs">
                              Máx. Usos
                            </Label>
                            <Input
                              id={`coupon-uses-${index}`}
                              type="number"
                              min="1"
                              max="1000"
                              placeholder="100"
                              value={coupon.maxUses}
                              onChange={(e) => updateCoupon(index, 'maxUses', e.target.value)}
                              className="text-sm"
                              readOnly={coupon.isExisting}
                              disabled={coupon.isExisting}
                            />
                          </div>
                        </div>
                        
                        {coupon.isExisting && (
                          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
                            💡 Este cupom já existe na base de dados. Use os botões "Ver" ou "Editar" para gerenciá-lo.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {formData.coupons.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
                    <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum cupom adicionado</p>
                    <p className="text-xs">Clique em "Adicionar Cupom" para criar códigos de resgate</p>
                  </div>
                )}
              </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name || !formData.dateTime || !formData.cardPrice}>
                <Trophy className="h-4 w-4 mr-2" />
                {isEditing ? "Atualizar Sorteio" : "Criar Sorteio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Estatísticas */}
        <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Estatísticas do Sorteio
              </DialogTitle>
              <DialogDescription>
                Informações detalhadas sobre vendas e participação
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {loadingStats ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Carregando estatísticas...</p>
                </div>
              ) : selectedDrawStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">Total de Jogadores</p>
                          <p className="text-2xl font-bold text-blue-700">{selectedDrawStats.totalPlayers}</p>
                        </div>
                        <div className="bg-blue-100 p-2 rounded-full">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-900">Cartelas Vendidas</p>
                          <p className="text-2xl font-bold text-green-700">{selectedDrawStats.totalCards}</p>
                        </div>
                        <div className="bg-green-100 p-2 rounded-full">
                          <Trophy className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-900">Valor Total Arrecadado</p>
                          <p className="text-2xl font-bold text-purple-700">
                            R$ {selectedDrawStats.totalRevenue.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-purple-100 p-2 rounded-full">
                          <DollarSign className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lista de Jogadores */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">Jogadores por Cartelas</h3>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {selectedDrawStats.playerStats.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDrawStats.playerStats.map((player, index) => (
                            <div key={player.userId} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                              <div className="flex items-center space-x-3">
                                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{player.userName}</p>
                                  <p className="text-sm text-gray-500">ID: {player.userId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">{player.cardCount}</p>
                                <p className="text-xs text-gray-500">
                                  {player.cardCount === 1 ? 'cartela' : 'cartelas'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          Nenhum jogador encontrado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma estatística disponível
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatsDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes do Cupom */}
        <Dialog open={couponDetailsOpen} onOpenChange={setCouponDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Detalhes do Cupom: {selectedCoupon?.code}
              </DialogTitle>
            </DialogHeader>
            
            {selectedCoupon && (
              <div className="space-y-6">
                {/* Informações Básicas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Código</Label>
                    <Badge variant="default" className="font-mono text-base px-3 py-1">
                      {selectedCoupon.code}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={selectedCoupon.isActive ? "default" : "secondary"}>
                      {selectedCoupon.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cartelas por Uso</Label>
                    <div className="text-lg font-semibold text-green-600">
                      +{selectedCoupon.cardsAmount} 🎫
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Usos Disponíveis</Label>
                    <div className="text-lg font-semibold">
                      {selectedCoupon.maxUses - selectedCoupon.currentUses}/{selectedCoupon.maxUses}
                    </div>
                  </div>
                </div>

                {/* Histórico de Usos */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Histórico de Usos</Label>
                  
                  {loadingCouponDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Carregando histórico...</span>
                    </div>
                  ) : couponUsages.length > 0 ? (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Data de Uso</TableHead>
                            <TableHead>Cartelas Recebidas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {couponUsages.map((usage: any) => (
                            <TableRow key={usage.id}>
                              <TableCell>{usage.userName}</TableCell>
                              <TableCell>
                                {new Date(usage.usedAt).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  +{usage.cardsReceived} 🎫
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      Este cupom ainda não foi usado por nenhum usuário
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCouponDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição do Cupom */}
        <Dialog open={couponEditOpen} onOpenChange={setCouponEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar Cupom: {selectedCoupon?.code}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Código do Cupom</Label>
                <Input
                  id="edit-code"
                  value={editCouponData.code}
                  onChange={(e) => setEditCouponData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Ex: CUPOM10"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-cards">Cartelas por Uso</Label>
                  <Input
                    id="edit-cards"
                    type="number"
                    value={editCouponData.cardsAmount}
                    onChange={(e) => setEditCouponData(prev => ({ ...prev, cardsAmount: e.target.value }))}
                    placeholder="Ex: 5"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-max-uses">Usos Máximos</Label>
                  <Input
                    id="edit-max-uses"
                    type="number"
                    value={editCouponData.maxUses}
                    onChange={(e) => setEditCouponData(prev => ({ ...prev, maxUses: e.target.value }))}
                    placeholder="Ex: 100"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editCouponData.isActive}
                  onChange={(e) => setEditCouponData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="edit-active">Cupom ativo</Label>
              </div>
              
              {selectedCoupon && selectedCoupon.currentUses > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Este cupom já foi usado {selectedCoupon.currentUses} vez(es). 
                    Reduzi r o número máximo de usos abaixo dos usos atuais pode causar problemas.
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              <Button
                variant="destructive"
                onClick={handleDeleteCoupon}
                disabled={!!(selectedCoupon?.currentUses && selectedCoupon.currentUses > 0)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setCouponEditOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCouponEdit}>
                  Salvar Alterações
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
