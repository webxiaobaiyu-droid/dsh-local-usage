/** The sidebar's Usage entry glyph; the sidebar owns the button, label, and selected state around it. */

import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render three rising bars at the size the sidebar asks for.
 * @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
 * @returns the glyph element.
 */
export function UsagePanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M3.5 12.5V9.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 12.5V6.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12.5 12.5V3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M2.2 14.4H13.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}
