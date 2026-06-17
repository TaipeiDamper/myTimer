import { buildEdgeMeta } from '../core/geometry.js';

export function pointKey(pt) {
    return `${pt.col},${pt.row}`;
}

export function invalidateCustomEdgeMeta(session) {
    session.customEdgeMeta = null;
}

export function getCustomEdgeMeta(session, settings) {
    const count = Math.max(session.customPoints.length, 1);
    if (!session.customEdgeMeta || session.customEdgeMeta.length !== count) {
        session.customEdgeMeta = buildEdgeMeta(count, settings.edgeType);
    }
    return session.customEdgeMeta;
}

export function saveCurrentCustomPolygon(session, settings) {
    if (session.customPoints.length < 3) return false;
    session.customDrafts.push({
        vertices: session.customPoints.map(pt => ({ ...pt })),
        edgeMeta: getCustomEdgeMeta(session, settings).map(edge => ({ ...edge }))
    });
    session.customPoints = [];
    session.customEdgeMeta = null;
    session.ghostPoint = null;
    return true;
}

export function collectCustomPolygonsForPractice(session) {
    return session.customDrafts.map(draft => ({
        vertices: draft.vertices,
        edgeMeta: draft.edgeMeta
    }));
}

export function getCustomPreviewPolygons(session) {
    return session.customDrafts.map(draft => ({
        vertices: draft.vertices,
        edgeMeta: draft.edgeMeta
    }));
}

/**
 * @returns {{ type: 'close'|'undo'|'add'|'noop', status?: string }}
 */
export function handleCustomGridClick(session, pt) {
    const key = pointKey(pt);
    const selectedKeys = session.customPoints.map(pointKey);

    if (selectedKeys.length >= 3 && pointKey(session.customPoints[0]) === key) {
        return { type: 'close' };
    }

    if (selectedKeys.length > 0 && pointKey(session.customPoints[session.customPoints.length - 1]) === key) {
        session.customPoints.pop();
        invalidateCustomEdgeMeta(session);
        return {
            type: 'undo',
            status: session.customPoints.length
                ? `已撤銷 — 目前 ${session.customPoints.length} 個頂點`
                : '自訂模式 — 點選格子交叉點'
        };
    }

    if (selectedKeys.includes(key)) {
        if (pointKey(session.customPoints[0]) === key && session.customPoints.length >= 3) {
            return { type: 'close' };
        }
        return { type: 'noop' };
    }

    session.customPoints.push({ ...pt });
    invalidateCustomEdgeMeta(session);
    return {
        type: 'add',
        status: `已選 ${session.customPoints.length} 個頂點`
    };
}

/**
 * @returns {string|null} status message if something was cleared
 */
export function clearLastCustom(session) {
    if (session.customPoints.length > 0) {
        session.customPoints = [];
        session.customEdgeMeta = null;
        session.ghostPoint = null;
        return session.customDrafts.length
            ? `已清除目前選點 — 已儲存 ${session.customDrafts.length} 個多邊形`
            : '自訂模式 — 點選格子交叉點';
    }
    if (session.customDrafts.length > 0) {
        session.customDrafts.pop();
        return session.customDrafts.length
            ? `已刪除上一個多邊形 — 目前共 ${session.customDrafts.length} 個`
            : '自訂模式 — 點選格子交叉點';
    }
    return null;
}

export function isGridLocked(state) {
    return state.phase === 'timing'
        || state.phase === 'revealed'
        || (state.mode === 'custom' && (state.customPoints.length > 0 || state.customDrafts.length > 0));
}
