import { settings } from "../index";

const questPills = new Map<string, HTMLElement>();
let pillContainer: HTMLElement | null = null;

function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function getPillContainer(): HTMLElement {
    const existing = document.getElementById("vc-pill-container");
    if (existing) {
        pillContainer = existing;
        return existing;
    }
    if (!pillContainer || !document.body.contains(pillContainer)) {
        pillContainer = document.createElement("div");
        pillContainer.id = "vc-pill-container";
        pillContainer.className = "vc-pill-container";
        document.body.appendChild(pillContainer);
    }
    return pillContainer;
}

function closePillElement(el: HTMLElement, delay = 900) {
    if (el.classList.contains("hiding")) return;
    el.classList.add("hiding");
    setTimeout(() => el.remove(), delay);
}

export function createQuestPill(questId: string, title: string): void {
    // Top HUD removed per user request - progress is handled by bottom floating HUD
    const container = document.getElementById("vc-pill-container");
    if (container) container.remove();
}

export function updateQuestPill(questId: string, body?: string, percent?: number): void {
    // Top HUD removed
}

export function completeQuestPill(questId: string, message: string, success: boolean): void {
    // Top HUD removed
}

export function removeQuestPill(questId: string): void {
    const container = document.getElementById("vc-pill-container");
    if (container) container.remove();
}

function showPillSlideMessage(questId: string, message: string, type: "success" | "info" | "error" | "cancel"): void {
    const row = questPills.get(questId);
    if (!row) {
        showSubPill("", message, type);
        return;
    }

    const existing = row.querySelector(".quest-pill-slide");
    if (existing) {
        closePillElement(existing as HTMLElement, 400);
    }

    const icons: Record<string, string> = { success: "✓", error: "✕", info: "⚡", cancel: "✕" };

    const slide = document.createElement("div");
    slide.className = "quest-pill-slide";

    slide.innerHTML = `
        <div class="quest-pill-slide-icon ${type}">${icons[type]}</div>
        <span class="quest-pill-slide-text">${escapeHtml(message)}</span>
    `;

    row.appendChild(slide);

    const baseDuration = (settings.store.notificationDuration ?? 4) * 1000;
    const duration = baseDuration;
    setTimeout(() => {
        if (slide.parentElement) {
            closePillElement(slide, 400);
        }
    }, duration);
}

function showSubPill(title: string, body: string, type: "success" | "info" | "error" | "cancel"): void {
    const container = getPillContainer();

    const existingPills = container.querySelectorAll(".quest-sub-pill:not(.hiding)");
    if (existingPills.length > 4) {
        const oldest = existingPills[0] as HTMLElement;
        closePillElement(oldest, 500);
    }

    const icons: Record<string, string> = { success: "✓", error: "✕", info: "⚡", cancel: "✕" };
    const baseDuration = (settings.store.notificationDuration ?? 4) * 1000;
    const duration = baseDuration;

    const pill = document.createElement("div");
    pill.className = `quest-sub-pill ${type}`;

    pill.innerHTML = `
        <div class="quest-sub-pill-icon ${type}">${icons[type]}</div>
        <div class="quest-sub-pill-content">
            ${title ? `<div class="quest-sub-pill-title">${escapeHtml(title)}</div>` : ""}
            ${body ? `<div class="quest-sub-pill-body">${escapeHtml(body)}</div>` : ""}
        </div>
    `;

    container.appendChild(pill);

    setTimeout(() => {
        closePillElement(pill, 500);
    }, duration);
}

export function notify(title: string, body: string, type: "success" | "info" | "error" | "cancel" = "info", questId?: string): void {
    try {
        if (!settings.store.showNotifications) return;

        if (questId && questPills.has(questId)) {
            showPillSlideMessage(questId, body, type);
        } else {
            showSubPill(title, body, type);
        }
    } catch (error) {
        console.error("[QuestAutoComplete] Notification error:", error);
    }
}

export function cleanupAllPills(): void {
    questPills.forEach((row) => {
        try { row.remove(); } catch (e) {}
    });
    questPills.clear();

    const container = document.getElementById("vc-pill-container");
    if (container) {
        container.querySelectorAll(".quest-pill-row, .quest-sub-pill").forEach(el => el.remove());
        if (container.children.length === 0) container.remove();
    }
    pillContainer = null;
}
