// deno-lint-ignore-file
import { Config } from './src/type/types.ts'
import { getOrgList, getRepoList, getToken, getUser, isCollaborator } from './src/utils/ghapi.ts'
import { create, verify, createApp, serveStatic } from './deps.ts'

const PATH = Deno.cwd()
const PORT = Number(Deno.env.get('PORT')) || 8080
const JWT_KEY = Math.random().toString(36).substr(2, 5)

const app = createApp()
const config: Config = JSON.parse(Deno.readTextFileSync(PATH + '/config.json'))

app.get('/', (req) => req.redirect('/index.html'))
app.get('/config', (req) => {
  req.respond({
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      client_id: config.client_id,
      redirect_uri: config.redirect_uri,
      scope: config.scope.join(' ')
    })
  })
})

app.get('/oauth', async (req) => {
  const code = req.query.get('code')
  if (!code) return req.redirect('/')

  const token = await getToken(code, config)
  if (!token) return req.redirect('/')

  const jwt = await create({ alg: 'HS512', typ: 'JWT' }, { token }, JWT_KEY)
  req.setCookie('token', jwt)
  req.redirect('/')
})

app.ws('/ws', async (socket, req) => {
  const jwt = req.query.get('token')
  if (!jwt) return socket.send(JSON.stringify({ finished: true, error: true }))

  socket.send(JSON.stringify({ finished: false, message: 'verifing jwt token...' }))
  const jwtBody = await verify(jwt, JWT_KEY, 'HS512').catch(() => socket.send(JSON.stringify({ finished: true, error: true })))

  if (!jwtBody) return
  if (!jwtBody.token) return

  const token = jwtBody.token as string

  socket.send(JSON.stringify({ finished: false, message: 'getting user infomations...' }))
  const user = await getUser(token)

  socket.send(JSON.stringify({ finished: false, message: 'getting provided organizations...' }))
  const userOrgs = await getOrgList(token)

  socket.send(JSON.stringify({ finished: false, message: 'getting public/private repositories...' }))
  const userRepos = await getRepoList(token)

  socket.send(JSON.stringify({ finished: false, message: 'getting public organization memberships...' }))
  const userPubOrgs = await getOrgList(token, user.login)

  socket.send(JSON.stringify({ finished: false, message: 'filtering repositories...' }))
  const data = {
    fork: userRepos.filter((repo) => user.login === repo.owner.login && repo.fork && !repo.private),
    public: userRepos.filter((repo) => user.login === repo.owner.login && !repo.fork && !repo.private),
    private: userRepos.filter((repo) => user.login === repo.owner.login && repo.private),
    collabo: userRepos.filter((repo) => user.login !== repo.owner.login),
  }

  const organizations = {
    public: userPubOrgs,
    private: userOrgs.filter((org) => !userPubOrgs.find((pubOrg) => pubOrg.login === org.login)),
  }

  const orgRepos: { public: any[], private: any[] } = {
    public: [],
    private: []
  }

  for (const organization of organizations.public) {
    socket.send(JSON.stringify({ finished: false, message: 'getting repositories of ' + organization.login + '...', data: getData() }))
    const repos = await getRepoList(token, organization.login)

    for (const repo of repos) {
      socket.send(JSON.stringify({ finished: false, message: 'checking commit histories of ' + repo.full_name + '...', data: getData() }))
      const isCollabo = await isCollaborator(repo.full_name, user.login, token)
      if (!isCollabo) continue

      orgRepos.public.push(repo)
    }
  }

  for (const organization of organizations.private) {
    socket.send(JSON.stringify({ finished: false, message: 'getting repositories of ' + organization.login + '...', data: getData() }))
    const repos = await getRepoList(token, organization.login)

    for (const repo of repos) {
      socket.send(JSON.stringify({ finished: false, message: 'checking collaborator list of ' + repo.full_name + '...', data: getData() }))
      const isCollabo = await isCollaborator(repo.full_name, user.login, token)
      if (!isCollabo) continue

      orgRepos.private.push(repo)
    }
  }

  socket.send(JSON.stringify({ finished: true, data: getData() }))

  function getData () {
    return {
      size: {
        fork: data.fork.length,
        public: data.public.length,
        private: data.private.length,
        collabo: data.collabo.length,
        orgPublic: orgRepos.public.length,
        orgPrivate: orgRepos.private.length
      },
      stars: {
        fork: data.fork.reduce((prev, curr) => prev + curr.stargazers_count, 0),
        public: data.public.reduce((prev, curr) => prev + curr.stargazers_count, 0),
        private: data.private.reduce((prev, curr) => prev + curr.stargazers_count, 0),
        collabo: data.collabo.reduce((prev, curr) => prev + curr.stargazers_count, 0),
        orgPublic: orgRepos.public.reduce((prev: number, curr: { stargazers_count: number }) => prev + curr.stargazers_count, 0),
        orgPrivate: orgRepos.private.reduce((prev: number, curr: { stargazers_count: number }) => prev + curr.stargazers_count, 0)
      }
    }
  }
})

app.use(serveStatic(PATH + '/public'))
app.listen({ port: PORT })
console.log('Server is now on http://localhost:' + PORT)
