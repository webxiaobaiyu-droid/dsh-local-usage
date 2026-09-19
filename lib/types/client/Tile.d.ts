/**
 * One labelled figure in a summary strip.
 *
 * Both the range summary and the day drill-down state a figure the same way —
 * a value over a label, with an optional quieter line under it — so the markup
 * lives here once rather than twice. It is deliberately dumb: the caller has
 * already formatted the value, because formatting is a property of the reader's
 * language and this component knows nothing about that.
 *
 * @module dsh-local-usage/client/Tile
 */
import type { ReactNode } from 'react';
/** The figure, what it counts, and an optional note beneath it. */
export interface TileProps {
    /** Already-formatted figure. */
    readonly value: string;
    /** What the figure counts. */
    readonly label: string;
    /** Optional quieter second line, e.g. the other half of a paired figure. */
    readonly detail?: string;
}
/**
 * Render one figure.
 * @param props - the formatted value, its label, and an optional note.
 * @returns the tile.
 */
export declare function Tile({ value, label, detail }: TileProps): ReactNode;
