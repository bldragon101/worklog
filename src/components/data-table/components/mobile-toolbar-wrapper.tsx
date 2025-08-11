"use client"

import { ReactNode } from "react"

interface MobileToolbarWrapperProps {
  children: ReactNode
}

export function MobileToolbarWrapper({ children }: MobileToolbarWrapperProps) {
  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="min-w-0 max-w-full">
        {children}
      </div>
    </div>
  )
}