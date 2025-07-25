"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { doc, getDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WinnerModal } from "@/components/WinnerModal"
import { creditUserPrize, calculatePrize, checkCardWinner as checkCardWinnerUtil } from "@/lib/prize-utils"

interface Winner {
  userId: string;
  userName: string;
  cardId: string;
  type: "quadra" | "quina" | "cheia";
  prize: number;
}

interface Card {
  id: string;
  userId: string;
  drawId: string;
  numbers: number[];
  purchaseDate: Date;
}

export default function AdminManageDrawPage() {
  const { user, loading } = useAuth()
  const [draw, setDraw] = useState<Draw | null>(null)
  const [loadingDraw, setLoadingDraw] = useState(true)
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const drawId = params.id as string
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [winnerInfo, setWinnerInfo] = useState<Winner[] | null>(null)
  const [winnerQueue, setWinnerQueue] = useState<Winner[][]>([])
  const announcedWinnersRef = useRef(new Set<string>())
  const winnerTypes = ["quadra", "quina", "cheia"] as const
  type WinnerType = typeof winnerTypes[number]

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDraw = async () => {
      try {
        const drawDoc = await getDoc(doc(db, "draws", drawId))
        if (drawDoc.exists()) {
          const drawData = {
            id: drawDoc.id,
            ...drawDoc.data(),
            dateTime: drawDoc.data().dateTime.toDate(),
            createdAt: drawDoc.data().createdAt.toDate(),
          } as Draw

          setDraw(drawData)
          setDrawnNumbers(drawData.drawnNumbers || [])

          // Verificar ganhadores existentes ao carregar
          if (drawData.winnerDetails) {
            console.log("[ADMIN INIT] Processando winnerDetails iniciais:", drawData.winnerDetails);
            processWinnerDetails(drawData.winnerDetails);
          }

          // Contar cartelas vendidas
          const cardsQuery = query(collection(db, "cards"), where("drawId", "==", drawId))
          const cardsSnapshot = await getDocs(cardsQuery)
          setTotalCards(cardsSnapshot.size)
        } else {
          toast({
            title: "Sorteio não encontrado",
            description: "O sorteio solicitado não existe.",
            variant: "destructive",
          })
          router.push("/backoffice/sorteios")
        }
      } catch (error) {
        console.error("Error fetching draw:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar o sorteio.",
          variant: "destructive",
        })
      } finally {
        setLoadingDraw(false)
      }
    }

    if (user?.role === "admin") {
      fetchDraw()
    }
  }, [user, drawId, router, toast])

  // Função para processar winnerDetails
  const processWinnerDetails = (winnerDetails: any) => {
    console.log("[ADMIN] Processando winnerDetails:", winnerDetails);
    
    const fases: ("quadra" | "quina" | "cheia")[] = ["quadra", "quina", "cheia"];
    
    for (const fase of fases) {
      const faseWinners = winnerDetails[fase] || [];
      console.log(`[ADMIN] Fase ${fase}: ${faseWinners.length} ganhadores`, faseWinners);
      
      for (const winner of faseWinners) {
        const key = `${winner.cardId}-${winner.type || fase}`;
        console.log(`[ADMIN] Verificando key: ${key}, já anunciado:`, announcedWinnersRef.current.has(key));
        
        if (!announcedWinnersRef.current.has(key)) {
          console.log(`[ADMIN] Novo ganhador detectado: ${fase} - ${winner.cardId}`);
          
          // Marcar como anunciado ANTES de processar
          announcedWinnersRef.current.add(key);
          
          // Criar objeto Winner
          const winnerFormatted: Winner = {
            userId: winner.userId || '',
            userName: winner.userName || 'Usuário',
            cardId: winner.cardId || '',
            type: (winner.type || fase) as "quadra" | "quina" | "cheia",
            prize: Number(winner.prize) || 0
          };
          
          console.log(`[ADMIN] Winner formatado:`, winnerFormatted);
          
          // Adicionar à fila de modais
          setWinnerQueue(prev => {
            const newQueue = [...prev, [winnerFormatted]];
            console.log("[ADMIN] Queue atualizada:", newQueue);
            return newQueue;
          });
          
          // Toast de confirmação
          toast({
            title: `🎉 ${fase.toUpperCase()} Ganha!`,
            description: `${winner.userName} ganhou R$ ${Number(winner.prize || 0).toFixed(2)}!`,
          });
        }
      }
    }
  };

  // Listener em tempo real para winnerDetails
  useEffect(() => {
    if (!user) return;

    console.log("[ADMIN] Configurando listener para draw:", drawId);

    const unsub = onSnapshot(doc(db, "draws", drawId), async (docSnapshot) => {
      if (!docSnapshot.exists()) return;
      
      const updatedDraw = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
        dateTime: docSnapshot.data().dateTime.toDate(),
        createdAt: docSnapshot.data().createdAt.toDate(),
      } as Draw;

      console.log("[ADMIN] Snapshot recebido:", {
        drawnNumbers: updatedDraw.drawnNumbers?.length,
        winnerDetails: updatedDraw.winnerDetails
      });

      setDraw(updatedDraw);
      setDrawnNumbers(updatedDraw.drawnNumbers || []);

      // Processar winnerDetails se existir
      if (updatedDraw.winnerDetails) {
        console.log("[ADMIN] winnerDetails detectado no snapshot");
        processWinnerDetails(updatedDraw.winnerDetails);
      }
    });
    
    return () => {
      console.log("[ADMIN] Limpando listener");
      unsub();
    };
  }, [user, drawId, toast]);

  // useEffect para gerenciar a fila de modais
  useEffect(() => {
    console.log("[ADMIN] Verificando fila de modais:", {
      queueLength: winnerQueue.length,
      showModal: showWinnerModal
    });

    // Se há itens na fila e o modal não está sendo exibido
    if (winnerQueue.length > 0 && !showWinnerModal) {
      console.log("[ADMIN] Abrindo modal para:", winnerQueue[0]);
      setWinnerInfo(winnerQueue[0]);
      setShowWinnerModal(true);
    }
  }, [winnerQueue, showWinnerModal]);

  // Função para fechar modal e processar próximo da fila
  const handleModalClose = () => {
    console.log("[ADMIN] Fechando modal, fila atual:", winnerQueue.length);
    
    setShowWinnerModal(false);
    setWinnerInfo(null);
    
    // Remover o primeiro item da fila
    setWinnerQueue(prev => {
      const [first, ...rest] = prev;
      console.log("[ADMIN] Removido da fila:", first, "restante:", rest.length);
      return rest;
    });
  };

  const handleDrawNumber = async (number: number) => {
    if (drawnNumbers.includes(number)) {
      toast({
        title: "Número já sorteado",
        description: `O número ${number} já foi sorteado.`,
        variant: "destructive",
      })
      return
    }

    try {
      const newDrawnNumbers = [...drawnNumbers, number]
      
      console.log(`[ADMIN] Sorteando número ${number}, total: ${newDrawnNumbers.length}`);
      
      // APENAS atualizar drawnNumbers - o backend Node.js cuida dos ganhadores
      await updateDoc(doc(db, "draws", drawId), {
        drawnNumbers: newDrawnNumbers,
      })

      setDrawnNumbers(newDrawnNumbers)

      toast({
        title: "Número sorteado",
        description: `O número ${number} foi sorteado com sucesso.`,
      })

    } catch (error) {
      console.error("Error drawing number:", error)
      toast({
        title: "Erro",
        description: "Não foi possível sortear o número.",
        variant: "destructive",
      })
    }
  }

  const handleStartDraw = async () => {
    if (!draw) return

    try {
      await updateDoc(doc(db, "draws", drawId), {
        status: "active",
      })

      setDraw({
        ...draw,
        status: "active",
      })

      toast({
        title: "Sorteio iniciado",
        description: "O sorteio foi iniciado com sucesso.",
      })
    } catch (error) {
      console.error("Error starting draw:", error)
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o sorteio.",
        variant: "destructive",
      })
    }
  }

  const handleFinishDraw = async () => {
    if (!draw) return

    if (confirm("Tem certeza que deseja finalizar este sorteio? Esta ação não pode ser desfeita.")) {
      try {
        await updateDoc(doc(db, "draws", drawId), {
          status: "finished",
        })

        setDraw({
          ...draw,
          status: "finished",
        })

        toast({
          title: "Sorteio finalizado",
          description: "O sorteio foi finalizado com sucesso.",
        })
      } catch (error) {
        console.error("Error finishing draw:", error)
        toast({
          title: "Erro",
          description: "Não foi possível finalizar o sorteio.",
          variant: "destructive",
        })
      }
    }
  }

  if (loading || loadingDraw) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin" || !draw) {
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

  const renderNumberGrid = () => {
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1)
    return (
      <div className="grid grid-cols-10 gap-2">
        {numbers.map((number) => (
          <Button
            key={number}
            variant={drawnNumbers.includes(number) ? "default" : "outline"}
            size="sm"
            className={`h-10 w-10 p-0 ${drawnNumbers.includes(number) ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
            onClick={() => handleDrawNumber(number)}
            disabled={draw.status !== "active" || drawnNumbers.includes(number)}
          >
            {number}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Administrar Sorteio</h1>
            <p className="text-muted-foreground">{draw.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {draw.status === "waiting" && <Button onClick={handleStartDraw}>Iniciar Sorteio</Button>}
            {draw.status === "active" && (
              <Button variant="destructive" onClick={handleFinishDraw}>
                Finalizar Sorteio
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Sorteio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Status:</span>
                {getStatusBadge(draw.status)}
              </div>
              <div className="flex justify-between">
                <span>Data/Hora:</span>
                <span>{formatDateTime(draw.dateTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>Valor da Cartela:</span>
                <span>R$ {draw.cardPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Modo:</span>
                <span>{draw.mode === "automatic" ? "Automático" : "Manual"}</span>
              </div>
              <div className="flex justify-between">
                <span>Cartelas Vendidas:</span>
                <span>{totalCards}</span>
              </div>
              <div className="flex justify-between">
                <span>Números Sorteados:</span>
                <span>{drawnNumbers.length}/90</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos Números</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {drawnNumbers.slice(-10).map((number) => (
                  <div
                    key={number}
                    className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold"
                  >
                    {number}
                  </div>
                ))}
                {drawnNumbers.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum número sorteado ainda</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prêmios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draw.type === "fixed" ? (
                <>
                  <div className="flex justify-between">
                    <span>Quadra:</span>
                    <span>R$ {(draw.prizes as any).quadra.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quina:</span>
                    <span>R$ {(draw.prizes as any).quina.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cartela Cheia:</span>
                    <span>R$ {(draw.prizes as any).cheia.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>Quadra:</span>
                    <span>{(draw.prizes as any).quadraPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quina:</span>
                    <span>{(draw.prizes as any).quinaPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cartela Cheia:</span>
                    <span>{(draw.prizes as any).cheiaPercent}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Iframe para sorteios manuais */}
        {draw.mode === "manual" && draw.externalUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Gerador de Números</CardTitle>
              <CardDescription>Sistema de geração de números para bingo manual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[600px] border rounded-lg overflow-hidden">
                <iframe
                  src={draw.externalUrl}
                  className="w-full h-full border-0"
                  title="Gerador de Números para Bingo"
                  allow="fullscreen"
                  loading="lazy"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Painel de números apenas para sorteios manuais */}
        {draw.mode === "manual" && (
          <Card>
            <CardHeader>
              <CardTitle>Painel de Números</CardTitle>
              <CardDescription>
                Clique nos números para sorteá-los. Números em azul já foram sorteados.
                <br />
                <span className="text-yellow-600 font-medium">
                  ⚡ Os ganhadores são verificados automaticamente pelo sistema backend.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>{renderNumberGrid()}</CardContent>
          </Card>
        )}

        {/* Aviso para sorteios automáticos */}
        {draw.mode === "automatic" && (
          <Card>
            <CardHeader>
              <CardTitle>Sorteio Automático</CardTitle>
              <CardDescription>
                Este sorteio é automático. Os números são sorteados automaticamente pelo sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  O sistema sorteia automaticamente um número a cada 3 segundos quando o sorteio está ativo.
                </p>
                {draw.status === "active" && (
                  <p className="text-green-600 font-medium mt-2">✅ Sorteio automático em andamento</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info - Apenas em desenvolvimento */}
        {process.env.NODE_ENV !== "production" && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">🐛 Debug Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-blue-700 text-sm space-y-1">
                <div>Winner Queue Length: {winnerQueue.length}</div>
                <div>Show Modal: {showWinnerModal ? "Yes" : "No"}</div>
                <div>Announced Winners: {announcedWinnersRef.current.size}</div>
                <div>Current Winner: {winnerInfo ? winnerInfo[0]?.type : "None"}</div>
                {draw.winnerDetails && (
                  <div>
                    WinnerDetails: {Object.entries(draw.winnerDetails).map(([fase, winners]) => 
                      `${fase}:${Array.isArray(winners) ? winners.length : 0}`
                    ).join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informação sobre backend */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">ℹ️ Sistema de Ganhadores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700 text-sm">
              Os ganhadores são verificados automaticamente pelo sistema backend Node.js. 
              Quando você sorteia um número, o sistema verifica todas as cartelas e registra 
              automaticamente os ganhadores, creditando os prêmios e exibindo os modais.
            </p>
          </CardContent>
        </Card>

        {/* Modal de Ganhador */}
        <WinnerModal
          open={showWinnerModal}
          winners={winnerInfo || []}
          onOpenChange={(open) => {
            if (!open) handleModalClose();
          }}
          autoClose={true}
          autoCloseTime={15}
          onTimerEnd={handleModalClose}
          isAdmin={true}
        />
      </div>
    </AdminLayout>
  )
}