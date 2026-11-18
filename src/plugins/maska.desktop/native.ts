/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, IpcMainInvokeEvent } from "electron";

import { connectHub, HubMessage } from "./hub";

// The hub link lives here, in Discord's main process: Discord's pages may not open connections to this computer
// themselves. The plugin (renderer) says things through start/state/result and hears things through wait.

const HOLD_MS = 25000;
const MAX_WAITING = 100;

let hub: ReturnType<typeof connectHub> | undefined;
let inbox: HubMessage[] = [];
let waiter: ((messages: HubMessage[]) => void) | undefined;
let waiterTimer: ReturnType<typeof setTimeout> | undefined;

function release(messages: HubMessage[]) {
    const resolve = waiter;
    if (!resolve) return;
    waiter = undefined;
    clearTimeout(waiterTimer);
    resolve(messages);
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
        onMessage(message) {
            if (inbox.length >= MAX_WAITING) inbox.shift();
            inbox.push(message);
            if (waiter) release(takeInbox());
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
