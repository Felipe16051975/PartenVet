/**
 * api.js — Wrapper centralizado para peticiones al backend
 */

const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Error ${response.status}`);
    }

    return data;
}
