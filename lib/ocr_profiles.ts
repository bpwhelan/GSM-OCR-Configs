// Versioned public contract. Also shipped in GSM-OCR-Configs/lib; keep it dependency-free.
export const OCR_PROFILE_REPOSITORY = 'bpwhelan/GSM-OCR-Configs';
export const OCR_PROFILE_URL = `https://github.com/${OCR_PROFILE_REPOSITORY}`;
export const MAX_PROFILE_BYTES = 32_768;
export const OCR_PROFILE_MARKER = '<!-- gsm-ocr-profile:v1 -->';
export const OCR_VERIFICATION_MARKER = '<!-- gsm-ocr-verification:v1 -->';
export const OCR_ENGINES = ['glens', 'bing', 'oneocr', 'screenai', 'meikiocr', 'meiki_text_detector', 'gemini', 'gvision', 'azure', 'ocrspace', 'local_llm_ocr', 'alivetext', 'mlkitocr'] as const;
export const OCR_PLATFORMS = ['windows', 'macos', 'linux', 'emulator', 'console'] as const;

export interface Resolution { width: number; height: number }
export interface PortableOcrArea {
    coordinates: [number, number, number, number];
    is_excluded: boolean;
    is_secondary: boolean;
    is_exclusive: boolean;
    is_black_hole: boolean;
}
export interface SharedOcrSettings {
    scanRate?: number;
    base_scale?: number;
    furigana_filter_sensitivity?: number;
    ocr1?: string;
    ocr2?: string;
    twoPassOCR?: boolean;
    optimize_second_scan?: boolean;
}
export interface OcrProfile {
    schemaVersion: 1;
    name: string;
    game: { title: string; executableNames: string[]; platform: typeof OCR_PLATFORMS[number]; language: string };
    notes: string;
    resolution: Resolution;
    areas: PortableOcrArea[];
    settings?: SharedOcrSettings;
}
export interface OcrCatalogEntry {
    id: string;
    revision: string;
    author: string;
    issueNumber: number;
    updatedAt: string;
    profile: OcrProfile;
    verification: { works: number; needsWork: number };
}
export interface OcrCatalog { schemaVersion: 1; generatedAt: string; profiles: OcrCatalogEntry[] }
export interface OcrVerification {
    schemaVersion: 1;
    profileId: string;
    revision: string;
    result: 'works' | 'needsWork';
    resolution: Resolution;
    settingsApplied: boolean;
    notes: string;
}
export interface OcrCommunityContext {
    scene: { id: string; name: string };
    executableName: string;
    resolution: Resolution | null;
    areas: PortableOcrArea[];
    canShare: boolean;
    settings: SharedOcrSettings;
    language: string;
    platform: OcrProfile['game']['platform'];
    installed: { id: string; revision: string; name: string; settingsApplied: boolean } | null;
}
export class OcrProfileError extends Error {
    code: string;
    constructor(code = 'invalidProfile') { super(code); this.code = code; }
}
function invalid(): never { throw new OcrProfileError(); }
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = true): string {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) invalid();
    const result = value.trim();
    if (required && !result) invalid();
    return result;
}
function number(value: unknown, min: number, max: number, integer = false): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid();
    return value;
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') invalid(); return value; }
export function parseResolution(value: unknown): Resolution {
    const data = object(value);
    return { width: number(data.width, 1, 16_384, true), height: number(data.height, 1, 16_384, true) };
}
export function aspectRatio(size: Resolution): string {
    let a = size.width, b = size.height;
    while (b) [a, b] = [b, a % b];
    return a ? `${size.width / a}:${size.height / a}` : '';
}
function parseAreas(value: unknown): PortableOcrArea[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64) invalid();
    return value.map((raw) => {
        const area = object(raw);
        if (!Array.isArray(area.coordinates) || area.coordinates.length !== 4) invalid();
        const [x, y, w, h] = area.coordinates.map((n) => number(n, 0, 1));
        if (w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001) invalid();
        return {
            coordinates: [x, y, w, h],
            is_excluded: area.is_excluded === undefined ? false : bool(area.is_excluded),
            is_secondary: area.is_secondary === undefined ? false : bool(area.is_secondary),
            is_exclusive: area.is_exclusive === undefined ? false : bool(area.is_exclusive),
            is_black_hole: area.is_black_hole === undefined ? false : bool(area.is_black_hole),
        };
    });
}
export function sharedOcrSettings(value: unknown): SharedOcrSettings {
    const data = object(value);
    const result: SharedOcrSettings = {};
    if (data.scanRate !== undefined) result.scanRate = number(data.scanRate, 0.05, 60);
    if (data.base_scale !== undefined) result.base_scale = number(data.base_scale, 0.5, 1);
    if (data.furigana_filter_sensitivity !== undefined) result.furigana_filter_sensitivity = number(data.furigana_filter_sensitivity, 0, 100, true);
    for (const key of ['ocr1', 'ocr2'] as const) {
        if (data[key] !== undefined) {
            const engine = text(data[key], 40);
            if (!(OCR_ENGINES as readonly string[]).includes(engine)) invalid();
            result[key] = engine;
        }
    }
    if (data.twoPassOCR !== undefined) result.twoPassOCR = bool(data.twoPassOCR);
    if (data.optimize_second_scan !== undefined) result.optimize_second_scan = bool(data.optimize_second_scan);
    return result;
}
export function parseOcrProfile(value: unknown): OcrProfile {
    const data = object(value);
    if (data.schemaVersion !== 1) invalid();
    const game = object(data.game);
    if (!Array.isArray(game.executableNames) || game.executableNames.length > 12) invalid();
    const executables = [...new Set(game.executableNames.map((item) => {
        const name = text(item, 128);
        if (/[\\/:\r\n]/u.test(name) || name === '.' || name === '..') invalid();
        return name;
    }))];
    if (!(OCR_PLATFORMS as readonly unknown[]).includes(game.platform)) invalid();
    const result: OcrProfile = {
        schemaVersion: 1,
        name: text(data.name, 100),
        game: { title: text(game.title, 160), executableNames: executables, platform: game.platform as OcrProfile['game']['platform'], language: text(game.language, 32) },
        notes: text(data.notes ?? '', 3000, false),
        resolution: parseResolution(data.resolution),
        areas: parseAreas(data.areas),
    };
    if (data.settings !== undefined) result.settings = sharedOcrSettings(data.settings);
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_PROFILE_BYTES) invalid();
    return result;
}
export function portableAreas(value: unknown, resolution: Resolution): PortableOcrArea[] {
    const config = object(value);
    if (!['percentage', 'absolute', 'pixels'].includes(String(config.coordinate_system))) invalid();
    if (!Array.isArray(config.rectangles)) invalid();
    if (config.coordinate_system === 'percentage') return parseAreas(config.rectangles);
    const size = parseResolution(resolution);
    return parseAreas(config.rectangles.map((value) => {
        const area = object(value);
        if (!Array.isArray(area.coordinates) || area.coordinates.length !== 4) invalid();
        return { ...area, coordinates: area.coordinates.map((n, i) => number(n, 0, 16_384) / (i % 2 ? size.height : size.width)) };
    }));
}
export function applySharedOcrSettings<T extends object>(current: T, settings: SharedOcrSettings | undefined, apply: boolean): T & SharedOcrSettings & { advancedMode?: boolean; scanRate_advanced?: number; ocr1_advanced?: string; ocr2_advanced?: string } {
    if (apply !== true || !settings) return { ...current };
    const patch = sharedOcrSettings(settings);
    const currentValues = current as Record<string, unknown>;
    const selectsAdvancedMode = !!(patch.ocr1 || patch.ocr2 || patch.scanRate !== undefined);
    const firstEngine = patch.ocr1 ?? currentValues.ocr1;
    const secondEngine = patch.ocr2 ?? currentValues.ocr2;
    const scanRate = patch.scanRate ?? currentValues.scanRate;
    return {
        ...current, ...patch,
        // Advanced mode keeps shared engines and scan rate effective after renderer saves.
        ...(selectsAdvancedMode ? { advancedMode: true } : {}),
        ...(selectsAdvancedMode && typeof firstEngine === 'string' ? { ocr1_advanced: firstEngine } : {}),
        ...(selectsAdvancedMode && typeof secondEngine === 'string' ? { ocr2_advanced: secondEngine } : {}),
        ...(selectsAdvancedMode && typeof scanRate === 'number' ? { scanRate_advanced: scanRate } : {}),
    };
}
function revision(value: unknown): string {
    const result = text(value, 64);
    if (!/^[a-f0-9]{64}$/.test(result)) invalid();
    return result;
}
function profileId(value: unknown): string {
    const result = text(value, 30);
    if (!/^profile-[1-9][0-9]*$/.test(result)) invalid();
    return result;
}
function date(value: unknown): string {
    const result = text(value, 40);
    if (!Number.isFinite(Date.parse(result))) invalid();
    return result;
}
export function parseOcrCatalog(value: unknown): OcrCatalog {
    const data = object(value);
    if (data.schemaVersion !== 1 || !Array.isArray(data.profiles) || data.profiles.length > 10_000) invalid();
    const ids = new Set<string>();
    return { schemaVersion: 1, generatedAt: date(data.generatedAt), profiles: data.profiles.map((value) => {
        const entry = object(value), verification = object(entry.verification);
        const id = profileId(entry.id), issueNumber = number(entry.issueNumber, 1, Number.MAX_SAFE_INTEGER, true);
        if (id !== `profile-${issueNumber}` || ids.has(id)) invalid();
        ids.add(id);
        const author = text(entry.author, 39);
        if (!/^[a-zA-Z0-9-]+$/.test(author)) invalid();
        return { id, issueNumber, author, revision: revision(entry.revision), updatedAt: date(entry.updatedAt), profile: parseOcrProfile(entry.profile), verification: { works: number(verification.works, 0, 1_000_000, true), needsWork: number(verification.needsWork, 0, 1_000_000, true) } };
    }) };
}
export function parseOcrVerification(value: unknown): OcrVerification {
    const data = object(value);
    if (data.schemaVersion !== 1 || !['works', 'needsWork'].includes(String(data.result))) invalid();
    return { schemaVersion: 1, profileId: profileId(data.profileId), revision: revision(data.revision), result: data.result as OcrVerification['result'], resolution: parseResolution(data.resolution), settingsApplied: bool(data.settingsApplied), notes: text(data.notes ?? '', 1500, false) };
}
export function searchOcrProfiles(entries: OcrCatalogEntry[], query: string): OcrCatalogEntry[] {
    const normalized = query.normalize('NFKC').toLocaleLowerCase().trim();
    const tokens = normalized.split(/\s+/u).filter(Boolean);
    return entries.map((entry) => {
        const { profile } = entry;
        const haystack = [profile.name, profile.game.title, ...profile.game.executableNames, profile.notes, profile.game.platform, profile.game.language, aspectRatio(profile.resolution), `${profile.resolution.width}x${profile.resolution.height}`].join(' ').normalize('NFKC').toLocaleLowerCase();
        const executableMatch = profile.game.executableNames.some((name) => name.normalize('NFKC').toLocaleLowerCase() === normalized);
        return { entry, match: tokens.every((token) => haystack.includes(token)), score: (executableMatch ? 1_000_000 : 0) + entry.verification.works - entry.verification.needsWork };
    }).filter((item) => item.match).sort((a, b) => b.score - a.score || a.entry.profile.game.title.localeCompare(b.entry.profile.game.title)).map((item) => item.entry);
}
