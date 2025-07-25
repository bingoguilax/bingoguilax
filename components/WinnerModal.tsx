import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock } from "lucide-react";
import React, { useEffect, useState } from "react";

interface Winner {
  userId: string;
  userName: string;
  cardId: string;
  type: "quadra" | "quina" | "cheia";
  prize: number;
}

interface WinnerModalProps {
  open: boolean;
  winners: Winner[];
  autoClose?: boolean;
  autoCloseTime?: number;
  onOpenChange: (open: boolean) => void;
  onTimerEnd?: () => void;
  isAdmin?: boolean;
}

export function WinnerModal({ 
  open, 
  winners, 
  autoClose = true,
  autoCloseTime = 10,
  onOpenChange,
  onTimerEnd,
  isAdmin = false
}: WinnerModalProps) {
  const [winnerTimer, setWinnerTimer] = useState(autoCloseTime);

  // Reset timer quando o modal abre ou quando mudam os winners
  useEffect(() => {
    if (open) {
      setWinnerTimer(autoCloseTime);
    }
  }, [open, winners, autoCloseTime]);

  // Timer countdown - CORRIGIDO
  useEffect(() => {
    if (!open || !autoClose) return;
    
    const interval = setInterval(() => {
      setWinnerTimer((prev) => {
        const newValue = prev - 1;
        
        // Se chegou a zero, fechar o modal
        if (newValue <= 0) {
          onTimerEnd?.();
          onOpenChange(false);
          return 0;
        }
        
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, autoClose, onOpenChange, onTimerEnd]);

  // Função para formatar o ID da cartela (últimos 4 dígitos)
  const formatCardId = (cardId: string): string => {
    if (!cardId) return "????";
    return cardId.slice(-4).toUpperCase();
  };

  // Ordenar ganhadores por tipo (cheia, quina, quadra)
  const sortedWinners = [...winners].sort((a, b) => {
    const order = { cheia: 0, quina: 1, quadra: 2 };
    return order[a.type] - order[b.type];
  });

  if (!winners || winners.length === 0) return null;

  // Pegar o ganhador mais recente (primeiro da lista ordenada)
  const latestWinner = sortedWinners[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="text-center">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <DialogTitle className="text-2xl">🎉 Premiação do Bingo! 🎉</DialogTitle>
            <DialogDescription className="text-lg mt-2">Parabéns aos vencedores!</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Badge do tipo de prêmio */}
          <Badge 
            className={`mx-auto block w-fit px-3 py-1 text-sm ${
              latestWinner.type === "cheia" ? "bg-green-100 text-green-800" : 
              latestWinner.type === "quina" ? "bg-blue-100 text-blue-800" : 
              "bg-yellow-100 text-yellow-800"
            }`}
          >
            Cartela {latestWinner.type === "cheia" ? "Cheia" : latestWinner.type === "quina" ? "Quina" : "Quadra"}
          </Badge>

          {/* Lista de ganhadores */}
          {sortedWinners.map(winner => (
            <div key={winner.cardId} className="bg-blue-50 p-3 rounded-lg">
              <div className="flex justify-between">
                <span className="text-blue-800">
                  {winner.type === "cheia" ? "Cheia" : winner.type === "quina" ? "Quina" : "Quadra"} Cartela {formatCardId(winner.cardId)}, {winner.userName}
                </span>
                <span className="text-green-600 font-bold">
                  R$ {winner.prize.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}