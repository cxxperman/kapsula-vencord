/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, IpcMainInvokeEvent, NativeImage, nativeImage } from "electron";
import { writeFileSync } from "fs";
import { join } from "path";

import { connectHub, HubMessage } from "./hub";
import { MASKA_ICO } from "./icon";

// The hub link lives here, in Discord's main process: Discord's pages may not open connections to this computer
// themselves. The plugin (renderer) says things through start/state/result and hears things through wait.

const HOLD_MS = 25000;
const MAX_WAITING = 100;

let hub: ReturnType<typeof connectHub> | undefined;
let inbox: HubMessage[] = [];
let waiter: ((messages: HubMessage[]) => void) | undefined;
let waiterTimer: ReturnType<typeof setTimeout> | undefined;
let commandId = 0;
// commands of ours waiting for their result: id -> resolve
const asked = new Map<string, (result: CommandResult) => void>();
let icon: NativeImage | undefined;
let iconOn = false;

function release(messages: HubMessage[]) {
    const resolve = waiter;
    if (!resolve) return;
    waiter = undefined;
    clearTimeout(waiterTimer);
    resolve(messages);
}

export interface CommandResult {
    ok: boolean;
    data: unknown;
    error?: string;
}

// The result of one of our own commands goes back to its caller, never into the inbox
function deliver(message: HubMessage) {
    const resolve = message.type === "result" ? asked.get(message.id) : undefined;
    if (!resolve) return push(message);
    asked.delete(message.id);
    resolve({ ok: message.ok === true, data: message.data ?? null, error: message.error });
}

function push(message: HubMessage) {
    if (inbox.length >= MAX_WAITING) inbox.shift();
    inbox.push(message);
    if (waiter) release(takeInbox());
}

function takeInbox() {
    const messages = inbox;
    inbox = [];
    return messages;
}

export function start(_: IpcMainInvokeEvent, version: string, commands: string[], topics: string[]) {
    hub?.stop();
    inbox = [];
    hub = connectHub({
        app: "maska",
        name: "Maska",
        version: String(version),
        commands: commands.map(String),
        topics: topics.map(String),
        onMessage: deliver,
        // without the hub nobody is connected: the plugin hears it as an empty hub.apps
        onStatus(online) {
            if (!online) push({ type: "state", topic: "hub.apps", data: null });
        }
    });
}

export function stop(_: IpcMainInvokeEvent) {
    hub?.stop();
    hub = undefined;
    inbox = [];
    release([]);
}

export function state(_: IpcMainInvokeEvent, topic: string, data: unknown) {
    if (typeof topic === "string" && topic.startsWith("maska.")) hub?.state(topic, data);
}

export function result(_: IpcMainInvokeEvent, id: unknown, to: string, ok: boolean, data: unknown, error?: string) {
    hub?.send({ type: "result", id, to, ok: ok === true, data: data ?? null, error });
}

// A command to another dev.txt app; resolves with its result, or with "timeout" when none comes in time
export function request(_: IpcMainInvokeEvent, to: string, name: string, args: unknown, timeout = 5000): Promise<CommandResult> {
    const link = hub;
    if (!link?.online) return Promise.resolve({ ok: false, data: null, error: "timeout" });
    const id = `maska-${++commandId}`;
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            asked.delete(id);
            resolve({ ok: false, data: null, error: "timeout" });
        }, Math.min(Number(timeout) || 5000, 60000));
        asked.set(id, result => {
            clearTimeout(timer);
            resolve(result);
        });
        link.send({ type: "command", id, to: String(to), name: String(name), args: args ?? {} });
    });
}

// Windows reads an .ico only from a file; the png inside it is the fallback
function maskaIcon() {
    if (icon) return icon;
    const data = Buffer.from(MASKA_ICO, "base64");
    try {
        const file = join(app.getPath("userData"), "maska.ico");
        writeFileSync(file, data);
        icon = nativeImage.createFromPath(file);
    } catch { }
    if (!icon || icon.isEmpty()) {
        // the last entry of the .ico is the 256 px png
        const entry = 6 + (data.readUInt16LE(4) - 1) * 16;
        const start = data.readUInt32LE(entry + 12);
        icon = nativeImage.createFromBuffer(data.subarray(start, start + data.readUInt32LE(entry + 8)));
    }
    return icon;
}

function applyIcon(win: BrowserWindow) {
    const image = maskaIcon();
    if (!win.isDestroyed() && !image.isEmpty()) win.setIcon(image);
}

// The maska icon on Discord's windows, now and for the ones opened later. Off only takes effect after a restart
export function setIcon(_: IpcMainInvokeEvent, on: boolean) {
    iconOn = on === true;
    if (iconOn) BrowserWindow.getAllWindows().forEach(applyIcon);
}

// Resolves as soon as the hub has passed something on (a command, hub.theme), or empty after 25 seconds
export function wait(_: IpcMainInvokeEvent): Promise<HubMessage[]> {
    // a page that was reloaded never comes back for its answer: only the newest request is served
    release([]);
    if (inbox.length) return Promise.resolve(takeInbox());
    return new Promise(resolve => {
        waiter = resolve;
        waiterTimer = setTimeout(() => release([]), HOLD_MS);
    });
}

app.on("will-quit", () => hub?.stop());
app.on("browser-window-created", (_, win) => {
    if (iconOn) applyIcon(win);
});
