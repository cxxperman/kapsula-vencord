/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";
import { request } from "http";

// Kapsula listens only on this computer
function call(method: string, path: string, body: string | null, timeout: number): Promise<string | null> {
    return new Promise(resolve => {
        const headers: Record<string, string | number> = {};
        if (body != null) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(body);
        }
        const req = request({ host: "127.0.0.1", port: 42073, path, method, headers, timeout }, res => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve(res.statusCode === 200 ? data : null));
        });
        req.on("error", () => resolve(null));
        req.on("timeout", () => {
            req.destroy();
            resolve(null);
        });
        req.end(body ?? undefined);
    });
}

// Voice state for the island; the reply may carry commands (mute, deafen, leave)
export function send(_: IpcMainInvokeEvent, body: string) {
    return call("POST", "/discord", body, 1500);
}

// Waits until a button is pressed on the island (Kapsula answers empty after about 20 seconds)
export function wait(_: IpcMainInvokeEvent) {
    return call("GET", "/discord/wait", null, 30000);
}
