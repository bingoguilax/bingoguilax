"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, updateDoc, runTransaction } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserLayout } from "@/components/layout/user-layout"
import { AutomaticDrawEngine } from "@/components/automatic-draw-engine"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw, Card as BingoCard } from "@/lib/types"
import { Clock, Trophy, Users, ArrowLeft, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WinnerModal } from "@/components/WinnerModal"
import { calculateAccumulatedPrize } from "@/lib/prize-utils"

interface Winner {
  userId: string;
  userName: string;
  cardId: string;
  type: "quadra" | "quina" | "cheia";
  prize: number;
}

export default function DrawRoomPage() {
  const { user, loading } = useAuth()
  const [draw, setDraw] = useState<Draw | null>(null)
  const [userCards, setUserCards] = useState<BingoCard[]>([])
  const [loadingDraw, setLoadingDraw] = useState(true)
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([])
  const [timeUntilStart, setTimeUntilStart] = useState<string>("")
  const [lastDrawnNumber, setLastDrawnNumber] = useState<number | null>(null)
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const drawId = params.drawId as string
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [winnerInfo, setWinnerInfo] = useState<Winner[] | null>(null)
  const lastWinnersRef = useRef({ quadra: new Set<string>(), quina: new Set<string>(), cheia: new Set<string>() })
  // Ref para guardar IDs de ganhadores já exibidos
  // const shownWinnersRef = useRef<{ [key: string]: string }>({ quadra: '', quina: '', cheia: '' });
  const [stats, setStats] = useState<{ totalPlayers: number, totalCards: number }>({ totalPlayers: 0, totalCards: 0 })

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDrawAndCards = async () => {
      if (!user) return

      try {
        // Buscar informações do sorteio
        const drawDoc = await getDoc(doc(db, "draws", drawId))
        if (!drawDoc.exists()) {
          toast({
            title: "Sorteio não encontrado",
            description: "O sorteio solicitado não existe.",
            variant: "destructive",
          })
          router.push("/home")
          return
        }

        const drawData = {
          id: drawDoc.id,
          ...drawDoc.data(),
          dateTime: drawDoc.data().dateTime.toDate(),
          createdAt: drawDoc.data().createdAt.toDate(),
        } as Draw    

        setDraw(drawData)
        setDrawnNumbers(drawData.drawnNumbers || [])

        if (drawData.drawnNumbers && drawData.drawnNumbers.length > 0) {
          setLastDrawnNumber(drawData.drawnNumbers[drawData.drawnNumbers.length - 1])
        }

        // Buscar cartelas do usuário para este sorteio
        const cardsQuery = query(collection(db, "cards"), where("userId", "==", user.id), where("drawId", "==", drawId))
        const cardsSnapshot = await getDocs(cardsQuery)
        const cardsData = cardsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          purchaseDate: doc.data().purchaseDate.toDate(),
        })) as BingoCard[]

        if (cardsData.length === 0) {
          toast({
            title: "Acesso negado",
            description: "Você precisa comprar cartelas para acessar esta sala.",
            variant: "destructive",
          })
          router.push("/home")
          return
        }

         // ←–– AQUI: notifica quem entrou depois do ganhador manual  
        if (drawData.winnerDetails) {
          const fases: ("quadra" | "quina" | "cheia")[] = ["quadra", "quina", "cheia"]
          outer: for (const fase of fases) {
            for (const detail of drawData.winnerDetails[fase] || []) {
              if (!lastWinnersRef.current[fase].has(detail.cardId)) {
                lastWinnersRef.current[fase].add(detail.cardId)
                setWinnerInfo([detail])
                setShowWinnerModal(true)
                break outer
              }
            }
          }
        }

        setUserCards(cardsData)
      } catch (error) {
        console.error("Error fetching draw and cards:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar a sala do sorteio.",
          variant: "destructive",
        })
      } finally {
        setLoadingDraw(false)
      }
    }

    fetchDrawAndCards()
  }, [user, drawId, router, toast])

  // Adicionar um novo useEffect separado para o listener em tempo real
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(doc(db, "draws", drawId), snap => {
      if (!snap.exists()) return;
      
      const d = snap.data() as Draw;
      setDraw({ ...d, dateTime: d.dateTime.toDate(), createdAt: d.createdAt.toDate() });
      setDrawnNumbers(d.drawnNumbers || []);
      setLastDrawnNumber((d.drawnNumbers || []).slice(-1)[0] || null);
      
      console.log("[SNAPSHOT] winnerDetails recebido:", d.winnerDetails);
      
      // VERIFICAÇÃO MELHORADA DE GANHADORES
      if (d.winnerDetails) {
        const fases: ("quadra" | "quina" | "cheia")[] = ["quadra", "quina", "cheia"];
        
        // Procurar por novos ganhadores em TODAS as fases
        for (const fase of fases) {
          const ganhadores = d.winnerDetails[fase] || [];
          
          for (const ganhador of ganhadores) {
            // Verificar se este ganhador já foi mostrado
            if (!lastWinnersRef.current[fase].has(ganhador.cardId)) {
              console.log(`[MODAL] Novo ganhador detectado - Fase: ${fase}, Cartela: ${ganhador.cardId}`);
              
              // Marcar como mostrado
              lastWinnersRef.current[fase].add(ganhador.cardId);
              
              // Exibir modal
              setWinnerInfo([ganhador]);
              setShowWinnerModal(true);
              
              // Parar na primeira nova detecção para evitar múltiplos modais
              return;
            }
          }
        }
      }
    });
  
    return () => unsubscribe();
  }, [user, drawId]);

  useEffect(() => {
    lastWinnersRef.current = { quadra: new Set(), quina: new Set(), cheia: new Set() };
  }, [drawId]);

  // Timer para contagem regressiva
  useEffect(() => {
    if (!draw) return

    const updateTimer = () => {
      const now = new Date()
      const diff = draw.dateTime.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilStart("Iniciando...")
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeUntilStart(`${hours}h ${minutes}m ${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [draw])

  const isNumberMarked = (number: number): boolean => {
    return drawnNumbers.includes(number)
  }

  const getMarkedCount = (card: BingoCard): number => {
    let count = 0
    card.numbers.forEach((number, index) => {
      const row = Math.floor(index / 5)
      const col = index % 5
      const isFree = col === 2 && row === 2

      if (isFree || isNumberMarked(number)) {
        count++
      }
    })
    return count
  }

  const getCardStatus = (card: BingoCard): string => {
    // ORDEM CORRETA: Verificar cheia primeiro, depois quina, depois quadra
    if (temCheia(card)) return "CARTELA CHEIA!";
    if (temQuina(card)) return "QUINA!";
    if (temQuadra(card)) return "QUADRA!";
    
    // Contar total de marcados para status padrão
    const totalMarked = getMarkedCount(card);
    return `${totalMarked}/25 marcados`;
  };

  // FUNÇÃO getCardStatusColor CORRIGIDA
const getCardStatusColor = (card: BingoCard): string => {
  if (temCheia(card)) return "text-green-600 font-bold";
  if (temQuina(card)) return "text-blue-600 font-bold";
  if (temQuadra(card)) return "text-yellow-600 font-bold";
  return "text-gray-600";
};

  // Função para formatar o ID da cartela (últimos 4 dígitos)
  const formatCardId = (cardId: string): string => {
    if (!cardId) return "????";
    return cardId.slice(-4).toUpperCase();
  };

  // 1. Verificar se uma cartela fez quadra
  const temQuadra = (card: BingoCard): boolean => {
    for (let row = 0; row < 5; row++) {
      let markedInRow = 0;
      for (let col = 0; col < 5; col++) {
        const index = row * 5 + col;
        const number = card.numbers[index];
        const isFree = col === 2 && row === 2;
        if (isFree || drawnNumbers.includes(number)) {
          markedInRow++;
        }
      }
      // EXATAMENTE 4 marcações (não mais que isso)
      if (markedInRow === 4) return true;
    }
    return false;
  };
  
  const temQuina = (card: BingoCard): boolean => {
    for (let row = 0; row < 5; row++) {
      let markedInRow = 0;
      for (let col = 0; col < 5; col++) {
        const index = row * 5 + col;
        const number = card.numbers[index];
        const isFree = col === 2 && row === 2;
        if (isFree || drawnNumbers.includes(number)) {
          markedInRow++;
        }
      }
      // EXATAMENTE 5 marcações
      if (markedInRow === 5) return true;
    }
    return false;
  };
  
  const temCheia = (card: BingoCard): boolean => {
    let totalMarked = 0;
    card.numbers.forEach((number, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const isFree = col === 2 && row === 2;
      if (isFree || drawnNumbers.includes(number)) {
        totalMarked++;
      }
    });
    return totalMarked === 25;
  };

  // Função de depuração para ajudar a diagnosticar problemas
  // LOG DEBUG MELHORADO
const logDebugInfo = () => {
  if (!draw || !draw.winners) return;
  
  const winners = draw.winners as Record<string, string[]>;
  console.group("=== DEBUG: Estado do Sorteio ===");
  console.log(`Fase atual: ${draw.currentPhase}`);
  console.log(`Status: ${draw.status}`);
  console.log(`Números sorteados: ${drawnNumbers.length}/90`);
  console.log(`Últimos números: [${drawnNumbers.slice(-5).join(', ')}]`);
  
  // Log dos ganhadores
  console.log(`Ganhadores quadra: ${(winners.quadra || []).length}`, winners.quadra || []);
  console.log(`Ganhadores quina: ${(winners.quina || []).length}`, winners.quina || []);
  console.log(`Ganhadores cheia: ${(winners.cheia || []).length}`, winners.cheia || []);
  
  // Log do winnerDetails se existir
  if (draw.winnerDetails) {
    console.log("winnerDetails:", draw.winnerDetails);
  }
  
  // Verificar estado das cartelas do usuário
  const cartelasInfo = userCards.map(card => {
    const hasQuadra = temQuadra(card);
    const hasQuina = temQuina(card);
    const hasCheia = temCheia(card);
    const marked = getMarkedCount(card);
    
    return {
      id: formatCardId(card.id),
      marked: `${marked}/25`,
      quadra: hasQuadra ? "SIM" : "NÃO",
      quina: hasQuina ? "SIM" : "NÃO", 
      cheia: hasCheia ? "SIM" : "NÃO",
      status: getCardStatus(card)
    };
  });
  
  console.table(cartelasInfo);
  
  // Log dos números de cada linha das cartelas
  userCards.forEach((card, cardIndex) => {
    console.group(`Cartela ${formatCardId(card.id)}:`);
    for (let row = 0; row < 5; row++) {
      const numeros = [];
      const marcados = [];
      let contMarcados = 0;
      
      for (let col = 0; col < 5; col++) {
        const index = row * 5 + col;
        const numero = card.numbers[index];
        const isFree = col === 2 && row === 2;
        const isMarked = isFree || drawnNumbers.includes(numero);
        
        if (isMarked) contMarcados++;
        numeros.push(isFree ? 'FREE' : numero);
        marcados.push(isMarked ? '✓' : '✗');
      }
      
      let status = '';
      if (contMarcados === 4) status = ' 🟡 QUADRA';
      else if (contMarcados === 5) status = ' 🟢 QUINA';
      
      console.log(`Linha ${row + 1}: [${numeros.join(', ')}] -> [${marcados.join(' ')}] = ${contMarcados}/5${status}`);
    }
    console.groupEnd();
  });
  
  console.groupEnd();
};

  const renderBingoCard = (card: BingoCard, index: number) => {
    return (
      <Card key={card.id} className="w-full max-w-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-lg">
            Cartela <span className="font-mono">{formatCardId(card.id)}</span>
          </CardTitle>
          <div className={`text-center text-sm ${getCardStatusColor(card)}`}>{getCardStatus(card)}</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-1 mb-2">
            <div className="text-center font-bold text-sm py-1">B</div>
            <div className="text-center font-bold text-sm py-1">I</div>
            <div className="text-center font-bold text-sm py-1">N</div>
            <div className="text-center font-bold text-sm py-1">G</div>
            <div className="text-center font-bold text-sm py-1">O</div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {card.numbers.map((number, idx) => {
              const row = Math.floor(idx / 5)
              const col = idx % 5
              const isFree = col === 2 && row === 2
              const isMarked = isFree || isNumberMarked(number)
              const isLastDrawn = number === lastDrawnNumber

              return (
                <div
                  key={`${card.id}-${idx}`}
                  className={`
                    aspect-square flex items-center justify-center text-sm font-medium border rounded transition-all duration-300
                    ${
                      isFree
                        ? "bg-yellow-200 text-yellow-800 border-yellow-300"
                        : isLastDrawn && isMarked
                          ? "bg-red-500 text-white border-red-600 shadow-md transform scale-105"
                          : isMarked
                            ? "bg-blue-500 text-white border-blue-600 shadow-md"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }
                  `}
                >
                  {isFree ? "★" : number}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderNumbersHistory = () => {
    const lastFiveNumbers = drawnNumbers.slice(-5).reverse()

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Últimos Números Sorteados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-3">
            {lastFiveNumbers.map((number, index) => (
              <div
                key={`history-${number}-${index}`}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-lg
                  ${
                    index === 0
                      ? "bg-red-500 ring-4 ring-red-200 animate-pulse"
                      : index === 1
                        ? "bg-blue-500"
                        : index === 2
                          ? "bg-green-500"
                          : index === 3
                            ? "bg-purple-500"
                            : "bg-gray-500"
                  }
                `}
              >
                {number}
              </div>
            ))}
            {lastFiveNumbers.length === 0 && (
              <p className="text-muted-foreground text-sm py-4">Nenhum número sorteado ainda</p>
            )}
          </div>
          {lastFiveNumbers.length > 0 && (
            <div className="text-center mt-3">
              <p className="text-xs text-muted-foreground">
                Último número: <span className="font-bold text-red-600">{lastFiveNumbers[0]}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  {/*
  useEffect(() => {
    if (!user || !draw || userCards.length === 0 || drawnNumbers.length === 0) return;

    // NOVA ABORDAGEM: Separar claramente as funções de verificação
    
    // FUNÇÃO PRINCIPAL DE VERIFICAÇÃO DE GANHADORES
    const verificarGanhadores = async () => {
      if (!user || !draw || !userCards.length) return;
      
      // Executar função de depuração para ajudar a diagnosticar problemas
      logDebugInfo();
      
      try {
        // Usar transação do Firestore para garantir consistência
        await runTransaction(db, async (transaction) => {
          // 1. Obter dados atualizados do sorteio dentro da transação
          const drawRef = doc(db, "draws", drawId);
          const drawDoc = await transaction.get(drawRef);
          
          if (!drawDoc.exists()) {
            console.log("Sorteio não encontrado");
            return;
          }
          
          const drawData = drawDoc.data();
          const fase = drawData.currentPhase as "quadra" | "quina" | "cheia";
          const winners = { ...(drawData.winners || {}) };
          
          // 2. Se já existe um ganhador para a fase atual, não faz nada
          if (winners[fase] && winners[fase].length > 0) {
            console.log(`Já existe ganhador para ${fase}. Ignorando.`);
            return;
          }
          
          // 3. Filtrar cartelas elegíveis com base na fase atual
          const cartelasElegiveis = userCards.filter(card => {
            // Na fase quadra, todas as cartelas são elegíveis
            if (fase === "quadra") return true;
            
            // Na fase quina, cartelas que ganharam quadra NÃO são elegíveis
            if (fase === "quina") {
              return !(winners.quadra || []).includes(card.id);
            }
            
            // Na fase cheia, cartelas que ganharam quadra ou quina NÃO são elegíveis
            if (fase === "cheia") {
              return !(winners.quadra || []).includes(card.id) && 
                     !(winners.quina || []).includes(card.id);
            }
            
            return false;
          });
          
          console.log(`Fase atual: ${fase}, Cartelas elegíveis: ${cartelasElegiveis.length}`);
          
          // 4. Verificar se alguma cartela elegível ganhou o prêmio da fase atual
          let cartela_vencedora: BingoCard | null = null;
          
          // IMPORTANTE: Só verifica o tipo de prêmio da fase atual
          if (fase === "quadra") {
            cartela_vencedora = cartelasElegiveis.find(card => temQuadra(card)) || null;
          } 
          else if (fase === "quina") {
            cartela_vencedora = cartelasElegiveis.find(card => temQuina(card)) || null;
          }
          else if (fase === "cheia") {
            cartela_vencedora = cartelasElegiveis.find(card => temCheia(card)) || null;
          }
          
          // 5. Se encontrou um ganhador, registrar e avançar fase
          if (cartela_vencedora) {
            // Preparar objeto de winners (preservando winners anteriores)
            const updatedWinners = { ...winners };
            
            // Adicionar o ganhador atual
            if (!updatedWinners[fase]) {
              updatedWinners[fase] = [];
            }
            
            // Garantir que não há duplicatas
            if (!updatedWinners[fase].includes(cartela_vencedora.id)) {
              updatedWinners[fase] = [cartela_vencedora.id];
              
              // Determinar próxima fase
              let proximaFase = fase;
              if (fase === "quadra") proximaFase = "quina";
              else if (fase === "quina") proximaFase = "cheia";
              else proximaFase = "cheia"; // Mantém em "cheia" se já estiver nela
              
              // Atualizar no Firestore dentro da transação
              transaction.update(drawRef, {
                winners: updatedWinners,
                currentPhase: proximaFase
              });
              
              console.log(`Registrado ganhador para ${fase}: Cartela ${cartela_vencedora.id.slice(-4).toUpperCase()}`);
              console.log(`Fase avançada para: ${proximaFase}`);
            }
          }
        });
      } catch (error) {
        console.error("Erro ao verificar ganhadores:", error);
      }
    };
    
    // Executar verificação
    verificarGanhadores();
  }, [user, draw, userCards, drawnNumbers, drawId]);
  */}
  if (loading || loadingDraw) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || !draw) {
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
    <UserLayout>
      {/* Engine de Sorteio Automático */}
      <AutomaticDrawEngine drawId={drawId} isActive={draw.status === "active"} onStatsUpdate={setStats} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push("/home")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{draw.name}</h1>
              <p className="text-muted-foreground">Sala do Sorteio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Botão de depuração para administradores */}
            {user.role === "admin" && process.env.NODE_ENV !== "production" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  toast({
                    title: "Verificação manual iniciada",
                    description: "Verificando ganhadores..."
                  });
                  // Executar verificação manual
                  if (!user || !draw || !userCards.length) return;
                  logDebugInfo();
                  runTransaction(db, async (transaction) => {
                    // Lógica de verificação similar à função verificarGanhadores
                    const drawRef = doc(db, "draws", drawId);
                    const drawDoc = await transaction.get(drawRef);
                    
                    if (!drawDoc.exists()) {
                      console.log("Sorteio não encontrado");
                      return;
                    }
                    
                    const drawData = drawDoc.data();
                    const fase = drawData.currentPhase as "quadra" | "quina" | "cheia";
                    const winners = { ...(drawData.winners || {}) };
                    
                    // Verificar se já existe um ganhador para a fase atual
                    if (winners[fase] && winners[fase].length > 0) {
                      toast({
                        title: `Já existe ganhador para ${fase}`,
                        description: `Cartela: ${formatCardId(winners[fase][0])}`,
                      });
                      return;
                    }
                    
                    // Executar verificação
                    console.log("Executando verificação manual de ganhadores...");
                  }).catch(error => {
                    console.error("Erro na verificação manual:", error);
                    toast({
                      title: "Erro na verificação",
                      description: "Ocorreu um erro ao verificar ganhadores.",
                      variant: "destructive",
                    });
                  });
                }}
              >
                Verificar Ganhadores
              </Button>
            )}
            {getStatusBadge(draw.status)}
          </div>
        </div>

        {/* Histórico dos Últimos Números */}
        {drawnNumbers.length > 0 && renderNumbersHistory()}

        {/* Informações do Sorteio */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Data/Hora:</span>
                <span>{formatDateTime(draw.dateTime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Valor da Cartela:</span>
                <span>R$ {draw.cardPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Suas Cartelas:</span>
                <span>{userCards.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Modo:</span>
                <span>{draw.mode === "automatic" ? "Automático" : "Manual"}</span>
              </div>
              {draw.status === "waiting" && (
                <div className="text-center py-2 bg-yellow-50 rounded text-yellow-700 text-sm">
                  {draw.mode === "automatic" ? "Inicia automaticamente em:" : "Inicia em:"} {timeUntilStart}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Prêmios */}
          {draw && (
            <Card className="mt-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Prêmios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {draw.type === "fixed" ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Quadra:</span>
                      <span>R$ {(draw.prizes as any).quadra.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Quina:</span>
                      <span>R$ {(draw.prizes as any).quina.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cartela Cheia:</span>
                      <span>R$ {(draw.prizes as any).cheia.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Quadra:</span>
                      <span>R$ {calculateAccumulatedPrize("quadra", draw).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Quina:</span>
                      <span>R$ {calculateAccumulatedPrize("quina", draw).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cartela Cheia:</span>
                      <span>R$ {calculateAccumulatedPrize("cheia", draw).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {/* Jogadores e cartelas participantes */}
                <div className="mt-10 text-center">
                  <span className="text-sm text-zinc-600 font-medium">Jogadores: </span>
                  <span className="text-base font-bold text-zinc-800">{stats.totalPlayers}</span>
                </div>
                <div className="text-center">
                  <span className="text-sm text-zinc-600 font-medium">Cartelas participantes: </span>
                  <span className="text-base font-bold text-zinc-800">{stats.totalCards}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Progresso do Sorteio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-3">
                <span className="text-3xl font-bold text-blue-600">{drawnNumbers.length}</span>
                <span className="text-lg text-muted-foreground">/90</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(drawnNumbers.length / 90) * 100}%` }}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {drawnNumbers.length === 0 ? "Aguardando início" : `${90 - drawnNumbers.length} números restantes`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gerador de Números - Exibido durante sorteio ativo manual */}
        {draw.status === "active" && draw.mode === "manual" && draw.externalUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Sorteio ao Vivo
              </CardTitle>
              <CardDescription>Acompanhe o sorteio dos números em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[500px] border rounded-lg overflow-hidden bg-gray-50">
                <iframe
                  src={draw.externalUrl}
                  className="w-full h-full border-0"
                  title="Sorteio de Números ao Vivo"
                  allow="fullscreen"
                  loading="lazy"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cartelas do Usuário */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Suas Cartelas
            {draw.status === "active" && (
              <span className="text-sm text-green-600 ml-2">(Marcação automática ativa)</span>
            )}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {userCards.map((card, index) => renderBingoCard(card, index))}
          </div>
        </div>

        {/* Todos os Números Sorteados */}
        {drawnNumbers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Todos os Números Sorteados</CardTitle>
              <CardDescription>Histórico completo do sorteio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {drawnNumbers.map((number, index) => (
                  <div
                    key={`all-${number}-${index}`}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                      ${
                        number === lastDrawnNumber
                          ? "bg-red-500 text-white ring-2 ring-red-300"
                          : "bg-gray-600 text-white"
                      }`}
                  >
                    {number}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Ganhador */}
      <WinnerModal
        open={showWinnerModal}
        winners={winnerInfo || []}
        onOpenChange={(open) => {
          setShowWinnerModal(open);
          if (!open) setWinnerInfo(null);
        }}
        autoClose
        autoCloseTime={15}
        onTimerEnd={() => {
          setShowWinnerModal(false);
          setWinnerInfo(null);
        }}
        isAdmin={false}
      />


    </UserLayout>
  )
}
