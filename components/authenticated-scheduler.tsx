"use client"
import { AutomaticDrawScheduler } from "./automatic-draw-scheduler"
import { useAuth } from "@/hooks/use-auth"

export function AuthenticatedScheduler() {
  const { user, loading } = useAuth()

  // Só renderizar o scheduler se o usuário estiver autenticado
  if (loading || !user) {
    return null
  }

  return <AutomaticDrawScheduler />
}
