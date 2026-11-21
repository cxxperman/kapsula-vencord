/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// A copy of kit.txt/icons/sprites.json: the pixel icons of the dev.txt apps. "#" is the body, "E" an eye, "." empty
export const SPRITES = {
    colors: { "#": "#F08A4B", "E": "#1A1A1E" } as Record<string, string>,
    sprites: {
        kapsula: [".#.......#.", ".##.....##.", ".#########.", "###########", "##E#####E##", "##E#####E##", "###########", ".#########.", ".#.#...#.#."],
        aura: ["....##......", "...####....#", "..######..##", ".###########", "##E########.", "##E########.", ".###########", "..######..##", "...####....#", "....##......"],
        maska: ["#..........#", "##........##", "############", "###E####E###", "###E####E###", "############", ".####..####.", "..##....##.."],
        arkada: [".####..####.", "############", "##E######E##", "#EEE####E#E#", "##E######E##", "############", "####....####", ".##......##."],
        "arkada-stick": ["....####....", "...######...", "...######...", "....####....", ".....##.....", ".....##.....", "..########..", ".###E##E###.", "############", "############"],
        core: [".....#....", "....##....", ".########.", "##########", ".########.", "..######..", "...##E#...", "...##E#...", "..######..", ".########.", "##########", ".########."],
        "core-sun": [".....##.....", ".#...##...#.", "..#......#..", "....####....", "##.##E###.##", "##.##E###.##", "....####....", "..#......#..", ".#...##...#.", ".....##....."],
        dock: ["....####....", "....#E##....", ".##.#E##.##.", ".##.####.##.", ".##.####.##.", "............", "############", ".##########."],
        smena: ["#######.....", "#######.....", "##..........", "##.#########", "##.##E###E##", "##.##E###E##", "...#########", "...#########"],
        metla: [".......##.", "......##..", ".....##...", "....##....", "...##.....", "..####....", ".######...", ".##E###...", "###E####..", "########..", "#.#.#.#.#.", "#.#.#.#.#."]
    } as Record<string, string[]>
};

// One rectangle per run of same-coloured pixels in a row
function runs(rows: string[]) {
    const out: { x: number; y: number; w: number; fill: string; }[] = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
            const c = row[x];
            let end = x + 1;
            while (row[end] === c) end++;
            const fill = SPRITES.colors[c];
            if (fill) out.push({ x, y, w: end - x, fill });
            x = end;
        }
    });
    return out;
}

export type Eye = "normal" | "wide" | "squint" | "closed";

// The eyes redrawn: wide is a pixel taller, squint only the lower row, closed a line one pixel wider each side
function withEye(rows: string[], eye: Eye) {
    if (eye === "normal") return rows;
    const grid = rows.map(r => r.split(""));
    const eyes: [number, number][] = [];
    grid.forEach((row, y) => row.forEach((c, x) => c === "E" && eyes.push([x, y])));
    const isEye = (x: number, y: number) => eyes.some(([a, b]) => a === x && b === y);
    for (const [x, y] of eyes) grid[y][x] = "#";
    for (const [x, y] of eyes) {
        const top = !isEye(x, y - 1);
        const bottom = !isEye(x, y + 1);
        if (eye === "wide") {
            grid[y][x] = "E";
            if (top && grid[y - 1]?.[x] === "#") grid[y - 1][x] = "E";
        } else if (bottom && eye === "squint") {
            grid[y][x] = "E";
        } else if (bottom) {
            for (const dx of [-1, 0, 1]) if (grid[y][x + dx] === "#") grid[y][x + dx] = "E";
        }
    }
    return grid.map(r => r.join(""));
}

interface PixelIconProps {
    app?: string;
    size?: number | string;
    className?: string;
    eye?: Eye;
    eyeColor?: string;
}

// The app's pixel icon as inline SVG; an app without one gets maska's
export function PixelIcon({ app = "maska", size = 16, className, eye = "normal", eyeColor }: PixelIconProps) {
    const rows = withEye(SPRITES.sprites[app] ?? SPRITES.sprites.maska, eye);
    const width = Math.max(...rows.map(r => r.length));
    return (
        <svg className={className} width={size} height={size} viewBox={`0 0 ${width} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
            {runs(rows).map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} style={{ fill: eyeColor && r.fill === SPRITES.colors.E ? eyeColor : r.fill }} />)}
        </svg>
    );
}
