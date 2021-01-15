import { Config } from '../type/types.ts'
import { ACCEPT, OAUTH_BASEURL, API_BASEURL, USER_AGENT } from '../constant/const.ts'

async function _fetch (url: string, token: string) {
  return await fetch (API_BASEURL + url, {
    method: 'GET',
    headers: new Headers({
      Accept: ACCEPT,
      'User-Agent': USER_AGENT,
      Authorization: 'token ' + token
    })
  }).then((res) => res.json())
}

export async function getToken (code: string, config: Config): Promise<string | undefined> {
  const url = new URL(OAUTH_BASEURL + '/access_token')

  url.searchParams.append('code', code)
  url.searchParams.append('client_id', config.client_id)
  url.searchParams.append('redirect_uri', config.redirect_uri)
  url.searchParams.append('client_secret', config.client_secret)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: new Headers({ 'Accept': ACCEPT, 'User-Agent': USER_AGENT })
  }).then((res) => res.json())

  return response.access_token
}

export const getUser = async (token: string) => await _fetch('/user', token)

export async function getRepoList (token: string, orgName?: string) {
  const url = new URL(API_BASEURL + (orgName ? '/orgs/' + orgName + '/repos' : '/user/repos'))

  url.searchParams.append('type', 'all')
  url.searchParams.append('per_page', '100')

  const repos = []
  let finished = false, page = 1

  while (!finished) {
    url.searchParams.set('page', String(page))
    const res = await _fetch(url.pathname + url.search, token)
    if (res.length < 1) finished = true
    repos.push(...res)
    page++
  }

  return repos
}

export async function getOrgList (token: string, username?: string) {
  const url = new URL(API_BASEURL + (username ? '/users/' + username + '/orgs' : '/user/orgs'))

  url.searchParams.append('per_page', '100')

  const orgs = []
  let finished = false, page = 1

  while (!finished) {
    url.searchParams.set('page', String(page))
    const res = await _fetch(url.pathname + url.search, token)
    if (res.length < 1) finished = true
    orgs.push(...res)
    page++
  }

  return orgs
}

export async function isCollaborator (repofullname: string, username: string, token: string) {
  const url = new URL(API_BASEURL + '/repos/' + repofullname + '/collaborators/' + username)
  try {
    await _fetch(url.pathname, token)
    return true
  } catch (_) {
    return false
  }
}
