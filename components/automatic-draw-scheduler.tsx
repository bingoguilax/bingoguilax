"use client"

import { useEffect, useState } from "react"
import { doc, updateDoc, onSnapshot, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Draw } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"

export function AutomaticDrawScheduler() {
  const { user } = useAuth()
  const [draws, setDraws] = useState<Draw[]>([])

  useEffect(() => {
    // Só executar se o usuário for admin
    if (!user || user.role !== 'admin') return

    console.log("Setting up draw scheduler for user:", user.id)

    // Escutar mudanças em sorteios que estão aguardando
    const unsubscribe = onSnapshot(
      query(collection(db, "draws"), where("status", "==", "waiting")),
      (snapshot) => {
        try {
          const drawsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            dateTime: doc.data().dateTime.toDate(),
            createdAt: doc.data().createdAt.toDate(),
          })) as Draw[]

          console.log("Found waiting draws:", drawsData.length)
          setDraws(drawsData)
        } catch (error) {
          console.error("Error processing draws:", error)
        }
      },
      (error) => {
        console.error("Error listening to draws:", error)
        // Silenciar o erro para não quebrar a aplicação
      },
    )

    return () => {
      console.log("Cleaning up draw scheduler")
      unsubscribe()
    }
  }, [user])

  useEffect(() => {
    // Só verificar se há usuário autenticado e sorteios
    if (!user || draws.length === 0) return

    const checkAndStartDraws = async () => {
      const now = new Date()

      for (const draw of draws) {
        // Verificar se a data/hora do sorteio já passou
        if (draw.dateTime <= now && draw.status === "waiting") {
          try {
            console.log(`Starting automatic draw: ${draw.name}`)
            await updateDoc(doc(db, "draws", draw.id), {
              status: "active",
            })
          } catch (error) {
            console.error(`Error starting draw ${draw.id}:`, error)
            // Continuar com outros sorteios mesmo se um falhar
          }
        }
      }
    }

    // Verificar imediatamente
    checkAndStartDraws()

    // Verificar a cada 30 segundos (reduzido de 10 para economizar recursos)
    const interval = setInterval(checkAndStartDraws, 30000)

    return () => clearInterval(interval)
  }, [draws, user])

  return null // Este componente não renderiza nada
}
