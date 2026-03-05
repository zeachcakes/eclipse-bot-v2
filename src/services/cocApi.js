const BASE_URL = 'https://api.clashofclans.com/v1';

class CocApiService {
  constructor(token) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
  }

  async #get(endpoint) {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers: this.headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.message ?? res.statusText;
      throw new Error(`CoC API [${res.status}]: ${message}`);
    }
    return res.json();
  }

  getClan(tag) {
    return this.#get(`/clans/${encodeURIComponent(tag)}`);
  }

  getPlayer(tag) {
    return this.#get(`/players/${encodeURIComponent(tag)}`);
  }

  getClanMembers(tag) {
    return this.#get(`/clans/${encodeURIComponent(tag)}/members`);
  }
}

module.exports = new CocApiService(process.env.COC_API_TOKEN);
