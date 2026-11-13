/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";
import { request } from "http";

// Kapsula listens only on this computer. Its reply carries commands from the island: mute, deafen, leave
export function send(_: IpcMainInvokeEvent, body: string): Promise<string | null> {
    return new Promise(resolve => {
        const req = request({
            host: "127.0.0.1",
            port: 42073,
            path: "/discord",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
            timeout: 1500
        }, res => {
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
        req.end(body);
    });
}
