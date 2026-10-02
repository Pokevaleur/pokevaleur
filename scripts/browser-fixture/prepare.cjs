// Rewrite only the disposable CI checkout, never the deployed application's config.
const fs = require('node:fs')
const assert = require('node:assert/strict')
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Fixture setup is restricted to disposable GitHub Actions runners')
const prod = 'https://zrvjbvhumyizutnjzljy.supabase.co'
for (const path of ['lib/supabase-config.js', 'middleware.js']) {
  const content = fs.readFileSync(path, 'utf8')
  assert(content.includes(prod), `Expected API configuration missing in ${path}`)
  fs.writeFileSync(path, content.replaceAll(prod, 'http://127.0.0.1:54321'))
}
const config = fs.readFileSync('next.config.js', 'utf8')
assert(config.includes("connect-src 'self'"))
fs.writeFileSync('next.config.js', config.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:54321"))
console.log('Disposable UI checkout now points to the local fixture service')
