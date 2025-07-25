"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { LayoutDashboard, CreditCard, Banknote, Users, Trophy, Settings, LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/backoffice/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const menuItems = [
    { href: "/backoffice/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/backoffice/depositos", icon: CreditCard, label: "Depósitos" },
    { href: "/backoffice/saques", icon: Banknote, label: "Saques" },
    { href: "/backoffice/usuarios", icon: Users, label: "Usuários" },
    { href: "/backoffice/sorteios", icon: Trophy, label: "Sorteios" },
    { href: "/backoffice/configuracoes", icon: Settings, label: "Configurações" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-card border-r">
          <div className="p-6">
            <h2 className="text-xl font-bold">Admin Panel</h2>
            {user && <p className="text-sm text-muted-foreground mt-1">Olá, {user.name}</p>}
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b">
          <div className="flex h-16 items-center px-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex flex-col h-full">
                  <div className="py-4">
                    <h2 className="text-lg font-semibold">Admin Panel</h2>
                    {user && <p className="text-sm text-muted-foreground">Olá, {user.name}</p>}
                  </div>
                  <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                        onClick={() => setOpen(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="border-t pt-4">
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="ml-4 text-lg font-semibold">Admin Panel</h1>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 md:ml-0 pt-16 md:pt-0">
          <div className="container mx-auto px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
