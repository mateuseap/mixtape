async function request(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export function fetchTracks() {
  return request('/api/tracks');
}

export function uploadTrack(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/tracks', { method: 'POST', body: formData });
}

export function deleteTrack(id) {
  return request(`/api/tracks/${id}`, { method: 'DELETE' });
}

export function streamUrl(id) {
  return `/api/tracks/${id}/stream`;
}
