const path = require('path');
const http = require('http');

const Koa = require('koa');
const KoaStatic = require('koa-static');
const KoaRouter = require('koa-router');
const KoaEJS = require('koa-ejs');
const KoaLogger = require('koa-logger');

const Signaling = require('./signaling.js');

const app = new Koa();
const server = http.createServer(app.callback());

Signaling(server);

const router = new KoaRouter();
const PATH_STATIC = path.resolve(__dirname, 'public');
const PATH_VIEW = path.resolve(__dirname, 'view');
const PORT = 12001;

router.get('/p2p', async (ctx) => {
  await ctx.render('p2p');
});

router.get('/o2m', async (ctx) => {
  await ctx.render('o2m');
});
router.get('/live', async (ctx) => {
  await ctx.render('live');
});

KoaEJS(app, {
  root: PATH_VIEW,
  layout: 'template',
  viewExt: 'html',
  cache: false,
  debug: false,
});

app
  .use(KoaLogger())
  .use(KoaStatic(PATH_STATIC))
  .use(router.routes())
  .use(router.allowedMethods());

server.listen(PORT, '0.0.0.0', () => {
  console.log('http://0.0.0.0:' + PORT);
});
