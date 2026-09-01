/**
 * Pratinjau lokal LessonLen v2.
 * Menyusun template seperti HtmlService.include, tanpa Google.
 * Backend-nya js_mock.html (data di memori peramban).
 *
 *   node preview-server.js
 */
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = Number(process.env.PORT || 3000);

function include(nama) {
  return fs.readFileSync(path.join(ROOT, nama + '.html'), 'utf8');
}

function indexHtml() {
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<\?= appNama \?>/g, 'LessonLen');
  html = html.replace(/<\?= appVersi \?>/g, '2.0.0');
  html = html.replace(/<\?= appIkon \?>/g, '\uD83C\uDF31');
  html = html.replace(/<\?!= include\('([^']+)'\); \?>/g, function (_, n) {
    return include(n);
  });
  return html;
}

var server = http.createServer(function (req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  /* Jangan pasang X-Frame-Options — pratinjau Arena dibuka di iframe. */
  try {
    res.end(indexHtml());
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e && e.stack || e));
  }
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('LessonLen v2 pratinjau di http://0.0.0.0:' + PORT);
});
