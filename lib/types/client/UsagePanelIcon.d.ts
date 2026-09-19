/** The sidebar's Usage entry glyph; the sidebar owns the button, label, and selected state around it. */
import type { ReactNode } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/**
 * Render three rising bars at the size the sidebar asks for.
 * @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
 * @returns the glyph element.
 */
export declare function UsagePanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode;
